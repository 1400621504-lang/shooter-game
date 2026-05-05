// Boss 系统 — 每3波出 boss，技能：哈气（白色wifi声波），逐级加强

const BOSS_RADIUS = 40;
const BOSS_BASE_HP = 600;
const BOSS_HP_PER_LEVEL = 200;  // 每级 +150 HP
const BOSS_SPEED_BASE = 48;
const BOSS_SPEED_PER_LEVEL = 4;
const BOSS_DAMAGE_BASE = 28;
const BOSS_DAMAGE_PER_LEVEL = 5;
const BOSS_SCORE_BASE = 1000;
const BOSS_SCORE_PER_LEVEL = 250;
const BOSS_HISS_INTERVAL_BASE = 5.5;
const BOSS_HISS_RANGE_BASE = 170;
const BOSS_HISS_RANGE_PER_LEVEL = 15;
const BOSS_HISS_DAMAGE_BASE = 18;
const BOSS_HISS_DAMAGE_PER_LEVEL = 4;
const BOSS_HISS_PUSH = 160;
const BOSS_HISS_WINDUP = 0.6;

function bossLevel(waveNum) { return Math.floor(waveNum / 3); } // 1,2,3...
function bossScaled(base, perLvl, lvl) { return base + perLvl * (lvl - 1); }

// ── Boss 名字表 ──
const BOSS_NAMES = ['张振颉', '程泽鑫', '耄耋'];
const BOSS_TITLES = ['炫彩', '哈吉', '暗影', '烈焰', '冰霜', '雷霆', '狂暴', '幽灵', '钢铁', '幻影'];

// ── Boss 图片预加载 ──
let bossImg = null;
let bossHissImg = null;
(function loadBossImg() {
  const img = new Image();
  img.onload = () => { bossImg = img; };
  img.onerror = () => {};
  img.src = 'boss-imgs/boss1.gif';
  if (img.complete && img.naturalWidth > 0) bossImg = img;

  const img2 = new Image();
  img2.onload = () => { bossHissImg = img2; };
  img2.onerror = () => {};
  img2.src = 'boss-imgs/boss_hiss.gif';
  if (img2.complete && img2.naturalWidth > 0) bossHissImg = img2;
})();

// ── Boss 出场警告状态 ──
let bossWarnMsg = '';
let bossWarnTimer = 0;    // 警告显示倒计时
let bossWarnDelay = 0;    // 显示前等待

function getBossName(waveNum) {
  const idx = Math.floor(waveNum / 3) - 1; // 第3波=0, 第6波=1...
  if (idx < BOSS_NAMES.length) return BOSS_NAMES[idx];
  // 第4个起：xx耄耋
  const ti = (idx - BOSS_NAMES.length) % BOSS_TITLES.length;
  return BOSS_TITLES[ti] + '耄耋';
}

function triggerBossWarning(waveNum) {
  bossWarnMsg = '⚠ BOSS ' + getBossName(waveNum) + ' 来了！';
  bossWarnDelay = 0.8;
  bossWarnTimer = 0;
}

function spawnBoss(pool, waveNum, camX, camY, sw, sh) {
  let slot = null;
  for (const e of pool) {
    if (!e.active) { slot = e; break; }
  }
  if (!slot) return null;

  const margin = 100;
  const side = randInt(0, 3);
  const vl = camX - sw / 2 - margin;
  const vr = camX + sw / 2 + margin;
  const vt = camY - sh / 2 - margin;
  const vb = camY + sh / 2 + margin;
  let sx, sy;
  switch (side) {
    case 0: sx = rand(vl, vr); sy = vt; break;
    case 1: sx = vr; sy = rand(vt, vb); break;
    case 2: sx = rand(vl, vr); sy = vb; break;
    case 3: sx = vl; sy = rand(vt, vb); break;
  }

  slot.x = clamp(sx, BOSS_RADIUS, WORLD_SIZE - BOSS_RADIUS);
  slot.y = clamp(sy, BOSS_RADIUS, WORLD_SIZE - BOSS_RADIUS);
  slot.active = true;
  slot.isBoss = true;
  const lv = bossLevel(waveNum);
  slot.bossName = getBossName(waveNum);
  slot.bossLevel = lv;
  slot.radius = BOSS_RADIUS;
  slot.hp = bossScaled(BOSS_BASE_HP, BOSS_HP_PER_LEVEL, lv);
  slot.maxHp = slot.hp;
  slot.speed = bossScaled(BOSS_SPEED_BASE, BOSS_SPEED_PER_LEVEL, lv);
  slot._normalSpeed = slot.speed;
  slot.damage = bossScaled(BOSS_DAMAGE_BASE, BOSS_DAMAGE_PER_LEVEL, lv);
  slot.score = bossScaled(BOSS_SCORE_BASE, BOSS_SCORE_PER_LEVEL, lv);
  // 哈气随等级缩放
  slot.hissInterval = Math.max(3.5, BOSS_HISS_INTERVAL_BASE - (lv - 1) * 0.3);
  slot.hissRange = bossScaled(BOSS_HISS_RANGE_BASE, BOSS_HISS_RANGE_PER_LEVEL, lv);
  slot.hissDamage = bossScaled(BOSS_HISS_DAMAGE_BASE, BOSS_HISS_DAMAGE_PER_LEVEL, lv);
  slot.color = '#E91E63';
  slot.type = 'boss';
  slot.hitFlash = 0;
  slot.rot = 0;
  slot.angle = 0;
  slot.vx = 0;
  slot.vy = 0;
  slot.hissCooldown = 0.8; // 快速首次哈气
  slot.hissWindup = 0;
  slot.hissActive = false;
  slot.hissTimer = 0;
  slot.hissAngle = 0;
  slot.hissHitPlayer = false;
  slot._waves = [];  // wifi 波
  slot.img = bossImg;

  return slot;
}

function updateBosses(pool, dt, player, particles, audio, gameTime) {
  // bossWarnDelay/Timer 由 main.js 统一管理

  for (const e of pool) {
    if (!e.active || !e.isBoss) continue;

    e.hissCooldown -= dt;

    // ── 前摇 ──
    if (e.hissWindup > 0) {
      e.hissWindup -= dt;
      e.speed = e._normalSpeed * 0.3;
      if (e.hissWindup <= 0) {
        e.hissActive = true;
        e.hissTimer = 0.6;
        e.hissHitPlayer = false;
        if (bossHissImg && bossHissImg.complete && bossHissImg.naturalWidth > 0) e.img = bossHissImg;
        e.hissAngle = Math.atan2(player.y - e.y, player.x - e.x);
        audio.playHiss();
        particles.emit(e.x, e.y, {
          count: 10, minSpeed: 30, maxSpeed: 100,
          minLife: 0.1, maxLife: 0.3,
          minSize: 1, maxSize: 4,
          colors: ['#fff', '#ddd', '#FF5722']
        });
      }
      continue;
    }

    // ── 哈气激活 ──
    if (e.hissActive) {
      e.speed = 0;
      e.hissTimer -= dt;

      // 每 0.1s 生成一组 wifi 波
      if (e._waves.length < 6 && (e._waves.length === 0 || e.hissTimer < 0.6 - e._waves.length * 0.1)) {
        e._waves.push({ radius: e.radius + 16, alpha: 1.0 });
      }
      for (const w of e._waves) {
        w.radius += dt * 260;
        w.alpha -= dt * 1.7;
      }
      e._waves = e._waves.filter(w => w.alpha > 0);

      // 伤害 + 击退
      if (player.alive) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < e.hissRange + player.radius && d > 10) {
          const adiff = Math.abs(normAngle(Math.atan2(dy, dx) - e.hissAngle));
          if (adiff < Math.PI / 3) {
            if (!e.hissHitPlayer && !player.isInvulnerable()) {
              player.takeDamage(e.hissDamage, gameTime);
              e.hissHitPlayer = true;
            }
            const pushX = (dx / d) * BOSS_HISS_PUSH;
            const pushY = (dy / d) * BOSS_HISS_PUSH;
            player.x = clamp(player.x + pushX * dt, player.radius, WORLD_SIZE - player.radius);
            player.y = clamp(player.y + pushY * dt, player.radius, WORLD_SIZE - player.radius);
          }
        }
      }

      // 粒子
      if (Math.random() < 0.4) {
        const a = e.hissAngle + rand(-Math.PI / 3, Math.PI / 3);
        const r = e.radius + Math.random() * e.hissRange;
        particles.emit(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, {
          count: 1, minSpeed: 5, maxSpeed: 25,
          minLife: 0.1, maxLife: 0.2,
          minSize: 1, maxSize: 3,
          colors: ['#fff', '#eee', '#ddd']
        });
      }

      if (e.hissTimer <= 0) {
        e.hissActive = false;
        e.hissCooldown = e.hissInterval;
        e.img = bossImg; // 换回正常图
        e._waves = [];
      }
      continue;
    }

    e.speed = e._normalSpeed;

    if (e.hissCooldown <= 0 && player.alive) {
      e.hissWindup = BOSS_HISS_WINDUP;
    }
  }
}

// ── 渲染 boss wifi 声波特效 ──
function renderBossEffects(ctx, pool, camX, camY, sw, sh) {
  for (const e of pool) {
    if (!e.active || !e.isBoss) continue;

    const sx = e.x - camX + sw / 2;
    const sy = e.y - camY + sh / 2;
    const maxR = e.hissRange || 180;
    if (sx < -maxR - 50 || sx > sw + maxR + 50 || sy < -maxR - 50 || sy > sh + maxR + 50) continue;

    ctx.save();
    ctx.translate(sx, sy);

    // 前摇脉冲
    if (e.hissWindup > 0) {
      const pulse = Math.sin(e.hissWindup * 15) * 0.4 + 0.6;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#F44336';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 10, 0, Math.PI * 2); ctx.stroke();
    }

    // Wifi 式声波：白色扇形弧线
    for (const w of (e._waves || [])) {
      if (w.alpha <= 0) continue;
      const a = w.alpha;
      const arcAngle = Math.PI / 2.5; // 72° 扇形
      const ha = e.hissAngle - arcAngle / 2;
      // 三层弧线（像 wifi 图标）
      const levels = [
        { r: w.radius, lw: 2.5, alphaMul: 1 },
        { r: w.radius + 16, lw: 2, alphaMul: 0.7 },
        { r: w.radius + 30, lw: 1.5, alphaMul: 0.45 },
      ];
      for (const lv of levels) {
        ctx.globalAlpha = a * lv.alphaMul;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = lv.lw;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, lv.r, ha, ha + arcAngle);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── 渲染 boss 出场警告 ──
function renderBossWarning(ctx, sw, sh, state) {
  // 强制：playing/over/paused 状态绝不显示
  if (state !== 'wavePause') { bossWarnTimer = 0; bossWarnDelay = 0; return; }
  if (bossWarnTimer <= 0) return;
  const s = Math.min(sw, sh) / 600;
  const alpha = bossWarnTimer > 0.8 ? 1 : bossWarnTimer / 0.8;

  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, sw, sh);

  const flash = Math.sin(Date.now() / 80) * 0.4 + 0.6;
  ctx.globalAlpha = alpha * flash;
  ctx.strokeStyle = '#F44336';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, sw - 40, sh - 40);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#F44336';
  ctx.font = `bold ${Math.round(30 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bossWarnMsg, sw / 2, sh / 2 - 10);
  ctx.fillStyle = '#aaa';
  ctx.font = `${Math.round(14 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.fillText('准备迎战！', sw / 2, sh / 2 + 30);

  ctx.restore();
}

// ── 渲染 boss 头顶名字（由 main.js 调用，在敌人渲染之后）──
function renderBossNames(ctx, pool, camX, camY, sw, sh) {
  const s = Math.min(sw, sh) / 600;
  ctx.font = `bold ${Math.round(11 * s)}px "PingFang SC","Helvetica Neue",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const e of pool) {
    if (!e.active || !e.isBoss) continue;
    const sx = e.x - camX + sw / 2;
    const sy = e.y - camY + sh / 2;
    if (sx < -60 || sx > sw + 60 || sy < -60 || sy > sh + 60) continue;
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    const label = e.bossName + ' Lv.' + (e.bossLevel || 1);
    ctx.fillText(label, sx, sy - e.radius - 8);
    ctx.shadowBlur = 0;
  }
}
