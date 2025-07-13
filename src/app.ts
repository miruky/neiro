// 画面の描画と操作。パッチを1つ持ち、つまみを動かすたびに音のエンジンと
// 図(波形・フィルタ特性・エンベロープ)へ反映する。鍵盤はマウス・タッチ・
// パソコンのキーボードで弾ける。音色はこの端末に保存し、URLでも共有できる。

import {
  FILTER_TYPES,
  LFO_TARGETS,
  PRESETS,
  RANGE,
  WAVEFORMS,
  defaultPatch,
  deserializePatch,
  type Patch,
  type PatchStore,
} from './lib/patch';
import { SynthEngine } from './lib/engine';
import { summarizePatch } from './lib/describe';
import { isSharp, keyToMidi, midiToName, noteRange } from './lib/notes';
import { renderCycle, toPath } from './lib/waveform';
import { responsePath } from './lib/filterResponse';
import { envelopePath } from './lib/adsr';
import { mulberry32, randomPatch } from './lib/random';
import { patchToHash } from './lib/share';
import {
  THEME_LABEL,
  loadThemeChoice,
  nextThemeChoice,
  resolveTheme,
  saveThemeChoice,
  type ThemeChoice,
} from './lib/theme';
import {
  loadUserPresets,
  removeUserPreset,
  saveUserPresets,
  upsertUserPreset,
} from './lib/userPresets';
import { icons } from './icons';

const WAVE_LABEL: Record<string, string> = {
  sine: '正弦',
  triangle: '三角',
  sawtooth: 'のこぎり',
  square: '矩形',
};
const FILTER_LABEL: Record<string, string> = {
  lowpass: 'ローパス',
  highpass: 'ハイパス',
  bandpass: 'バンドパス',
};
const TARGET_LABEL: Record<string, string> = {
  pitch: '音程',
  filter: 'フィルタ',
  amplitude: '音量',
};
const THEME_ICON: Record<ThemeChoice, string> = {
  system: icons.monitor,
  light: icons.sun,
  dark: icons.moon,
};

const KEY_LO = 48;
const KEY_HI = 72;

function getPath(obj: Patch, path: string): number | string {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as
    | number
    | string;
}

function setPath(obj: Patch, path: string, value: number | string): void {
  const keys = path.split('.');
  const last = keys.pop() as string;
  const target = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<
    string,
    unknown
  >;
  target[last] = value;
}

function formatValue(path: string, value: number): string {
  if (path.endsWith('cutoff')) {
    return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
  }
  if (path.endsWith('octave')) return value > 0 ? `+${value}` : `${value}`;
  if (path.endsWith('detune')) return `${value > 0 ? '+' : ''}${Math.round(value)} c`;
  if (path.endsWith('rate')) return `${value.toFixed(2)} Hz`;
  if (path.endsWith('resonance')) return value.toFixed(1);
  if (path.endsWith('envAmount')) return value.toFixed(2);
  if (/attack|decay|release/.test(path)) {
    return value >= 1 ? `${value.toFixed(2)} s` : `${Math.round(value * 1000)} ms`;
  }
  return value.toFixed(2);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export interface AppDeps {
  root: HTMLElement;
  store: PatchStore;
  engine: SynthEngine;
  initialPatch: Patch;
}

export function createApp({ root, store, engine, initialPatch }: AppDeps): void {
  let patch = initialPatch;
  let octaveShift = 0;
  let themeChoice = loadThemeChoice(localStorage);
  let userPresets = loadUserPresets(localStorage);
  let randomSeed = (Date.now() & 0xffffffff) >>> 0;
  const held = new Set<number>();
  let audioReady = false;
  // 入場アニメは初回描画のみ。再描画(操作のたび)では再生しない
  let hasBooted = false;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function notify(message: string): void {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  let hashTimer = 0;
  function syncHash(): void {
    window.clearTimeout(hashTimer);
    hashTimer = window.setTimeout(() => {
      history.replaceState(null, '', patchToHash(patch));
    }, 200);
  }

  function commit(): void {
    store.save(patch);
    engine.setPatch(patch);
    syncHash();
  }

  function applyTheme(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = resolveTheme(themeChoice, prefersDark);
  }

  async function ensureAudio(): Promise<void> {
    if (audioReady) return;
    await engine.resume();
    audioReady = true;
    root.querySelector('#audio-hint')?.setAttribute('hidden', '');
    startScope();
  }

  function seg(
    path: string,
    choices: readonly string[],
    labels: Record<string, string>,
    groupLabel: string,
  ): string {
    const current = getPath(patch, path);
    return `<div class="segmented" role="radiogroup" aria-label="${groupLabel}">${choices
      .map(
        (c) =>
          `<button type="button" role="radio" aria-checked="${c === current}" class="seg${
            c === current ? ' active' : ''
          }" data-param="${path}" data-value="${c}">${labels[c] ?? c}</button>`,
      )
      .join('')}</div>`;
  }

  function knobName(path: string): string {
    const map: Record<string, string> = {
      octave: 'オクターブ',
      detune: 'デチューン',
      level: '音量',
      noise: 'ノイズ',
      cutoff: 'カットオフ',
      resonance: '共鳴',
      envAmount: 'EG量',
      attack: 'アタック',
      decay: 'ディケイ',
      sustain: 'サステイン',
      release: 'リリース',
      rate: '速さ',
      depth: '深さ',
      volume: '音量',
    };
    const leaf = path.split('.').pop() as string;
    return map[leaf] ?? leaf;
  }

  function range(path: string, min: number, max: number, step: number): string {
    const value = getPath(patch, path) as number;
    const name = knobName(path);
    return `<label class="knob"><span class="knob-name">${name}</span>
      <input type="range" data-param="${path}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${name}"/>
      <span class="knob-val" data-display="${path}">${formatValue(path, value)}</span></label>`;
  }

  function oscModule(which: 'oscA' | 'oscB', no: string, title: string): string {
    return `<section class="module">
      <header class="module-head"><span class="module-no">${no}</span><h2>${title}</h2></header>
      ${seg(`${which}.waveform`, WAVEFORMS, WAVE_LABEL, `${title}の波形`)}
      <div class="knobs">
        ${range(`${which}.octave`, RANGE.octave.min, RANGE.octave.max, 1)}
        ${range(`${which}.detune`, RANGE.detune.min, RANGE.detune.max, 1)}
        ${range(`${which}.level`, RANGE.level.min, RANGE.level.max, 0.01)}
      </div>
    </section>`;
  }

  function keyboard(): string {
    const midis = noteRange(KEY_LO, KEY_HI);
    const whites = midis.filter((m) => !isSharp(m));
    const nW = whites.length;
    const whiteKeys = whites
      .map((m, i) => {
        const label = m % 12 === 0 ? `<span>${midiToName(m)}</span>` : '';
        return `<button type="button" class="key white" data-midi="${m}" aria-label="${midiToName(
          m,
        )}" style="left:${(i / nW) * 100}%;width:${100 / nW}%">${label}</button>`;
      })
      .join('');
    const blackKeys = midis
      .filter((m) => isSharp(m))
      .map((m) => {
        const wi = whites.filter((w) => w < m).length;
        return `<button type="button" class="key black" data-midi="${m}" aria-label="${midiToName(
          m,
        )}" style="left:${(wi / nW) * 100}%;width:${(100 / nW) * 0.62}%"></button>`;
      })
      .join('');
    return `<div class="keyboard" id="keyboard">${whiteKeys}${blackKeys}</div>`;
  }

  function presetSection(): string {
    const factory = PRESETS.map(
      (p, i) =>
        `<button type="button" class="chip" data-preset="${i}">${escapeHtml(p.name)}</button>`,
    ).join('');
    const mine = userPresets
      .map(
        (p) =>
          `<span class="chip chip-user"><button type="button" class="chip-load" data-user="${escapeAttr(
            p.name,
          )}">${escapeHtml(p.name)}</button><button type="button" class="chip-del" data-del="${escapeAttr(
            p.name,
          )}" aria-label="${escapeAttr(p.name)} を削除">${icons.trash}</button></span>`,
      )
      .join('');
    return `<section class="presets reveal">
      <p class="kicker">プリセット</p>
      <div class="chips">${factory}${mine}</div>
      <form class="save-form" id="save-form">
        <input type="text" id="save-name" placeholder="この音色に名前を付けて保存" maxlength="24" aria-label="音色の名前"/>
        <button type="submit" class="btn">${icons.bookmark}<span>保存</span></button>
      </form>
    </section>`;
  }

  function render(): void {
    if (hasBooted) root.classList.add('booted');
    root.innerHTML = `
      <header class="masthead">
        <div class="masthead-inner">
          <span class="wordmark">${icons.logo}<span class="word">neiro</span></span>
          <span class="masthead-kicker">減算合成シンセサイザー</span>
          <button type="button" class="theme-toggle" id="theme-toggle" aria-label="テーマを切り替え(現在: ${
            THEME_LABEL[themeChoice]
          })">
            ${THEME_ICON[themeChoice]}<span class="theme-label">${THEME_LABEL[themeChoice]}</span>
          </button>
        </div>
      </header>

      <main class="page">
        <section class="intro reveal">
          <p class="kicker accent">Browser Synthesizer</p>
          <h1 class="display">配線して、<br />音を彫る。</h1>
          <p class="lede">
            2基のオシレータ、ノイズ、フィルタ、2つのエンベロープ、LFO。つまみを動かすと、
            合成された波形・フィルタの周波数特性・出力の波が同時に描き直され、音の変化を目で追える。
          </p>
          <p class="patch-summary" id="patch-summary">${summarizePatch(patch)}</p>
        </section>

        <section class="signal reveal" aria-label="信号の可視化">
          <figure class="viz">
            <figcaption class="kicker">合成波形</figcaption>
            <svg viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label="合成された1周期の波形">
              <line class="viz-base" x1="0" y1="60" x2="320" y2="60" />
              <path id="wave-path" class="viz-line" d="" fill="none"/>
            </svg>
          </figure>
          <figure class="viz">
            <figcaption class="kicker">出力(オシロスコープ)</figcaption>
            <svg viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label="出力の波形">
              <line class="viz-base" x1="0" y1="60" x2="320" y2="60" />
              <path id="scope-path" class="viz-line accent" d="M0 60 L320 60" fill="none"/>
            </svg>
          </figure>
          <figure class="viz">
            <figcaption class="kicker">フィルタ特性</figcaption>
            <svg viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label="フィルタの周波数特性">
              <path id="resp-path" class="viz-line" d="" fill="none"/>
            </svg>
          </figure>
        </section>

        <section class="transport reveal">
          <label class="master"><span class="kicker">マスター</span>
            <input type="range" data-param="volume" min="0" max="1" step="0.01" value="${
              patch.volume
            }" aria-label="マスター音量"/></label>
          <div class="actions">
            <button type="button" class="btn" id="act-random">${icons.dice}<span>ランダム</span></button>
            <button type="button" class="btn" id="act-reset">${icons.reset}<span>初期化</span></button>
            <button type="button" class="btn" id="act-share">${icons.link}<span>共有リンク</span></button>
            <button type="button" class="btn" id="act-export">${icons.download}<span>書き出し</span></button>
            <button type="button" class="btn" id="act-import">${icons.upload}<span>読み込み</span></button>
            <input type="file" id="import-file" accept="application/json,.json" hidden />
          </div>
        </section>

        <div class="console reveal">
          ${oscModule('oscA', '01', 'オシレータ A')}
          ${oscModule('oscB', '02', 'オシレータ B')}
          <section class="module">
            <header class="module-head"><span class="module-no">03</span><h2>フィルタ</h2></header>
            ${seg('filter.type', FILTER_TYPES, FILTER_LABEL, 'フィルタの種類')}
            <div class="knobs">
              ${range('filter.cutoff', RANGE.cutoff.min, RANGE.cutoff.max, 1)}
              ${range('filter.resonance', RANGE.resonance.min, RANGE.resonance.max, 0.1)}
              ${range('filter.envAmount', RANGE.envAmount.min, RANGE.envAmount.max, 0.01)}
              ${range('noise', RANGE.noise.min, RANGE.noise.max, 0.01)}
            </div>
          </section>
          <section class="module">
            <header class="module-head"><span class="module-no">04</span><h2>アンプ エンベロープ</h2></header>
            <svg class="env" viewBox="0 0 240 70" preserveAspectRatio="none" role="img" aria-label="音量エンベロープ">
              <path id="amp-env-path" class="viz-line" d="" fill="none"/>
            </svg>
            <div class="knobs">
              ${range('ampEnv.attack', RANGE.attack.min, RANGE.attack.max, 0.001)}
              ${range('ampEnv.decay', RANGE.decay.min, RANGE.decay.max, 0.001)}
              ${range('ampEnv.sustain', RANGE.sustain.min, RANGE.sustain.max, 0.01)}
              ${range('ampEnv.release', RANGE.release.min, RANGE.release.max, 0.001)}
            </div>
          </section>
          <section class="module">
            <header class="module-head"><span class="module-no">05</span><h2>フィルタ エンベロープ</h2></header>
            <svg class="env" viewBox="0 0 240 70" preserveAspectRatio="none" role="img" aria-label="フィルタエンベロープ">
              <path id="flt-env-path" class="viz-line" d="" fill="none"/>
            </svg>
            <div class="knobs">
              ${range('filterEnv.attack', RANGE.attack.min, RANGE.attack.max, 0.001)}
              ${range('filterEnv.decay', RANGE.decay.min, RANGE.decay.max, 0.001)}
              ${range('filterEnv.sustain', RANGE.sustain.min, RANGE.sustain.max, 0.01)}
              ${range('filterEnv.release', RANGE.release.min, RANGE.release.max, 0.001)}
            </div>
          </section>
          <section class="module">
            <header class="module-head"><span class="module-no">06</span><h2>LFO</h2></header>
            ${seg('lfo.waveform', WAVEFORMS, WAVE_LABEL, 'LFOの波形')}
            <div class="seg-label">行き先</div>
            ${seg('lfo.target', LFO_TARGETS, TARGET_LABEL, 'LFOの行き先')}
            <div class="knobs">
              ${range('lfo.rate', RANGE.rate.min, RANGE.rate.max, 0.01)}
              ${range('lfo.depth', RANGE.depth.min, RANGE.depth.max, 0.01)}
            </div>
          </section>
        </div>

        ${presetSection()}

        <section class="play reveal">
          <div class="play-head">
            <p class="kicker">演奏</p>
            <div class="octave-shift">
              <button type="button" class="btn ghost" id="oct-down" aria-label="オクターブを下げる">${
                icons.minus
              }</button>
              <span id="oct-label" class="oct-label">オクターブ ${
                octaveShift > 0 ? '+' : ''
              }${octaveShift}</span>
              <button type="button" class="btn ghost" id="oct-up" aria-label="オクターブを上げる">${
                icons.plus
              }</button>
            </div>
          </div>
          <p class="audio-hint" id="audio-hint">鍵盤に触れるか、キーボードのキー(下段 z〜m / 上段 q〜u)を押すと音が出ます。<kbd>[</kbd><kbd>]</kbd> でオクターブ移動。</p>
          ${keyboard()}
        </section>
      </main>

      <footer class="site-footer">
        <p>neiro はブラウザの中だけで音を合成する。音色はこの端末に保存され、共有リンクにも畳み込まれる。音そのものが外部へ送られることはない。</p>
      </footer>`;
    bindEvents();
    refreshVisuals();
    hasBooted = true;
  }

  function refreshVisuals(): void {
    setPathAttr('#wave-path', toPath(renderCycle(patch, 256), 320, 120, 8));
    setPathAttr('#resp-path', responsePath(patch.filter, { width: 320, height: 120 }));
    setPathAttr('#amp-env-path', envelopePath(patch.ampEnv, 240, 70, 4));
    setPathAttr('#flt-env-path', envelopePath(patch.filterEnv, 240, 70, 4));
    const summary = root.querySelector('#patch-summary');
    if (summary) summary.textContent = summarizePatch(patch);
  }

  function setPathAttr(sel: string, d: string): void {
    root.querySelector(sel)?.setAttribute('d', d);
  }

  function loadPatch(next: Patch): void {
    patch = structuredClone(next);
    commit();
    render();
  }

  function bindEvents(): void {
    for (const el of root.querySelectorAll<HTMLInputElement>('input[type="range"][data-param]')) {
      el.addEventListener('input', () => {
        const path = el.dataset.param as string;
        setPath(patch, path, Number(el.value));
        const disp = root.querySelector(`[data-display="${path}"]`);
        if (disp) {
          disp.textContent = formatValue(path, Number(el.value));
          disp.classList.remove('flash');
          void (disp as HTMLElement).offsetWidth;
          disp.classList.add('flash');
        }
        commit();
        refreshVisuals();
      });
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('.seg')) {
      el.addEventListener('click', () => {
        setPath(patch, el.dataset.param as string, el.dataset.value as string);
        commit();
        render();
      });
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      el.addEventListener('click', () => {
        const preset = PRESETS[Number(el.dataset.preset)];
        if (preset) loadPatch(preset.patch);
      });
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('[data-user]')) {
      el.addEventListener('click', () => {
        const found = userPresets.find((p) => p.name === el.dataset.user);
        if (found) {
          loadPatch(found.patch);
          notify(`「${found.name}」を読み込みました`);
        }
      });
    }
    for (const el of root.querySelectorAll<HTMLButtonElement>('[data-del]')) {
      el.addEventListener('click', () => {
        const name = el.dataset.del as string;
        userPresets = removeUserPreset(userPresets, name);
        saveUserPresets(localStorage, userPresets);
        render();
        notify(`「${name}」を削除しました`);
      });
    }

    root.querySelector('#theme-toggle')?.addEventListener('click', () => {
      themeChoice = nextThemeChoice(themeChoice);
      saveThemeChoice(localStorage, themeChoice);
      applyTheme();
      render();
    });
    root.querySelector('#act-random')?.addEventListener('click', () => {
      randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
      loadPatch(randomPatch(mulberry32(randomSeed)));
      notify('音色をランダムに作りました');
    });
    root.querySelector('#act-reset')?.addEventListener('click', () => {
      loadPatch(defaultPatch());
      notify('既定の音色に戻しました');
    });
    root.querySelector('#act-share')?.addEventListener('click', () => void copyShareLink());
    root.querySelector('#act-export')?.addEventListener('click', exportPatch);
    const fileInput = root.querySelector<HTMLInputElement>('#import-file');
    root.querySelector('#act-import')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => void importPatch(fileInput));

    root.querySelector('#save-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = root.querySelector<HTMLInputElement>('#save-name');
      const name = input?.value.trim() ?? '';
      if (!name) return;
      userPresets = upsertUserPreset(userPresets, name, structuredClone(patch));
      saveUserPresets(localStorage, userPresets);
      render();
      notify(`「${name}」を保存しました`);
    });

    root.querySelector('#oct-down')?.addEventListener('click', () => shiftOctave(-1));
    root.querySelector('#oct-up')?.addEventListener('click', () => shiftOctave(1));
    bindKeyboard();
  }

  async function copyShareLink(): Promise<void> {
    const url = `${location.origin}${location.pathname}${patchToHash(patch)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('共有リンクをコピーしました');
    } catch {
      history.replaceState(null, '', patchToHash(patch));
      notify('アドレス欄のURLがこの音色を指しています');
    }
  }

  function exportPatch(): void {
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neiro-patch.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('音色を JSON に書き出しました');
  }

  async function importPatch(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const next = deserializePatch(await file.text());
    if (next) {
      loadPatch(next);
      notify(`${file.name} を読み込みました`);
    } else {
      notify('この JSON は音色として読み取れませんでした');
    }
  }

  function shiftOctave(delta: number): void {
    octaveShift = Math.min(2, Math.max(-2, octaveShift + delta));
    const label = root.querySelector('#oct-label');
    if (label) label.textContent = `オクターブ ${octaveShift > 0 ? '+' : ''}${octaveShift}`;
  }

  function press(midi: number): void {
    if (held.has(midi)) return;
    held.add(midi);
    void ensureAudio().then(() => engine.noteOn(midi));
    root.querySelector(`.key[data-midi="${midi}"]`)?.classList.add('on');
  }

  function release(midi: number): void {
    if (!held.has(midi)) return;
    held.delete(midi);
    engine.noteOff(midi);
    root.querySelector(`.key[data-midi="${midi}"]`)?.classList.remove('on');
  }

  function bindKeyboard(): void {
    const board = root.querySelector('#keyboard');
    if (!board) return;
    for (const key of board.querySelectorAll<HTMLButtonElement>('.key')) {
      const midi = Number(key.dataset.midi);
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        key.setPointerCapture(e.pointerId);
        press(midi);
      });
      key.addEventListener('pointerup', () => release(midi));
      key.addEventListener('pointercancel', () => release(midi));
      key.addEventListener('pointerleave', (e) => {
        if (e.buttons > 0) release(midi);
      });
    }
  }

  // パソコンのキーボードはアプリ全体で受ける。[ ] はオクターブ移動に充てる
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    if (e.key === '[') {
      shiftOctave(-1);
      return;
    }
    if (e.key === ']') {
      shiftOctave(1);
      return;
    }
    const midi = keyToMidi(e.key, 4 + octaveShift);
    if (midi !== null) {
      e.preventDefault();
      press(midi);
    }
  });
  window.addEventListener('keyup', (e) => {
    const midi = keyToMidi(e.key, 4 + octaveShift);
    if (midi !== null) release(midi);
  });
  window.addEventListener('blur', () => {
    for (const m of [...held]) release(m);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeChoice === 'system') applyTheme();
  });

  // ライブのオシロスコープ
  let scopeRunning = false;
  function startScope(): void {
    if (scopeRunning) return;
    const analyser = engine.analyserNode;
    if (!analyser) return;
    scopeRunning = true;
    const buf = new Uint8Array(analyser.fftSize);
    const W = 320;
    const H = 120;
    const draw = (): void => {
      analyser.getByteTimeDomainData(buf);
      const step = Math.ceil(buf.length / W);
      let d = '';
      for (let x = 0; x < W; x++) {
        const v = (buf[x * step] ?? 128) / 128 - 1;
        const y = H / 2 - v * (H / 2 - 6);
        d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
      }
      root.querySelector('#scope-path')?.setAttribute('d', d);
      requestAnimationFrame(draw);
    };
    draw();
  }

  applyTheme();
  render();
}
