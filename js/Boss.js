// Boss 系统 — 多类型 Boss 共存：哈气(原版)/坦克/超人/飞机

const BOSS_TYPE = { HISS: 'hiss', TANK: 'tank', SUPERMAN: 'superman', AIRCRAFT: 'aircraft' };

// ── 哈气 Boss 常量 ──
const BOSS_RADIUS = 40;
const BOSS_BASE_HP = 600;
const BOSS_HP_PER_LEVEL = 200;
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

// ── 坦克 Boss 常量 ──
const TANK_RADIUS = 55;
const TANK_BASE_HP = 1000;
const TANK_HP_PER_LEVEL = 300;
const TANK_SPEED = 35;
const TANK_SPEED_PER_LEVEL = 2;
const TANK_DAMAGE = 40;
const TANK_DAMAGE_PER_LEVEL = 8;
const TANK_SCORE = 1500;
const TANK_SCORE_PER_LEVEL = 350;
const TANK_DEFENSE = 0.4;
const TANK_MISSILE_INTERVAL = 3.0;
const TANK_MISSILE_SPEED = 220;
const TANK_MISSILE_DAMAGE = 25;
const TANK_MISSILE_LIFETIME = 4.5;
const TANK_SHELL_INTERVAL = 4.0;
const TANK_SHELL_COUNT = 12;
const TANK_SHELL_SPEED = 200;
const TANK_SHELL_DAMAGE = 15;
const TANK_SHELL_LIFETIME = 1.8;

// ── 超人 Boss 常量 ──
const SUPERMAN_RADIUS = 30;
const SUPERMAN_BASE_HP = 400;
const SUPERMAN_HP_PER_LEVEL = 120;
const SUPERMAN_SPEED = 200;
const SUPERMAN_SPEED_PER_LEVEL = 15;
const SUPERMAN_DAMAGE = 12;
const SUPERMAN_DAMAGE_PER_LEVEL = 3;
const SUPERMAN_SCORE = 1200;
const SUPERMAN_SCORE_PER_LEVEL = 300;
const SUPERMAN_DASH_INTERVAL = 4.0;
const SUPERMAN_DASH_SPEED = 500;
const SUPERMAN_DASH_DURATION = 0.4;
const SUPERMAN_DODGE_INTERVAL = 2.5;
const SUPERMAN_DODGE_DURATION = 0.3;
const SUPERMAN_DODGE_SPEED = 350;

// ── 飞机 Boss 常量 ──
const AIRCRAFT_RADIUS = 38;
const AIRCRAFT_BASE_HP = 700;
const AIRCRAFT_HP_PER_LEVEL = 180;
const AIRCRAFT_SPEED = 120;
const AIRCRAFT_SPEED_PER_LEVEL = 8;
const AIRCRAFT_DAMAGE = 22;
const AIRCRAFT_DAMAGE_PER_LEVEL = 5;
const AIRCRAFT_SCORE = 1500;
const AIRCRAFT_SCORE_PER_LEVEL = 350;
const AIRCRAFT_BARRAGE_INTERVAL = 2.5;
const AIRCRAFT_BARRAGE_BULLETS = 8;
const AIRCRAFT_BARRAGE_SPEED = 300;
const AIRCRAFT_BARRAGE_DAMAGE = 12;
const AIRCRAFT_MISSILE_INTERVAL = 5.0;
const AIRCRAFT_MISSILE_COUNT = 6;
const AIRCRAFT_MISSILE_SPEED = 180;
const AIRCRAFT_MISSILE_LIFETIME = 4.0;
const AIRCRAFT_MISSILE_DAMAGE = 30;
const AIRCRAFT_DIVE_INTERVAL = 7.0;
const AIRCRAFT_DIVE_SPEED = 500;
const AIRCRAFT_DIVE_DURATION = 0.5;
const AIRCRAFT_DIVE_BULLETS = 12;
const AIRCRAFT_DIVE_DAMAGE = 18;

function bossLevel(waveNum) { return Math.floor(waveNum / 3); }
function bossScaled(base, perLvl, lvl) { return base + perLvl * (lvl - 1); }

// ── Boss 名字表 ──
const BOSS_NAMES = ['张振颉', '程泽鑫', '耄耋'];
const BOSS_TITLES = ['炫彩', '哈吉', '暗影', '烈焰', '冰霜', '雷霆', '狂暴', '幽灵', '钢铁', '幻影'];
const TANK_NAMES = ['铁壁', '钢牙', '巨锤', '堡垒', '重装', '磐石', '战车', '洪流'];
const SUPERMAN_NAMES = ['疾风', '闪电', '魅影', '飞燕', '流光', '迅雷', '幻刃', '追魂'];
const AIRCRAFT_NAMES = ['天袭', '猎鹰', '风暴', '雷霆', '毁灭', '天罚', '飓风', '天火'];

// ── Boss 图片预加载 ──
let bossImg = null;
let bossHissImg = null;
let tankBossImg = null;
let supermanBossImg = null;
let aircraftBossImg = null;
(function loadBossImg() {
  const load = (src, onOk) => {
    const img = new Image();
    img.onload = () => onOk(img);
    img.onerror = () => {};
    img.src = src;
    if (img.complete && img.naturalWidth > 0) onOk(img);
  };
  load('boss-imgs/boss1.gif', im => bossImg = im);
  load('boss-imgs/boss_hiss.gif', im => bossHissImg = im);
  load('boss-imgs/boss_tank.gif', im => tankBossImg = im);
  load('boss-imgs/boss_superman.gif', im => supermanBossImg = im);
  load('boss-imgs/boss_aircraft.gif', im => aircraftBossImg = im);
})();

// ── Boss 出场警告状态 ──
let bossWarnMsg = '';
let bossWarnTimer = 0;
let bossWarnDelay = 0;

function getBossName(waveNum, bossType) {
  if (bossType === BOSS_TYPE.TANK) {
    const idx = Math.floor(waveNum / 3) - 2;
    return (TANK_NAMES[idx % TANK_NAMES.length] || '铁壁') + '坦克';
  }
  if (bossType === BOSS_TYPE.SUPERMAN) {
    const idx = Math.floor(waveNum / 3) - 3;
    return (SUPERMAN_NAMES[idx % SUPERMAN_NAMES.length] || '疾风') + '超人';
  }
  if (bossType === BOSS_TYPE.AIRCRAFT) {
    const idx = Math.floor(waveNum / 3) - 4;
    return (AIRCRAFT_NAMES[idx % AIRCRAFT_NAMES.length] || '天袭') + '战机';
  }
  const idx = Math.floor(waveNum / 3) - 1;
  if (idx < BOSS_NAMES.length) return BOSS_NAMES[idx];
  const ti = (idx - BOSS_NAMES.length) % BOSS_TITLES.length;
  return BOSS_TITLES[ti] + '耄耋';
}

function getBossTypesForWave(waveNum) {
  if (waveNum < 3 || waveNum % 3 !== 0) return [];
  const types = [BOSS_TYPE.HISS];
  const bi = Math.floor(waveNum / 3);
  if (bi >= 2) types.push(BOSS_TYPE.TANK);
  if (bi >= 3) types.push(BOSS_TYPE.SUPERMAN);
  if (bi >= 4) types.push(BOSS_TYPE.AIRCRAFT);
  return types;
}

function spawnBoss(pool, waveNum, bossType, camX, camY, sw, sh) {
  let slot = null;
  for (const e of pool) {
    if (!e.active) { slot = e; break; }
  }
  if (!slot) return null;

  const lv = bossLevel(waveNum);
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

  if (bossType === BOSS_TYPE.TANK) {
    slot.x = clamp(sx, TANK_RADIUS, WORLD_SIZE - TANK_RADIUS);
    slot.y = clamp(sy, TANK_RADIUS, WORLD_SIZE - TANK_RADIUS);
    slot.active = true;
    slot.isBoss = true;
    slot.bossType = BOSS_TYPE.TANK;
    slot.bossName = getBossName(waveNum, BOSS_TYPE.TANK);
    slot.bossLevel = lv;
    slot.radius = TANK_RADIUS;
    slot.hp = bossScaled(TANK_BASE_HP, TANK_HP_PER_LEVEL, lv);
    slot.maxHp = slot.hp;
    slot.speed = bossScaled(TANK_SPEED, TANK_SPEED_PER_LEVEL, lv);
    slot._normalSpeed = slot.speed;
    slot.damage = bossScaled(TANK_DAMAGE, TANK_DAMAGE_PER_LEVEL, lv);
    slot.score = bossScaled(TANK_SCORE, TANK_SCORE_PER_LEVEL, lv);
    slot.defense = TANK_DEFENSE;
    slot.color = '#795548';
    slot.type = 'boss';
    slot.hitFlash = 0;
    slot.rot = 0;
    slot.angle = 0;
    slot.vx = 0;
    slot.vy = 0;
    slot.img = tankBossImg;
    slot._missileTimer = 2.0;
    slot._missileInterval = TANK_MISSILE_INTERVAL;
    slot._missiles = [];
    slot._shellTimer = 5.0;
    slot._shellInterval = TANK_SHELL_INTERVAL;
    slot._shells = [];
  } else if (bossType === BOSS_TYPE.SUPERMAN) {
    slot.x = clamp(sx, SUPERMAN_RADIUS, WORLD_SIZE - SUPERMAN_RADIUS);
    slot.y = clamp(sy, SUPERMAN_RADIUS, WORLD_SIZE - SUPERMAN_RADIUS);
    slot.active = true;
    slot.isBoss = true;
    slot.bossType = BOSS_TYPE.SUPERMAN;
    slot.bossName = getBossName(waveNum, BOSS_TYPE.SUPERMAN);
    slot.bossLevel = lv;
    slot.radius = SUPERMAN_RADIUS;
    slot.hp = bossScaled(SUPERMAN_BASE_HP, SUPERMAN_HP_PER_LEVEL, lv);
    slot.maxHp = slot.hp;
    slot.speed = bossScaled(SUPERMAN_SPEED, SUPERMAN_SPEED_PER_LEVEL, lv);
    slot._normalSpeed = slot.speed;
    slot.damage = bossScaled(SUPERMAN_DAMAGE, SUPERMAN_DAMAGE_PER_LEVEL, lv);
    slot.score = bossScaled(SUPERMAN_SCORE, SUPERMAN_SCORE_PER_LEVEL, lv);
    slot.color = '#00BCD4';
    slot.type = 'boss';
    slot.hitFlash = 0;
    slot.rot = 0;
    slot.angle = 0;
    slot.vx = 0;
    slot.vy = 0;
    slot.img = supermanBossImg;
    // 冲刺
    slot._dashTimer = 3.0;
    slot._dashInterval = SUPERMAN_DASH_INTERVAL;
    slot._dashActive = false;
    slot._dashTimer2 = 0;
    slot._dashAngle = 0;
    // 闪避
    slot._dodgeTimer = 1.5;
    slot._dodgeInterval = SUPERMAN_DODGE_INTERVAL;
    slot._dodgeActive = false;
    slot._dodgeTimer2 = 0;
    slot._dodgeAngle = 0;
    slot._trail = [];
  } else if (bossType === BOSS_TYPE.AIRCRAFT) {
    slot.x = clamp(sx, AIRCRAFT_RADIUS, WORLD_SIZE - AIRCRAFT_RADIUS);
    slot.y = clamp(sy, AIRCRAFT_RADIUS, WORLD_SIZE - AIRCRAFT_RADIUS);
    slot.active = true;
    slot.isBoss = true;
    slot.bossType = BOSS_TYPE.AIRCRAFT;
    slot.bossName = getBossName(waveNum, BOSS_TYPE.AIRCRAFT);
    slot.bossLevel = lv;
    slot.radius = AIRCRAFT_RADIUS;
    slot.hp = bossScaled(AIRCRAFT_BASE_HP, AIRCRAFT_HP_PER_LEVEL, lv);
    slot.maxHp = slot.hp;
    slot.speed = bossScaled(AIRCRAFT_SPEED, AIRCRAFT_SPEED_PER_LEVEL, lv);
    slot._normalSpeed = slot.speed;
    slot.damage = bossScaled(AIRCRAFT_DAMAGE, AIRCRAFT_DAMAGE_PER_LEVEL, lv);
    slot.score = bossScaled(AIRCRAFT_SCORE, AIRCRAFT_SCORE_PER_LEVEL, lv);
    slot.color = '#FF9800';
    slot.type = 'boss';
    slot.hitFlash = 0;
    slot.rot = 0;
    slot.angle = 0;
    slot.vx = 0;
    slot.vy = 0;
    slot.img = aircraftBossImg;
    // 弹幕
    slot._barrageTimer = 1.0;
    slot._barrageInterval = AIRCRAFT_BARRAGE_INTERVAL;
    slot._airBullets = [];
    // 导弹
    slot._acMissileTimer = 3.0;
    slot._acMissileInterval = AIRCRAFT_MISSILE_INTERVAL;
    slot._acMissiles = [];
    // 俯冲
    slot._diveTimer = 5.0;
    slot._diveInterval = AIRCRAFT_DIVE_INTERVAL;
    slot._diveActive = false;
    slot._diveTimer2 = 0;
    slot._diveAngle = 0;
    slot._diveBulletsFired = false;
  } else {
    // 默认哈气 Boss
    slot.x = clamp(sx, BOSS_RADIUS, WORLD_SIZE - BOSS_RADIUS);
    slot.y = clamp(sy, BOSS_RADIUS, WORLD_SIZE - BOSS_RADIUS);
    slot.active = true;
    slot.isBoss = true;
    slot.bossType = BOSS_TYPE.HISS;
    slot.bossName = getBossName(waveNum, BOSS_TYPE.HISS);
    slot.bossLevel = lv;
    slot.radius = BOSS_RADIUS;
    slot.hp = bossScaled(BOSS_BASE_HP, BOSS_HP_PER_LEVEL, lv);
    slot.maxHp = slot.hp;
    slot.speed = bossScaled(BOSS_SPEED_BASE, BOSS_SPEED_PER_LEVEL, lv);
    slot._normalSpeed = slot.speed;
    slot.damage = bossScaled(BOSS_DAMAGE_BASE, BOSS_DAMAGE_PER_LEVEL, lv);
    slot.score = bossScaled(BOSS_SCORE_BASE, BOSS_SCORE_PER_LEVEL, lv);
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
    slot.hissCooldown = 0.8;
    slot.hissWindup = 0;
    slot.hissActive = false;
    slot.hissTimer = 0;
    slot.hissAngle = 0;
    slot.hissHitPlayer = false;
    slot._waves = [];
    slot.img = bossImg;
  }

  return slot;
}

// ── 哈气 Boss 更新 ──
function _updateHissBoss(e, dt, player, particles, audio, gameTime) {
  e.hissCooldown -= dt;

  if (e.hissWindup > 0) {
    e.hissWindup -= dt;
    e.speed = e._normalSpeed * 0.3;
    if (e.hissWindup <= 0) {
      e.hissActive = true;
      e.hissTimer = 0.6;
      e.hissHitPlayer = false;
      // 玩家在哈气范围内 → 触发角色表情
      if (player.alive) {
        const dx3 = player.x - e.x;
        const dy3 = player.y - e.y;
        if (Math.sqrt(dx3 * dx3 + dy3 * dy3) < e.hissRange * 2 + player.radius) {
          player.onBossHiss();
        }
      }
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
    return;
  }

  if (e.hissActive) {
    e.speed = 0;
    e.hissTimer -= dt;

    if (e._waves.length < 6 && (e._waves.length === 0 || e.hissTimer < 0.6 - e._waves.length * 0.1)) {
      e._waves.push({ radius: e.radius + 16, alpha: 1.0 });
    }
    for (const w of e._waves) {
      w.radius += dt * 260;
      w.alpha -= dt * 1.7;
    }
    e._waves = e._waves.filter(w => w.alpha > 0);

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
      e.img = bossImg;
      e._waves = [];
    }
    return;
  }

  e.speed = e._normalSpeed;

  if (e.hissCooldown <= 0 && player.alive) {
    e.hissWindup = BOSS_HISS_WINDUP;
  }
}

// ── 坦克 Boss 更新 ──
function _updateTankBoss(e, dt, player, particles, audio, gameTime) {
  // 追踪导弹
  e._missileTimer -= dt;
  if (e._missileTimer <= 0 && player.alive) {
    e._missileTimer = e._missileInterval;
    const mx = e.x;
    const my = e.y;
    const angle = Math.atan2(player.y - my, player.x - mx);
    e._missiles.push({
      x: mx + Math.cos(angle) * (e.radius + 10),
      y: my + Math.sin(angle) * (e.radius + 10),
      vx: Math.cos(angle) * TANK_MISSILE_SPEED,
      vy: Math.sin(angle) * TANK_MISSILE_SPEED,
      speed: TANK_MISSILE_SPEED,
      damage: TANK_MISSILE_DAMAGE,
      lifetime: TANK_MISSILE_LIFETIME,
      trail: []
    });
    audio.missileLaunch();
  }

  // 更新导弹
  for (const m of e._missiles) {
    m.lifetime -= dt;
    m.trail.push({ x: m.x, y: m.y, life: 0.25 });
    if (m.trail.length > 15) m.trail.shift();
    for (const t of m.trail) t.life -= dt;

    // 追踪玩家
    if (player.alive) {
      const dx = player.x - m.x;
      const dy = player.y - m.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const turnRate = 3.5 * dt;
      const curAngle = Math.atan2(m.vy, m.vx);
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - curAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const newAngle = curAngle + clamp(diff, -turnRate, turnRate);
      m.vx = Math.cos(newAngle) * m.speed;
      m.vy = Math.sin(newAngle) * m.speed;
    }

    m.x += m.vx * dt;
    m.y += m.vy * dt;

    // 碰玩家
    if (player.alive && !player.isInvulnerable()) {
      const d = dist(m.x, m.y, player.x, player.y);
      if (d < player.radius + 8) {
        player.takeDamage(m.damage, gameTime);
        m.lifetime = -1;
        audio.missileExplosion();
        particles.emit(m.x, m.y, {
          count: 20, minSpeed: 50, maxSpeed: 200,
          minLife: 0.15, maxLife: 0.5,
          minSize: 2, maxSize: 6,
          colors: ['#FF5722', '#FF9800', '#fff', '#f00']
        });
      }
    }
  }
  e._missiles = e._missiles.filter(m => m.lifetime > 0);

  // 环形炮击
  e._shellTimer -= dt;
  if (e._shellTimer <= 0 && player.alive) {
    e._shellTimer = e._shellInterval;
    audio.tankShell();
    for (let i = 0; i < TANK_SHELL_COUNT; i++) {
      const a = (Math.PI * 2 / TANK_SHELL_COUNT) * i;
      e._shells.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * TANK_SHELL_SPEED,
        vy: Math.sin(a) * TANK_SHELL_SPEED,
        radius: 5,
        damage: TANK_SHELL_DAMAGE,
        lifetime: TANK_SHELL_LIFETIME
      });
    }
    // 炮击闪光粒子
    particles.emit(e.x, e.y, {
      count: 25, minSpeed: 80, maxSpeed: 250,
      minLife: 0.1, maxLife: 0.35,
      minSize: 2, maxSize: 5,
      colors: ['#FF5722', '#FF9800', '#fff', '#FFEB3B']
    });
  }

  // 更新炮弹
  for (const s of e._shells) {
    s.lifetime -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.x = clamp(s.x, s.radius, WORLD_SIZE - s.radius);
    s.y = clamp(s.y, s.radius, WORLD_SIZE - s.radius);

    if (player.alive && !player.isInvulnerable()) {
      const d = dist(s.x, s.y, player.x, player.y);
      if (d < player.radius + s.radius) {
        player.takeDamage(s.damage, gameTime);
        s.lifetime = -1;
        particles.emit(s.x, s.y, {
          count: 8, minSpeed: 30, maxSpeed: 120,
          minLife: 0.08, maxLife: 0.25,
          minSize: 1, maxSize: 4,
          colors: ['#FF5722', '#FF9800', '#fff']
        });
      }
    }
  }
  e._shells = e._shells.filter(s => s.lifetime > 0);
}

// ── 超人 Boss 更新 ──
function _updateSupermanBoss(e, dt, player, particles, audio, gameTime) {
  // 拖尾更新
  e._trail = e._trail || [];
  e._trail.push({ x: e.x, y: e.y, life: 0.2 });
  if (e._trail.length > 12) e._trail.shift();
  for (const t of e._trail) t.life -= dt;
  e._trail = e._trail.filter(t => t.life > 0);

  // 更新计时器
  e._dashTimer -= dt;
  e._dodgeTimer -= dt;

  // 闪避中
  if (e._dodgeActive) {
    e._dodgeTimer2 -= dt;
    e.speed = SUPERMAN_DODGE_SPEED;
    e.defense = 1.0; // 完全无敌
    if (e._dodgeTimer2 <= 0) {
      e._dodgeActive = false;
      e.defense = undefined;
    }
    // 朝闪避方向移动
    e.x += Math.cos(e._dodgeAngle) * e.speed * dt;
    e.y += Math.sin(e._dodgeAngle) * e.speed * dt;
    e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
    e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
    return;
  }

  // 冲刺中
  if (e._dashActive) {
    e._dashTimer2 -= dt;
    e.speed = SUPERMAN_DASH_SPEED;
    if (e._dashTimer2 <= 0) {
      e._dashActive = false;
      e.speed = e._normalSpeed;
      e._dashTimer = e._dashInterval;
    }
    // 朝冲刺方向移动（持续追踪玩家）
    const dx3 = player.x - e.x;
    const dy3 = player.y - e.y;
    const d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3) || 0.001;
    const turnRate2 = 6.0 * dt;
    const curAng = Math.atan2(e.vy || Math.sin(e._dashAngle), e.vx || Math.cos(e._dashAngle));
    const tgtAng = Math.atan2(dy3, dx3);
    let diff = tgtAng - curAng;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const newAng = curAng + clamp(diff, -turnRate2, turnRate2);
    const spd = e.speed;
    e.vx = Math.cos(newAng) * spd;
    e.vy = Math.sin(newAng) * spd;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
    e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
    e.angle = newAng;
    return;
  }

  // 正常状态速度
  e.speed = e._normalSpeed;

  // 冲刺触发
  if (e._dashTimer <= 0 && player.alive) {
    e._dashActive = true;
    e._dashTimer2 = SUPERMAN_DASH_DURATION;
    e._dashAngle = Math.atan2(player.y - e.y, player.x - e.x);
    e.speed = SUPERMAN_DASH_SPEED;
    e._trail = [];
    audio.supermanDash();
    particles.emit(e.x, e.y, {
      count: 8, minSpeed: 60, maxSpeed: 200,
      minLife: 0.1, maxLife: 0.3,
      minSize: 1, maxSize: 3,
      colors: ['#00BCD4', '#B2EBF2', '#fff']
    });
  }

  // 闪避触发（在冲刺冷却中，有一定概率闪避）
  if (e._dodgeTimer <= 0 && !e._dashActive && player.alive) {
    e._dodgeActive = true;
    e._dodgeTimer2 = SUPERMAN_DODGE_DURATION;
    e._dodgeTimer = e._dodgeInterval;
    // 垂直于玩家方向随机选一边闪避
    const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);
    e._dodgeAngle = toPlayer + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    e.vx = Math.cos(e._dodgeAngle) * SUPERMAN_DODGE_SPEED;
    e.vy = Math.sin(e._dodgeAngle) * SUPERMAN_DODGE_SPEED;
    e.defense = 1.0;
    audio.supermanDodge();
    particles.emit(e.x, e.y, {
      count: 6, minSpeed: 40, maxSpeed: 120,
      minLife: 0.08, maxLife: 0.2,
      minSize: 1, maxSize: 3,
      colors: ['#B2EBF2', '#fff', '#00BCD4']
    });
  }
}

// ── 飞机 Boss 更新 ──
function _updateAircraftBoss(e, dt, player, particles, audio, gameTime) {
  // 弹幕
  e._barrageTimer -= dt;
  e._barrageInterval = e._barrageInterval || AIRCRAFT_BARRAGE_INTERVAL;
  if (e._barrageTimer <= 0 && player.alive) {
    e._barrageTimer = e._barrageInterval;
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    const spread = Math.PI / 4; // 45° 扇形
    for (let i = 0; i < AIRCRAFT_BARRAGE_BULLETS; i++) {
      const a = angle - spread / 2 + (spread / (AIRCRAFT_BARRAGE_BULLETS - 1)) * i;
      e._airBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * AIRCRAFT_BARRAGE_SPEED,
        vy: Math.sin(a) * AIRCRAFT_BARRAGE_SPEED,
        radius: 4,
        damage: AIRCRAFT_BARRAGE_DAMAGE,
        lifetime: 2.0
      });
    }
    audio.aircraftBarrage();
    particles.emit(e.x, e.y, {
      count: 12, minSpeed: 100, maxSpeed: 300,
      minLife: 0.05, maxLife: 0.15,
      minSize: 1, maxSize: 3,
      colors: ['#FFEB3B', '#FF9800', '#fff']
    });
  }

  // 导弹齐射
  e._acMissileTimer -= dt;
  e._acMissileInterval = e._acMissileInterval || AIRCRAFT_MISSILE_INTERVAL;
  if (e._acMissileTimer <= 0 && player.alive) {
    e._acMissileTimer = e._acMissileInterval;
    const baseAngle = Math.atan2(player.y - e.y, player.x - e.x);
    for (let i = 0; i < AIRCRAFT_MISSILE_COUNT; i++) {
      const a = baseAngle - 0.5 + (1.0 / (AIRCRAFT_MISSILE_COUNT - 1)) * i;
      e._acMissiles.push({
        x: e.x + Math.cos(a) * (e.radius + 12),
        y: e.y + Math.sin(a) * (e.radius + 12),
        vx: Math.cos(a) * AIRCRAFT_MISSILE_SPEED,
        vy: Math.sin(a) * AIRCRAFT_MISSILE_SPEED,
        speed: AIRCRAFT_MISSILE_SPEED,
        damage: AIRCRAFT_MISSILE_DAMAGE,
        lifetime: AIRCRAFT_MISSILE_LIFETIME,
        trail: []
      });
    }
    audio.aircraftMissile();
  }

  // 俯冲
  e._diveTimer -= dt;
  e._diveInterval = e._diveInterval || AIRCRAFT_DIVE_INTERVAL;
  if (e._diveActive) {
    e._diveTimer2 -= dt;
    e.speed = AIRCRAFT_DIVE_SPEED;
    if (e._diveTimer2 <= 0.2 && !e._diveBulletsFired) {
      // 到达时释放近距离弹幕
      e._diveBulletsFired = true;
      for (let i = 0; i < AIRCRAFT_DIVE_BULLETS; i++) {
        const a = (Math.PI * 2 / AIRCRAFT_DIVE_BULLETS) * i;
        e._airBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * 250,
          vy: Math.sin(a) * 250,
          radius: 4,
          damage: AIRCRAFT_DIVE_DAMAGE,
          lifetime: 1.2
        });
      }
      audio.aircraftBarrage();
      particles.emit(e.x, e.y, {
        count: 20, minSpeed: 80, maxSpeed: 300,
        minLife: 0.1, maxLife: 0.3,
        minSize: 2, maxSize: 6,
        colors: ['#FFEB3B', '#FF9800', '#fff', '#F44336']
      });
    }
    if (e._diveTimer2 <= 0) {
      e._diveActive = false;
      e.speed = e._normalSpeed;
      e._diveTimer = e._diveInterval;
    }
  } else if (e._diveTimer <= 0 && player.alive) {
    e._diveActive = true;
    e._diveTimer2 = AIRCRAFT_DIVE_DURATION;
    e._diveAngle = Math.atan2(player.y - e.y, player.x - e.x);
    e._diveBulletsFired = false;
    audio.aircraftDive();
  }

  // 更新弹幕子弹
  for (const b of e._airBullets) {
    b.lifetime -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.x = clamp(b.x, b.radius, WORLD_SIZE - b.radius);
    b.y = clamp(b.y, b.radius, WORLD_SIZE - b.radius);
    if (player.alive && !player.isInvulnerable()) {
      const d2 = dist(b.x, b.y, player.x, player.y);
      if (d2 < player.radius + b.radius) {
        player.takeDamage(b.damage, gameTime);
        b.lifetime = -1;
        particles.emit(b.x, b.y, {
          count: 4, minSpeed: 20, maxSpeed: 80,
          minLife: 0.05, maxLife: 0.15,
          minSize: 1, maxSize: 3,
          colors: ['#FFEB3B', '#fff']
        });
      }
    }
  }
  e._airBullets = e._airBullets.filter(b => b.lifetime > 0);

  // 更新导弹
  for (const m of e._acMissiles) {
    m.lifetime -= dt;
    m.trail.push({ x: m.x, y: m.y, life: 0.2 });
    if (m.trail.length > 10) m.trail.shift();
    for (const t of m.trail) t.life -= dt;

    if (player.alive) {
      const dx2 = player.x - m.x;
      const dy2 = player.y - m.y;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 0.001;
      const turnRate2 = 2.5 * dt;
      const curAng = Math.atan2(m.vy, m.vx);
      const tgtAng = Math.atan2(dy2, dx2);
      let diff = tgtAng - curAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const newAng = curAng + clamp(diff, -turnRate2, turnRate2);
      m.vx = Math.cos(newAng) * m.speed;
      m.vy = Math.sin(newAng) * m.speed;
    }

    m.x += m.vx * dt;
    m.y += m.vy * dt;

    if (player.alive && !player.isInvulnerable()) {
      const d2 = dist(m.x, m.y, player.x, player.y);
      if (d2 < player.radius + 8) {
        player.takeDamage(m.damage, gameTime);
        m.lifetime = -1;
        audio.missileExplosion();
        particles.emit(m.x, m.y, {
          count: 15, minSpeed: 40, maxSpeed: 180,
          minLife: 0.1, maxLife: 0.4,
          minSize: 2, maxSize: 5,
          colors: ['#FF5722', '#FF9800', '#fff']
        });
      }
    }
  }
  e._acMissiles = e._acMissiles.filter(m => m.lifetime > 0);
}

// ── 主 Boss 更新入口 ──
function updateBosses(pool, dt, player, particles, audio, gameTime) {
  for (const e of pool) {
    if (!e.active || !e.isBoss) continue;

    // 所有 Boss 朝玩家移动
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    e.angle = Math.atan2(dy, dx);

    if (e.bossType === BOSS_TYPE.TANK) {
      e.rot += dt * 0.5;
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
      e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
      e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
      _updateTankBoss(e, dt, player, particles, audio, gameTime);
    } else if (e.bossType === BOSS_TYPE.SUPERMAN) {
      e.rot += dt * 3;
      // 超人移动由 _updateSupermanBoss 控制
      if (!e._dashActive && !e._dodgeActive) {
        // 环绕玩家高速移动
        const orbitDist = 160;
        const perpX = -(dy / d);
        const perpY = (dx / d);
        const targetX = player.x - (dx / d) * orbitDist + perpX * Math.sin(gameTime * 3) * 80;
        const targetY = player.y - (dy / d) * orbitDist + perpY * Math.sin(gameTime * 3) * 80;
        const tdx = targetX - e.x;
        const tdy = targetY - e.y;
        const td = Math.sqrt(tdx * tdx + tdy * tdy) || 0.001;
        e.x += (tdx / td) * e.speed * dt;
        e.y += (tdy / td) * e.speed * dt;
      }
      e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
      e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
      _updateSupermanBoss(e, dt, player, particles, audio, gameTime);
    } else if (e.bossType === BOSS_TYPE.AIRCRAFT) {
      e.rot += dt * 1.2;
      if (!e._diveActive) {
        // 悬浮绕圈
        const adx = player.x - e.x;
        const ady = player.y - e.y;
        const ad = Math.sqrt(adx * adx + ady * ady) || 0.001;
        const orbitR = 200;
        const px = -(ady / ad);
        const py = (adx / ad);
        const tx2 = player.x - (adx / ad) * orbitR + px * Math.cos(gameTime * 2 + e.bossLevel) * 100;
        const ty2 = player.y - (ady / ad) * orbitR + py * Math.cos(gameTime * 2 + e.bossLevel) * 100;
        const tdx2 = tx2 - e.x;
        const tdy2 = ty2 - e.y;
        const td2 = Math.sqrt(tdx2 * tdx2 + tdy2 * tdy2) || 0.001;
        e.x += (tdx2 / td2) * e.speed * dt;
        e.y += (tdy2 / td2) * e.speed * dt;
      }
      e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
      e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
      _updateAircraftBoss(e, dt, player, particles, audio, gameTime);
    } else if (e.bossType === BOSS_TYPE.HISS || !e.bossType) {
      _updateHissBoss(e, dt, player, particles, audio, gameTime);
      // 哈气 boss 的移动由 _updateHissBoss 控制
      if (!e.hissWindup && !e.hissActive) {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
        e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
        e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
      }
    }
  }
}

// ── 渲染 Boss 特效 ──
function renderBossEffects(ctx, pool, camX, camY, sw, sh) {
  for (const e of pool) {
    if (!e.active || !e.isBoss) continue;

    const sx = e.x - camX + sw / 2;
    const sy = e.y - camY + sh / 2;

    // 哈气 Boss 特效
    if (e.bossType === BOSS_TYPE.HISS || !e.bossType) {
      const maxR = e.hissRange || 180;
      if (sx < -maxR - 50 || sx > sw + maxR + 50 || sy < -maxR - 50 || sy > sh + maxR + 50) continue;

      ctx.save();
      ctx.translate(sx, sy);

      if (e.hissWindup > 0) {
        const pulse = Math.sin(e.hissWindup * 15) * 0.4 + 0.6;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#F44336';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, e.radius + 10, 0, Math.PI * 2); ctx.stroke();
      }

      for (const w of (e._waves || [])) {
        if (w.alpha <= 0) continue;
        const a = w.alpha;
        const arcAngle = Math.PI / 2.5;
        const ha = e.hissAngle - arcAngle / 2;
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

    // 坦克 Boss 特效
    if (e.bossType === BOSS_TYPE.TANK) {
      // 导弹发射器 — 双管炮塔，跟踪玩家
      ctx.save();
      ctx.translate(sx, sy);
      const launcherAngle = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.rotate(launcherAngle);
      // 炮塔底座（半圆形）
      ctx.fillStyle = '#616161';
      ctx.strokeStyle = '#424242';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.radius - 2, 0, 10, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.stroke();
      // 双管发射筒
      for (let t = -1; t <= 1; t += 2) {
        ctx.fillStyle = '#757575';
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 1;
        ctx.fillRect(e.radius + 2, t * 7 - 3, 16, 6);
        ctx.strokeRect(e.radius + 2, t * 7 - 3, 16, 6);
        // 导弹头（红色）
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(e.radius + 18, t * 7, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();

      // 导弹
      for (const m of (e._missiles || [])) {
        const mx = m.x - camX + sw / 2;
        const my = m.y - camY + sh / 2;
        if (mx < -50 || mx > sw + 50 || my < -50 || my > sh + 50) continue;

        ctx.save();
        // 拖尾
        for (let i = 0; i < m.trail.length; i++) {
          const t = m.trail[i];
          if (t.life <= 0) continue;
          const tx = t.x - camX + sw / 2;
          const ty = t.y - camY + sh / 2;
          ctx.globalAlpha = (t.life / 0.25) * 0.5;
          ctx.fillStyle = '#FF9800';
          ctx.beginPath();
          ctx.arc(tx, ty, 3 * (t.life / 0.25), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        // 导弹主体
        const ma = Math.atan2(m.vy, m.vx);
        ctx.translate(mx, my);
        ctx.rotate(ma);
        ctx.fillStyle = '#FF5722';
        ctx.shadowColor = '#FF5722';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        // 尾焰
        ctx.fillStyle = '#FFEB3B';
        ctx.shadowColor = '#FFEB3B';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(-5, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // 炮弹
      for (const s of (e._shells || [])) {
        if (s.lifetime <= 0) continue;
        const sx2 = s.x - camX + sw / 2;
        const sy2 = s.y - camY + sh / 2;
        if (sx2 < -20 || sx2 > sw + 20 || sy2 < -20 || sy2 > sh + 20) continue;

        ctx.save();
        ctx.globalAlpha = Math.min(1, s.lifetime / 0.3);
        ctx.fillStyle = '#FF9800';
        ctx.shadowColor = '#FF5722';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx2, sy2, s.radius, 0, Math.PI * 2);
        ctx.fill();
        // 内核高亮
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(sx2, sy2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // 炮击前摇闪光
      if (e._shellTimer < 0.3 && e._shellTimer > 0) {
        const flash = Math.sin(e._shellTimer * 40) * 0.5 + 0.5;
        ctx.save();
        ctx.globalAlpha = flash * 0.3;
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FF5722';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // 超人 Boss 特效
    if (e.bossType === BOSS_TYPE.SUPERMAN) {
      const sx2 = e.x - camX + sw / 2;
      const sy2 = e.y - camY + sh / 2;
      if (sx2 < -200 || sx2 > sw + 200 || sy2 < -200 || sy2 > sh + 200) continue;

      ctx.save();
      // 飞行拖尾
      for (let i = 0; i < (e._trail || []).length; i++) {
        const t = e._trail[i];
        if (t.life <= 0) continue;
        const tx = t.x - camX + sw / 2;
        const ty = t.y - camY + sh / 2;
        ctx.globalAlpha = (t.life / 0.2) * 0.4;
        ctx.fillStyle = '#00BCD4';
        ctx.beginPath();
        ctx.arc(tx, ty, e.radius * (t.life / 0.2), 0, Math.PI * 2);
        ctx.fill();
      }

      // 冲刺光效
      if (e._dashActive) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#00BCD4';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00BCD4';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(sx2, sy2, e.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 闪避残影
      if (e._dodgeActive) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#B2EBF2';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sx2, sy2, e.radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 飞机 Boss 特效
    if (e.bossType === BOSS_TYPE.AIRCRAFT) {
      const sx3 = e.x - camX + sw / 2;
      const sy3 = e.y - camY + sh / 2;
      if (sx3 < -300 || sx3 > sw + 300 || sy3 < -300 || sy3 > sh + 300) continue;

      ctx.save();
      // 尾焰（飞机后面）
      const flameAngle = e.angle + Math.PI; // 后方
      const flameX = sx3 + Math.cos(flameAngle) * e.radius;
      const flameY = sy3 + Math.sin(flameAngle) * e.radius;
      for (let f = 0; f < 3; f++) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.3;
        ctx.fillStyle = f === 0 ? '#FFEB3B' : '#FF9800';
        ctx.beginPath();
        ctx.arc(
          flameX + (Math.random() - 0.5) * 12,
          flameY + (Math.random() - 0.5) * 12,
          3 + Math.random() * 4,
          0, Math.PI * 2
        );
        ctx.fill();
      }

      // 弹幕子弹
      for (const b of (e._airBullets || [])) {
        if (b.lifetime <= 0) continue;
        const bx = b.x - camX + sw / 2;
        const by = b.y - camY + sh / 2;
        if (bx < -20 || bx > sw + 20 || by < -20 || by > sh + 20) continue;
        ctx.globalAlpha = Math.min(1, b.lifetime / 0.3);
        ctx.fillStyle = '#FFEB3B';
        ctx.shadowColor = '#FF9800';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(bx, by, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 导弹
      for (const m of (e._acMissiles || [])) {
        const mx = m.x - camX + sw / 2;
        const my = m.y - camY + sh / 2;
        if (mx < -50 || mx > sw + 50 || my < -50 || my > sh + 50) continue;
        ctx.save();
        // 拖尾
        for (let i = 0; i < m.trail.length; i++) {
          const t = m.trail[i];
          if (t.life <= 0) continue;
          const tx = t.x - camX + sw / 2;
          const ty = t.y - camY + sh / 2;
          ctx.globalAlpha = (t.life / 0.2) * 0.4;
          ctx.fillStyle = '#FF9800';
          ctx.beginPath();
          ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const ma = Math.atan2(m.vy, m.vx);
        ctx.translate(mx, my);
        ctx.rotate(ma);
        ctx.fillStyle = '#FF5722';
        ctx.shadowColor = '#F44336';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -3);
        ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // 俯冲闪光
      if (e._diveActive) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FF9800';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(sx3, sy3, e.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

// ── 渲染 Boss 出场警告 ──
function renderBossWarning(ctx, sw, sh, state) {
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

// ── 渲染 Boss 头顶名字 ──
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
    ctx.fillStyle = e.bossType === BOSS_TYPE.TANK ? '#FF9800' : e.bossType === BOSS_TYPE.SUPERMAN ? '#00BCD4' : e.bossType === BOSS_TYPE.AIRCRAFT ? '#FF5722' : '#FFD700';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    const label = e.bossName + ' Lv.' + (e.bossLevel || 1);
    ctx.fillText(label, sx, sy - e.radius - 8);
    ctx.shadowBlur = 0;
  }
}
