// 利用者が作った音色に名前を付けて localStorage へ保存する。配列の更新は純粋関数で
// 行い、読み書きだけがストレージに触れる。読み込み時は壊れた項目を捨てて安全側に倒す。

import { isPatch, normalizePatch, type Patch } from './patch';

export interface UserPreset {
  name: string;
  patch: Patch;
}

/** 同名は上書きし、新規は末尾へ。元の配列は変更しない */
export function upsertUserPreset(
  list: readonly UserPreset[],
  name: string,
  patch: Patch,
): UserPreset[] {
  const trimmed = name.trim();
  const entry: UserPreset = { name: trimmed, patch };
  const i = list.findIndex((p) => p.name === trimmed);
  if (i < 0) return [...list, entry];
  const next = list.slice();
  next[i] = entry;
  return next;
}

/** 指定名を取り除く。元の配列は変更しない */
export function removeUserPreset(list: readonly UserPreset[], name: string): UserPreset[] {
  return list.filter((p) => p.name !== name);
}

function sanitize(value: unknown): UserPreset[] {
  if (!Array.isArray(value)) return [];
  const out: UserPreset[] = [];
  for (const item of value) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { name: unknown }).name === 'string' &&
      isPatch((item as { patch: unknown }).patch)
    ) {
      const it = item as { name: string; patch: Patch };
      out.push({ name: it.name, patch: normalizePatch(it.patch) });
    }
  }
  return out;
}

const STORAGE_KEY = 'neiro.userPresets.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadUserPresets(storage: StorageLike): UserPreset[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveUserPresets(storage: StorageLike, list: readonly UserPreset[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(list));
}
