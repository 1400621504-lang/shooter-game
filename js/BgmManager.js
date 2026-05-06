// BGM 管理器 — Web Audio API 播放，兼容移动端

const BGM_VOLUME = 0.38;
const BOSS_BGM_VOLUME = 0.32;
const BGM_PLAYLIST_NAMES = ['不再曼波', '打火基'];
const BGM_URLS = ['bgm/不再曼波.mp3', 'bgm/打火基.mp3'];
const BOSS_BGM_URL = 'bgm/boss战bgm.mp3';

class BgmManager {
  constructor() {
    this.currentIdx = 0;
    this.playing = false;
    this._bossMode = false;
    this._muted = false;
    this._bgmVolume = BGM_VOLUME;
    this._bossVolume = BOSS_BGM_VOLUME;
    this._audioCtx = null;
    this._gainNode = null;
    this._source = null;

    // 轨道状态：null=未加载, ArrayBuffer=已取回未解码, AudioBuffer=已就绪
    this._tracks = [null, null];
    this._bossTrack = null;
    this._playQueued = false;

    // 启动预加载
    this._preload();
  }

  // ── 预加载：fetch 原始数据 ──

  async _preload() {
    for (let i = 0; i < BGM_URLS.length; i++) this._fetchTrack(i);
    this._fetchBoss();
  }

  async _fetchTrack(idx) {
    try {
      const resp = await fetch(BGM_URLS[idx]);
      if (!resp.ok) return;
      this._tracks[idx] = await resp.arrayBuffer();
      if (this._audioCtx) this._decodeTrack(idx);
    } catch (_) {}
  }

  async _fetchBoss() {
    try {
      const resp = await fetch(BOSS_BGM_URL);
      if (!resp.ok) return;
      this._bossTrack = await resp.arrayBuffer();
      if (this._audioCtx) this._decodeBoss();
    } catch (_) {}
  }

  // ── 解码 ──

  async _decodeTrack(idx) {
    if (!this._audioCtx || !this._tracks[idx] || !(this._tracks[idx] instanceof ArrayBuffer)) return;
    try {
      this._tracks[idx] = await this._audioCtx.decodeAudioData(this._tracks[idx]);
    } catch (_) { this._tracks[idx] = null; }
    this._checkQueued();
  }

  async _decodeBoss() {
    if (!this._audioCtx || !this._bossTrack || !(this._bossTrack instanceof ArrayBuffer)) return;
    try {
      this._bossTrack = await this._audioCtx.decodeAudioData(this._bossTrack);
    } catch (_) { this._bossTrack = null; }
    this._checkQueued();
  }

  // 解码所有待解码数据（setAudioContext 时调用）
  _decodeAll() {
    for (let i = 0; i < BGM_URLS.length; i++) {
      if (this._tracks[i] instanceof ArrayBuffer) this._decodeTrack(i);
    }
    if (this._bossTrack instanceof ArrayBuffer) this._decodeBoss();
  }

  // ── 播放队列 ──

  _checkQueued() {
    if (!this._playQueued) return;
    const buf = this._bossMode ? this._bossTrack : this._tracks[this.currentIdx];
    if (buf instanceof AudioBuffer) {
      this._playQueued = false;
      this._doPlay();
    }
  }

  // ── AudioContext 关联（main.js 在用户手势后调用）──

  setAudioContext(ctx) {
    if (this._audioCtx) return;
    this._audioCtx = ctx;
    this._gainNode = ctx.createGain();
    this._gainNode.gain.value = this._bgmVolume;
    this._gainNode.connect(ctx.destination);
    // 解码已取回但未解码的数据
    this._decodeAll();
    // 尝试恢复之前排队的播放
    this._checkQueued();
  }

  // ── 属性 ──

  get currentName() {
    if (this._bossMode) return (this._muted ? '[静音] ' : '') + '⚔ Boss 战 ♪';
    return (this._muted ? '[静音] ' : '') + BGM_PLAYLIST_NAMES[this.currentIdx];
  }

  get muted() { return this._muted || false; }

  get progress() {
    if (!this._source) return 0;
    const buf = this._bossMode ? this._bossTrack : this._tracks[this.currentIdx];
    if (!buf || !buf.duration) return 0;
    const elapsed = this._audioCtx ? (this._audioCtx.currentTime - this._startTime) : 0;
    return (elapsed % buf.duration) / buf.duration;
  }

  get isBossMode() { return this._bossMode; }

  // ── 控制 ──

  toggleMute() {
    this._muted = !this._muted;
    if (this._gainNode) this._gainNode.gain.value = this._muted ? 0 : this._bgmVolume;
  }

  setBossMode(isBoss) {
    if (isBoss === this._bossMode) return;
    this._bossMode = isBoss;
    this._stopSource();
    if (this.playing) this._doPlay();
  }

  setBgmVolume(v) {
    this._bgmVolume = v;
    if (this._gainNode && !this._muted) this._gainNode.gain.value = v;
  }

  setBossVolume(v) {
    this._bossVolume = v;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this._doPlay();
  }

  stop() {
    this.playing = false;
    this._bossMode = false;
    this._playQueued = false;
    this._stopSource();
  }

  setSong(idx) {
    if (this._bossMode) return;
    const wasPlaying = this.playing;
    this._stopSource();
    this.currentIdx = ((idx % BGM_PLAYLIST_NAMES.length) + BGM_PLAYLIST_NAMES.length) % BGM_PLAYLIST_NAMES.length;
    if (wasPlaying) this._doPlay();
  }

  next() { this.setSong(this.currentIdx + 1); }
  prev() { this.setSong(this.currentIdx - 1); }

  _randomNext() {
    const total = BGM_PLAYLIST_NAMES.length;
    if (total <= 1) return;
    let next;
    do { next = Math.floor(Math.random() * total); }
    while (next === this.currentIdx);
    this.setSong(next);
  }

  _stopSource() {
    try { if (this._source) { this._source.onended = null; this._source.stop(); } } catch (_) {}
    this._source = null;
  }

  _doPlay() {
    if (!this._audioCtx || !this.playing) return;

    // 每次尝试都重置队列标记，避免旧标记残留导致随机重播
    this._playQueued = false;

    const buf = this._bossMode ? this._bossTrack : this._tracks[this.currentIdx];
    if (!(buf instanceof AudioBuffer)) {
      this._playQueued = true;
      return;
    }

    this._stopSource();

    const vol = this._muted ? 0 : (this._bossMode ? this._bossVolume : this._bgmVolume);
    if (this._gainNode) this._gainNode.gain.value = vol;

    try {
      const src = this._audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this._gainNode);
      src.start(0);
      this._source = src;
      this._startTime = this._audioCtx.currentTime;
    } catch (_) {}
  }
}
