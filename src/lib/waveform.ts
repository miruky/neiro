// オシレータの波形を描くための純粋計算。実際の発音は engine.ts が Web Audio で行うが、
// 配線の効果を目で確かめられるよう、合成後の1周期を数値で求めて折れ線パスにする。

import type { Patch, Waveform } from './patch';

/** 位相(0..1)に対する各波形の値(-1..1) */
export function oscSample(type: Waveform, phase: number): number {
  const t = phase - Math.floor(phase);
  switch (type) {
    case 'sine':
      return Math.sin(2 * Math.PI * t);
    case 'sawtooth':
      return 2 * t - 1;
    case 'square':
      return t < 0.5 ? 1 : -1;
    case 'triangle':
      if (t < 0.25) return 4 * t;
      if (t < 0.75) return 2 - 4 * t;
      return 4 * t - 4;
  }
}

/**
 * 2基のオシレータを混ぜた1周期(基準オシレータ基準)を n 点で標本化する。
 * オクターブ差はその周期に重なる波数として現れる。ノイズと微細なずれは
 * 見た目が毎回変わるため波形プレビューには含めない。
 */
export function renderCycle(patch: Patch, n = 256): number[] {
  const total = patch.oscA.level + patch.oscB.level || 1;
  const ratioA = 2 ** patch.oscA.octave;
  const ratioB = 2 ** patch.oscB.octave;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    const a = oscSample(patch.oscA.waveform, phase * ratioA) * patch.oscA.level;
    const b = oscSample(patch.oscB.waveform, phase * ratioB) * patch.oscB.level;
    out.push(Math.max(-1, Math.min(1, (a + b) / total)));
  }
  return out;
}

/** 標本列を幅 w・高さ h の折れ線SVGパスにする。pad は上下の余白 */
export function toPath(samples: number[], w: number, h: number, pad = 4): string {
  if (samples.length === 0) return '';
  const mid = h / 2;
  const amp = mid - pad;
  return samples
    .map((s, i) => {
      const x = (i / (samples.length - 1)) * w;
      const y = mid - s * amp;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}
