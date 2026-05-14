/**
 * Procedural audio via Web Audio API. No assets, all synthesized.
 * Tiny & fits the cozy aesthetic.
 */

export class Audio {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.musicNodes = null;
  }

  _ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.muted = true;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = m;
    this._ensure();
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // One-shot tone helper
  _tone({ freq = 440, type = "sine", dur = 0.15, vol = 0.3, slide = 0, attack = 0.01, release = 0.05 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  coin() {
    this._ensure();
    this._tone({ freq: 880, type: "triangle", dur: 0.08, vol: 0.18 });
    setTimeout(() => this._tone({ freq: 1320, type: "triangle", dur: 0.1, vol: 0.18 }), 60);
  }

  jump() {
    this._ensure();
    this._tone({ freq: 320, type: "square", dur: 0.12, vol: 0.16, slide: 320 });
  }

  slide() {
    this._ensure();
    this._tone({ freq: 220, type: "sawtooth", dur: 0.18, vol: 0.12, slide: -120 });
  }

  laneChange() {
    this._ensure();
    this._tone({ freq: 660, type: "triangle", dur: 0.06, vol: 0.1 });
  }

  hit() {
    this._ensure();
    if (!this.ctx || this.muted) return;
    // Noise burst
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 4410, 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.45;
    src.connect(g).connect(this.master);
    src.start(t);
  }

  shieldBlock() {
    this._ensure();
    this._tone({ freq: 660, type: "triangle", dur: 0.2, vol: 0.25, slide: 200 });
  }

  powerup() {
    this._ensure();
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this._tone({ freq: f, type: "triangle", dur: 0.1, vol: 0.18 }), i * 60);
    });
  }

  gameOver() {
    this._ensure();
    [392, 349, 311, 261].forEach((f, i) => {
      setTimeout(() => this._tone({ freq: f, type: "sawtooth", dur: 0.25, vol: 0.2 }), i * 130);
    });
  }

  startMusic() {
    this._ensure();
    if (!this.ctx || this.musicNodes) return;
    // Soft ambient pad: two detuned saws + lowpass
    const t = this.ctx.currentTime;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = "sawtooth";
    o2.type = "sawtooth";
    o1.frequency.value = 220;
    o2.frequency.value = 222;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(this.master);
    o1.start(t);
    o2.start(t);
    this.musicNodes = { o1, o2, g, lp };

    // Subtle vibe variation
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 200;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start(t);
    this.musicNodes.lfo = lfo;
  }

  stopMusic() {
    if (!this.musicNodes) return;
    const { o1, o2, lfo } = this.musicNodes;
    try { o1.stop(); } catch {}
    try { o2.stop(); } catch {}
    try { lfo.stop(); } catch {}
    this.musicNodes = null;
  }
}
