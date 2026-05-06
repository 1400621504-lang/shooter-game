// 敌人管理器 — 对象池 + AI + 波次生成 + 图片敌人

const WORLD_SIZE = 2400;
const ENEMY_IMG_COUNT = 15;

const ENEMY_TYPES = {
  basic:  { hp: 50,  speed: 90,  damage: 15, radius: 18, color: '#EF5350', score: 100 },
  fast:   { hp: 25,  speed: 180, damage: 10, radius: 14, color: '#FF9800', score: 150 },
  tank:   { hp: 130, speed: 55,  damage: 25, radius: 26, color: '#B71C1C', score: 300 },
};

// 波次定义，超过第 6 波动态生成
const WAVE_DEFS = [
  { basic: 3, fast: 0, tank: 0 },
  { basic: 5, fast: 0, tank: 0 },
  { basic: 5, fast: 2, tank: 0 },
  { basic: 7, fast: 3, tank: 0 },
  { basic: 7, fast: 2, tank: 1 },
  { basic: 9, fast: 4, tank: 1 },
];

// ── 敌人图片（模块级预加载）──
const enemyImgs = [];
(function loadEnemyImgs() {
  for (let i = 1; i <= ENEMY_IMG_COUNT; i++) {
    const img = new Image();
    img.onerror = () => { enemyImgs[i - 1] = null; }; // 加载失败降级
    img.src = 'enemy-imgs/e' + i + '.gif';
    // 如果缓存命中
    if (img.complete && img.naturalWidth > 0) enemyImgs[i - 1] = img;
    else img.onload = () => { enemyImgs[i - 1] = img; };
  }
})();

class EnemyManager {
  constructor(max = 60) {
    this.pool = [];
    for (let i = 0; i < max; i++) {
      this.pool.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        angle: 0,
        rot: 0,
        hp: 0, maxHp: 0,
        speed: 0,
        damage: 0,
        radius: 0,
        color: '#fff',
        type: 'basic',
        score: 0,
        active: false,
        hitFlash: 0,
        img: null
      });
    }
  }

  get idleCount() {
    return this.pool.filter(e => !e.active).length;
  }

  get aliveCount() {
    return this.pool.filter(e => e.active).length;
  }

  getActive() {
    return this.pool.filter(e => e.active);
  }

  // 随机选一张小怪图片
  _randomImg() {
    const loaded = enemyImgs.filter(im => im != null);
    if (loaded.length === 0) return null;
    return loaded[randInt(0, loaded.length - 1)];
  }

  // 在视野外生成一个敌人
  _spawnOne(type, camX, camY, sw, sh) {
    for (const e of this.pool) {
      if (e.active) continue;
      const cfg = ENEMY_TYPES[type];
      const side = randInt(0, 3);
      const margin = 80;
      let sx, sy;
      const vl = camX - sw / 2 - margin;
      const vr = camX + sw / 2 + margin;
      const vt = camY - sh / 2 - margin;
      const vb = camY + sh / 2 + margin;
      switch (side) {
        case 0: sx = rand(vl, vr); sy = vt; break;
        case 1: sx = vr; sy = rand(vt, vb); break;
        case 2: sx = rand(vl, vr); sy = vb; break;
        case 3: sx = vl; sy = rand(vt, vb); break;
      }
      e.x = clamp(sx, cfg.radius, WORLD_SIZE - cfg.radius);
      e.y = clamp(sy, cfg.radius, WORLD_SIZE - cfg.radius);
      e.hp = cfg.hp;
      e.maxHp = cfg.hp;
      e.speed = cfg.speed;
      e.damage = cfg.damage;
      e.radius = cfg.radius;
      e.color = cfg.color;
      e.type = type;
      e.score = cfg.score;
      e.active = true;
      e.hitFlash = 0;
      e.rot = 0;
      e.isBoss = false;
      e.bossType = undefined;
      e.defense = undefined;
      e.img = this._randomImg();
      return;
    }
  }

  // 按波次定义生成
  spawnWave(waveNum, camX, camY, sw, sh) {
    let def;
    if (waveNum <= WAVE_DEFS.length) {
      def = WAVE_DEFS[waveNum - 1];
    } else {
      const extra = waveNum - WAVE_DEFS.length;
      def = {
        basic: 5 + extra * 2,
        fast: 2 + extra,
        tank: Math.max(0, extra - 1)
      };
    }
    for (let i = 0; i < def.basic; i++) this._spawnOne('basic', camX, camY, sw, sh);
    for (let i = 0; i < def.fast; i++) this._spawnOne('fast', camX, camY, sw, sh);
    for (let i = 0; i < (def.tank || 0); i++) this._spawnOne('tank', camX, camY, sw, sh);
  }

  update(dt, player) {
    const allActive = this.getActive();

    for (const e of allActive) {
      e.hitFlash -= dt;

      // 朝玩家移动
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      let vx = (dx / d) * e.speed;
      let vy = (dy / d) * e.speed;

      // 分离力（避免敌人堆叠）
      let sepX = 0, sepY = 0;
      for (const other of allActive) {
        if (other === e) continue;
        const odx = e.x - other.x;
        const ody = e.y - other.y;
        const od = Math.sqrt(odx * odx + ody * ody) || 0.001;
        const minDist = e.radius + other.radius + 8;
        if (od < minDist) {
          sepX += (odx / od) * (minDist - od) * 2;
          sepY += (ody / od) * (minDist - od) * 2;
        }
      }

      vx += sepX;
      vy += sepY;
      const mag = Math.sqrt(vx * vx + vy * vy) || 0.001;
      vx = vx / mag * e.speed;
      vy = vy / mag * e.speed;

      e.vx = vx;
      e.vy = vy;
      e.angle = Math.atan2(vy, vx);
      e.rot += dt * (e.type === 'fast' ? 3 : e.type === 'tank' ? 1 : 2);
      e.x += vx * dt;
      e.y += vy * dt;
      e.x = clamp(e.x, e.radius, WORLD_SIZE - e.radius);
      e.y = clamp(e.y, e.radius, WORLD_SIZE - e.radius);
    }
  }

  // 返回击杀的敌人分数（0 = 没死）
  damageAt(index, dmg) {
    const e = this.pool[index];
    if (!e || !e.active) return 0;
    const effectiveDmg = e.defense ? dmg * (1 - e.defense) : dmg;
    e.hp -= effectiveDmg;
    e.hitFlash = 0.07;
    if (e.hp <= 0) {
      e.active = false;
      return e.score;
    }
    return 0;
  }

  render(ctx, camX, camY, sw, sh) {
    for (const e of this.pool) {
      if (!e.active) continue;
      const sx = e.x - camX + sw / 2;
      const sy = e.y - camY + sh / 2;
      if (sx < -e.radius * 2 || sx > sw + e.radius * 2 ||
          sy < -e.radius * 2 || sy > sh + e.radius * 2) continue;

      const r = e.radius;

      ctx.save();
      ctx.translate(sx, sy);

      // 圆形裁剪路径
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();

      if (e.img) {
        // 受伤闪白
        if (e.hitFlash > 0) {
          ctx.globalAlpha = 1;
          ctx.drawImage(e.img, -r, -r, r * 2, r * 2);
          // 白色叠加
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(-r, -r, r * 2, r * 2);
        } else {
          ctx.drawImage(e.img, -r, -r, r * 2, r * 2);
        }
      } else {
        // 没有图片时的降级绘制
        ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 圆形边框
      if (e.isBoss) {
        // Boss 边框：金色粗边 + 脉冲
        const pulse = 1 + Math.sin(Date.now() / 200) * 0.3;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4 * pulse;
        ctx.shadowColor = '#E91E63';
        ctx.shadowBlur = 18;
      } else {
        ctx.strokeStyle = e.type === 'tank' ? '#B71C1C' : e.type === 'fast' ? '#FF9800' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = e.type === 'tank' ? 3 : 1.5;
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Boss 血条
      if (e.isBoss) {
        const barW = r * 2;
        const barH = 5;
        const barY = -r - 12;
        ctx.fillStyle = '#333';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        const hpR = e.hp / e.maxHp;
        ctx.fillStyle = hpR > 0.5 ? '#4CAF50' : hpR > 0.25 ? '#FF9800' : '#F44336';
        ctx.fillRect(-barW / 2, barY, barW * hpR, barH);
      }

      ctx.restore();
    }
  }
}
