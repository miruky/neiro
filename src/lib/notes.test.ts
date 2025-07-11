import { describe, expect, it } from 'vitest';
import { isSharp, keyToMidi, midiToFreq, midiToName, noteRange } from './notes';

describe('midiToFreq', () => {
  it('A4(69)は440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });

  it('オクターブ差は周波数の倍々', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 4);
    expect(midiToFreq(57)).toBeCloseTo(220, 4);
  });
});

describe('midiToName', () => {
  it('番号を音名にする', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(61)).toBe('C#4');
  });
});

describe('isSharp', () => {
  it('黒鍵を見分ける', () => {
    expect(isSharp(61)).toBe(true);
    expect(isSharp(60)).toBe(false);
  });
});

describe('keyToMidi', () => {
  it('下段zは基準オクターブのC、上段qはその1つ上', () => {
    expect(keyToMidi('z', 4)).toBe(60);
    expect(keyToMidi('q', 4)).toBe(72);
  });

  it('大文字でも引け、対応のないキーはnull', () => {
    expect(keyToMidi('Z', 4)).toBe(60);
    expect(keyToMidi('k', 4)).toBeNull();
  });
});

describe('noteRange', () => {
  it('両端を含む昇順', () => {
    expect(noteRange(60, 63)).toEqual([60, 61, 62, 63]);
  });
});
