// ADSRエンベロープの形を描くための純粋計算。発音時の実際の値の変化は
// engine.ts が AudioParam のスケジュールで作るが、ここでは時間に対する
// レベルを求めて、設定中のエンベロープを図として見せる。

import type { Envelope } from './patch';

export interface EnvPoint {
  t: number;
  level: number;
}

/**
 * アタック→ディケイ→サステイン保持→リリースの折れ線の節点を返す。
 * hold は鍵を押し続ける時間として図に挿む見せかけの長さ(秒)。
 */
export function envelopePoints(env: Envelope, hold = 0.4): EnvPoint[] {
  const a = env.attack;
  const d = env.decay;
  const r = env.release;
  const s = env.sustain;
  return [
    { t: 0, level: 0 },
    { t: a, level: 1 },
    { t: a + d, level: s },
    { t: a + d + hold, level: s },
    { t: a + d + hold + r, level: 0 },
  ];
}

/** 鍵を押している間の経過時間 t(秒)に対するレベル(0..1) */
export function levelAtHeld(env: Envelope, t: number): number {
  if (t <= 0) return 0;
  if (t < env.attack) return t / env.attack;
  const afterAttack = t - env.attack;
  if (afterAttack < env.decay) {
    return 1 - (1 - env.sustain) * (afterAttack / env.decay);
  }
  return env.sustain;
}

/** エンベロープの節点を幅 w・高さ h の折れ線SVGパスにする */
export function envelopePath(env: Envelope, w: number, h: number, pad = 3, hold = 0.4): string {
  const pts = envelopePoints(env, hold);
  const span = pts[pts.length - 1]?.t || 1;
  const usableH = h - pad * 2;
  return pts
    .map((p, i) => {
      const x = (p.t / span) * w;
      const y = h - pad - p.level * usableH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}
