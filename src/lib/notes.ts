// 音程まわりの純粋な計算。MIDIノート番号を基準に周波数と音名を導き、
// パソコンのキーボードを鍵盤に見立てる対応表を持つ。

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDIノート番号(69=A4=440Hz)を周波数(Hz)に変換する */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** MIDIノート番号を音名(例: 60 -> "C4")にする */
export function midiToName(midi: number): string {
  const name = NAMES[((midi % 12) + 12) % 12] ?? 'C';
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** その音が黒鍵か(半音か) */
export function isSharp(midi: number): boolean {
  return NAMES[((midi % 12) + 12) % 12]?.includes('#') ?? false;
}

/**
 * パソコンのキーから基準オクターブのCを0とした半音差への対応。
 * 下段(z..m)が1オクターブ、上段(q..i)がその1オクターブ上を担う。
 */
export const KEY_SEMITONES: Readonly<Record<string, number>> = {
  z: 0,
  s: 1,
  x: 2,
  d: 3,
  c: 4,
  v: 5,
  g: 6,
  b: 7,
  h: 8,
  n: 9,
  j: 10,
  m: 11,
  ',': 12,
  q: 12,
  2: 13,
  w: 14,
  3: 15,
  e: 16,
  r: 17,
  5: 18,
  t: 19,
  6: 20,
  y: 21,
  7: 22,
  u: 23,
  i: 24,
};

/** キーと基準オクターブからMIDIノート番号を求める。対応がなければnull */
export function keyToMidi(key: string, baseOctave: number): number | null {
  const semi = KEY_SEMITONES[key.toLowerCase()];
  if (semi === undefined) return null;
  // baseOctave=4 のとき z が C4(MIDI 60)
  return (baseOctave + 1) * 12 + semi;
}

/** [from, to] のMIDIノート番号を昇順で並べる */
export function noteRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m++) out.push(m);
  return out;
}
