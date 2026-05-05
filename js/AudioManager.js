// 音效 — Web Audio API 合成 + 哈气录音

class AudioManager {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._hissAudios = null;
  }

  // 必须在用户手势回调里调用以解锁 AudioContext
  init() {
    if (this.ready) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ready = true;
    } catch (_) {}
  }

  _tone(freq, dur, type = 'square', vol = 0.06) {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (_) {}
  }

  _noise(dur, vol = 0.05) {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime;
      const size = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
    } catch (_) {}
  }

  shoot()      { this._noise(0.04, 0.04); this._tone(900, 0.03, 'square', 0.03); }
  hit()        { this._tone(220, 0.07, 'sawtooth', 0.06); }
  explosion()  { this._noise(0.18, 0.07); this._tone(70, 0.15, 'triangle', 0.08); }
  playerHit()  { this._tone(120, 0.25, 'square', 0.1); this._tone(80, 0.3, 'triangle', 0.08); }
  waveClear()  {
    this._tone(523, 0.12, 'square', 0.06);
    setTimeout(() => this._tone(659, 0.12, 'square', 0.06), 120);
    setTimeout(() => this._tone(784, 0.18, 'square', 0.06), 240);
  }

  // 哈气音效 — 预加载 3 段，随机播放
  _initHissAudios() {
    if (this._hissAudios) return;
    this._hissAudios = [
      new Audio('boss-imgs/hiss1.mp3'),
      new Audio('boss-imgs/hiss2.mp3'),
      new Audio('boss-imgs/hiss3.mp3')
    ];
  }
  playHiss() {
    this._initHissAudios();
    const src = this._hissAudios[Math.floor(Math.random() * 3)];
    const a = src.cloneNode(); // 每次新实例，避免浏览器节流
    a.volume = 0.7;
    a.play().catch(() => {});
  }
  // Boss 出场低音警报
  bossWarning() {
    this._tone(200, 0.3, 'sawtooth', 0.08);
    this._tone(150, 0.5, 'triangle', 0.06);
    setTimeout(() => this._tone(250, 0.25, 'sawtooth', 0.08), 350);
    setTimeout(() => this._tone(180, 0.4, 'triangle', 0.06), 700);
  }
}
