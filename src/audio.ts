export class OrganismAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  muted = false;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.12;
    this.master.connect(this.ctx.destination);

    // Ambient drone — sine wave, very quiet
    this.drone = this.ctx.createOscillator();
    this.drone.type = 'sine';
    this.drone.frequency.value = 110;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.025;
    this.drone.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.drone.start();
  }

  update(
    breathValue: number,
    excitement: number,
    mood: number,
    twitchFired: boolean,
    startleFired: boolean,
    prevBreathValue: number,
  ): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Drone: mood modulates pitch (anxious = lower, curious = higher)
    const freq = 90 + (mood + 1) * 0.5 * 80;  // 90–170 Hz
    this.drone!.frequency.setTargetAtTime(freq, now, 1.2);
    this.droneGain!.gain.setTargetAtTime(0.018 + excitement * 0.03, now, 0.5);

    // Breath pulse on inhale peak (breathValue crosses +0.8 rising)
    if (breathValue > 0.8 && prevBreathValue <= 0.8) {
      this.pulse(excitement);
    }

    if (twitchFired) this.twitch();
    if (startleFired) this.startle();
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
  }

  private startle(): void {
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(now);
    osc.stop(now + 0.2);
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
