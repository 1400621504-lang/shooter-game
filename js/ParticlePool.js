// 粒子对象池 — 命中火花 / 爆炸 / 死亡粒子

class ParticlePool {
  constructor(size = 500) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push({
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        size: 2,
        color: '#fff',
        active: false
      });
    }
  }

  // config: { count, minSpeed, maxSpeed, minLife, maxLife, minSize, maxSize, colors }
  emit(x, y, config) {
    const {
      count = 10,
      minSpeed = 50, maxSpeed = 200,
      minLife = 0.2, maxLife = 0.6,
      minSize = 1, maxSize = 4,
      colors = ['#ff0', '#f80']
    } = config;

    let spawned = 0;
    for (const p of this.pool) {
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(minSpeed, maxSpeed);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = rand(minLife, maxLife);
      p.life = p.maxLife;
      p.size = rand(minSize, maxSize);
      p.color = colors[randInt(0, colors.length - 1)];
      p.active = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95; // 轻微阻力
      p.vy *= 0.95;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  render(ctx, camX, camY, sw, sh) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const sx = p.x - camX + sw / 2;
      const sy = p.y - camY + sh / 2;
      if (sx < -20 || sx > sw + 20 || sy < -20 || sy > sh + 20) continue;
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }
}
