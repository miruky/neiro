import { describe, expect, it } from 'vitest';
import type { Envelope } from './patch';
import { envelopePath, envelopePoints, levelAtHeld } from './adsr';

const env: Envelope = { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 };

describe('envelopePoints', () => {
  it('0から立ち上がり、頂点1、サステイン、0で終わる', () => {
    const pts = envelopePoints(env, 0.4);
    expect(pts[0]).toEqual({ t: 0, level: 0 });
    expect(pts[1]).toEqual({ t: 0.1, level: 1 });
    expect(pts[2]).toMatchObject({ level: 0.5 });
    expect(pts[pts.length - 1]?.level).toBe(0);
  });

  it('節点の時刻は単調非減少', () => {
    const pts = envelopePoints(env);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.t).toBeGreaterThanOrEqual(pts[i - 1]!.t);
    }
  });
});

describe('levelAtHeld', () => {
  it('押下直後は0、アタック中は上昇、ディケイ後はサステイン', () => {
    expect(levelAtHeld(env, 0)).toBe(0);
    expect(levelAtHeld(env, 0.05)).toBeCloseTo(0.5, 6);
    expect(levelAtHeld(env, 0.1)).toBeCloseTo(1, 6);
    expect(levelAtHeld(env, 1)).toBeCloseTo(env.sustain, 6);
  });

  it('ディケイの途中は1とサステインの間', () => {
    const v = levelAtHeld(env, 0.2);
    expect(v).toBeLessThan(1);
    expect(v).toBeGreaterThan(env.sustain);
  });
});

describe('envelopePath', () => {
  it('Mで始まる折れ線', () => {
    const path = envelopePath(env, 240, 90);
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('L');
  });
});
