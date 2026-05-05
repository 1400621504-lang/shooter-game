// 数学工具

function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// 归一化角度到 [-PI, PI]
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 角度线性插值（走最短弧）
function lerpAngle(a, b, t) {
  let diff = normAngle(b - a);
  return a + diff * t;
}

// 粘性辅助瞄准
// 返回：修正后的瞄准角度
function aimAssist(originX, originY, aimAngle, enemies, radius, strength) {
  let best = null;
  let bestDist = radius;

  for (const e of enemies) {
    if (!e.active) continue;
    const d = dist(originX, originY, e.x, e.y);
    if (d >= radius) continue;
    const toEnemy = angleTo(originX, originY, e.x, e.y);
    const diff = Math.abs(normAngle(aimAngle - toEnemy));
    // 只在敌人处于瞄准方向 ±45° 内吸附
    if (diff < Math.PI / 4 && d < bestDist) {
      bestDist = d;
      best = toEnemy;
    }
  }

  if (best !== null) {
    return lerpAngle(aimAngle, best, strength);
  }
  return aimAngle;
}
