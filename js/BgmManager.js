// BGM 管理器 — Web Audio API 播放，兼容移动端

const BGM_VOLUME = 0.38;
const BOSS_BGM_VOLUME = 0.32;

const BGM_PLAYLIST_NAMES = ['不再曼波', '打火基'];
const BGM_PATHS = ['bgm/不再曼波.mp3', 'bgm/打火基.mp3'];
const BOSS_BGM_PATH = 'bgm/boss战bgm.mp3';

class BgmManager {
  constructor() {
    this.currentIdx = 0;
    this.playing = false;
    this._bossMode = false;
    this._bgmVolume = BGM_VOLUME;
    this._bossVolume = BOSS_BGM_VOLUME;
    this._buffers = [null, null];         // 解码后的 AudioBuffer
    this._bossBuffer = null;
    this._loading = [false, false];
    this._bossLoading = false;
    this._source = null;                  // 当前播放的 SourceNode
    this._bossSource = null;
    this._gainNode = null;                // 音量控制
    this._startTime = 0;
    this._pauseOffset = 0;
    this._audioCtx = null;
    this._loadAttempted = [false, false];
    this._bossLoadAttempted = false;

    // 开始预加载
    this._preload();
  }

  // 关联 AudioContext（由 main.js 在用户手势后调用）
  setAudioContext(ctx) {
    this._audioCtx = ctx;
    if (this._gainNode) return;
    this._gainNode = ctx.createGain();
    this._gainNode.gain.value = this._bgmVolume;
    this._gainNode.connect(ctx.destination);
  }

  // 预加载所有 BGM 文件
  async _preload() {
    for (let i = 0; i < BGM_PATHS.length; i++) {
      this._loadTrack(i);
    }
    this._loadBossTrack();
  }

  async _loadTrack(idx) {
    if (this._loadAttempted[idx]) return;
    this._loadAttempted[idx] = true;
    this._loading[idx] = true;
    try {
      const resp = await fetch(BGM_PATHS[idx]);
      const buf = await resp.arrayBuffer();
      if (this._audioCtx) {
        this._buffers[idx] = await this._audioCtx.decodeAudioData(buf);
      } else {
        // 暂存原始数据，等 AudioContext 就绪后解码
        this._buffers[idx] = buf;
      }
    } catch (_) {}
    this._loading[idx] = false;
  }

  async _loadBossTrack() {
    if (this._bossLoadAttempted) return;
    this._bossLoadAttempted = true;
    this._bossLoading = true;
    try {
      const resp = await fetch(BOSS_BGM_PATH);
      const buf = await resp.arrayBuffer();
      if (this._audioCtx) {
        this._bossBuffer = await this._audioCtx.decodeAudioData(buf);
      } else {
        this._bossBuffer = buf;
      }
    } catch (_) {}
    this._bossLoading = false;
  }

  // 有 AudioContext 后解码之前缓存的原始数据
  _decodePending() {
    if (!this._audioCtx) return;
    for (let i = 0; i < this._buffers.length; i++) {
      if (this._buffers[i] && this._buffers[i] instanceof ArrayBuffer) {
        this._audioCtx.decodeAudioData(this._buffers[i])
          .then(buf => { this._buffers[i] = buf; })
          .catch(() => { this._buffers[i] = null; });
      }
    }
    if (this._bossBuffer && this._bossBuffer instanceof ArrayBuffer) {
      this._audioCtx.decodeAudioData(this._bossBuffer)
        .then(buf => { this._bossBuffer = buf; })
        .catch(() => { this._bossBuffer = null; });
    }
  }

  get currentName() {
    if (this._bossMode) return (this._muted ? '[静音] ' : '') + '⚔ Boss 战 ♪';
    return (this._muted ? '[静音] ' : '') + BGM_PLAYLIST_NAMES[this.currentIdx];
  }

  get muted() { return this._muted || false; }

  get progress() {
    if (!this._source && !this._bossSource) return 0;
    const buf = this._bossMode ? this._bossBuffer : this._buffers[this.currentIdx];
    if (!buf || !buf.duration) return 0;
    const elapsed = this._audioCtx ? (this._audioCtx.currentTime - this._startTime) : 0;
    return (elapsed % buf.duration) / buf.duration;
  }

  get isBossMode() { return this._bossMode; }

  toggleMute() {
    this._muted = !this._muted;
    const v = this._muted ? 0 : this._bgmVolume;
    if (this._gainNode) this._gainNode.gain.value = v;
  }

  setBossMode(isBoss) {
    if (isBoss === this._bossMode) return;
    this._bossMode = isBoss;
    this._stopSource();

    if (!this.playing) return;
    const vol = this._muted ? 0 : (isBoss ? this._bossVolume : this._bgmVolume);
    if (this._gainNode) this._gainNode.gain.value = vol;
    this._playCurrent();
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
    const volume = this._muted ? 0 : (this._bossMode ? this._bossVolume : this._bgmVolume);
    this._playCurrent(volume);
  }

  stop() {
    this.playing = false;
    this._bossMode = false;
    this._stopSource();
  }

  setSong(idx) {
    if (this._bossMode) return;
    const wasPlaying = this.playing;
    this._stopSource();
    this.currentIdx = ((idx % BGM_PLAYLIST_NAMES.length) + BGM_PLAYLIST_NAMES.length) % BGM_PLAYLIST_NAMES.length;
    if (wasPlaying) {
      this._playCurrent(this._gainNode ? this._gainNode.gain.value : this._bgmVolume);
    }
  }

  next() { this.setSong(this.currentIdx + 1); }
  prev() { this.setSong(this.currentIdx - 1); }

  _randomNext() {
    let next;
    const total = BGM_PLAYLIST_NAMES.length;
    if (total <= 1) { next = 0; }
    else {
      do { next = Math.floor(Math.random() * total); }
      while (next === this.currentIdx);
    }
    this.setSong(next);
  }

  _stopSource() {
    try {
      if (this._source) { this._source.onended = null; this._source.stop(); }
    } catch (_) {}
    this._source = null;
    try {
      if (this._bossSource) { this._bossSource.onended = null; this._bossSource.stop(); }
    } catch (_) {}
    this._bossSource = null;
  }

  _playCurrent(volume) {
    if (!this._audioCtx) return;

    this._decodePending();
    this._stopSource();

    // 确保音量节点就绪
    if (!this._gainNode) {
      this._gainNode = this._audioCtx.createGain();
      this._gainNode.gain.value = this._muted ? 0 : (this._bossMode ? this._bossVolume : this._bgmVolume);
      this._gainNode.connect(this._audioCtx.destination);
    }

    const buffer = this._bossMode ? this._bossBuffer : this._buffers[this.currentIdx];
    if (!buffer || (buffer instanceof ArrayBuffer)) {
      // 还没加载完，持续重试直到就绪
      if (!this._bossMode && !this._loadAttempted[this.currentIdx]) {
        this._loadTrack(this.currentIdx);
      } else if (this._bossMode && !this._bossLoadAttempted) {
        this._loadBossTrack();
      }
      setTimeout(() => this._playCurrent(volume), 500);
      return;
    }

    const ctx = this._audioCtx;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this._gainNode || ctx.destination);
      src.start(0);
      src.onended = () => {
        if (!this._bossMode && !src.loop) this._randomNext();
      };
      this._source = src;
      this._startTime = ctx.currentTime;
    } catch (_) {}
  }
}
