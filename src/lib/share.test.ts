import { describe, expect, it } from 'vitest';
import { decodePatch, encodePatch, patchFromHash, patchToHash } from './share';
import { PRESETS, defaultPatch, type Patch } from './patch';

function expectClose(a: Patch, b: Patch): void {
  expect(a.oscA.waveform).toBe(b.oscA.waveform);
  expect(a.oscB.waveform).toBe(b.oscB.waveform);
  expect(a.filter.type).toBe(b.filter.type);
  expect(a.lfo.waveform).toBe(b.lfo.waveform);
  expect(a.lfo.target).toBe(b.lfo.target);
  expect(a.oscA.octave).toBe(b.oscA.octave);
  expect(a.oscA.level).toBeCloseTo(b.oscA.level, 2);
  expect(a.oscB.detune).toBeCloseTo(b.oscB.detune, 0);
  expect(a.filter.cutoff).toBeCloseTo(b.filter.cutoff, 0);
  expect(a.filter.resonance).toBeCloseTo(b.filter.resonance, 1);
  expect(a.filter.envAmount).toBeCloseTo(b.filter.envAmount, 2);
  expect(a.ampEnv.attack).toBeCloseTo(b.ampEnv.attack, 3);
  expect(a.ampEnv.release).toBeCloseTo(b.ampEnv.release, 3);
  expect(a.filterEnv.sustain).toBeCloseTo(b.filterEnv.sustain, 2);
  expect(a.lfo.rate).toBeCloseTo(b.lfo.rate, 2);
  expect(a.volume).toBeCloseTo(b.volume, 2);
}

describe('encodePatch / decodePatch', () => {
  it('既定の音色を往復しても保たれる', () => {
    const p = defaultPatch();
    const back = decodePatch(encodePatch(p));
    expect(back).not.toBeNull();
    expectClose(back as Patch, p);
  });

  it('すべてのプリセットを往復しても保たれる', () => {
    for (const { patch } of PRESETS) {
      const back = decodePatch(encodePatch(patch));
      expect(back).not.toBeNull();
      expectClose(back as Patch, patch);
    }
  });

  it('トークンに改行や空白を含まない', () => {
    const token = encodePatch(defaultPatch());
    expect(token).toMatch(/^[A-Za-z0-9-]+$/);
  });

  it('バージョンが違うトークンは拒否する', () => {
    const token = encodePatch(defaultPatch()).replace(/^A/, 'Z');
    expect(decodePatch(token)).toBeNull();
  });

  it('要素数が足りないトークンは拒否する', () => {
    expect(decodePatch('A-1-2-3')).toBeNull();
  });

  it('数値でない値を含むトークンは拒否する', () => {
    const parts = encodePatch(defaultPatch()).split('-');
    parts[5] = 'x';
    expect(decodePatch(parts.join('-'))).toBeNull();
  });

  it('列挙値が範囲外なら拒否する', () => {
    const parts = encodePatch(defaultPatch()).split('-');
    parts[1] = '99'; // oscA.waveform の添字
    expect(decodePatch(parts.join('-'))).toBeNull();
  });
});

describe('patchToHash / patchFromHash', () => {
  it('ハッシュ片を往復できる', () => {
    const p = PRESETS[1]?.patch ?? defaultPatch();
    const hash = patchToHash(p);
    expect(hash.startsWith('#p=')).toBe(true);
    const back = patchFromHash(hash);
    expect(back).not.toBeNull();
    expectClose(back as Patch, p);
  });

  it('他のパラメータが混ざっていても読める', () => {
    const p = defaultPatch();
    const back = patchFromHash(`#foo=1&p=${encodePatch(p)}&bar=2`);
    expect(back).not.toBeNull();
  });

  it('p が無いハッシュは null', () => {
    expect(patchFromHash('#about')).toBeNull();
    expect(patchFromHash('')).toBeNull();
  });
});
