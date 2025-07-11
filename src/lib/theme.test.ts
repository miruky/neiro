import { describe, expect, it } from 'vitest';
import {
  isThemeChoice,
  loadThemeChoice,
  nextThemeChoice,
  resolveTheme,
  saveThemeChoice,
  type ThemeChoice,
} from './theme';

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('resolveTheme', () => {
  it('システムはOSの好みに従う', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('明示指定はOSの好みを無視する', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextThemeChoice', () => {
  it('システム→ライト→ダーク→システムと巡回する', () => {
    expect(nextThemeChoice('system')).toBe('light');
    expect(nextThemeChoice('light')).toBe('dark');
    expect(nextThemeChoice('dark')).toBe('system');
  });
});

describe('isThemeChoice', () => {
  it('正しい値だけを受け入れる', () => {
    for (const v of ['system', 'light', 'dark'] as ThemeChoice[]) {
      expect(isThemeChoice(v)).toBe(true);
    }
    expect(isThemeChoice('auto')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(1)).toBe(false);
  });
});

describe('loadThemeChoice / saveThemeChoice', () => {
  it('未設定なら system を返す', () => {
    expect(loadThemeChoice(memStorage())).toBe('system');
  });

  it('保存した選択を読み戻せる', () => {
    const s = memStorage();
    saveThemeChoice(s, 'dark');
    expect(loadThemeChoice(s)).toBe('dark');
  });

  it('壊れた値は system に倒す', () => {
    expect(loadThemeChoice(memStorage({ 'neiro.theme.v1': 'nonsense' }))).toBe('system');
  });
});
