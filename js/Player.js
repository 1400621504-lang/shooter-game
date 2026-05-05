// 玩家 — 图片状态机 + 圆形裁剪

const PLAYER_RADIUS = 24;
const PLAYER_SPEED = 240;
const PLAYER_MAX_HP = 100;
const FIRE_INTERVAL = 0.13;
const BULLET_SPEED = 650;
const BULLET_DAMAGE = 25;
const INVULN_TIME = 1.0;

// ── 角色状态图片（模块级预加载）──
let imgDefault = null;
let imgKill = null;
let imgHurt = null;
let imgStuck = null;

(function loadPlayerImgs() {
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
})();

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = PLAYER_RADIUS;
    this.speed = PLAYER_SPEED;
    this.angle = 0;
    this.hp = PLAYER_MAX_HP;
    this.maxHp = PLAYER_MAX_HP;
    this.alive = true;
    this.fireTimer = 0;
    this.invulnTimer = 0;
    this.hitFlash = 0;

    // 状态图计时器（优先级：kill > hurt > stuck > default）
    this.killFlashTimer = 0;   // 击败小怪 0.5s
    this.hurtFlashTimer = 0;   // 受到攻击 0.88s
    this.stuckFlashTimer = 0;  // 攻击同目标超2s未击杀 0.88s
  }

  update(dt, moveJoy, shootJoy, worldSize) {
    if (!this.alive) return;

    // 移动
    if (moveJoy.active && moveJoy.magnitude > 0) {
      this.x += moveJoy.normX * this.speed * moveJoy.magnitude * dt;
      this.y += moveJoy.normY * this.speed * moveJoy.magnitude * dt;
    }
    this.x = clamp(this.x, this.radius, worldSize - this.radius);
    this.y = clamp(this.y, this.radius, worldSize - this.radius);

    // 瞄准方向
    if (shootJoy.active && shootJoy.magnitude > 0.1) {
      this.angle = shootJoy.angle;
    }

    this.fireTimer -= dt;
    this.invulnTimer -= dt;
    this.hitFlash -= dt;
    this.killFlashTimer -= dt;
    this.hurtFlashTimer -= dt;
    this.stuckFlashTimer -= dt;
  }

  fire(dt, bulletPool) {
    if (this.fireTimer > 0) return;
    this.fireTimer = FIRE_INTERVAL;
    const bx = this.x + Math.cos(this.angle) * (this.radius + 4);
    const by = this.y + Math.sin(this.angle) * (this.radius + 4);
    bulletPool.fire(bx, by, this.angle, BULLET_SPEED, BULLET_DAMAGE);
  }

  takeDamage(dmg, gameTime) {
    if (this.invulnTimer > 0 || !this.alive) return false;
    this.hp -= dmg;
    this.invulnTimer = INVULN_TIME;
    this.hitFlash = 0.15;
    this.hurtFlashTimer = 0.88;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return true;
  }

  // 由 main.js 调用，击杀敌人时触发
  onKill() {
    this.killFlashTimer = 0.5;
  }

  // 由 main.js 调用，攻击同目标超2s
  onAttackStuck() {
    this.stuckFlashTimer = 0.88;
  }

  isInvulnerable() { return this.invulnTimer > 0; }

  // 当前应该显示的状态图（按优先级）
  _currentImg() {
    if (this.killFlashTimer > 0 && imgKill) return imgKill;
    if (this.hurtFlashTimer > 0 && imgHurt) return imgHurt;
    if (this.stuckFlashTimer > 0 && imgStuck) return imgStuck;
    return imgDefault;
  }

  render(ctx, camX, camY, sw, sh) {
    if (!this.alive) return;
    const sx = this.x - camX + sw / 2;
    const sy = this.y - camY + sh / 2;
    const r = this.radius;

    ctx.save();
    ctx.translate(sx, sy);

    // 圆形裁剪
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    const curImg = this._currentImg();

    if (curImg) {
      // 受伤闪烁
      if (this.hitFlash > 0 && Math.sin(this.hitFlash * 60) > 0) {
        ctx.globalAlpha = 0.35;
      }
      // 无敌闪烁
      if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0 && this.hitFlash <= 0) {
        ctx.globalAlpha = 0.4;
      }

      // 发光效果
      ctx.shadowColor = '#4FC3F7';
      ctx.shadowBlur = 12;
      // 如果是特殊状态，切换发光颜色
      if (this.killFlashTimer > 0) {
        ctx.shadowColor = '#FFEB3B';
        ctx.shadowBlur = 18;
      } else if (this.hurtFlashTimer > 0) {
        ctx.shadowColor = '#F44336';
        ctx.shadowBlur = 14;
      } else if (this.stuckFlashTimer > 0) {
        ctx.shadowColor = '#FF9800';
        ctx.shadowBlur = 14;
      }

      ctx.drawImage(curImg, -r, -r, r * 2, r * 2);
      ctx.shadowBlur = 0;
    } else {
      // 降级：蓝色圆形
      ctx.globalAlpha = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0 ? 0.4 : 1;
      ctx.fillStyle = '#4FC3F7';
      ctx.shadowColor = '#4FC3F7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 方向箭头
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.rotate(this.angle);
      ctx.beginPath();
      ctx.moveTo(r + 6, 0);
      ctx.lineTo(r - 2, -5);
      ctx.lineTo(r - 2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
