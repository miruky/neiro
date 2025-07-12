// テーマの選択(システム追従・ライト・ダーク)を純粋に扱う。実際の data-theme 反映は
// 描画前に index.html 先頭のスクリプトが行い、ここはその解決規則と永続化だけを持つ。

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return typeof v === 'string' && (THEME_CHOICES as readonly string[]).includes(v);
}

/** 選択とOSの好みから、実際に適用する明暗を決める */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

/** トグルで次に進む選択(システム → ライト → ダーク → システム) */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  const i = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(i + 1) % THEME_CHOICES.length] ?? 'system';
}

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'システムに合わせる',
  light: 'ライト',
  dark: 'ダーク',
};

const STORAGE_KEY = 'neiro.theme.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadThemeChoice(storage: StorageLike): ThemeChoice {
  const raw = storage.getItem(STORAGE_KEY);
  return isThemeChoice(raw) ? raw : 'system';
}

export function saveThemeChoice(storage: StorageLike, choice: ThemeChoice): void {
  storage.setItem(STORAGE_KEY, choice);
}
