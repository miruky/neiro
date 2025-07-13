import { describe, expect, it } from 'vitest';
import { summarizePatch } from './describe';
import { defaultPatch, type Patch } from './patch';

describe('summarizePatch', () => {
  it('オシレータの波形とフィルタを言い表す', () => {
    const s = summarizePatch(defaultPatch());
    expect(s).toContain('のこぎり × 矩形');
    expect(s).toContain('ローパス');
  });

  it('カットオフを kHz / Hz で読みやすく丸める', () => {
    const p: Patch = { ...defaultPatch(), filter: { ...defaultPatch().filter, cutoff: 2200 } };
    expect(summarizePatch(p)).toContain('2.2 kHz');
    const low: Patch = { ...defaultPatch(), filter: { ...defaultPatch().filter, cutoff: 440 } };
    expect(summarizePatch(low)).toContain('440 Hz');
  });

  it('LFOの深さがあるときだけ行き先を添える', () => {
    const base = defaultPatch();
    expect(summarizePatch(base)).not.toContain('LFO');
    const withLfo: Patch = { ...base, lfo: { ...base.lfo, depth: 0.5, target: 'filter' } };
    expect(summarizePatch(withLfo)).toContain('LFO→フィルタ');
  });

  it('ノイズが入っているときだけ明記する', () => {
    const base = defaultPatch();
    expect(summarizePatch(base)).not.toContain('ノイズ');
    const noisy: Patch = { ...base, noise: 0.2 };
    expect(summarizePatch(noisy)).toContain('ノイズ入り');
  });
});
