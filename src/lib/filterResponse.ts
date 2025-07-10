// フィルタの周波数特性を描くための純粋計算。RBJ(Audio EQ Cookbook)の双二次
// 係数から振幅特性(dB)を求める。実際の発音は BiquadFilterNode が行うので、
// これは配線の効きを目で確かめるための近似カーブとして扱う。

import type { FilterSpec, FilterType } from './patch';

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

function coefficients(type: FilterType, f0: number, q: number, fs: number): Biquad {
  const w0 = (2 * Math.PI * f0) / fs;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Math.max(q, 0.0001));
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  switch (type) {
    case 'lowpass':
      return { b0: (1 - cos) / 2, b1: 1 - cos, b2: (1 - cos) / 2, a0, a1, a2 };
    case 'highpass':
      return { b0: (1 + cos) / 2, b1: -(1 + cos), b2: (1 + cos) / 2, a0, a1, a2 };
    case 'bandpass':
      return { b0: alpha, b1: 0, b2: -alpha, a0, a1, a2 };
  }
}

/** 一つの周波数での振幅(dB) */
function magnitudeDb(c: Biquad, f: number, fs: number): number {
  const w = (2 * Math.PI * f) / fs;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);
  const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
  const numIm = -(c.b1 * sin1 + c.b2 * sin2);
  const denRe = c.a0 + c.a1 * cos1 + c.a2 * cos2;
  const denIm = -(c.a1 * sin1 + c.a2 * sin2);
  const num = Math.hypot(numRe, numIm);
  const den = Math.hypot(denRe, denIm) || 1e-9;
  return 20 * Math.log10(Math.max(num / den, 1e-7));
}

/** 周波数列に対する振幅特性(dB) */
export function biquadResponse(filter: FilterSpec, freqs: number[], fs = 44100): number[] {
  const c = coefficients(filter.type, filter.cutoff, filter.resonance, fs);
  return freqs.map((f) => magnitudeDb(c, f, fs));
}

/** [min, max] を対数等間隔に n 点並べる */
export function logFreqs(min: number, max: number, n: number): number[] {
  const lo = Math.log10(min);
  const hi = Math.log10(max);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(10 ** (lo + ((hi - lo) * i) / (n - 1)));
  }
  return out;
}

export interface ResponseView {
  width: number;
  height: number;
  /** 縦軸の表示範囲(dB) */
  minDb?: number;
  maxDb?: number;
  fMin?: number;
  fMax?: number;
}

/** フィルタ特性を、横軸=対数周波数・縦軸=dB の折れ線SVGパスにする */
export function responsePath(filter: FilterSpec, view: ResponseView): string {
  const { width, height, minDb = -36, maxDb = 18, fMin = 20, fMax = 20000 } = view;
  const n = 160;
  const freqs = logFreqs(fMin, fMax, n);
  const db = biquadResponse(filter, freqs);
  const loF = Math.log10(fMin);
  const hiF = Math.log10(fMax);
  return db
    .map((d, i) => {
      const x = ((Math.log10(freqs[i] ?? fMin) - loF) / (hiF - loF)) * width;
      const clamped = Math.max(minDb, Math.min(maxDb, d));
      const y = height - ((clamped - minDb) / (maxDb - minDb)) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}
