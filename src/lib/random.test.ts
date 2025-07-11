import { describe, expect, it } from 'vitest';
import { mulberry32, randomPatch } from './random';
import { RANGE, isPatch } from './patch';

describe('mulberry32', () => {
  it('同じシードからは同じ列を返す', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('0..1 の範囲に収まる', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomPatch', () => {
  it('正規のパッチを返す', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = randomPatch(mulberry32(seed));
      expect(isPatch(p)).toBe(true);
    }
  });

  it('すべての値が定義された範囲に収まる', () => {
    const p = randomPatch(mulberry32(99));
    expect(p.oscA.octave).toBeGreaterThanOrEqual(RANGE.octave.min);
    expect(p.oscA.octave).toBeLessThanOrEqual(RANGE.octave.max);
    expect(p.filter.cutoff).toBeGreaterThanOrEqual(RANGE.cutoff.min);
    expect(p.filter.cutoff).toBeLessThanOrEqual(RANGE.cutoff.max);
    expect(p.lfo.depth).toBeGreaterThanOrEqual(RANGE.depth.min);
    expect(p.lfo.depth).toBeLessThanOrEqual(RANGE.depth.max);
  });

  it('同じシードからは同じ音色になる', () => {
    expect(randomPatch(mulberry32(42))).toEqual(randomPatch(mulberry32(42)));
  });

  it('異なるシードでは別の音色になる', () => {
    expect(randomPatch(mulberry32(1))).not.toEqual(randomPatch(mulberry32(2)));
  });

  it('オクターブは整数になる', () => {
    const p = randomPatch(mulberry32(3));
    expect(Number.isInteger(p.oscA.octave)).toBe(true);
    expect(Number.isInteger(p.oscB.octave)).toBe(true);
  });
});
