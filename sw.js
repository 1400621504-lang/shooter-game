const CACHE_NAME = 'shooter-v8';
const URLS = [
  './',
  'index.html',
  'manifest.json',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  // 3 首 BGM（预缓存加速）
  'bgm/不再曼波.mp3',
  'bgm/打火基.mp3',
  'bgm/boss战bgm.mp3',
  // 代码文件（已内联到 index.html，保留兜底）
  'js/utils.js',
  'js/VirtualJoystick.js',
  'js/AudioManager.js',
  'js/ParticlePool.js',
  'js/BulletPool.js',
  'js/Player.js',
  'js/EnemyManager.js',
  'js/Boss.js',
  'js/main.js',
  'player-imgs/player_default.png',
  'player-imgs/player_hurt.png',
  'player-imgs/player_kill.png',
  'player-imgs/player_stuck.png',
  'boss-imgs/boss1.gif',
  'boss-imgs/hiss1.mp3', 'boss-imgs/hiss2.mp3',
  'boss-imgs/hiss3.mp3',
  // 小怪图片
  'enemy-imgs/e1.gif', 'enemy-imgs/e2.gif', 'enemy-imgs/e3.gif',
  'enemy-imgs/e4.gif', 'enemy-imgs/e5.gif', 'enemy-imgs/e6.gif',
  'enemy-imgs/e7.gif', 'enemy-imgs/e8.gif', 'enemy-imgs/e9.gif',
  'enemy-imgs/e10.gif', 'enemy-imgs/e11.gif', 'enemy-imgs/e12.gif',
  'enemy-imgs/e13.gif', 'enemy-imgs/e14.gif', 'enemy-imgs/e15.gif'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
