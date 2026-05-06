// 虚拟双摇杆 — 底层输入抽象
// side = 'left' | 'right'，自动识别触点在左半屏还是右半屏

class VirtualJoystick {
  constructor(side, maxRadius = 80) {
    this.side = side;
    this.maxRadius = maxRadius;
    this._baseMaxRadius = maxRadius;
    this.deadZone = 0.15;
    this.touchId = null;
    this.active = false;
    this.baseX = 0;
    this.baseY = 0;
    this.knobX = 0;
    this.knobY = 0;
    this.normX = 0;
    this.normY = 0;
    this.magnitude = 0;
    this.angle = 0;
    this.alpha = 0;
  }

  // 根据屏幕尺寸调整摇杆大小
  updateLayout(sw, sh) {
    this.maxRadius = clamp(Math.min(sw, sh) * 0.13, 60, 120);
  }

  // 尝试接管触摸，zone 判断在调用方做
  tryStart(touchId, x, y, screenW) {
    const inZone = this.side === 'left'
      ? x < screenW / 2
      : x >= screenW / 2;
    if (!inZone || this.touchId !== null) return false;

    this.touchId = touchId;
    this.baseX = x;
    this.baseY = y;
    this.knobX = x;
    this.knobY = y;
    this.active = true;
    return true;
  }

  handleMove(touchId, x, y) {
    if (touchId !== this.touchId) return;
    this.knobX = x;
    this.knobY = y;

    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > this.maxRadius) {
      // 拉到极限
      const r = this.maxRadius / d;
      this.normX = dx * r / this.maxRadius;
      this.normY = dy * r / this.maxRadius;
      this.magnitude = 1;
    } else if (d / this.maxRadius < this.deadZone) {
      // 死区内
      this.normX = 0;
      this.normY = 0;
      this.magnitude = 0;
    } else {
      // 死区到极限之间，线性映射
      const raw = (d / this.maxRadius - this.deadZone) / (1 - this.deadZone);
      this.normX = (dx / d) * raw;
      this.normY = (dy / d) * raw;
      this.magnitude = raw;
    }

    this.angle = Math.atan2(dy, dx);
  }

  handleEnd(touchId) {
    if (touchId !== this.touchId) return;
    this.touchId = null;
    this.active = false;
    this.normX = 0;
    this.normY = 0;
    this.magnitude = 0;
  }

  update(dt) {
    const target = this.active ? 1 : 0;
    this.alpha = lerp(this.alpha, target, dt * 12);
  }

  render(ctx) {
    if (this.alpha < 0.02) return;
    ctx.save();

    // 底圈
    ctx.globalAlpha = this.alpha * 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.baseX, this.baseY, this.maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 摇杆头
    ctx.globalAlpha = this.alpha * 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.knobX, this.knobY, this.maxRadius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
