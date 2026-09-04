import { ENEMY_DEFS, POWERUP_INFO } from "./defs";
import type {
  Bullet,
  ChapterDef,
  Enemy,
  Glint,
  Particle,
  Popup,
  PowerUp,
  Star,
} from "./types";
import type { PlayerState } from "./engine";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rockHash(i: number, seed: number): number {
  const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function paintBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  stars: Star[],
  chapter: ChapterDef,
): void {
  ctx.fillStyle = chapter.bottom;
  ctx.fillRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, chapter.top);
  gradient.addColorStop(0.55, chapter.mid);
  gradient.addColorStop(1, chapter.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const nebula = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  for (const nb of chapter.nebulas) {
    nebula(W * nb.x, H * nb.y, W * nb.r, nb.color);
  }

  if (chapter.rocks > 0) {
    ctx.save();
    for (let i = 0; i < chapter.rocks; i++) {
      const px = rockHash(i, 1) * W;
      const size = 14 + rockHash(i, 2) * 26;
      const speed = chapter.rockSpeed * (0.6 + rockHash(i, 3) * 0.8);
      const py =
        ((rockHash(i, 4) * (H + size * 3) + time * speed) % (H + size * 3)) - size;
      const wob = Math.sin(time * (1 + rockHash(i, 5)) + i) * 6;
      ctx.fillStyle = chapter.rockColor;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (Math.PI * 2 * k) / 7 + i;
        const rad = size * (0.6 + rockHash(i * 3 + k, 6) * 0.5);
        const rx = px + wob + Math.cos(a) * rad;
        const ry = py + Math.sin(a) * rad * 0.85;
        if (k === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(235,190,130,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const star of stars) {
    ctx.globalAlpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2 + star.twinkle));
    ctx.fillStyle = chapter.star;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

export function paintPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  time: number,
  boosting = false,
): void {
  const blink = p.invincible > 0 && Math.floor(time * 14) % 2 === 0;
  const flicker = 5 + Math.random() * (6 + (boosting ? 14 : 0));
  const y = p.y + Math.sin(time * 4) * 2;

  ctx.save();
  ctx.translate(p.x, y);
  ctx.rotate(p.tilt);
  if (blink) ctx.globalAlpha = 0.35;

  const afterburner = p.rapid > 0 ? 14 : 0;
  const turbo = boosting ? 48 : 0;
  const flameW = 6 + (boosting ? 4 : 0);
  const flameLen = flicker + 8 + afterburner + turbo;
  const flame = ctx.createLinearGradient(0, p.h * 0.42, 0, p.h * 0.42 + flameLen + 2);
  if (boosting) {
    flame.addColorStop(0, "rgba(255,255,255,0.98)");
    flame.addColorStop(0.3, "rgba(255,225,90,0.95)");
    flame.addColorStop(0.65, "rgba(255,120,30,0.8)");
    flame.addColorStop(1, "rgba(255,50,40,0)");
  } else {
    flame.addColorStop(0, "rgba(255,180,60,0.95)");
    flame.addColorStop(0.55, "rgba(255,90,40,0.7)");
    flame.addColorStop(1, "rgba(255,60,60,0)");
  }
  ctx.fillStyle = flame;
  ctx.shadowColor = boosting ? "rgba(255,120,30,0.9)" : "rgba(0,0,0,0)";
  ctx.shadowBlur = boosting ? 18 : 0;
  ctx.beginPath();
  ctx.moveTo(-flameW, p.h * 0.42);
  ctx.lineTo(0, p.h * 0.42 + flameLen);
  ctx.lineTo(flameW, p.h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  const body = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
  body.addColorStop(0, "#dffcff");
  body.addColorStop(0.5, "#46c6f5");
  body.addColorStop(1, "#0e4f8f");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#8df0ff";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(80,220,255,0.9)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, -p.h / 2);
  ctx.lineTo(p.w / 2, -p.h * 0.05);
  ctx.lineTo(p.w * 0.3, p.h * 0.28);
  ctx.lineTo(p.w * 0.14, p.h * 0.42);
  ctx.lineTo(-p.w * 0.14, p.h * 0.42);
  ctx.lineTo(-p.w * 0.3, p.h * 0.28);
  ctx.lineTo(-p.w / 2, -p.h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(220,250,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, p.h * 0.02, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-p.w / 2, -p.h * 0.05);
  ctx.lineTo(-p.w * 0.18, -p.h * 0.18);
  ctx.moveTo(p.w / 2, -p.h * 0.05);
  ctx.lineTo(p.w * 0.18, -p.h * 0.18);
  ctx.stroke();
  ctx.restore();

  if (p.shield > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.save();
    ctx.translate(p.x, y);
    ctx.strokeStyle = `rgba(90, 220, 255, ${0.35 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "#4dd6ff";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 32 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(90, 200, 255, ${0.06 + pulse * 0.04})`;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (p.dual > 0) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(p.x + side * (p.w / 2 + 6), y + Math.sin(time * 10) * 1.5);
      ctx.fillStyle = "#38e1ff";
      ctx.shadowColor = "#38e1ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(4, 3);
      ctx.lineTo(-4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (p.freeze > 0) {
    const icy = 0.3 + 0.3 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(p.x, y);
    ctx.strokeStyle = `rgba(200, 165, 255, ${0.25 + icy * 0.25})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "#c8a5ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 3) * i + time;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }

  if (p.magnet > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const radius = 30 + pulse * 3;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.strokeStyle = `rgba(123, 255, 142, ${0.25 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7bff8e";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      const a = time * 2.4 + (Math.PI * 2 * i) / 3;
      ctx.fillStyle = "#7bff8e";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function paintBullet(
  ctx: CanvasRenderingContext2D,
  bullet: Bullet,
): void {
  const friendly = bullet.friendly;
  const color = friendly ? "#8df0ff" : "#ff5d7a";
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  const w = bullet.w;
  const h = bullet.h;
  if (friendly) {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

export function paintEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  time: number,
): void {
  const def = ENEMY_DEFS[enemy.kind];
  const x = enemy.x;
  const y = enemy.y;
  const flashing = enemy.flash > 0 && Math.floor(time * 30) % 2 === 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 10;

  if (enemy.kind === "drone") {
    ctx.fillStyle = "#2a0f1d";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -def.h / 2);
    ctx.lineTo(def.w * 0.34, -def.h * 0.2);
    ctx.lineTo(def.w / 2, def.h * 0.25);
    ctx.lineTo(def.w * 0.22, def.h / 2);
    ctx.lineTo(-def.w * 0.22, def.h / 2);
    ctx.lineTo(-def.w / 2, def.h * 0.25);
    ctx.lineTo(-def.w * 0.34, -def.h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, def.h * 0.08, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "fighter") {
    ctx.fillStyle = "#1d1435";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -def.h / 2);
    ctx.lineTo(def.w / 2, def.h * 0.1);
    ctx.lineTo(def.w * 0.24, def.h / 2);
    ctx.lineTo(-def.w * 0.24, def.h / 2);
    ctx.lineTo(-def.w / 2, def.h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.fillRect(-def.w * 0.18, -def.h * 0.18, def.w * 0.36, 4);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(i === 0 ? -def.w * 0.32 : def.w * 0.32, def.h * 0.12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (enemy.kind === "tank") {
    ctx.fillStyle = "#06222a";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(angle) * (def.w / 2);
      const py = Math.sin(angle) * (def.h / 2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, -def.h * 0.32, 16, 3);
  } else if (enemy.kind === "spinner") {
    ctx.save();
    ctx.rotate(enemy.rot * 1.6);
    ctx.fillStyle = "#331a0a";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * (def.w / 2), Math.sin(angle) * (def.h / 2));
    }
    ctx.stroke();
    ctx.fillStyle = def.color;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * (def.w / 2), Math.sin(angle) * (def.h / 2), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#ffe6c2";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === "kamikaze") {
    const glow = 2 + Math.sin(time * 12) * 1.5;
    ctx.fillStyle = "#3a2a00";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -def.h / 2);
    ctx.lineTo(def.w / 2, def.h * 0.1);
    ctx.lineTo(def.w * 0.22, def.h / 2);
    ctx.lineTo(-def.w * 0.22, def.h / 2);
    ctx.lineTo(-def.w / 2, def.h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = glow;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, -def.h * 0.12, 4, 0, Math.PI * 2);
    ctx.fill();
    const flame = ctx.createLinearGradient(0, def.h / 2, 0, def.h / 2 + 14);
    flame.addColorStop(0, "rgba(255,200,80,0.9)");
    flame.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-4, def.h / 2);
    ctx.lineTo(0, def.h / 2 + 12 + glow);
    ctx.lineTo(4, def.h / 2);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "meteor") {
    const gold = !!enemy.gold;
    ctx.save();
    ctx.rotate(enemy.rot);
    ctx.fillStyle = gold ? "#5a3a10" : "#4a2d14";
    ctx.strokeStyle = gold ? "#ffd166" : def.color;
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI * 2 * k) / 8;
      const rad = (def.w / 2) * (0.55 + rockHash(k, 9) * 0.45);
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad * 0.9;
      ctx.beginPath();
      ctx.arc(px, py, 2 + rockHash(k, 10) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI * 2 * k) / 8;
      const rad = (def.w / 2) * (0.8 + 0.2 * Math.sin(a * 3 + enemy.rot * 4));
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad * 0.9;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (gold) {
      ctx.strokeStyle = "rgba(255,209,102,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, def.w / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    const ember = 3 + Math.sin(time * 10) * 2;
    ctx.fillStyle = gold ? "rgba(255,224,80,0.95)" : "rgba(255,200,120,0.9)";
    ctx.shadowColor = gold ? "#ffd166" : "#ff9f43";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, def.h * 0.28, ember * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (enemy.kind === "speeder") {
    ctx.rotate(enemy.vx >= 0 ? 0 : Math.PI);
    ctx.fillStyle = "#0e2b1a";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(def.w / 2, -2);
    ctx.lineTo(def.w * 0.2, -def.h / 2);
    ctx.lineTo(-def.w / 2, 0);
    ctx.lineTo(def.w * 0.2, def.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(def.w * 0.16, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(140,255,190,0.9)";
    ctx.beginPath();
    ctx.moveTo(-def.w / 2, -1.5);
    ctx.lineTo(-def.w / 2 - 9, 0);
    ctx.lineTo(-def.w / 2, 1.5);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === "mine") {
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    const radius = (def.w / 2) * 0.5 + 3 * pulse;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + enemy.rot;
      const ex = Math.cos(a) * (radius * 1.9);
      const ey = Math.sin(a) * (radius * 1.9);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = "#ff8bab";
      ctx.beginPath();
      ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3d1426";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 8 + enemy.rot);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  if (flashing) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(def.w, def.h) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function paintPowerUp(
  ctx: CanvasRenderingContext2D,
  pu: PowerUp,
  time: number,
): void {
  const info = POWERUP_INFO[pu.kind];
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  ctx.save();
  ctx.translate(pu.x, pu.y);
  ctx.rotate(Math.sin(time * 3 + pu.rot) * 0.2);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 16;

  ctx.fillStyle = "rgba(10, 20, 40, 0.9)";
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = info.color;
  if (pu.kind === "shield") {
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, -4);
    ctx.lineTo(4, 3);
    ctx.lineTo(0, 7);
    ctx.lineTo(-4, 3);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();
  } else if (pu.kind === "rapid") {
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(-3, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(1, 6);
    ctx.closePath();
    ctx.fill();
  } else if (pu.kind === "bomb") {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.lineTo(7, -9);
    ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(7, -9, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (pu.kind === "magnet") {
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -1, 5, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -1);
    ctx.lineTo(5, 6);
    ctx.moveTo(-5, -1);
    ctx.lineTo(-5, 6);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(3.4, 3, 3.4, 4);
    ctx.fillRect(-6.8, 3, 3.4, 4);
  } else if (pu.kind === "dual") {
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.lineTo(-2.5, -4);
    ctx.lineTo(1, 3);
    ctx.moveTo(-1, 3);
    ctx.lineTo(2.5, -4);
    ctx.lineTo(6, 3);
    ctx.stroke();
    ctx.lineCap = "butt";
  } else if (pu.kind === "freeze") {
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -7, Math.sin(a) * -7);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-8, -1, -4, -7, 0, -3);
    ctx.bezierCurveTo(4, -7, 8, -1, 0, 6);
    ctx.fill();
  }
  ctx.restore();
}

export function paintGlint(
  ctx: CanvasRenderingContext2D,
  g: Glint,
  time: number,
): void {
  const t = clamp(g.life / g.maxLife, 0, 1);
  const pulse = 0.6 + 0.4 * Math.sin(time * 5 + g.rot);
  const magnet = !!g.magnet;
  const color = magnet ? "#7bff8e" : g.gold ? "#ffd166" : "#9df4ff";
  const glow = magnet ? "#5aff8c" : g.gold ? "#ffcf3f" : "#8df0ff";
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.rot);
  ctx.scale(pulse * t, pulse * t);
  ctx.fillStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  if (magnet) {
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -1, g.w * 0.24, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.w * 0.24, -1);
    ctx.lineTo(g.w * 0.24, g.h * 0.34);
    ctx.moveTo(-g.w * 0.24, -1);
    ctx.lineTo(-g.w * 0.24, g.h * 0.34);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(g.w * 0.15, g.h * 0.18, g.w * 0.18, g.h * 0.26);
    ctx.fillRect(-g.w * 0.33, g.h * 0.18, g.w * 0.18, g.h * 0.26);
  } else {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      const px = Math.cos(a) * (g.w / 2);
      const py = Math.sin(a) * (g.h / 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(px * 0.45, py * 0.45);
      ctx.lineTo(px, py);
      ctx.lineTo(px * 0.45, py * 0.45);
    }
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, g.w * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function paintParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
): void {
  for (const particle of particles) {
    const t = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function paintPopups(
  ctx: CanvasRenderingContext2D,
  popups: Popup[],
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const popup of popups) {
    const t = clamp(popup.life / popup.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.font = `800 ${popup.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
}

export function paintBanner(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  banner: string,
  bannerTimer: number,
  subtitle: string | null,
): void {
  const t = clamp(bannerTimer / 2.2, 0, 1);
  const alpha = t < 0.2 ? t / 0.2 : t;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 clamp(26px, 8vw, 44px) "Segoe UI", system-ui, sans-serif`;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 6;
  ctx.strokeText(banner, W / 2, H * 0.32);
  ctx.fillStyle = "#eaffff";
  ctx.shadowColor = "rgba(80,220,255,0.9)";
  ctx.shadowBlur = 20;
  ctx.fillText(banner, W / 2, H * 0.32);
  if (subtitle) {
    ctx.font = `700 14px "Segoe UI", system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.strokeText(subtitle, W / 2, H * 0.32 + 38);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(subtitle, W / 2, H * 0.32 + 38);
  }
  ctx.restore();
}