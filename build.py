#!/usr/bin/env python3
"""构建单文件 HTML — 内联全部 JS + base64 图片 + 音效"""
import base64
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'game.html')

# ── 图片 → data URI ──
def b64img(path):
    with open(path, 'rb') as f:
        raw = f.read()
    b64 = base64.b64encode(raw).decode()
    ext = os.path.splitext(path)[1].lower()
    mime = 'image/png' if ext == '.png' else 'image/gif'
    return f'data:{mime};base64,{b64}'

def b64audio(path):
    with open(path, 'rb') as f:
        raw = f.read()
    b64 = base64.b64encode(raw).decode()
    return f'data:audio/mp3;base64,{b64}'

enemy_uris = {i: b64img(os.path.join(ROOT, f'build-imgs/enemy/e{i}.png')) for i in range(1, 16)}
player_uris = {
    'default': b64img(os.path.join(ROOT, 'build-imgs/player/player_default.png')),
    'hurt':    b64img(os.path.join(ROOT, 'build-imgs/player/player_hurt.png')),
    'kill':    b64img(os.path.join(ROOT, 'build-imgs/player/player_kill.png')),
    'stuck':   b64img(os.path.join(ROOT, 'build-imgs/player/player_stuck.png')),
}
boss_img_uri = b64img(os.path.join(ROOT, 'build-imgs/boss1.png'))
boss_hiss_img_uri = b64img(os.path.join(ROOT, 'build-imgs/boss_hiss.png'))
hiss_audio_uri = b64audio(os.path.join(ROOT, 'boss-imgs/hiss_trim.mp3'))

# ── 读取 JS 源码 ──
def read_js(name):
    with open(os.path.join(ROOT, 'js', name)) as f:
        return f.read()

js_files = [
    'utils.js', 'VirtualJoystick.js', 'AudioManager.js',
    'ParticlePool.js', 'BulletPool.js', 'Player.js',
    'EnemyManager.js', 'Boss.js', 'BgmManager.js', 'main.js'
]
scripts = {n: read_js(n) for n in js_files}

# ── 修改 EnemyManager.js — 换为 data URI ──
emu = scripts['EnemyManager.js']
old_iife = """(function loadEnemyImgs() {
  for (let i = 1; i <= ENEMY_IMG_COUNT; i++) {
    const img = new Image();
    img.onerror = () => { enemyImgs[i - 1] = null; }; // 加载失败降级
    img.src = 'enemy-imgs/e' + i + '.gif';
    // 如果缓存命中
    if (img.complete && img.naturalWidth > 0) enemyImgs[i - 1] = img;
    else img.onload = () => { enemyImgs[i - 1] = img; };
  }
})();"""

uri_array = ',\n  '.join(f'{repr(enemy_uris[i])}' for i in range(1, 16))
new_iife = f"""(function loadEnemyImgs() {{
  const uris = [
  {uri_array}
  ];
  for (let i = 0; i < ENEMY_IMG_COUNT; i++) {{
    const img = new Image();
    img.onerror = () => {{ enemyImgs[i] = null; }};
    img.src = uris[i];
    if (img.complete && img.naturalWidth > 0) enemyImgs[i] = img;
    else img.onload = () => {{ enemyImgs[i] = img; }};
  }}
}})();"""

scripts['EnemyManager.js'] = emu.replace(old_iife, new_iife)

# ── 修改 Player.js — 换为 data URI ──
ps = scripts['Player.js']
old_player_iife = """(function loadPlayerImgs() {
  const load = (src, onOk) => {
    const img = new Image();
    img.onload = () => onOk(img);
    img.onerror = () => {};
    img.src = src;
    if (img.complete && img.naturalWidth > 0) onOk(img);
  };
  load('player-imgs/player_default.png', im => imgDefault = im);
  load('player-imgs/player_kill.png', im => imgKill = im);
  load('player-imgs/player_hurt.png', im => imgHurt = im);
  load('player-imgs/player_stuck.png', im => imgStuck = im);
})();"""

new_player_iife = f"""// 图片已内联为 data URI，直接加载
(function loadPlayerImgs() {{
  const uris = {{
    default: {repr(player_uris['default'])},
    kill:    {repr(player_uris['kill'])},
    hurt:    {repr(player_uris['hurt'])},
    stuck:   {repr(player_uris['stuck'])},
  }};
  const loadUri = (uri, onOk) => {{
    const img = new Image();
    img.onload = () => onOk(img);
    img.onerror = () => {{}};
    img.src = uri;
    if (img.complete && img.naturalWidth > 0) onOk(img);
  }};
  loadUri(uris.default, im => imgDefault = im);
  loadUri(uris.kill, im => imgKill = im);
  loadUri(uris.hurt, im => imgHurt = im);
  loadUri(uris.stuck, im => imgStuck = im);
}})();"""

scripts['Player.js'] = ps.replace(old_player_iife, new_player_iife)

# ── 修改 Boss.js — 换 boss 图片 ──
bs = scripts['Boss.js']
old_boss_iife = """(function loadBossImg() {
  const img = new Image();
  img.onload = () => { bossImg = img; };
  img.onerror = () => {};
  img.src = 'boss-imgs/boss1.gif';
  if (img.complete && img.naturalWidth > 0) bossImg = img;
})();"""

new_boss_iife = f"""(function loadBossImg() {{
  const img = new Image();
  img.onload = () => {{ bossImg = img; }};
  img.onerror = () => {{}};
  img.src = {repr(boss_img_uri)};
  if (img.complete && img.naturalWidth > 0) bossImg = img;

  const img2 = new Image();
  img2.onload = () => {{ bossHissImg = img2; }};
  img2.onerror = () => {{}};
  img2.src = {repr(boss_hiss_img_uri)};
  if (img2.complete && img2.naturalWidth > 0) bossHissImg = img2;
}})();"""

scripts['Boss.js'] = bs.replace(old_boss_iife, new_boss_iife)

# ── 修改 AudioManager.js — 换 3 段 hiss 音频 ──
am = scripts['AudioManager.js']
hiss_audio_uris = [b64audio(os.path.join(ROOT, f'boss-imgs/hiss{i}.mp3')) for i in range(1, 4)]
for i in range(1, 4):
    am = am.replace(
        f"new Audio('boss-imgs/hiss{i}.mp3')",
        f"new Audio({repr(hiss_audio_uris[i-1])})"
    )
scripts['AudioManager.js'] = am

# ── 组装 HTML ──
html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="俯角射击">
  <meta name="theme-color" content="#111111">
  <title>俯角射击</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{
      width: 100%; height: 100%;
      overflow: hidden;
      background: #111;
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      position: fixed;
      top: 0; left: 0;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }}
    canvas {{
      display: block;
      position: absolute;
      top: 0; left: 0;
    }}
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script>
{scripts['utils.js']}
  </script>
  <script>
{scripts['VirtualJoystick.js']}
  </script>
  <script>
{scripts['AudioManager.js']}
  </script>
  <script>
{scripts['ParticlePool.js']}
  </script>
  <script>
{scripts['BulletPool.js']}
  </script>
  <script>
{scripts['Player.js']}
  </script>
  <script>
{scripts['EnemyManager.js']}
  </script>
  <script>
{scripts['Boss.js']}
  </script>
  <script>
{scripts['BgmManager.js']}
  </script>
  <script>
{scripts['main.js']}
  </script>
</body>
</html>
"""

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

size_mb = os.path.getsize(OUT) / 1024 / 1024
print(f'✓ {OUT}  ({size_mb:.1f} MB)')
