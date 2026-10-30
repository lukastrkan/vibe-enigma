/**
 * Casino & Enigma Sound Synthesizer
 * 100% Web Audio API - no external mp3 assets needed.
 */

class SlotEnigmaAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // Heavy mechanical lever pull
  playLeverPull() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Heavy spring tension thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);

    // Spring release metallic snap
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const snap = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      snap.type = 'triangle';
      snap.frequency.setValueAtTime(800, t2);
      snap.frequency.exponentialRampToValueAtTime(120, t2 + 0.08);
      sGain.gain.setValueAtTime(0.25, t2);
      sGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
      snap.connect(sGain);
      sGain.connect(this.ctx.destination);
      snap.start(t2);
      snap.stop(t2 + 0.09);
    }, 120);
  }

  // Slot reel tick (called rapidly while reels spin)
  playReelTick(pitch = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(100 * pitch, t + 0.02);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Reel stop clunk
  playReelStop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.06);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  // Jackpot / Decoded victory arpeggio
  playJackpot() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      }, idx * 70);
    });
  }

  // Standard mechanical key click
  playKeyClick() {
    this.playReelTick(1.2);
  }
}

export const sound = new SlotEnigmaAudio();
