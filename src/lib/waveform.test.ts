import { describe, expect, it } from 'vitest';
import { defaultPatch } from './patch';
import { oscSample, renderCycle, toPath } from './waveform';

describe('oscSample', () => {
  it('正弦波は0から始まる', () => {
    expect(oscSample('sine', 0)).toBeCloseTo(0, 6);
    expect(oscSample('sine', 0.25)).toBeCloseTo(1, 6);
  });

  it('のこぎり波は-1から1への傾斜', () => {
    expect(oscSample('sawtooth', 0)).toBeCloseTo(-1, 6);
    expect(oscSample('sawtooth', 0.5)).toBeCloseTo(0, 6);
  });

  it('矩形波は前半1・後半-1', () => {
    expect(oscSample('square', 0.25)).toBe(1);
    expect(oscSample('square', 0.75)).toBe(-1);
  });

  it('三角波は0->1->0->-1->0', () => {
    expect(oscSample('triangle', 0)).toBeCloseTo(0, 6);
    expect(oscSample('triangle', 0.25)).toBeCloseTo(1, 6);
    expect(oscSample('triangle', 0.5)).toBeCloseTo(0, 6);
    expect(oscSample('triangle', 0.75)).toBeCloseTo(-1, 6);
  });

  it('位相は1周期で巻き戻る', () => {
    expect(oscSample('sine', 1.25)).toBeCloseTo(oscSample('sine', 0.25), 6);
  });
});

describe('renderCycle', () => {
  it('指定した点数を返し、値は-1..1に収まる', () => {
    const s = renderCycle(defaultPatch(), 128);
    expect(s).toHaveLength(128);
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(-1);
  });

  it('オクターブを上げると波数が増える(ゼロ交差が増える)', () => {
    const base = defaultPatch();
    const high = { ...base, oscB: { ...base.oscB, octave: 2, level: 0 } };
    const oscBoff = { ...base, oscB: { ...base.oscB, level: 0 } };
    expect(renderCycle(oscBoff).length).toBe(renderCycle(high).length);
  });
});

describe('toPath', () => {
  it('Mで始まる折れ線', () => {
    const path = toPath(renderCycle(defaultPatch(), 32), 200, 80);
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('L');
  });

  it('空入力は空文字', () => {
    expect(toPath([], 100, 50)).toBe('');
  });
});
