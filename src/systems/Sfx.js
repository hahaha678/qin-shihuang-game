// 合成音效：WebAudio 现场生成，零音频文件
const Sfx = {
  ctx: null,
  noiseBuf: null,
  ok: true,

  ensure() {
    if (!this.ok) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        const len = this.ctx.sampleRate * 0.5;
        const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { this.ok = false; this.ctx = null; }
  },

  /** 音调滑动 */
  tone(f0, f1, dur, type = 'square', vol = 0.15, when = 0) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /** 滤波噪声（挥砍/风声） */
  noise(dur, vol = 0.2, freq = 1200, q = 1, when = 0) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.ctx.destination);
    s.start(t); s.stop(t + dur + 0.02);
  },

  swing()      { this.noise(0.11, 0.16, 2600, 0.8); this.tone(760, 300, 0.07, 'sine', 0.04); },
  swingHeavy() { this.noise(0.17, 0.24, 1500, 0.9); this.tone(480, 140, 0.14, 'sine', 0.07); },
  hit()        { this.tone(230, 60, 0.09, 'square', 0.2); this.noise(0.05, 0.22, 3400, 1); },
  hitHeavy()   { this.tone(150, 35, 0.17, 'square', 0.3); this.noise(0.11, 0.3, 2100, 1); },
  hurt()       { this.tone(170, 65, 0.16, 'sawtooth', 0.18); this.noise(0.08, 0.12, 900, 1); },
  enemyDie()   { this.tone(280, 45, 0.4, 'sawtooth', 0.16); this.noise(0.25, 0.14, 700, 1); },
  die()        { this.tone(190, 28, 0.7, 'sawtooth', 0.22); this.noise(0.45, 0.18, 550, 1); },
  land()       { this.noise(0.06, 0.09, 620, 1); },
  charge()     { this.tone(200, 900, 0.42, 'sine', 0.07); },
  roar()       { this.tone(110, 40, 0.6, 'sawtooth', 0.26); this.noise(0.45, 0.24, 480, 1); },
  gong()       { this.tone(140, 100, 0.8, 'sine', 0.24); this.noise(0.6, 0.1, 320, 0.7); },
  jump()       { this.noise(0.07, 0.06, 1500, 1); },
  fracture()   { this.tone(900, 70, 0.5, 'sawtooth', 0.15); this.noise(0.5, 0.14, 480, 1); this.tone(1500, 1500, 0.35, 'sine', 0.05); },
  warn()       { this.tone(880, 880, 0.07, 'square', 0.13); this.tone(880, 880, 0.07, 'square', 0.13, 0.11); },
  roll()       { this.noise(0.14, 0.09, 850, 0.9); },
  pickup() {
    this.tone(660, 660, 0.07, 'sine', 0.12);
    this.tone(880, 880, 0.07, 'sine', 0.12, 0.07);
    this.tone(1320, 1320, 0.1, 'sine', 0.1, 0.14);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone(f, f, 0.13, 'square', 0.11, i * 0.11));
  },
};
