// UIの線画アイコン。24pxグリッド・stroke=currentColorで統一し、装飾(aria-hidden)
// として出力する。ボタンには別途テキストラベルかaria-labelを与える。

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  // 配線をたどる信号のような波形
  logo: svg('<path d="M2 12h3l2-7 4 14 3-9 2 5h6"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
} as const;
