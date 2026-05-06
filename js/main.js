// 主循环 — 画布、触控路由、游戏状态、渲染

// ── DOM ──
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ── 平台检测 ──
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

// ── 瞄准追踪（攻击同目标超2s）──
let aimedEnemyIdx = -1;
let aimedEnemyTimer = 0;

// ── 启动画面 Logo ──
let logoImg = null;
(function() {
  const img = new Image();
  img.onload = () => { logoImg = img; };
  img.onerror = () => {};
  img.src = 'logo.png';
})();

// ── 屏幕尺寸 ──
let sw, sh, dpr;

function resize() {
  dpr = window.devicePixelRatio || 1;
  sw = window.innerWidth;
  sh = window.innerHeight;
  canvas.width = sw * dpr;
  canvas.height = sh * dpr;
  canvas.style.width = sw + 'px';
  canvas.style.height = sh + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  moveJoy.updateLayout(sw, sh);
  shootJoy.updateLayout(sw, sh);
}

// ── 输入 ──
const moveJoy = new VirtualJoystick('left', 75);
const shootJoy = new VirtualJoystick('right', 75);

// ── 实体 ──
let player;
let bullets;
let enemies;
let particles;
let audio;
let bgm;
let rune = null;
let runeChosen = false;
let runeSelectVisible = false;

// ── 相机 ──
let cam = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
let shakeAmt = 0;
let shakeDur = 0;

// ── 游戏状态 ──
const STATE = { START: 'start', PLAYING: 'playing', WAVE_PAUSE: 'wavePause', PAUSED: 'paused', OVER: 'over' };
let state = STATE.START;
let score = 0;
let waveNum = 0;
let waveMsg = '';
let waveMsgTimer = 0;
let hissNotifyTimer = 0;
let comboTimer = 0;
let comboCount = 0;
let bestCombo = 0;
let gameTime = 0;
let autoShoot = false;          // 自动射击模式（手机专用）

// ── 波次暂停计时 ──
let wavePauseTimer = 0;

// ── Game Over 动画 ──
let overTimer = 0;

// ── 自动暂停 ──
let pauseTimer = 0;

// ── 初始化 ──
function setup() {
  player = new Player(WORLD_SIZE / 2, WORLD_SIZE / 2);
  bullets = new BulletPool(200);
  enemies = new EnemyManager(60);
  particles = new ParticlePool(500);
  audio = new AudioManager();
  if (!bgm) bgm = new BgmManager(); // 只创建一次
  cam.x = WORLD_SIZE / 2;
  cam.y = WORLD_SIZE / 2;
  shakeAmt = 0;
  shakeDur = 0;
  score = 0;
  waveNum = 0;
  waveMsg = '';
  waveMsgTimer = 0;
  comboTimer = 0;
  comboCount = 0;
  bestCombo = 0;
  gameTime = 0;
  overTimer = 0;
  if (!runeChosen) { rune = null; runeSelectVisible = false; }
}

// 请求全屏（横屏时去掉浏览器 chrome）
function requestFullscreen() {
  // 桌面端先不强制全屏，避免焦点丢失
  if (isDesktop) return;
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}

// UI 缩放 — 按屏幕短边自适应
function uiScale() {
  return clamp(Math.min(sw, sh) / 600, 0.6, 1.4);
}

// ── 开始游戏 ──
function startGame() {
  audio.init();
  // 解锁移动端音频（iOS 需要明确 resume）
  if (audio.ctx && audio.ctx.state === 'suspended') {
    audio.ctx.resume();
  }
  // 将 AudioContext 传给 BGM 管理器
  if (audio.ctx) bgm.setAudioContext(audio.ctx);
  audio._initHissAudios(); // 预加载哈气
  requestFullscreen();
  setup();
  bgm.play();
  state = STATE.PLAYING;
  nextWave();
}

// ── 下一波 ──
function nextWave() {
  waveNum++;
  enemies.spawnWave(waveNum, cam.x, cam.y, sw, sh);
  const types = getBossTypesForWave(waveNum);
  if (types.length > 0) {
    waveMsg = '⚠⚠ BOSS 来袭！ ' + types.map(t => getBossName(waveNum, t)).join(' · ') + ' — 第' + waveNum + '波';
  } else {
    waveMsg = '第 ' + waveNum + ' 波';
  }
  waveMsgTimer = 1.8;
}

// ── 碰 撞：子弹 vs 敌人 ──
function checkBulletHits() {
  const activeBullets = bullets.getActive();
  const activeEnemies = enemies.getActive();
  for (const b of activeBullets) {
    for (let ei = 0; ei < enemies.pool.length; ei++) {
      const e = enemies.pool[ei];
      if (!e.active) continue;
      const d = dist(b.x, b.y, e.x, e.y);
      if (d < e.radius + 4) {
        const pts = enemies.damageAt(ei, b.damage);
        b.active = false;
        // 命中粒子
        particles.emit(b.x, b.y, {
          count: 5,
          minSpeed: 20, maxSpeed: 100,
          minLife: 0.08, maxLife: 0.2,
          minSize: 1, maxSize: 3,
          colors: ['#FFEB3B', '#FF9800', '#fff']
        });
        if (pts > 0) {
          // 击杀
          player.onKill();
          score += pts;
          comboCount++;
          comboTimer = 1.5;
          if (comboCount > bestCombo) bestCombo = comboCount;
          // 海克斯符文回调
          if (rune) {
            if (e.isBoss) rune.onBossKill(player);
            else rune.onMinionKill();
          }
          audio.explosion();
          shakeAmt = 6;
          shakeDur = 0.08;
          particles.emit(e.x, e.y, {
            count: 15,
            minSpeed: 40, maxSpeed: 200,
            minLife: 0.15, maxLife: 0.5,
            minSize: 1, maxSize: 5,
            colors: [e.color, '#ff0', '#fff']
          });
          // 连杀加分
          if (comboCount >= 5) score += comboCount * 10;
        } else {
          audio.hit();
          shakeAmt = 2;
          shakeDur = 0.04;
        }
        break;
      }
    }
  }
}

// ── 碰撞：敌人接触玩家 ──
function checkEnemyPlayer() {
  if (!player.alive) return;
  const activeEnemies = enemies.getActive();
  for (const e of activeEnemies) {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < player.radius + e.radius - 4) {
      if (player.takeDamage(e.damage, gameTime)) {
        audio.playerHit();
        shakeAmt = 12;
        shakeDur = 0.15;
        particles.emit(player.x, player.y, {
          count: 20,
          minSpeed: 30, maxSpeed: 150,
          minLife: 0.2, maxLife: 0.6,
          minSize: 2, maxSize: 6,
          colors: ['#4FC3F7', '#fff', '#f00']
        });
        if (!player.alive) {
          state = STATE.OVER;
          overTimer = 0;
          audio.explosion();
          particles.emit(player.x, player.y, {
            count: 40,
            minSpeed: 60, maxSpeed: 300,
            minLife: 0.3, maxLife: 1.0,
            minSize: 2, maxSize: 8,
            colors: ['#4FC3F7', '#fff', '#f00', '#ff0']
          });
        }
      }
      break;
    }
  }
}

// ── 更新 ──
function update(dt) {
  if (state === STATE.PAUSED) {
    moveJoy.update(dt);
    shootJoy.update(dt);
    if (moveJoy.active || shootJoy.active) {
      state = STATE.PLAYING;
      pauseTimer = 0;
    }
    // 仍然更新粒子（淡出效果）
    particles.update(dt);
    return;
  }

  if (state !== STATE.PLAYING && state !== STATE.WAVE_PAUSE) return;
  gameTime += dt;

  // 连击衰减
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) comboCount = 0;
  }

  // 波次消息计时
  if (waveMsgTimer > 0) waveMsgTimer -= dt;
  if (hissNotifyTimer > 0) hissNotifyTimer -= dt;

  if (state === STATE.PLAYING) {
    // 摇杆
    moveJoy.update(dt);
    shootJoy.update(dt);

    // ── 键盘 WASD 覆盖移动摇杆 ──
    const kx = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
    const ky = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);
    const kmag = Math.sqrt(kx * kx + ky * ky);
    if (kmag > 0 && !moveJoy.touchId) {
      moveJoy.active = true;
      moveJoy.normX = kx / kmag;
      moveJoy.normY = ky / kmag;
      moveJoy.magnitude = 1;
    } else if (kmag === 0 && !moveJoy.touchId) {
      moveJoy.active = false;
      moveJoy.normX = 0; moveJoy.normY = 0; moveJoy.magnitude = 0;
    }

    // ── 鼠标瞄准覆盖射击摇杆 ──
    if (mouseDown && !shootJoy.touchId && player.alive) {
      const psx = player.x - cam.x + sw / 2;
      const psy = player.y - cam.y + sh / 2;
      const mx = mouseX - psx;
      const my = mouseY - psy;
      const mmag = Math.sqrt(mx * mx + my * my);
      if (mmag > 8) {
        shootJoy.active = true;
        shootJoy.magnitude = 1;
        shootJoy.angle = Math.atan2(my, mx);
      }
    } else if (!mouseDown && !shootJoy.touchId) {
      shootJoy.active = false;
      shootJoy.magnitude = 0;
    }

    // 双手同时离开 → 计时（仅触屏模式）
    if (!isDesktop && !moveJoy.active && !shootJoy.active) {
      pauseTimer += dt;
      if (pauseTimer >= 2.0) {
        state = STATE.PAUSED;
        pauseTimer = 0;
      }
    } else {
      pauseTimer = 0;
    }

    // 玩家
    player.update(dt, moveJoy, shootJoy, WORLD_SIZE);

    // 开火
    if (shootJoy.active && shootJoy.magnitude > 0.15 && player.alive) {
      // 辅助瞄准
      const activeEnemies = enemies.getActive();
      const rawAim = shootJoy.angle;
      const adjusted = aimAssist(player.x, player.y, rawAim, activeEnemies, 50, 0.55);
      player.angle = adjusted;
      player.fire(dt, bullets);

      // 追踪瞄准同一目标
      let curAimedIdx = -1;
      let bestDot = 0.7;
      for (let ei = 0; ei < enemies.pool.length; ei++) {
        const e = enemies.pool[ei];
        if (!e.active) continue;
        const dx2 = e.x - player.x;
        const dy2 = e.y - player.y;
        const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 > 250) continue;
        const dot = (dx2 / d2) * Math.cos(adjusted) + (dy2 / d2) * Math.sin(adjusted);
        if (dot > bestDot) {
          bestDot = dot;
          curAimedIdx = ei;
        }
      }

      if (curAimedIdx >= 0 && curAimedIdx === aimedEnemyIdx) {
        aimedEnemyTimer += dt;
        if (aimedEnemyTimer >= 2.0) {
          player.onAttackStuck();
          aimedEnemyTimer = 0;
        }
      } else {
        aimedEnemyIdx = curAimedIdx;
        aimedEnemyTimer = 0;
      }

      // 每 3 发响一声
      if (Math.abs(player.fireTimer - FIRE_INTERVAL) < 0.001) {
        audio.shoot();
      }
    }

    // ── 自动射击（手机专用：右摇杆未触摸时自动瞄准最近敌人）──
    if (autoShoot && !shootJoy.active && player.alive) {
      const activeEnemies = enemies.getActive();
      if (activeEnemies.length > 0) {
        let nearest = activeEnemies[0];
        let nearDist = dist(player.x, player.y, nearest.x, nearest.y);
        for (const e of activeEnemies) {
          const d = dist(player.x, player.y, e.x, e.y);
          if (d < nearDist) { nearDist = d; nearest = e; }
        }
        if (nearDist < 600) {
          player.angle = angleTo(player.x, player.y, nearest.x, nearest.y);
          player.fire(dt, bullets);
          if (Math.abs(player.fireTimer - FIRE_INTERVAL) < 0.001) {
            audio.shoot();
          }
        }
      }
    }

    // 子弹
    bullets.update(dt, WORLD_SIZE);

    // 敌人
    enemies.update(dt, player);

    // Boss BGM 自动切换（实时检测场上是否有 Boss）
    if (bgm) {
      const hasBoss = enemies.getActive().some(e => e.isBoss);
      bgm.setBossMode(hasBoss);
    }

    // Boss 技能更新
    updateBosses(enemies.pool, dt, player, particles, audio, gameTime);

    // 符文更新
    if (rune) rune.update(dt, player, enemies.pool);

    // 碰撞
    checkBulletHits();
    checkEnemyPlayer();

    // 检查波次清空
    if (enemies.aliveCount === 0) {
      const nextIsBoss = (waveNum + 1) >= 3 && (waveNum + 1) % 3 === 0;
      state = STATE.WAVE_PAUSE;
      wavePauseTimer = nextIsBoss ? 2.0 : 1.4;
      if (nextIsBoss) {
        audio.bossWarning();
        const types = getBossTypesForWave(waveNum + 1);
        waveMsg = '⚠⚠ BOSS 登场！！ ' + types.map(t => getBossName(waveNum + 1, t)).join(' · ');
        waveMsgTimer = 2.2;
      }
      audio.waveClear();
    }
  } else if (state === STATE.WAVE_PAUSE) {
    // 击败第6波后触发海克斯符文选择
    if (waveNum === 6 && !runeChosen && !runeSelectVisible) {
      runeSelectVisible = true;
      wavePauseTimer = 999; // 暂停波次推进
    }
    if (!runeSelectVisible) {
      wavePauseTimer -= dt;
      if (wavePauseTimer <= 0) {
        state = STATE.PLAYING;
        nextWave();
        const types = getBossTypesForWave(waveNum);
        for (const t of types) {
          spawnBoss(enemies.pool, waveNum, t, cam.x, cam.y, sw, sh);
        }
      }
    }
  }

  // 粒子
  particles.update(dt);

  // 屏幕震动
  if (shakeDur > 0) {
    shakeDur -= dt;
    if (shakeDur <= 0) shakeAmt = 0;
  } else {
    shakeAmt = lerp(shakeAmt, 0, dt * 20);
  }
}

// ── 相机 ──
function updateCamera(dt) {
  if (!player.alive && state === STATE.OVER) return;
  const tx = player.x;
  const ty = player.y;
  cam.x = lerp(cam.x, tx, dt * 5);
  cam.y = lerp(cam.y, ty, dt * 5);
}

// ── 渲染：背景 ──
function drawBg() {
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, sw, sh);

  const grid = 80;
  const sx = Math.floor((cam.x - sw / 2) / grid) * grid;
  const sy = Math.floor((cam.y - sh / 2) / grid) * grid;

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = sx; x < cam.x + sw / 2; x += grid) {
    const px = x - cam.x + sw / 2;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, sh);
  }
  for (let y = sy; y < cam.y + sh / 2; y += grid) {
    const py = y - cam.y + sh / 2;
    ctx.moveTo(0, py);
    ctx.lineTo(sw, py);
  }
  ctx.stroke();

  // 世界边界
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  const bx = -cam.x + sw / 2;
  const by = -cam.y + sh / 2;
  ctx.strokeRect(bx, by, WORLD_SIZE, WORLD_SIZE);
}

// ── 渲染：HUD ──
function drawHUD() {
  const s = uiScale();
  ctx.save();
  // 分数 (左上)
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(18 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('分数 ' + score, 14, 18 * s);

  // 波次 (右上)
  ctx.textAlign = 'right';
  ctx.fillText('第 ' + waveNum + ' 波', sw - 14, 18 * s);

  // 连击 (中上)
  ctx.textAlign = 'center';
  if (comboCount >= 3) {
    ctx.fillStyle = '#FFEB3B';
    ctx.font = `bold ${Math.round(16 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText(comboCount + ' 连杀!', sw / 2, 18 * s);
  }

  // 血量 (左中)
  const barW = Math.round(40 * s), barH = Math.round(6 * s);
  const barX = 14, barY = Math.round(48 * s);
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  const hpRatio = player.alive ? player.hp / player.maxHp : 0;
  const hpColor = hpRatio > 0.5 ? '#4CAF50' : hpRatio > 0.25 ? '#FF9800' : '#F44336';
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  // 自动射击状态指示（血条旁）
  if (autoShoot) {
    ctx.fillStyle = '#4CAF50';
    ctx.font = `bold ${Math.round(8 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('AUTO', barX + barW + 6, barY);
  }

  // 波次消息 (中央)
  if (waveMsgTimer > 0) {
    const alpha = waveMsgTimer > 0.5 ? 1 : waveMsgTimer / 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(36 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(waveMsg, sw / 2, sh / 2 - 40);
    ctx.globalAlpha = 1;
  }

  // 当前 BGM + 进度条 + 触屏按钮（底部中）
  if (bgm) {
    const bx = sw / 2 - 80 * s;
    const by = sh - 22 * s;
    const bw = 160 * s;
    const btnSz = isDesktop ? 20 * s : Math.max(36, 32 * s);
    const btnGap = 8 * s;
    // 进度条背景
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, 3 * s);
    // 进度条
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(bx, by, bw * bgm.progress, 3 * s);
    // 文字
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#888';
    ctx.font = `${Math.round(10 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('♪ ' + bgm.currentName, sw / 2, by - 6 * s);
    // 触屏按钮：静音 | 下一首
    const btnY = by - btnSz - 4 * s;
    const leftBtnX = sw / 2 - btnSz - btnGap / 2;
    const rightBtnX = sw / 2 + btnGap / 2;
    // 记录按钮位置供触控检测
    bgm._btnLeft = { x: leftBtnX, y: btnY, w: btnSz, h: btnSz, action: 'mute' };
    bgm._btnRight = { x: rightBtnX, y: btnY, w: btnSz, h: btnSz, action: 'next' };
    // 静音按钮
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = bgm.muted ? '#F44336' : '#555';
    ctx.fillRect(leftBtnX, btnY, btnSz, btnSz);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(11 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bgm.muted ? 'M' : '♪', leftBtnX + btnSz / 2, btnY + btnSz / 2);
    // 下一首按钮
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#555';
    ctx.fillRect(rightBtnX, btnY, btnSz, btnSz);
    ctx.fillStyle = '#fff';
    ctx.fillText('»', rightBtnX + btnSz / 2, btnY + btnSz / 2);
    ctx.globalAlpha = 1;
  }

  // ── 自动射击切换按钮（左下角，仅触屏）──
  if (!isDesktop) {
    const asSize = Math.max(44, 40 * s);
    const asX = 14;
    const asY = sh - asSize - 14;
    _autoShootBtn = { x: asX, y: asY, w: asSize, h: asSize };
    ctx.fillStyle = autoShoot ? 'rgba(76,175,80,0.7)' : 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = autoShoot ? '#4CAF50' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    _roundRect(ctx, asX, asY, asSize, asSize, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(9 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(autoShoot ? 'A·射击' : '手·动', asX + asSize / 2, asY + asSize / 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── 渲染：开始界面 ──
function drawStartScreen() {
  const s = uiScale();
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, sw, sh);

  // Logo 图片（保持宽高比，宽度 ≈ 240px）
  if (logoImg) {
    const lw = 240 * s;
    const lh = logoImg.height / logoImg.width * lw;
    ctx.drawImage(logoImg, sw / 2 - lw / 2, sh / 2 - 80 * s - lh / 2, lw, lh);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(40 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('耄耋大乱斗', sw / 2, sh / 2 - 80 * s);
  }

  ctx.fillStyle = '#aaa';
  ctx.font = `${Math.round(16 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('左手移动  ·  右手射击', sw / 2, sh / 2 - 20 * s);

  // 移动端触控区域提示
  if (!isDesktop) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#4FC3F7';
    ctx.fillRect(0, 0, sw / 2, sh);
    ctx.fillStyle = '#FF5252';
    ctx.fillRect(sw / 2, 0, sw / 2, sh);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(11 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('移动', sw * 0.25, sh * 0.06);
    ctx.fillText('瞄准', sw * 0.75, sh * 0.06);
    ctx.fillText('左下角可切换自动射击', sw / 2, sh / 2 + (isIOS && !isStandalone ? 100 : 80) * s);
    ctx.globalAlpha = 1;
  }

  // BGM 选歌 — 顶部居中
  {
    const by = 60 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(sw / 2 - 140 * s, by - 10 * s, 280 * s, 28 * s);
    ctx.fillStyle = '#ddd';
    ctx.font = `bold ${Math.round(14 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText('♪ ' + (bgm ? bgm.currentName : '—'), sw / 2, by);
    // 左右箭头
    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.round(12 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText('◀ 点击切歌 ▶', sw / 2, by + 16 * s);
  }

  // iOS 且非独立模式：引导添加到主屏幕
  if (isIOS && !isStandalone) {
    ctx.fillStyle = '#FF9800';
    ctx.font = `${Math.round(14 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText('点底部 分享 → 添加到主屏幕', sw / 2, sh / 2 + 20 * s);
    ctx.fillText('可隐藏浏览器栏，获得全屏体验', sw / 2, sh / 2 + 42 * s);
  }

  // 脉冲提示
  const pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(20 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('点击屏幕开始', sw / 2, sh / 2 + (isIOS && !isStandalone ? 80 : 60) * s);
  ctx.globalAlpha = 1;
}

// ── 渲染：暂停遮罩 ──
function drawPauseOverlay() {
  const s = uiScale();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, sw, sh);

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(32 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('已暂停', sw / 2, sh / 2 - 10 * s);

  ctx.fillStyle = '#aaa';
  ctx.font = `${Math.round(14 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  const lines = [isDesktop ? 'ESC 继续' : '触摸屏幕继续'];
  if (bgm) {
    if (isDesktop) {
      lines.push('M 静音/播放 BGM');
      lines.push('← → 切歌  ♪ ' + bgm.currentName);
    } else {
      lines.push('♪ ' + bgm.currentName);
    }
  }
  lines.forEach((l, i) => ctx.fillText(l, sw / 2, sh / 2 + 25 * s + i * 22 * s));
}

// ── 渲染：结束界面 ──
function drawOverScreen() {
  const s = uiScale();
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, sw, sh);

  ctx.fillStyle = '#F44336';
  ctx.font = `bold ${Math.round(36 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('阵亡', sw / 2, sh / 2 - 80 * s);

  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(18 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  const lines = [
    '分数 ' + score,
    '到达第 ' + waveNum + ' 波',
    '最高连杀 ' + bestCombo
  ];
  lines.forEach((txt, i) => {
    ctx.fillText(txt, sw / 2, sh / 2 - 25 * s + i * 30 * s);
  });

  overTimer += 0.016;
  const pulse = Math.sin(overTimer * 3) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(20 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('点击重新开始', sw / 2, sh / 2 + 60 * s);
  ctx.globalAlpha = 1;
}

// ── 主渲染 ──
function render() {
  ctx.clearRect(0, 0, sw, sh);

  if (state === STATE.START) {
    drawStartScreen();
    return;
  }

  // 震动偏移
  let ox = 0, oy = 0;
  if (shakeAmt > 0.1) {
    ox = (Math.random() - 0.5) * shakeAmt * 2;
    oy = (Math.random() - 0.5) * shakeAmt * 2;
  }
  const rCamX = cam.x + ox;
  const rCamY = cam.y + oy;

  drawBg();

  // 粒子（底层）
  particles.render(ctx, rCamX, rCamY, sw, sh);

  // Boss 特效（底层）
  renderBossEffects(ctx, enemies.pool, rCamX, rCamY, sw, sh);

  // 敌人
  enemies.render(ctx, rCamX, rCamY, sw, sh);

  // Boss 头顶名字
  renderBossNames(ctx, enemies.pool, rCamX, rCamY, sw, sh);

  // 玩家
  player.render(ctx, rCamX, rCamY, sw, sh);

  // 符文
  if (rune) rune.render(ctx, player, rCamX, rCamY, sw, sh);

  // 子弹
  bullets.render(ctx, rCamX, rCamY, sw, sh);

  // 摇杆 UI
  moveJoy.render(ctx);
  shootJoy.render(ctx);

  // HUD
  drawHUD();

  // 海克斯符文选择面板
  if (runeSelectVisible) drawRuneSelect();
  // 符文技能按钮
  if (rune && state === STATE.PLAYING) drawRuneSkillBtn();

  // 暂停遮罩
  if (state === STATE.PAUSED) {
    drawPauseOverlay();
  }

  // 结束遮罩
  if (state === STATE.OVER) {
    drawOverScreen();
  }
}

// ── 游戏循环 ──
let lastStamp = 0;
function loop(stamp) {
  requestAnimationFrame(loop);
  const dt = lastStamp ? Math.min((stamp - lastStamp) / 1000, 0.1) : 0.016;
  lastStamp = stamp;

  resize(); // 处理旋转 / 缩放
  updateCamera(dt);
  update(dt);
  render();

  // 开始界面循环动画
  if (state === STATE.START) {
    moveJoy.update(dt);
    shootJoy.update(dt);
  }
}

// ── 触控 ──
function onTouchStart(e) {
  e.preventDefault();
  // 海克斯符文选择
  for (const t of e.changedTouches) {
    if (_handleRuneClick(t.clientX, t.clientY)) return;
    // 自动射击按钮（左下角）
    if (!isDesktop && _autoShootBtn) {
      const b = _autoShootBtn;
      if (t.clientX >= b.x && t.clientX <= b.x + b.w && t.clientY >= b.y && t.clientY <= b.y + b.h) {
        autoShoot = !autoShoot;
        return;
      }
    }
    // 符文技能按钮
    if (rune && rune._skillBtn && !rune.cfg.passive) {
      const b = rune._skillBtn;
      if (t.clientX >= b.x && t.clientX <= b.x + b.w && t.clientY >= b.y && t.clientY <= b.y + b.h) {
        rune.activate(player, enemies.getActive(), particles, audio);
        return;
      }
    }
  }
  if (state === STATE.START) {
    startGame();
    return;
  }
  if (state === STATE.OVER) {
    startGame();
    return;
  }
  // 检测 BGM 按钮点击
  for (const t of e.changedTouches) {
    if (bgm) {
      for (const btn of [bgm._btnLeft, bgm._btnRight]) {
        if (!btn) continue;
        const s2 = uiScale();
        if (t.clientX >= btn.x && t.clientX <= btn.x + btn.w &&
            t.clientY >= btn.y && t.clientY <= btn.y + btn.h) {
          if (btn.action === 'mute') bgm.toggleMute();
          else if (btn.action === 'next') bgm.next();
          t._handled = true;
          break;
        }
      }
    }
    if (!t._handled) {
      moveJoy.tryStart(t.identifier, t.clientX, t.clientY, sw);
      shootJoy.tryStart(t.identifier, t.clientX, t.clientY, sw);
    }
  }
  audio.init();
}

function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    moveJoy.handleMove(t.identifier, t.clientX, t.clientY);
    shootJoy.handleMove(t.identifier, t.clientX, t.clientY);
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    moveJoy.handleEnd(t.identifier);
    shootJoy.handleEnd(t.identifier);
  }
}

// ── 键盘 + 鼠标（桌面端）──
const keys = {};
let mouseX = 0, mouseY = 0;
let mouseDown = false;
let isDesktop = false; // 桌面模式：禁止自动暂停
let _autoShootBtn = null; // 自动射击按钮触控热区

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  isDesktop = true;
  if (['w','a','s','d'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  // ESC 暂停/继续
  if (e.key === 'Escape' && (state === STATE.PLAYING || state === STATE.PAUSED)) {
    e.preventDefault();
    if (state === STATE.PLAYING) { state = STATE.PAUSED; pauseTimer = 0; }
    else { state = STATE.PLAYING; }
  }
  // ← → 切 BGM, M 静音, F 自动射击
  // E 触发符文技能（被动符文忽略）
  if (e.key === 'e' && rune && !rune.cfg.passive && state === STATE.PLAYING) {
    e.preventDefault();
    rune.activate(player, enemies.getActive(), particles, audio);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'm' || e.key === 'f') {
    e.preventDefault();
    if (e.key === 'ArrowLeft') bgm.prev();
    else if (e.key === 'ArrowRight') bgm.next();
    else if (e.key === 'm') bgm.toggleMute();
    else if (e.key === 'f') { autoShoot = !autoShoot; }
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  // 海克斯符文选择
  if (_handleRuneClick(e.clientX, e.clientY)) return;
  // 符文技能按钮
  if (rune && rune._skillBtn && !rune.cfg.passive) {
    const b = rune._skillBtn;
    if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) {
      rune.activate(player, enemies.getActive(), particles, audio);
      return;
    }
  }
  if (state === STATE.START) {
    // 点击顶部切歌
    if (e.clientY < 100) {
      if (bgm) bgm.next();
      return;
    }
    isDesktop = true;
    startGame();
    return;
  }
  if (state === STATE.OVER) {
    isDesktop = true;
    startGame();
    return;
  }
  audio.init();
  isDesktop = true;
  mouseDown = true;
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('mouseleave', () => { mouseDown = false; });

// ── 注册 SW ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ── 圆角矩形辅助 ──
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── 海克斯符文选择面板 ──
function drawRuneSelect() {
  const s = uiScale();
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, sw, sh);

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(28 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('击败 BOSS！选择海克斯符文', sw / 2, sh * 0.12);

  const runeKeys = ['geliya', 'danbainaixi', 'quanpingshenfa'];
  const cardW = sw * 0.28;
  const cardH = sh * 0.55;
  const gap = sw * 0.03;
  const startX = sw / 2 - (cardW * 1.5 + gap);

  ctx._runeSelectRects = [];

  for (let i = 0; i < runeKeys.length; i++) {
    const key = runeKeys[i];
    const cfg = RUNE_DATA[key];
    const cx = startX + i * (cardW + gap);
    const cy = sh * 0.42;

    ctx._runeSelectRects.push({ x: cx - cardW / 2, y: cy - cardH / 2, w: cardW, h: cardH, key: key });

    // 卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    _roundRect(ctx, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // 符文图片
    const imgSize = cardW * 0.5;
    const imgCY = cy - cardH * 0.15;
    if (runeImgs[key]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, imgCY, imgSize / 2 + 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(runeImgs[key], cx - imgSize / 2, imgCY - imgSize / 2, imgSize, imgSize);
      ctx.restore();
    } else {
      // 图片未加载时的占位
      const colors = { nailong: '#FF5722', caodiniu: '#4CAF50', sangbiao: '#FF9800' };
      ctx.fillStyle = colors[key] || '#888';
      ctx.beginPath();
      ctx.arc(cx, imgCY, imgSize / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(imgSize * 0.5)}px "PingFang SC","Helvetica Neue",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.name[0], cx, imgCY);
    }

    // 名字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(18 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText(cfg.name, cx, cy + cardH * 0.12);

    // 技能名
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.round(14 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.fillText(cfg.skillName, cx, cy + cardH * 0.22);

    // 描述
    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.round(11 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    const descLines = cfg.desc.split('\n');
    for (let d = 0; d < descLines.length; d++) {
      ctx.fillText(descLines[d], cx, cy + cardH * 0.32 + d * 16 * s);
    }
  }

  // 提示
  ctx.fillStyle = '#888';
  ctx.font = `${Math.round(13 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('点击卡片选择符文 · 仅此一次', sw / 2, sh * 0.78);
}

// 符文技能按钮（被动符文不显示）
function drawRuneSkillBtn() {
  if (!rune || rune.cfg.passive) return;
  const s = uiScale();
  const btnSize = Math.round(isDesktop ? 40 * s : Math.max(44, 40 * s));
  // 手机版在右上角（避开射击摇杆），桌面版在右侧中央
  const bx = sw - btnSize - 16;
  const by = !isDesktop ? Math.round(70 * s) : sh / 2 - btnSize / 2;

  // 记录按钮位置
  rune._skillBtn = { x: bx, y: by, w: btnSize, h: btnSize };

  const cd = rune.cooldownRatio;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = cd > 0 ? '#555' : '#333';
  ctx.strokeStyle = cd > 0 ? '#555' : '#FFD700';
  ctx.lineWidth = 2;
  _roundRect(ctx, bx, by, btnSize, btnSize, 8);
  ctx.fill();
  ctx.stroke();

  // 冷却圆弧
  if (cd > 0) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx + btnSize / 2, by + btnSize / 2, btnSize / 2 - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd));
    ctx.stroke();
    // 冷却数字
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(12 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(rune.cooldownTimer) + 's', bx + btnSize / 2, by + btnSize / 2);
  } else {
    // 符文小图
    if (runeImgs[rune.type]) {
      ctx.drawImage(runeImgs[rune.type], bx + 4, by + 4, btnSize - 8, btnSize - 8);
    }
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(9 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('E', bx + btnSize / 2, by - 2);
  }

  ctx.restore();
}

// 海克斯符文选择点击处理
function _handleRuneClick(cx, cy) {
  if (!runeSelectVisible || !ctx._runeSelectRects) return false;
  for (const r of ctx._runeSelectRects) {
    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
      rune = new Pet(r.key);
      runeChosen = true;
      runeSelectVisible = false;
      // 继续波次推进
      state = STATE.PLAYING;
      nextWave();
      const types = getBossTypesForWave(waveNum);
      for (const t of types) {
        spawnBoss(enemies.pool, waveNum, t, cam.x, cam.y, sw, sh);
      }
      return true;
    }
  }
  return false;
}

// ── 启动 ──
resize();
setup();
canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);
canvas.addEventListener('touchcancel', onTouchEnd);
document.addEventListener('contextmenu', e => e.preventDefault());
requestAnimationFrame(loop);
