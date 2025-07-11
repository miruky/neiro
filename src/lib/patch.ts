// シンセの音色(パッチ)の型・既定値・プリセットと、その検証・永続化。
// 音を鳴らす処理は engine.ts に分離し、ここは純粋なデータとして扱う。

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';
export type LfoTarget = 'pitch' | 'filter' | 'amplitude';

export interface OscSpec {
  waveform: Waveform;
  /** オクターブ移調(-2..2) */
  octave: number;
  /** 微細なずれ(セント、-50..50) */
  detune: number;
  /** ミックス量(0..1) */
  level: number;
}

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterSpec {
  type: FilterType;
  /** 遮断周波数(Hz) */
  cutoff: number;
  /** 共鳴(Q) */
  resonance: number;
  /** フィルタエンベロープの効き(-1..1) */
  envAmount: number;
}

export interface Lfo {
  waveform: Waveform;
  /** 速さ(Hz) */
  rate: number;
  /** 深さ(0..1) */
  depth: number;
  target: LfoTarget;
}

export interface Patch {
  oscA: OscSpec;
  oscB: OscSpec;
  /** ノイズのミックス量(0..1) */
  noise: number;
  filter: FilterSpec;
  ampEnv: Envelope;
  filterEnv: Envelope;
  lfo: Lfo;
  /** 音の太さを決めるマスター音量(0..1) */
  volume: number;
}

export const WAVEFORMS: readonly Waveform[] = ['sine', 'triangle', 'sawtooth', 'square'];
export const FILTER_TYPES: readonly FilterType[] = ['lowpass', 'highpass', 'bandpass'];
export const LFO_TARGETS: readonly LfoTarget[] = ['pitch', 'filter', 'amplitude'];

/** 各パラメータの取りうる範囲。UIのスライダと正規化のクランプに使う */
export const RANGE = {
  octave: { min: -2, max: 2 },
  detune: { min: -50, max: 50 },
  level: { min: 0, max: 1 },
  noise: { min: 0, max: 1 },
  cutoff: { min: 20, max: 18000 },
  resonance: { min: 0.1, max: 24 },
  envAmount: { min: -1, max: 1 },
  attack: { min: 0.001, max: 4 },
  decay: { min: 0.001, max: 4 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.001, max: 6 },
  rate: { min: 0.05, max: 20 },
  depth: { min: 0, max: 1 },
  volume: { min: 0, max: 1 },
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function defaultPatch(): Patch {
  return {
    oscA: { waveform: 'sawtooth', octave: 0, detune: -6, level: 0.8 },
    oscB: { waveform: 'square', octave: 0, detune: 6, level: 0.5 },
    noise: 0,
    filter: { type: 'lowpass', cutoff: 2200, resonance: 6, envAmount: 0.5 },
    ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.4 },
    filterEnv: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
    lfo: { waveform: 'sine', rate: 5, depth: 0, target: 'pitch' },
    volume: 0.8,
  };
}

export interface NamedPatch {
  name: string;
  patch: Patch;
}

/** 出発点になる作り込んだ音色。配線の効果が分かるように差をつけてある */
export const PRESETS: readonly NamedPatch[] = [
  { name: 'のこぎりリード', patch: defaultPatch() },
  {
    name: 'ふくよかなパッド',
    patch: {
      oscA: { waveform: 'sawtooth', octave: 0, detune: -10, level: 0.7 },
      oscB: { waveform: 'sawtooth', octave: 0, detune: 10, level: 0.7 },
      noise: 0,
      filter: { type: 'lowpass', cutoff: 1400, resonance: 3, envAmount: 0.4 },
      ampEnv: { attack: 0.8, decay: 1.2, sustain: 0.8, release: 1.6 },
      filterEnv: { attack: 1.0, decay: 1.5, sustain: 0.5, release: 1.5 },
      lfo: { waveform: 'sine', rate: 0.6, depth: 0.18, target: 'filter' },
      volume: 0.7,
    },
  },
  {
    name: '丸いベース',
    patch: {
      oscA: { waveform: 'square', octave: -1, detune: 0, level: 0.9 },
      oscB: { waveform: 'triangle', octave: -2, detune: 0, level: 0.6 },
      noise: 0,
      filter: { type: 'lowpass', cutoff: 900, resonance: 8, envAmount: 0.7 },
      ampEnv: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2 },
      filterEnv: { attack: 0.005, decay: 0.18, sustain: 0.1, release: 0.2 },
      lfo: { waveform: 'sine', rate: 5, depth: 0, target: 'pitch' },
      volume: 0.85,
    },
  },
  {
    name: 'きらめき',
    patch: {
      oscA: { waveform: 'triangle', octave: 1, detune: 0, level: 0.8 },
      oscB: { waveform: 'sine', octave: 2, detune: 4, level: 0.4 },
      noise: 0.05,
      filter: { type: 'bandpass', cutoff: 3200, resonance: 10, envAmount: 0.6 },
      ampEnv: { attack: 0.005, decay: 0.6, sustain: 0.0, release: 0.5 },
      filterEnv: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.5 },
      lfo: { waveform: 'triangle', rate: 7, depth: 0.1, target: 'amplitude' },
      volume: 0.75,
    },
  },
];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isOsc(v: unknown): v is OscSpec {
  if (!isObj(v)) return false;
  return (
    (WAVEFORMS as readonly string[]).includes(v.waveform as string) &&
    typeof v.octave === 'number' &&
    typeof v.detune === 'number' &&
    typeof v.level === 'number'
  );
}

function isEnv(v: unknown): v is Envelope {
  if (!isObj(v)) return false;
  return (
    typeof v.attack === 'number' &&
    typeof v.decay === 'number' &&
    typeof v.sustain === 'number' &&
    typeof v.release === 'number'
  );
}

export function isPatch(value: unknown): value is Patch {
  if (!isObj(value)) return false;
  const p = value;
  if (!isOsc(p.oscA) || !isOsc(p.oscB)) return false;
  if (typeof p.noise !== 'number') return false;
  if (!isObj(p.filter)) return false;
  const f = p.filter;
  if (
    !(FILTER_TYPES as readonly string[]).includes(f.type as string) ||
    typeof f.cutoff !== 'number' ||
    typeof f.resonance !== 'number' ||
    typeof f.envAmount !== 'number'
  ) {
    return false;
  }
  if (!isEnv(p.ampEnv) || !isEnv(p.filterEnv)) return false;
  if (!isObj(p.lfo)) return false;
  const l = p.lfo;
  if (
    !(WAVEFORMS as readonly string[]).includes(l.waveform as string) ||
    typeof l.rate !== 'number' ||
    typeof l.depth !== 'number' ||
    !(LFO_TARGETS as readonly string[]).includes(l.target as string)
  ) {
    return false;
  }
  return typeof p.volume === 'number';
}

function normEnv(e: Envelope): Envelope {
  return {
    attack: clamp(e.attack, RANGE.attack.min, RANGE.attack.max),
    decay: clamp(e.decay, RANGE.decay.min, RANGE.decay.max),
    sustain: clamp(e.sustain, RANGE.sustain.min, RANGE.sustain.max),
    release: clamp(e.release, RANGE.release.min, RANGE.release.max),
  };
}

function normOsc(o: OscSpec): OscSpec {
  return {
    waveform: o.waveform,
    octave: Math.round(clamp(o.octave, RANGE.octave.min, RANGE.octave.max)),
    detune: clamp(o.detune, RANGE.detune.min, RANGE.detune.max),
    level: clamp(o.level, RANGE.level.min, RANGE.level.max),
  };
}

/** 範囲外の数値を取りうる範囲へ収める */
export function normalizePatch(p: Patch): Patch {
  return {
    oscA: normOsc(p.oscA),
    oscB: normOsc(p.oscB),
    noise: clamp(p.noise, RANGE.noise.min, RANGE.noise.max),
    filter: {
      type: p.filter.type,
      cutoff: clamp(p.filter.cutoff, RANGE.cutoff.min, RANGE.cutoff.max),
      resonance: clamp(p.filter.resonance, RANGE.resonance.min, RANGE.resonance.max),
      envAmount: clamp(p.filter.envAmount, RANGE.envAmount.min, RANGE.envAmount.max),
    },
    ampEnv: normEnv(p.ampEnv),
    filterEnv: normEnv(p.filterEnv),
    lfo: {
      waveform: p.lfo.waveform,
      rate: clamp(p.lfo.rate, RANGE.rate.min, RANGE.rate.max),
      depth: clamp(p.lfo.depth, RANGE.depth.min, RANGE.depth.max),
      target: p.lfo.target,
    },
    volume: clamp(p.volume, RANGE.volume.min, RANGE.volume.max),
  };
}

export function deserializePatch(json: string): Patch | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return isPatch(parsed) ? normalizePatch(parsed) : null;
}

export interface PatchStore {
  load(): Patch | null;
  save(patch: Patch): void;
}

const STORAGE_KEY = 'neiro.patch.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createStore(storage: StorageLike): PatchStore {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? null : deserializePatch(raw);
    },
    save(patch) {
      storage.setItem(STORAGE_KEY, JSON.stringify(patch));
    },
  };
}
