// 現在の音色を一行で言い表す要約。画面上部の読み取り行に出すほか、音色の差を
// 言葉で確かめるのに使う。表示専用の純粋関数で、判定は patch の値だけに依る。

import type { Patch } from './patch';

const WAVE: Record<string, string> = {
  sine: '正弦',
  triangle: '三角',
  sawtooth: 'のこぎり',
  square: '矩形',
};
const FILTER: Record<string, string> = {
  lowpass: 'ローパス',
  highpass: 'ハイパス',
  bandpass: 'バンドパス',
};
const TARGET: Record<string, string> = {
  pitch: '音程',
  filter: 'フィルタ',
  amplitude: '音量',
};

function hz(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`;
}

/** 「のこぎり × 矩形 · ローパス 2.2 kHz · LFO→フィルタ」のような一行要約 */
export function summarizePatch(p: Patch): string {
  const parts = [
    `${WAVE[p.oscA.waveform]} × ${WAVE[p.oscB.waveform]}`,
    `${FILTER[p.filter.type]} ${hz(p.filter.cutoff)}`,
  ];
  if (p.noise > 0.001) parts.push('ノイズ入り');
  if (p.lfo.depth > 0) parts.push(`LFO→${TARGET[p.lfo.target]}`);
  return parts.join(' · ');
}
