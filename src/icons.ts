// UIの線画アイコン。24pxグリッド・stroke=currentColorで統一し、装飾(aria-hidden)
// として出力する。ボタンには別途テキストラベルかaria-labelを与える。

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  // 配線をたどる信号のような波形
  logo: svg('<path d="M2 12h3l2-7 4 14 3-9 2 5h6"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  // さいころ(ランダム生成)
  dice: svg(
    '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none"/>',
  ),
  // 鎖(共有リンク)
  link: svg(
    '<path d="M9.5 14.5l5-5"/><path d="M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2"/><path d="M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
  ),
  // 書き出し(下向き矢印とトレイ)
  download: svg('<path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
  // 読み込み(上向き矢印とトレイ)
  upload: svg('<path d="M12 15V5"/><path d="M8 8l4-4 4 4"/><path d="M5 19h14"/>'),
  // しおり(保存)
  bookmark: svg('<path d="M6 4h12v16l-6-4-6 4z"/>'),
  // ごみ箱(削除)
  trash: svg('<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/>'),
  // 太陽(ライト)
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  ),
  // 月(ダーク)
  moon: svg('<path d="M20 14a8 8 0 1 1-9.5-9.8 6.5 6.5 0 0 0 9.5 9.8z"/>'),
  // 画面(システム追従)
  monitor: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
} as const;
