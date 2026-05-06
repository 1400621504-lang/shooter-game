// 海克斯符文系统 — 击败第6波Boss后三选一

const RUNE_DATA = {
  geliya: {
    name: '歌利亚巨人',
    skillName: '巨人血统',
    desc: '被动技能\n击杀Boss：生命上限+5%\n当前生命+5% · 体型+5%\n无限叠加',
    passive: true
  },
  danbainaixi: {
    name: '蛋白奶昔',
    skillName: '生命治愈',
    desc: '立即回复 25 HP\n并持续治疗 5 秒',
    cooldown: 12,
    healInstant: 25,
    healOverTime: 5,
    healDur: 5
  },
  quanpingshenfa: {
    name: '全凭身法',
    skillName: '野蛮冲撞',
    desc: '向前高速冲撞\n击杀小怪 -0.2s CD\n击杀Boss 刷新CD\n冲刺期间无敌',
    cooldown: 6,
    damage: 60,
    dashDist: 200,
    dashSpeed: 700,
    knockback: 150
  }
};

// 预加载
const runeImgs = {};
(function loadRuneImgs() {
  const mapping = {
    geliya: 'geliya',
    danbainaixi: 'danbainaixi',
    quanpingshenfa: 'quanpingshenfa'
  };
  for (const [key, filename] of Object.entries(mapping)) {
    const img = new Image();
    img.onload = () => { runeImgs[key] = img; };
    img.onerror = () => {};
    img.src = 'pet-imgs/' + filename + '.png';
    if (img.complete && img.naturalWidth > 0) runeImgs[key] = img;
  }
})();

class Pet {
  constructor(type) {
    this.type = type;
    this.cfg = RUNE_DATA[type];
    this.cooldownTimer = 0;
    this.skillActive = false;
    this.skillTimer = 0;

    // 蛋白奶昔：治疗
    this._healTimer = 0;
    this._healParticles = [];

    // 全凭身法：冲撞
    this._dashDir = 0;
    this._dashX = 0;
    this._dashY = 0;
    this._dashTrail = [];
  }

  activate(player, enemies, particles, audio) {
    if (this.cfg.passive) return;
    if (this.cooldownTimer > 0 || this.skillActive) return;

    if (this.type === 'danbainaixi') {
      this.cooldownTimer = this.cfg.cooldown;
      this._healTimer = this.cfg.healDur;
      player.hp = Math.min(player.maxHp, player.hp + this.cfg.healInstant);
      for (let i = 0; i < 15; i++) {
        this._healParticles.push({
          x: player.x + (Math.random() - 0.5) * 40,
          y: player.y + (Math.random() - 0.5) * 40,
          vy: -60 - Math.random() * 80,
          life: 0.8 + Math.random() * 0.5,
          size: 4 + Math.random() * 6
        });
      }
      audio.waveClear();

    } else if (this.type === 'quanpingshenfa') {
      this.cooldownTimer = this.cfg.cooldown;
      this.skillActive = true;
      this.skillTimer = this.cfg.dashDist / this.cfg.dashSpeed;
      this._dashDir = player.angle;
      this._dashX = player.x;
      this._dashY = player.y;
      this._dashTrail = [];
      // 冲刺期间无敌
      player.invulnTimer = Math.max(player.invulnTimer, this.skillTimer + 0.1);
      // 伤害路径敌人
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const dot = (dx / d) * Math.cos(player.angle) + (dy / d) * Math.sin(player.angle);
        if (dot > 0 && d < 80) {
          const crossDist = Math.abs(-Math.sin(player.angle) * dx + Math.cos(player.angle) * dy);
          if (crossDist < e.radius + 25) {
            let dmgDealt = this.cfg.damage;
            if (e.defense) dmgDealt *= (1 - e.defense);
            e.hp -= dmgDealt;
            if (e.hp <= 0) e.active = false;
            e.hitFlash = 0.12;
            const pdx = e.x - player.x;
            const pdy = e.y - player.y;
            const pdd = Math.sqrt(pdx * pdx + pdy * pdy) || 0.001;
            e.x = clamp(e.x + (pdx / pdd) * this.cfg.knockback, e.radius, WORLD_SIZE - e.radius);
            e.y = clamp(e.y + (pdy / pdd) * this.cfg.knockback, e.radius, WORLD_SIZE - e.radius);
          }
        }
      }
      particles.emit(player.x, player.y, {
        count: 20, minSpeed: 100, maxSpeed: 400,
        minLife: 0.1, maxLife: 0.3,
        minSize: 2, maxSize: 5,
        colors: ['#FFEB3B', '#FF9800', '#fff']
      });
      audio.supermanDash();
    }
  }

  // 全凭身法：击杀小怪减CD
  onMinionKill() {
    if (this.type === 'quanpingshenfa') {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - 0.2);
    }
  }

  // 歌利亚巨人 + 全凭身法：击杀Boss效果
  onBossKill(player) {
    if (this.type === 'geliya') {
      player.maxHp = Math.round(player.maxHp * 1.05);
      player.hp = Math.min(player.maxHp, Math.round(player.hp * 1.05) + 1);
      player.radius = Math.round(player.radius * 1.05);
    }
    if (this.type === 'quanpingshenfa') {
      this.cooldownTimer = 0;
    }
  }

  update(dt, player, enemies) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    // 全凭身法冲撞
    if (this.skillActive && this.type === 'quanpingshenfa') {
      this.skillTimer -= dt;
      player.x += Math.cos(this._dashDir) * this.cfg.dashSpeed * dt;
      player.y += Math.sin(this._dashDir) * this.cfg.dashSpeed * dt;
      player.x = clamp(player.x, player.radius, WORLD_SIZE - player.radius);
      player.y = clamp(player.y, player.radius, WORLD_SIZE - player.radius);
      for (const e of enemies) {
        if (!e.active || e._hitByDash) continue;
        const d = dist(player.x, player.y, e.x, e.y);
        if (d < player.radius + e.radius + 15) {
          let dmgDealt = this.cfg.damage * 0.5;
          if (e.defense) dmgDealt *= (1 - e.defense);
          e.hp -= dmgDealt;
          if (e.hp <= 0) e.active = false;
          e.hitFlash = 0.1;
          e._hitByDash = true;
        }
      }
      this._dashTrail.push({ x: player.x, y: player.y, life: 0.2 });
      if (this._dashTrail.length > 20) this._dashTrail.shift();
      for (const t of this._dashTrail) t.life -= dt;
      this._dashTrail = this._dashTrail.filter(t => t.life > 0);
      if (this.skillTimer <= 0) {
        this.skillActive = false;
        this._dashTrail = [];
        for (const e of enemies) e._hitByDash = false;
      }
    }

    // 蛋白奶昔持续治疗
    if (this._healTimer > 0) {
      this._healTimer -= dt;
      if (Math.floor(this._healTimer * 10) !== Math.floor((this._healTimer + dt) * 10)) {
        player.hp = Math.min(player.maxHp, player.hp + this.cfg.healOverTime);
        this._healParticles.push({
          x: player.x + (Math.random() - 0.5) * 30,
          y: player.y + (Math.random() - 0.5) * 30,
          vy: -50 - Math.random() * 60,
          life: 0.6 + Math.random() * 0.4,
          size: 3 + Math.random() * 4
        });
      }
    }
    for (const p of this._healParticles) {
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this._healParticles = this._healParticles.filter(p => p.life > 0);
  }

  render(ctx, player, camX, camY, sw, sh) {
    const px = player.x - camX + sw / 2;
    const py = player.y - camY + sh / 2;

    // 蛋白奶昔治疗粒子
    for (const p of this._healParticles) {
      const hx = p.x - camX + sw / 2;
      const hy = p.y - camY + sh / 2;
      ctx.save();
      ctx.globalAlpha = p.life / 1.0;
      ctx.fillStyle = '#4CAF50';
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const hs = p.size;
      ctx.fillRect(hx - hs / 2, hy - 1, hs, 2);
      ctx.fillRect(hx - 1, hy - hs / 2, 2, hs);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    if (this._healTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, player.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 全凭身法冲撞拖尾
    for (const t of this._dashTrail) {
      const tx = t.x - camX + sw / 2;
      const ty = t.y - camY + sh / 2;
      ctx.save();
      ctx.globalAlpha = (t.life / 0.2) * 0.5;
      ctx.fillStyle = '#FF9800';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  get cooldownRatio() {
    return this.cooldownTimer > 0 ? this.cooldownTimer / this.cfg.cooldown : 0;
  }
}
