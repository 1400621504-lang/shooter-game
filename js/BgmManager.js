// BGM 管理器 — 低音量后台播放，支持切换曲目

const BGM_VOLUME = 0.08;

const BGM_PLAYLIST = [
  { name: '不再曼波', file: 'bgm/不再曼波.mp3' },
  { name: '打火基',   file: 'bgm/打火基.mp3' },
];

class BgmManager {
  constructor() {
    this.audios = [];
    this.currentIdx = 0;
    this.playing = false;

    for (const s of BGM_PLAYLIST) {
      const a = new Audio(s.file);
      a.volume = BGM_VOLUME;
      a.loop = false;
      a.preload = 'auto';
      this.audios.push(a);
      a.addEventListener('ended', () => this._randomNext());
    }
  }

  get currentName() {
    return (this.muted ? '[静音] ' : '') + BGM_PLAYLIST[this.currentIdx].name;
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
    a.play().catch(() => {});
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
