// Neon Void — synthesized sound effects. Every sound is generated with the
// Web Audio API at play time, so the game ships zero audio files and still
// works fully offline. Audio starts lazily on the first user gesture.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freqFrom, freqTo, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds);
  }

  noise(seconds, volume) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(gain).connect(this.master);
    source.start(t);
  }

  shoot() { this.tone(880, 320, 0.08, 'square', 0.25); }
  hit() { this.tone(300, 140, 0.05, 'sawtooth', 0.18); }
  explosion() { this.noise(0.28, 0.5); this.tone(160, 40, 0.3, 'triangle', 0.4); }
  pickup() { this.tone(620, 1180, 0.09, 'sine', 0.3); }
  hurt() { this.tone(200, 60, 0.22, 'sawtooth', 0.45); }
  upgrade() { this.tone(440, 880, 0.16, 'sine', 0.3); this.tone(660, 1320, 0.22, 'sine', 0.22); }
  waveClear() { this.tone(523, 523, 0.1, 'sine', 0.3); setTimeout(() => this.tone(784, 784, 0.16, 'sine', 0.3), 90); }
}
