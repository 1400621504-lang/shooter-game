// 音效 — Web Audio API 合成 + 哈气录音

class AudioManager {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._masterGain = null;
    this._hissAudios = null;
  }

  // 必须在用户手势回调里调用以解锁 AudioContext
  init() {
    if (this.ready) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 1.0;
      this._masterGain.connect(this.ctx.destination);
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
      gain.connect(this._masterGain);
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

  shoot()      { this._noise(0.04, 0.16); this._tone(900, 0.03, 'square', 0.12); }
  hit()        { this._tone(220, 0.07, 'sawtooth', 0.24); }
  explosion()  { this._noise(0.18, 0.28); this._tone(70, 0.15, 'triangle', 0.32); }
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
    a.volume = 1.0;
    a.play().catch(() => {});
  }
  // 坦克 Boss：导弹发射
  missileLaunch() {
    this._noise(0.12, 0.05);
    this._tone(180, 0.25, 'sawtooth', 0.06);
    this._tone(90, 0.35, 'triangle', 0.05);
  }
  // 坦克 Boss：环形炮击
  tankShell() {
    this._tone(50, 0.3, 'triangle', 0.1);
    this._noise(0.15, 0.06);
    this._tone(30, 0.4, 'sine', 0.08);
  }
  // 坦克 Boss：导弹爆炸
  missileExplosion() {
    this._noise(0.2, 0.08);
    this._tone(60, 0.18, 'sawtooth', 0.07);
  }
  // 超人 Boss：高速冲刺
  supermanDash() {
    this._noise(0.08, 0.04);
    this._tone(600, 0.12, 'sine', 0.04);
    this._tone(1200, 0.08, 'sine', 0.03);
  }
  // 超人 Boss：闪避
  supermanDodge() {
    this._tone(800, 0.06, 'square', 0.03);
    this._tone(400, 0.1, 'sine', 0.04);
  }
  // 飞机 Boss：弹幕倾泻
  aircraftBarrage() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this._noise(0.03, 0.03);
        this._tone(300 + Math.random() * 200, 0.04, 'square', 0.04);
      }, i * 40);
    }
  }
  // 飞机 Boss：导弹齐射
  aircraftMissile() {
    this._tone(150, 0.3, 'sawtooth', 0.05);
    this._noise(0.15, 0.05);
  }
  // 飞机 Boss：俯冲
  aircraftDive() {
    this._tone(500, 0.15, 'sawtooth', 0.06);
    this._tone(200, 0.25, 'triangle', 0.07);
    this._noise(0.1, 0.04);
  }

  // Boss 出场低音警报
  bossWarning() {
    this._tone(200, 0.3, 'sawtooth', 0.08);
    this._tone(150, 0.5, 'triangle', 0.06);
    setTimeout(() => this._tone(250, 0.25, 'sawtooth', 0.08), 350);
    setTimeout(() => this._tone(180, 0.4, 'triangle', 0.06), 700);
  }
}
