// BGM 管理器 — 低音量后台播放，支持切换曲目

const BGM_VOLUME = 0.08;

const BGM_PLAYLIST_NAMES = ['不再曼波', '打火基'];

class BgmManager {
  constructor() {
    this.audios = [
      new Audio('bgm/不再曼波.mp3'),
      new Audio('bgm/打火基.mp3'),
    ];
    this.currentIdx = 0;
    this.playing = false;

    for (const a of this.audios) {
      a.volume = BGM_VOLUME;
      a.loop = false;
      a.preload = 'auto';
      a.addEventListener('ended', () => this._randomNext());
    }
  }

  get currentName() {
    return (this.muted ? '[静音] ' : '') + BGM_PLAYLIST_NAMES[this.currentIdx];
  }

  get muted() { return this._muted || false; }

  // 播放进度 0-1
  get progress() {
    const a = this.audios[this.currentIdx];
    if (!a || !a.duration || !isFinite(a.duration)) return 0;
    return a.currentTime / a.duration;
  }

  toggleMute() {
    this._muted = !this._muted;
    for (const a of this.audios) { a.volume = this._muted ? 0 : BGM_VOLUME; }
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    const a = this.audios[this.currentIdx];
    a.currentTime = 0;
    a.play().catch(() => { this.playing = false; }); // 加载失败时静默
  }

  stop() {
    this.playing = false;
    for (const a of this.audios) {
      a.pause();
      a.currentTime = 0;
    }
  }

  setSong(idx) {
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
