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
let comboTimer = 0;
let comboCount = 0;
let bestCombo = 0;
let gameTime = 0;

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
  bgm.play();
  requestFullscreen();
  setup();
  state = STATE.PLAYING;
  nextWave();
}

// ── 下一波 ──
function nextWave() {
  waveNum++;
  enemies.spawnWave(waveNum, cam.x, cam.y, sw, sh);
  if (waveNum >= 3 && waveNum % 3 === 0) {
    waveMsg = '⚠ BOSS ' + getBossName(waveNum) + ' 第 ' + waveNum + ' 波';
  } else {
    waveMsg = '第 ' + waveNum + ' 波';
  }
  waveMsgTimer = 1.5;
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
      if (pauseTimer >= 0.5) {
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

    // 子弹
    bullets.update(dt, WORLD_SIZE);

    // 敌人
    enemies.update(dt, player);

    // Boss 技能更新
    updateBosses(enemies.pool, dt, player, particles, audio, gameTime);

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
        // 直接显示波次消息，不用黑遮罩
        waveMsg = '⚠ BOSS ' + getBossName(waveNum + 1) + ' 来了！';
        waveMsgTimer = 2.0;
      }
      audio.waveClear();
    }
  } else if (state === STATE.WAVE_PAUSE) {
    wavePauseTimer -= dt;
    if (wavePauseTimer <= 0) {
      state = STATE.PLAYING;
      nextWave();
      if (waveNum >= 3 && waveNum % 3 === 0) {
        spawnBoss(enemies.pool, waveNum, cam.x, cam.y, sw, sh);
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

  // 当前 BGM + 进度条（底部中）
  if (bgm) {
    const bx = sw / 2 - 60 * s;
    const by = sh - 18 * s;
    const bw = 120 * s;
    // 进度条背景
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, 3 * s);
    // 进度条
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(bx, by, bw * bgm.progress, 3 * s);
    // 文字
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#666';
    ctx.font = `${Math.round(10 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('♪ ' + bgm.currentName + '  ← →切歌', sw / 2, by - 4 * s);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── 渲染：开始界面 ──
function drawStartScreen() {
  const s = uiScale();
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, sw, sh);

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(40 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('俯角射击', sw / 2, sh / 2 - 80 * s);

  ctx.fillStyle = '#aaa';
  ctx.font = `${Math.round(16 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('左手移动  ·  右手射击', sw / 2, sh / 2 - 20 * s);

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
    lines.push('M 静音/播放 BGM');
    lines.push('← → 切歌  ♪ ' + bgm.currentName);
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

  // 子弹
  bullets.render(ctx, rCamX, rCamY, sw, sh);

  // 摇杆 UI
  moveJoy.render(ctx);
  shootJoy.render(ctx);

  // HUD
  drawHUD();

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
  if (state === STATE.START) {
    startGame();
    return;
  }
  if (state === STATE.OVER) {
    // 点任意位置重来
    startGame();
    return;
  }
  for (const t of e.changedTouches) {
    moveJoy.tryStart(t.identifier, t.clientX, t.clientY, sw);
    shootJoy.tryStart(t.identifier, t.clientX, t.clientY, sw);
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
  // ← → 切 BGM, M 静音
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'm') {
    e.preventDefault();
    if (e.key === 'ArrowLeft') bgm.prev();
    else if (e.key === 'ArrowRight') bgm.next();
    else bgm.toggleMute();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousedown', e => {
  e.preventDefault();
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

// ── 启动 ──
resize();
setup();
canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);
canvas.addEventListener('touchcancel', onTouchEnd);
document.addEventListener('contextmenu', e => e.preventDefault());
requestAnimationFrame(loop);
