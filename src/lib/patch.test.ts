import { describe, expect, it } from 'vitest';
import {
  createStore,
  defaultPatch,
  deserializePatch,
  isPatch,
  normalizePatch,
  PRESETS,
  type Patch,
} from './patch';

describe('defaultPatch / PRESETS', () => {
  it('既定値とプリセットはすべて正しい形', () => {
    expect(isPatch(defaultPatch())).toBe(true);
    for (const p of PRESETS) expect(isPatch(p.patch)).toBe(true);
  });
});

describe('deserializePatch', () => {
  it('保存して読み戻せる', () => {
    const json = JSON.stringify(defaultPatch());
    expect(deserializePatch(json)).toEqual(defaultPatch());
  });

  it('壊れた入力はnull', () => {
    expect(deserializePatch('{')).toBeNull();
    expect(deserializePatch('null')).toBeNull();
  });

  it('波形やフィルタ種別が不正ならnull', () => {
    const bad = { ...defaultPatch(), oscA: { ...defaultPatch().oscA, waveform: 'noise' } };
    expect(deserializePatch(JSON.stringify(bad))).toBeNull();
  });

  it('キーが欠けていればnull', () => {
    const partial: Record<string, unknown> = { ...defaultPatch() };
    delete partial.volume;
    expect(deserializePatch(JSON.stringify(partial))).toBeNull();
  });
});

describe('normalizePatch', () => {
  it('範囲外の数値を収める', () => {
    const wild: Patch = {
      ...defaultPatch(),
      noise: 5,
      volume: -3,
      oscA: { ...defaultPatch().oscA, octave: 9, detune: 999 },
      filter: { ...defaultPatch().filter, cutoff: 50000, resonance: 0 },
    };
    const n = normalizePatch(wild);
    expect(n.noise).toBe(1);
    expect(n.volume).toBe(0);
    expect(n.oscA.octave).toBe(2);
    expect(n.oscA.detune).toBe(50);
    expect(n.filter.cutoff).toBe(18000);
    expect(n.filter.resonance).toBeGreaterThan(0);
  });
});

describe('createStore', () => {
  it('localStorage越しに往復する', () => {
    const map = new Map<string, string>();
    const store = createStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    expect(store.load()).toBeNull();
    store.save(defaultPatch());
    expect(store.load()).toEqual(defaultPatch());
  });
});
