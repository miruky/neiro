import { describe, expect, it } from 'vitest';
import type { FilterSpec } from './patch';
import { biquadResponse, logFreqs, responsePath } from './filterResponse';

function filter(over: Partial<FilterSpec> = {}): FilterSpec {
  return { type: 'lowpass', cutoff: 1000, resonance: 1, envAmount: 0, ...over };
}

describe('biquadResponse', () => {
  it('ローパスは低域を通し高域を落とす', () => {
    const [low, high] = biquadResponse(filter({ type: 'lowpass' }), [100, 10000]);
    expect(low!).toBeGreaterThan(-3);
    expect(high!).toBeLessThan(-12);
  });

  it('ハイパスは高域を通し低域を落とす', () => {
    const [low, high] = biquadResponse(filter({ type: 'highpass' }), [100, 10000]);
    expect(low!).toBeLessThan(-12);
    expect(high!).toBeGreaterThan(-3);
  });

  it('バンドパスは遮断周波数付近が最も高い', () => {
    const f = filter({ type: 'bandpass', cutoff: 1000, resonance: 4 });
    const [below, at, above] = biquadResponse(f, [200, 1000, 6000]);
    expect(at!).toBeGreaterThan(below!);
    expect(at!).toBeGreaterThan(above!);
  });

  it('共鳴を上げると遮断周波数付近が持ち上がる', () => {
    const mild = biquadResponse(filter({ resonance: 0.7, cutoff: 1000 }), [1000])[0]!;
    const sharp = biquadResponse(filter({ resonance: 12, cutoff: 1000 }), [1000])[0]!;
    expect(sharp).toBeGreaterThan(mild);
  });
});

describe('logFreqs', () => {
  it('両端を含み単調増加', () => {
    const fs = logFreqs(20, 20000, 50);
    expect(fs[0]).toBeCloseTo(20, 3);
    expect(fs[fs.length - 1]).toBeCloseTo(20000, 0);
    for (let i = 1; i < fs.length; i++) expect(fs[i]!).toBeGreaterThan(fs[i - 1]!);
  });
});

describe('responsePath', () => {
  it('Mで始まる折れ線を返す', () => {
    const path = responsePath(filter(), { width: 280, height: 120 });
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('L');
  });
});
