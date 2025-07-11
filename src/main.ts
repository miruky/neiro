import './style.css';
import { createApp } from './app';
import { SynthEngine } from './lib/engine';
import { createStore, defaultPatch } from './lib/patch';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);

// 一度でも保存があればその音色から、なければ既定の音色で始める
const initialPatch = store.load() ?? defaultPatch();
store.save(initialPatch);

const engine = new SynthEngine(initialPatch);

createApp({ root, store, engine, initialPatch });
