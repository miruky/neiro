// パッチを短い文字列に畳んでURLハッシュで共有するための符号化。JSONをそのまま
// base64にすると長くなるので、各パラメータを既知の範囲で量子化した整数列に並べ、
// ハイフン区切りの一意な並びにする。復号は patch.ts の検証・正規化を通して安全側へ倒す。

import {
  FILTER_TYPES,
  LFO_TARGETS,
  WAVEFORMS,
  isPatch,
  normalizePatch,
  type FilterType,
  type LfoTarget,
  type Patch,
  type Waveform,
} from './patch';

// 並びを変えると過去のリンクが壊れるため、書式を変えるときは必ず上げる
const VERSION = 'A';
const FIELD_COUNT = 26;

function idx<T>(arr: readonly T[], value: T): number {
  const i = arr.indexOf(value);
  return i < 0 ? 0 : i;
}

/** 現在のパッチを共有用トークンにする */
export function encodePatch(p: Patch): string {
  const fields = [
    idx(WAVEFORMS, p.oscA.waveform),
    p.oscA.octave + 2,
    Math.round(p.oscA.detune) + 50,
    Math.round(p.oscA.level * 100),
    idx(WAVEFORMS, p.oscB.waveform),
    p.oscB.octave + 2,
    Math.round(p.oscB.detune) + 50,
    Math.round(p.oscB.level * 100),
    Math.round(p.noise * 100),
    idx(FILTER_TYPES, p.filter.type),
    Math.round(p.filter.cutoff),
    Math.round(p.filter.resonance * 10),
    Math.round(p.filter.envAmount * 100) + 100,
    Math.round(p.ampEnv.attack * 1000),
    Math.round(p.ampEnv.decay * 1000),
    Math.round(p.ampEnv.sustain * 100),
    Math.round(p.ampEnv.release * 1000),
    Math.round(p.filterEnv.attack * 1000),
    Math.round(p.filterEnv.decay * 1000),
    Math.round(p.filterEnv.sustain * 100),
    Math.round(p.filterEnv.release * 1000),
    idx(WAVEFORMS, p.lfo.waveform),
    Math.round(p.lfo.rate * 100),
    Math.round(p.lfo.depth * 100),
    idx(LFO_TARGETS, p.lfo.target),
    Math.round(p.volume * 100),
  ];
  return [VERSION, ...fields].join('-');
}

function enumAt<T>(arr: readonly T[], i: number): T | null {
  return i >= 0 && i < arr.length ? (arr[i] as T) : null;
}

/** 共有トークンをパッチへ戻す。書式が違う・列挙値が範囲外なら null */
export function decodePatch(token: string): Patch | null {
  const parts = token.split('-');
  if (parts.shift() !== VERSION) return null;
  if (parts.length !== FIELD_COUNT) return null;
  const n = parts.map(Number);
  if (n.some((x) => !Number.isFinite(x))) return null;

  let i = 0;
  const num = (): number => n[i++] as number;
  const wave = (): Waveform | null => enumAt(WAVEFORMS, num());

  const waA = wave();
  const oaOct = num() - 2;
  const oaDet = num() - 50;
  const oaLvl = num() / 100;
  const waB = wave();
  const obOct = num() - 2;
  const obDet = num() - 50;
  const obLvl = num() / 100;
  const noise = num() / 100;
  const ft: FilterType | null = enumAt(FILTER_TYPES, num());
  const cutoff = num();
  const reso = num() / 10;
  const envAmt = (num() - 100) / 100;
  const aA = num() / 1000;
  const aD = num() / 1000;
  const aS = num() / 100;
  const aR = num() / 1000;
  const fA = num() / 1000;
  const fD = num() / 1000;
  const fS = num() / 100;
  const fR = num() / 1000;
  const lWave = wave();
  const lRate = num() / 100;
  const lDepth = num() / 100;
  const lTarget: LfoTarget | null = enumAt(LFO_TARGETS, num());
  const volume = num() / 100;

  if (!waA || !waB || !ft || !lWave || !lTarget) return null;

  const draft: Patch = {
    oscA: { waveform: waA, octave: oaOct, detune: oaDet, level: oaLvl },
    oscB: { waveform: waB, octave: obOct, detune: obDet, level: obLvl },
    noise,
    filter: { type: ft, cutoff, resonance: reso, envAmount: envAmt },
    ampEnv: { attack: aA, decay: aD, sustain: aS, release: aR },
    filterEnv: { attack: fA, decay: fD, sustain: fS, release: fR },
    lfo: { waveform: lWave, rate: lRate, depth: lDepth, target: lTarget },
    volume,
  };
  return isPatch(draft) ? normalizePatch(draft) : null;
}

/** location.hash から共有トークンを読む(#p=... の形)。無ければ null */
export function patchFromHash(hash: string): Patch | null {
  const m = /[#&]p=([^&]+)/.exec(hash);
  if (!m || m[1] === undefined) return null;
  return decodePatch(decodeURIComponent(m[1]));
}

/** 共有用のハッシュ片(#p=...)を作る */
export function patchToHash(p: Patch): string {
  return `#p=${encodePatch(p)}`;
}
