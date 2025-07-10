// 画面の描画と操作。パッチを1つ持ち、つまみを動かすたびに音のエンジンと
// 図(波形・フィルタ特性・エンベロープ)へ反映する。鍵盤はマウスと
// パソコンのキーボードの両方で弾ける。

import {
  FILTER_TYPES,
  LFO_TARGETS,
  PRESETS,
  RANGE,
  WAVEFORMS,
  type Patch,
  type PatchStore,
} from './lib/patch';
import { SynthEngine } from './lib/engine';
import { isSharp, keyToMidi, midiToName, noteRange } from './lib/notes';
import { renderCycle, toPath } from './lib/waveform';
import { responsePath } from './lib/filterResponse';
import { envelopePath } from './lib/adsr';
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

export interface AppDeps {
  root: HTMLElement;
  store: PatchStore;
  engine: SynthEngine;
  initialPatch: Patch;
}

export function createApp({ root, store, engine, initialPatch }: AppDeps): void {
  let patch = initialPatch;
  let octaveShift = 0;
  const held = new Set<number>();
  let audioReady = false;

  function commit(): void {
    store.save(patch);
    engine.setPatch(patch);
  }

  async function ensureAudio(): Promise<void> {
    if (audioReady) return;
    await engine.resume();
    audioReady = true;
    root.querySelector('#audio-hint')?.classList.add('hidden');
    startScope();
  }

  function seg(path: string, choices: readonly string[], labels: Record<string, string>): string {
    const current = getPath(patch, path);
    return `<div class="segmented" role="radiogroup">${choices
      .map(
        (c) =>
          `<button type="button" role="radio" aria-checked="${c === current}" class="seg ${
            c === current ? 'active' : ''
          }" data-param="${path}" data-value="${c}">${labels[c] ?? c}</button>`,
      )
      .join('')}</div>`;
  }

  function range(path: string, min: number, max: number, step: number): string {
    const value = getPath(patch, path) as number;
    return `<label class="knob"><span class="knob-name">${knobName(path)}</span>
      <input type="range" data-param="${path}" min="${min}" max="${max}" step="${step}" value="${value}"/>
      <span class="knob-val" data-display="${path}">${formatValue(path, value)}</span></label>`;
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

  function oscModule(which: 'oscA' | 'oscB', title: string): string {
    return `<section class="module">
      <h2>${title}</h2>
      ${seg(`${which}.waveform`, WAVEFORMS, WAVE_LABEL)}
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

  function render(): void {
    root.innerHTML = `
      <header class="site-header">
        <div class="site-header-inner">
          <span class="brand">${icons.logo}<span>neiro</span></span>
          <span class="tagline">配線して音を作るシンセサイザー</span>
          <label class="master"><span>${knobName('volume')}</span>
            <input type="range" data-param="volume" min="0" max="1" step="0.01" value="${patch.volume}"/></label>
        </div>
      </header>
      <main class="site-main">
        <p class="audio-hint" id="audio-hint">鍵盤に触れるか、キーボードのキーを押すと音が出ます。</p>

        <div class="visuals">
          <figure class="viz"><figcaption>オシレータ波形</figcaption>
            <svg viewBox="0 0 280 96" preserveAspectRatio="none" role="img" aria-label="合成された波形">
              <path id="wave-path" class="viz-line" d="" fill="none"/>
            </svg></figure>
          <figure class="viz"><figcaption>出力(オシロスコープ)</figcaption>
            <svg viewBox="0 0 280 96" preserveAspectRatio="none" role="img" aria-label="出力の波形">
              <path id="scope-path" class="viz-line accent" d="M0 48 L280 48" fill="none"/>
            </svg></figure>
          <figure class="viz"><figcaption>フィルタ特性</figcaption>
            <svg viewBox="0 0 280 96" preserveAspectRatio="none" role="img" aria-label="フィルタの周波数特性">
              <path id="resp-path" class="viz-line" d="" fill="none"/>
            </svg></figure>
        </div>

        <div class="rack">
          ${oscModule('oscA', 'オシレータ A')}
          ${oscModule('oscB', 'オシレータ B')}
          <section class="module">
            <h2>フィルタ</h2>
            ${seg('filter.type', FILTER_TYPES, FILTER_LABEL)}
            <div class="knobs">
              ${range('filter.cutoff', RANGE.cutoff.min, RANGE.cutoff.max, 1)}
              ${range('filter.resonance', RANGE.resonance.min, RANGE.resonance.max, 0.1)}
              ${range('filter.envAmount', RANGE.envAmount.min, RANGE.envAmount.max, 0.01)}
              ${range('noise', RANGE.noise.min, RANGE.noise.max, 0.01)}
            </div>
          </section>
          <section class="module">
            <h2>アンプ エンベロープ</h2>
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
            <h2>フィルタ エンベロープ</h2>
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
            <h2>LFO</h2>
            ${seg('lfo.waveform', WAVEFORMS, WAVE_LABEL)}
            <div class="seg-label">行き先</div>
            ${seg('lfo.target', LFO_TARGETS, TARGET_LABEL)}
            <div class="knobs">
              ${range('lfo.rate', RANGE.rate.min, RANGE.rate.max, 0.01)}
              ${range('lfo.depth', RANGE.depth.min, RANGE.depth.max, 0.01)}
            </div>
          </section>
        </div>

        <section class="presets">
          <span class="presets-label">プリセット</span>
          ${PRESETS.map(
            (p, i) => `<button type="button" class="chip" data-preset="${i}">${p.name}</button>`,
          ).join('')}
        </section>

        <div class="play">
          <div class="octave-shift">
            <button type="button" class="button ghost" id="oct-down" aria-label="オクターブを下げる">${icons.minus}</button>
            <span id="oct-label">オクターブ ${octaveShift > 0 ? '+' : ''}${octaveShift}</span>
            <button type="button" class="button ghost" id="oct-up" aria-label="オクターブを上げる">${icons.plus}</button>
          </div>
          ${keyboard()}
        </div>
      </main>
      <footer class="site-footer">
        <p>neiro — ブラウザの中だけで音を合成するシンセサイザー。音色はこの端末に保存され、外部には送りません。</p>
      </footer>`;
    bindEvents();
    refreshVisuals();
  }

  function refreshVisuals(): void {
    setPathAttr('#wave-path', toPath(renderCycle(patch, 256), 280, 96, 6));
    setPathAttr('#resp-path', responsePath(patch.filter, { width: 280, height: 96 }));
    setPathAttr('#amp-env-path', envelopePath(patch.ampEnv, 240, 70, 4));
    setPathAttr('#flt-env-path', envelopePath(patch.filterEnv, 240, 70, 4));
  }

  function setPathAttr(sel: string, d: string): void {
    root.querySelector(sel)?.setAttribute('d', d);
  }

  function bindEvents(): void {
    for (const el of root.querySelectorAll<HTMLInputElement>('input[type="range"][data-param]')) {
      el.addEventListener('input', () => {
        const path = el.dataset.param as string;
        setPath(patch, path, Number(el.value));
        const disp = root.querySelector(`[data-display="${path}"]`);
        if (disp) disp.textContent = formatValue(path, Number(el.value));
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
        if (preset) {
          patch = structuredClone(preset.patch);
          commit();
          render();
        }
      });
    }
    root.querySelector('#oct-down')?.addEventListener('click', () => shiftOctave(-1));
    root.querySelector('#oct-up')?.addEventListener('click', () => shiftOctave(1));
    bindKeyboard();
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

  // パソコンのキーボードはアプリ全体で受ける
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
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

  // ライブのオシロスコープ
  let scopeRunning = false;
  function startScope(): void {
    if (scopeRunning) return;
    const analyser = engine.analyserNode;
    if (!analyser) return;
    scopeRunning = true;
    const buf = new Uint8Array(analyser.fftSize);
    const W = 280;
    const H = 96;
    const draw = (): void => {
      analyser.getByteTimeDomainData(buf);
      const step = Math.ceil(buf.length / W);
      let d = '';
      for (let x = 0; x < W; x++) {
        const v = (buf[x * step] ?? 128) / 128 - 1;
        const y = H / 2 - v * (H / 2 - 4);
        d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
      }
      root.querySelector('#scope-path')?.setAttribute('d', d);
      requestAnimationFrame(draw);
    };
    draw();
  }

  render();
}
