// 音楽的に成り立ちやすい範囲でパッチをランダムに作る。乱数源を引数で差し替え
// られるようにして、テストでは決定的なシードから再現できるようにする。

import {
  normalizePatch,
  type FilterType,
  type LfoTarget,
  type Patch,
  type Waveform,
} from './patch';

/** 32bit シードから決定的な擬似乱数(0..1)を返す。テストと「種から再現」に使う */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const between = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo);
const intBetween = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));
/** 対数軸で均等に選ぶ。周波数のように桁で効くパラメータに使う */
const logBetween = (rng: Rng, lo: number, hi: number): number =>
  Math.exp(between(rng, Math.log(lo), Math.log(hi)));

const RICH: readonly Waveform[] = ['sawtooth', 'square', 'triangle'];
const SMOOTH: readonly Waveform[] = ['sine', 'triangle'];
const FILTERS: readonly FilterType[] = ['lowpass', 'lowpass', 'lowpass', 'bandpass', 'highpass'];
const TARGETS: readonly LfoTarget[] = ['pitch', 'filter', 'amplitude'];

/**
 * それらしく鳴る音色をランダムに組む。极端な無音や割れた音を避けるため、各値は
 * 控えめな範囲に収め、最後に normalizePatch で必ず正規の範囲へ収める。
 */
export function randomPatch(rng: Rng = Math.random): Patch {
  const lfoDepth = rng() < 0.5 ? 0 : between(rng, 0.05, 0.4);
  const patch: Patch = {
    oscA: {
      waveform: pick(rng, RICH),
      octave: intBetween(rng, -1, 1),
      detune: Math.round(between(rng, -12, 12)),
      level: between(rng, 0.55, 0.9),
    },
    oscB: {
      waveform: pick(rng, RICH),
      octave: intBetween(rng, -2, 1),
      detune: Math.round(between(rng, -12, 12)),
      level: between(rng, 0.3, 0.8),
    },
    noise: rng() < 0.7 ? 0 : between(rng, 0.02, 0.18),
    filter: {
      type: pick(rng, FILTERS),
      cutoff: Math.round(logBetween(rng, 300, 7000)),
      resonance: between(rng, 1, 12),
      envAmount: between(rng, 0, 0.85),
    },
    ampEnv: {
      attack: between(rng, 0.004, 0.6),
      decay: between(rng, 0.1, 1.1),
      sustain: between(rng, 0.25, 0.9),
      release: between(rng, 0.12, 1.6),
    },
    filterEnv: {
      attack: between(rng, 0.004, 0.5),
      decay: between(rng, 0.1, 1.0),
      sustain: between(rng, 0.1, 0.7),
      release: between(rng, 0.12, 1.4),
    },
    lfo: {
      waveform: pick(rng, SMOOTH),
      rate: between(rng, 0.2, 8),
      depth: lfoDepth,
      target: pick(rng, TARGETS),
    },
    volume: 0.8,
  };
  return normalizePatch(patch);
}
