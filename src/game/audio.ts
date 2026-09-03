export class AudioManager {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private beep(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0,
  ): void {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  shoot(): void {
    this.beep(820, 0.07, "square", 0.035);
  }

  enemyShot(): void {
    this.beep(300, 0.12, "sawtooth", 0.025);
  }

  hit(): void {
    this.beep(210, 0.16, "triangle", 0.07);
  }

  explosion(big = false): void {
    this.beep(big ? 85 : 150, big ? 0.5 : 0.24, "sawtooth", 0.12);
    this.beep(big ? 55 : 120, big ? 0.6 : 0.28, "square", 0.05);
  }

  gameOver(): void {
    this.beep(440, 0.18, "sawtooth", 0.05);
    this.beep(330, 0.18, "sawtooth", 0.05, 0.17);
    this.beep(220, 0.4, "sawtooth", 0.06, 0.34);
  }

  levelUp(): void {
    this.beep(660, 0.09, "square", 0.05);
    this.beep(880, 0.09, "square", 0.05, 0.09);
    this.beep(1100, 0.14, "square", 0.05, 0.18);
  }

  chapter(): void {
    this.beep(330, 0.14, "sawtooth", 0.07);
    this.beep(262, 0.14, "sawtooth", 0.07, 0.14);
    this.beep(196, 0.3, "sawtooth", 0.09, 0.28);
    this.beep(392, 0.24, "square", 0.05, 0.56);
  }

  powerup(): void {
    this.beep(620, 0.08, "square", 0.05);
    this.beep(940, 0.09, "square", 0.05, 0.08);
    this.beep(1250, 0.14, "square", 0.04, 0.16);
  }

  bomb(): void {
    this.beep(140, 0.5, "sawtooth", 0.14);
    this.beep(70, 0.6, "sine", 0.12, 0.05);
  }

  boost(): void {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t0);
    osc.frequency.exponentialRampToValueAtTime(980, t0 + 0.4);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.5);
  }

  countBeep(go = false): void {
    this.beep(go ? 880 : 440, go ? 0.28 : 0.1, "square", 0.07);
  }

  combo(level: number): void {
    const base = 500 + Math.min(6, level) * 80;
    this.beep(base, 0.06, "square", 0.05);
    this.beep(base * 1.26, 0.07, "square", 0.05, 0.05);
    if (level >= 4) this.beep(base * 1.5, 0.09, "square", 0.05, 0.1);
  }
}