// Web Audio による発音。パッチの配線(2オシレータ→ミキサ→フィルタ→アンプ)を
// ノートごとの声(ボイス)として組み立て、ADSRとLFOで時間変化を与える。
// AudioContext を使うためテストはせず、純粋計算は別モジュールに置いている。

import { midiToFreq } from './notes';
import type { LfoTarget, Patch } from './patch';

interface Voice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  noiseGain: GainNode;
  gainA: GainNode;
  gainB: GainNode;
  filter: BiquadFilterNode;
  amp: GainNode;
  midi: number;
}

const clampFreq = (f: number): number => Math.min(20000, Math.max(20, f));

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private tremolo!: GainNode;
  private analyser!: AnalyserNode;
  private lfo!: OscillatorNode;
  private lfoDepth!: GainNode;
  private noise!: AudioBufferSourceNode;
  private voices = new Map<number, Voice>();
  private patch: Patch;

  constructor(patch: Patch) {
    this.patch = patch;
  }

  /** 利用者の操作を機にAudioContextを起こす。以後の発音はこれが前提 */
  async resume(): Promise<void> {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
  }

  get analyserNode(): AnalyserNode | null {
    return this.ctx ? this.analyser : null;
  }

  private build(): void {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.patch.volume;
    this.tremolo = ctx.createGain();
    this.tremolo.gain.value = 1;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.tremolo).connect(this.analyser).connect(ctx.destination);

    this.lfo = ctx.createOscillator();
    this.lfo.type = this.patch.lfo.waveform;
    this.lfo.frequency.value = this.patch.lfo.rate;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth);
    this.lfo.start();

    this.noise = ctx.createBufferSource();
    this.noise.buffer = this.makeNoise(ctx);
    this.noise.loop = true;
    this.noise.start();

    this.applyLfo();
  }

  private makeNoise(ctx: BaseAudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** LFOの深さと行き先を現在のパッチに合わせる */
  private applyLfo(): void {
    if (!this.ctx) return;
    const { depth, target } = this.patch.lfo;
    try {
      this.lfoDepth.disconnect();
    } catch {
      // 未接続なら無視
    }
    this.lfoDepth.gain.value =
      target === 'pitch' ? depth * 60 : target === 'filter' ? depth * 2400 : depth * 0.5;
    if (target === 'amplitude') {
      this.lfoDepth.connect(this.tremolo.gain);
    } else {
      for (const v of this.voices.values()) this.routeLfoToVoice(v, target);
    }
  }

  private routeLfoToVoice(v: Voice, target: LfoTarget): void {
    if (target === 'pitch') {
      this.lfoDepth.connect(v.oscA.detune);
      this.lfoDepth.connect(v.oscB.detune);
    } else if (target === 'filter') {
      this.lfoDepth.connect(v.filter.frequency);
    }
  }

  setPatch(patch: Patch): void {
    this.patch = patch;
    if (!this.ctx) return;
    this.master.gain.value = patch.volume;
    this.lfo.type = patch.lfo.waveform;
    this.lfo.frequency.value = patch.lfo.rate;
    for (const v of this.voices.values()) this.applyPatchToVoice(v);
    this.applyLfo();
  }

  private applyPatchToVoice(v: Voice): void {
    const p = this.patch;
    v.oscA.type = p.oscA.waveform;
    v.oscB.type = p.oscB.waveform;
    v.oscA.detune.value = p.oscA.octave * 1200 + p.oscA.detune;
    v.oscB.detune.value = p.oscB.octave * 1200 + p.oscB.detune;
    v.gainA.gain.value = p.oscA.level;
    v.gainB.gain.value = p.oscB.level;
    v.noiseGain.gain.value = p.noise;
    v.filter.type = p.filter.type;
    v.filter.Q.value = p.filter.resonance;
    v.filter.frequency.value = clampFreq(p.filter.cutoff);
  }

  noteOn(midi: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const existing = this.voices.get(midi);
    if (existing) this.stopVoice(existing, now, 0.005);

    const p = this.patch;
    const freq = midiToFreq(midi);

    const oscA = ctx.createOscillator();
    oscA.type = p.oscA.waveform;
    oscA.frequency.value = freq;
    oscA.detune.value = p.oscA.octave * 1200 + p.oscA.detune;
    const oscB = ctx.createOscillator();
    oscB.type = p.oscB.waveform;
    oscB.frequency.value = freq;
    oscB.detune.value = p.oscB.octave * 1200 + p.oscB.detune;

    const gainA = ctx.createGain();
    gainA.gain.value = p.oscA.level;
    const gainB = ctx.createGain();
    gainB.gain.value = p.oscB.level;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = p.noise;

    const filter = ctx.createBiquadFilter();
    filter.type = p.filter.type;
    filter.Q.value = p.filter.resonance;

    const amp = ctx.createGain();
    amp.gain.value = 0;

    oscA.connect(gainA).connect(filter);
    oscB.connect(gainB).connect(filter);
    this.noise.connect(noiseGain).connect(filter);
    filter.connect(amp).connect(this.master);

    const voice: Voice = { oscA, oscB, noiseGain, gainA, gainB, filter, amp, midi };
    this.scheduleAmp(amp.gain, now);
    this.scheduleFilter(filter.frequency, now);
    if (this.patch.lfo.target !== 'amplitude') {
      this.routeLfoToVoice(voice, this.patch.lfo.target);
    }

    oscA.start(now);
    oscB.start(now);
    this.voices.set(midi, voice);
  }

  private scheduleAmp(gain: AudioParam, now: number): void {
    const e = this.patch.ampEnv;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(1, now + e.attack);
    gain.linearRampToValueAtTime(e.sustain, now + e.attack + e.decay);
  }

  private scheduleFilter(freq: AudioParam, now: number): void {
    const p = this.patch;
    const base = clampFreq(p.filter.cutoff);
    const e = p.filterEnv;
    const octaves = p.filter.envAmount * 4;
    const peak = clampFreq(base * 2 ** octaves);
    const sustainFreq = clampFreq(base * 2 ** (octaves * e.sustain));
    freq.cancelScheduledValues(now);
    freq.setValueAtTime(base, now);
    freq.exponentialRampToValueAtTime(peak, now + e.attack);
    freq.exponentialRampToValueAtTime(sustainFreq, now + e.attack + e.decay);
  }

  noteOff(midi: number): void {
    if (!this.ctx) return;
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    this.stopVoice(v, this.ctx.currentTime, this.patch.ampEnv.release);
  }

  private stopVoice(v: Voice, now: number, release: number): void {
    const end = now + Math.max(release, 0.01);
    v.amp.gain.cancelScheduledValues(now);
    v.amp.gain.setValueAtTime(v.amp.gain.value, now);
    v.amp.gain.linearRampToValueAtTime(0, end);
    const base = clampFreq(this.patch.filter.cutoff);
    v.filter.frequency.cancelScheduledValues(now);
    v.filter.frequency.setValueAtTime(v.filter.frequency.value, now);
    v.filter.frequency.exponentialRampToValueAtTime(base, end);
    v.oscA.stop(end + 0.05);
    v.oscB.stop(end + 0.05);
    window.setTimeout(
      () => {
        for (const node of [v.oscA, v.oscB, v.gainA, v.gainB, v.noiseGain, v.filter, v.amp]) {
          try {
            node.disconnect();
          } catch {
            // すでに切れていれば無視
          }
        }
      },
      (Math.max(release, 0.01) + 0.1) * 1000,
    );
  }

  /** 押されている音をすべて離す */
  allNotesOff(): void {
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
  }
}
