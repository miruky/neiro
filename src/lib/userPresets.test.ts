import { describe, expect, it } from 'vitest';
import {
  loadUserPresets,
  removeUserPreset,
  saveUserPresets,
  upsertUserPreset,
  type UserPreset,
} from './userPresets';
import { defaultPatch } from './patch';

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('upsertUserPreset', () => {
  it('新しい名前は末尾に足す', () => {
    const next = upsertUserPreset([], 'dawn', defaultPatch());
    expect(next).toHaveLength(1);
    expect(next[0]?.name).toBe('dawn');
  });

  it('同名は上書きして増やさない', () => {
    const base = upsertUserPreset([], 'pad', defaultPatch());
    const edited = { ...defaultPatch(), volume: 0.3 };
    const next = upsertUserPreset(base, 'pad', edited);
    expect(next).toHaveLength(1);
    expect(next[0]?.patch.volume).toBe(0.3);
  });

  it('前後の空白を取り除いて名前にする', () => {
    const next = upsertUserPreset([], '  lead  ', defaultPatch());
    expect(next[0]?.name).toBe('lead');
  });

  it('元の配列を変更しない', () => {
    const base: UserPreset[] = [];
    upsertUserPreset(base, 'x', defaultPatch());
    expect(base).toHaveLength(0);
  });
});

describe('removeUserPreset', () => {
  it('指定した名前だけ消す', () => {
    let list = upsertUserPreset([], 'a', defaultPatch());
    list = upsertUserPreset(list, 'b', defaultPatch());
    const next = removeUserPreset(list, 'a');
    expect(next.map((p) => p.name)).toEqual(['b']);
  });
});

describe('loadUserPresets / saveUserPresets', () => {
  it('未設定なら空配列', () => {
    expect(loadUserPresets(memStorage())).toEqual([]);
  });

  it('保存した一覧を読み戻せる', () => {
    const s = memStorage();
    const list = upsertUserPreset([], 'mine', defaultPatch());
    saveUserPresets(s, list);
    const back = loadUserPresets(s);
    expect(back).toHaveLength(1);
    expect(back[0]?.name).toBe('mine');
  });

  it('壊れたJSONは空配列に倒す', () => {
    expect(loadUserPresets(memStorage({ 'neiro.userPresets.v1': '{' }))).toEqual([]);
  });

  it('不正な項目は捨てる', () => {
    const bad = JSON.stringify([{ name: 'ok', patch: defaultPatch() }, { name: 'broken' }, 42]);
    const back = loadUserPresets(memStorage({ 'neiro.userPresets.v1': bad }));
    expect(back).toHaveLength(1);
    expect(back[0]?.name).toBe('ok');
  });
});
