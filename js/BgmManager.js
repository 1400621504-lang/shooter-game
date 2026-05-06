// BGM 管理器 — 低音量后台播放，支持切换曲目 + Boss 战音乐

const BGM_VOLUME = 0.38;
const BOSS_BGM_VOLUME = 0.32;

const BGM_PLAYLIST_NAMES = ['不再曼波', '打火基'];

class BgmManager {
  constructor() {
    this.audios = [
      new Audio('bgm/不再曼波.mp3'),
      new Audio('bgm/打火基.mp3'),
    ];
    this.currentIdx = 0;
    this.playing = false;
    this._bossAudio = new Audio('bgm/boss战bgm.mp3');
    this._bossMode = false;
    this._bgmVolume = BGM_VOLUME;
    this._bossVolume = BOSS_BGM_VOLUME;

    for (const a of this.audios) {
      a.volume = this._bgmVolume;
      a.loop = false;
      a.preload = 'auto';
      a.addEventListener('ended', () => this._randomNext());
    }
    this._bossAudio.volume = this._bossVolume;
    this._bossAudio.loop = true;
    this._bossAudio.preload = 'auto';
  }

  get currentName() {
    if (this._bossMode) return (this.muted ? '[静音] ' : '') + '⚔ Boss 战 ♪';
    return (this.muted ? '[静音] ' : '') + BGM_PLAYLIST_NAMES[this.currentIdx];
  }

  get muted() { return this._muted || false; }

  get progress() {
    if (this._bossMode) {
      const a = this._bossAudio;
      if (!a || !a.duration || !isFinite(a.duration)) return 0;
      return a.currentTime / a.duration;
    }
    const a = this.audios[this.currentIdx];
    if (!a || !a.duration || !isFinite(a.duration)) return 0;
    return a.currentTime / a.duration;
  }

  get isBossMode() { return this._bossMode; }

  toggleMute() {
    this._muted = !this._muted;
    const v = this._muted ? 0 : this._bgmVolume;
    for (const a of this.audios) { a.volume = v; }
    this._bossAudio.volume = this._muted ? 0 : this._bossVolume;
    if (this._muted && this._bossMode) { this._bossAudio.pause(); }
    else if (!this._muted && this._bossMode) { this._bossAudio.play().catch(() => {}); }
  }

  setBossMode(isBoss) {
    if (isBoss === this._bossMode) return;
    this._bossMode = isBoss;
    if (isBoss) {
      for (const a of this.audios) { a.pause(); }
      if (this.playing && !this._muted) {
        this._bossAudio.currentTime = 0;
        this._bossAudio.play().catch(() => {});
      }
    } else {
      this._bossAudio.pause();
      this._bossAudio.currentTime = 0;
      if (this.playing) {
        const a = this.audios[this.currentIdx];
        a.currentTime = 0;
        a.play().catch(() => {});
      }
    }
  }

  setBgmVolume(v) {
    this._bgmVolume = v;
    if (!this._muted) {
      for (const a of this.audios) { a.volume = v; }
    }
  }

  setBossVolume(v) {
    this._bossVolume = v;
    this._bossAudio.volume = this._muted ? 0 : v;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    if (this._bossMode && !this._muted) {
      this._bossAudio.currentTime = 0;
      this._bossAudio.play().catch(() => {});
      return;
    }
    const a = this.audios[this.currentIdx];
    a.currentTime = 0;
    a.play().catch(() => { this.playing = false; });
  }

  stop() {
    this.playing = false;
    this._bossMode = false;
    this._bossAudio.pause();
    this._bossAudio.currentTime = 0;
    for (const a of this.audios) {
      a.pause();
      a.currentTime = 0;
    }
  }

  setSong(idx) {
    if (this._bossMode) return;
    const wasPlaying = this.playing;
    for (const a of this.audios) { a.pause(); a.currentTime = 0; }
    this.currentIdx = ((idx % this.audios.length) + this.audios.length) % this.audios.length;
    if (wasPlaying) {
      const a = this.audios[this.currentIdx];
      a.play().catch(() => {});
    }
  }

  next() { this.setSong(this.currentIdx + 1); }
  prev() { this.setSong(this.currentIdx - 1); }

  _randomNext() {
    let next;
    const total = this.audios.length;
    if (total <= 1) { next = 0; }
    else {
      do { next = Math.floor(Math.random() * total); }
      while (next === this.currentIdx);
    }
    this.setSong(next);
  }
}
