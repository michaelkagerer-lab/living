import type { BehaviorState } from './types';
import {
  DRONE_BASE_FREQ,
  DRONE_INTERVAL_CALM, DRONE_INTERVAL_TENSE, DRONE_INTERVAL_DRIFT,
  DRONE_LFO_FREQ, DRONE_LFO_AMP, DRONE_VOICE2_GAIN,
} from './config';

export class OrganismAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private drone2: OscillatorNode | null = null;
  private droneGain2: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  muted = false;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.12;
    this.master.connect(this.ctx.destination);

    // Voice 1 — ambient sine drone, mood-reactive pitch
    this.drone = this.ctx.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = DRONE_BASE_FREQ;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.025;
    this.drone.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.drone.start();

    // Voice 2 — harmony, interval shifts with behavioral state
    this.drone2 = this.ctx.createOscillator();
    this.drone2.type = 'sine';
    this.drone2.frequency.value = DRONE_BASE_FREQ * DRONE_INTERVAL_CALM;
    this.droneGain2 = this.ctx.createGain();
    this.droneGain2.gain.value = DRONE_VOICE2_GAIN;

    // LFO — slow volume breath on voice 2
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = DRONE_LFO_FREQ;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = DRONE_VOICE2_GAIN * DRONE_LFO_AMP;

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.droneGain2.gain);
    this.drone2.connect(this.droneGain2);
    this.droneGain2.connect(this.master);
    this.drone2.start();
    this.lfo.start();
  }

  update(
    breathValue: number,
    excitement: number,
    mood: number,
    twitchFired: boolean,
    startleFired: boolean,
    prevBreathValue: number,
    behaviorState: BehaviorState,
    startleResponseScale: number,
  ): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Voice 1: mood modulates pitch (anxious = lower, curious = higher)
    const freq = 90 + (mood + 1) * 0.5 * 80;
    this.drone!.frequency.setTargetAtTime(freq, now, 1.2);
    this.droneGain!.gain.setTargetAtTime(0.018 + excitement * 0.03, now, 0.5);

    // Voice 2: interval narrows under tension, beats gently in calm
    const targetInterval = (behaviorState === 'STARTLED' || behaviorState === 'CAUTIOUS')
      ? DRONE_INTERVAL_TENSE : DRONE_INTERVAL_CALM;
    const drift = Math.sin(now * DRONE_INTERVAL_DRIFT * Math.PI * 2) * 0.003;
    this.drone2!.frequency.setTargetAtTime(freq * (targetInterval + drift), now, 2.5);
    this.droneGain2!.gain.setTargetAtTime(DRONE_VOICE2_GAIN + excitement * 0.01, now, 0.8);

    // Breath pulse on inhale peak (breathValue crosses +0.8 rising)
    if (breathValue > 0.8 && prevBreathValue <= 0.8) {
      this.pulse(excitement);
    }

    if (twitchFired) this.twitch();
    if (startleFired) this.startle(startleResponseScale);
  }

  private noise(duration: number): AudioBuffer {
    const sr  = this.ctx!.sampleRate;
    const buf = this.ctx!.createBuffer(1, Math.ceil(sr * duration), sr);
    const ch  = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }

  private pulse(excitement: number): void {
    const now    = this.ctx!.currentTime;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300 + excitement * 600;
    filter.Q.value = 6;
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise(0.25);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(now);
    src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  private twitch(): void {
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    osc.frequency.value = 800 + Math.random() * 400;
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + 0.04);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private startle(responseScale: number): void {
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.18 * responseScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  toggle(): void {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.12,
        this.ctx.currentTime,
        0.1,
      );
    }
  }
}
