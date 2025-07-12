import './style.css';
import { createApp } from './app';
import { SynthEngine } from './lib/engine';
import { createStore, defaultPatch } from './lib/patch';
import { patchFromHash } from './lib/share';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);

// 共有リンク(#p=...)があればその音色を最優先で開く。なければ前回保存、
// それも無ければ既定の音色から始める。
const initialPatch = patchFromHash(location.hash) ?? store.load() ?? defaultPatch();
store.save(initialPatch);

const engine = new SynthEngine(initialPatch);

createApp({ root, store, engine, initialPatch });
