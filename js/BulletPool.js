// 子弹对象池

class BulletPool {
  constructor(size = 200) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        speed: 0,
        damage: 0,
        life: 0,
        active: false
      });
    }
  }

  fire(x, y, angle, speed, damage) {
    for (const b of this.pool) {
      if (b.active) continue;
      b.x = x;
      b.y = y;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.speed = speed;
      b.damage = damage;
      b.life = 1.5; // 最多存活 1.5 秒
      b.active = true;
      return;
    }
  }

  update(dt, worldSize) {
    for (const b of this.pool) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // 出界或超时回收
      if (b.x < -50 || b.x > worldSize + 50 ||
          b.y < -50 || b.y > worldSize + 50 ||
          b.life <= 0) {
        b.active = false;
      }
    }
  }

  getActive() {
    return this.pool.filter(b => b.active);
  }

  render(ctx, camX, camY, sw, sh) {
    ctx.fillStyle = '#FFEB3B';
    ctx.shadowColor = '#FFEB3B';
    ctx.shadowBlur = 4;
    for (const b of this.pool) {
      if (!b.active) continue;
      const sx = b.x - camX + sw / 2;
      const sy = b.y - camY + sh / 2;
      if (sx < -10 || sx > sw + 10 || sy < -10 || sy > sh + 10) continue;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }
    ctx.shadowBlur = 0;
  }
}
