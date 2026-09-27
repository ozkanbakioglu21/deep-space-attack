import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const BULLET_SPEED = 560;
const GROUND_Y_FRAC = 0.94;
const SHIP_Y_FRAC = 0.86;
const ALIEN_BASE_VY = 58;
const ALIEN_VY_PER_LEVEL = 10;
const KILLS_PER_LEVEL = 10;

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
}

type AlienBehavior = "drift" | "weave" | "dart";

interface Alien {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: number;
  wobble: number;
  flash: number;
  behavior: AlienBehavior;
  alive: boolean;
}

const ALIEN_STYLES: { body: string; accent: string; eye: string }[] = [
  { body: "#ff6b6b", accent: "#c0392b", eye: "#1a0606" },
  { body: "#ffd166", accent: "#d99a2b", eye: "#1a1406" },
  { body: "#7cff6b", accent: "#3fa532", eye: "#06140a" },
  { body: "#c58bff", accent: "#8a4fd0", eye: "#140a2a" },
];

export class GunMode extends BaseMode {
  private bullets: Bullet[] = [];
  private aliens: Alien[] = [];
  private alienTimer = 0.8;
  private fireAccum = 0;
  private kills = 0;
  private aim = -Math.PI / 2;
  private muzzle = 0;

  protected get palette(): ChapterDef {
    return {
      name: "SİLAH",
      top: "#0a1428",
      mid: "#060d1c",
      bottom: "#02060f",
      star: "#9fc0ff",
      starSpeed: 1.6,
      nebulas: [{ x: 0.5, y: 0.4, r: 0.55, color: "rgba(80,120,255,0.10)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "gun");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.bullets = [];
    this.aliens = [];
    this.alienTimer = 0.8;
    this.fireAccum = 0;
    this.kills = 0;
    this.aim = -Math.PI / 2;
    this.muzzle = 0;
    this.player.x = this.W / 2;
    this.player.y = this.H * SHIP_Y_FRAC;
    this.setBanner("KONTROL SENDE!", "NİŞAN AL, SIKTIR");
  }

  protected resetIdle(): void {
    this.bullets = [];
    this.aliens = [];
    this.player = this.makePlayer();
    this.player.x = this.W / 2;
    this.player.y = this.H * SHIP_Y_FRAC;
    this.aim = -Math.PI / 2;
  }

  // Gun upgrades with level: faster rate, then extra barrels
  private get fireRate(): number {
    return Math.min(12, 5 + (this.level - 1) * 0.8);
  }

  private get barrels(): number {
    return Math.min(3, 1 + Math.floor((this.level - 1) / 3));
  }

  protected updateSub(dt: number): void {
    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Strafe (desktop: A/D or arrows)
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");
    if (left) p.x -= 320 * dt;
    if (right) p.x += 320 * dt;
    p.x = clamp(p.x, 30, this.W - 30);

    // Aim the barrel toward the pointer, clamped to the upper hemisphere
    let a = Math.atan2(this.pointerY - p.y, this.pointerX - p.x);
    if (a >= 0) a = a < Math.PI / 2 ? -0.16 * Math.PI : -0.84 * Math.PI;
    a = clamp(a, -0.84 * Math.PI, -0.16 * Math.PI);
    this.aim += (a - this.aim) * Math.min(1, dt * 20);
    p.tilt = Math.cos(this.aim) * 0.3;

    if (this.muzzle > 0) this.muzzle -= dt;

    // Fire while holding (touch/mouse) or Space
    const firing = this.hasPointer || this.keys.has(" ");
    if (firing) {
      this.fireAccum += dt;
      const interval = 1 / this.fireRate;
      while (this.fireAccum >= interval) {
        this.fireAccum -= interval;
        this.fireBullet();
      }
    } else {
      this.fireAccum = 0;
    }

    // Spawn aliens
    this.alienTimer -= dt;
    if (this.alienTimer <= 0) {
      const interval = Math.max(0.4, 1.1 - (this.level - 1) * 0.06) * (0.7 + Math.random() * 0.5);
      this.alienTimer = interval;
      this.spawnAlien();
      if (this.level >= 3 && Math.random() < 0.4) this.spawnAlien();
    }

    this.updateBullets(dt);
    this.updateAliens(dt);
  }

  protected onPointerDownHook(): void {
    if (this.playing && this.player.alive) {
      this.fireBullet();
      this.fireAccum = 0;
    }
  }

  private fireBullet(): void {
    const p = this.player;
    if (!p.alive) return;
    const n = this.barrels;
    const gap = 0.09;
    const spreadTotal = (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const ang = this.aim + t * spreadTotal;
      const bx = p.x + Math.cos(this.aim) * 26;
      const by = p.y + Math.sin(this.aim) * 26;
      this.bullets.push({
        x: bx,
        y: by,
        vx: Math.cos(ang) * BULLET_SPEED,
        vy: Math.sin(ang) * BULLET_SPEED,
        r: 4,
        alive: true,
      });
    }
    this.muzzle = 0.06;
    this.audio.shoot();
    this.shake = Math.min(3, this.shake + 0.6);
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      for (const a of this.aliens) {
        if (!a.alive) continue;
        if (this.overlaps(b.x, b.y, b.r * 2, b.r * 2, a.x, a.y, a.r * 1.9, a.r * 1.9)) {
          b.alive = false;
          this.hitAlien(a, b);
          break;
        }
      }
      if (b.y < -30 || b.y > this.H + 30 || b.x < -30 || b.x > this.W + 30) b.alive = false;
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  private hitAlien(a: Alien, b: Bullet): void {
    this.explode(b.x, b.y, "#8fb4ff", 6, 5, 100);
    a.hp--;
    a.flash = 0.1;
    if (a.hp <= 0) {
      a.alive = false;
      const style = ALIEN_STYLES[a.kind];
      this.explode(a.x, a.y, style.body, 18, 10, 150);
      this.explode(a.x, a.y, style.accent, 10, 7, 110);
      this.bumpScore(100);
      this.bumpCombo();
      this.kills++;
      this.addPopup(a.x, a.y, `+${100 * this.comboMul()}`, "#5b8dff", 15);
      this.audio.explosion();
      this.vibrate(14);
      this.shake = Math.min(8, this.shake + 3);
      this.checkLevel();
    } else {
      this.addPopup(a.x, a.y - a.r, "ÇARPTI!", "#ffd166", 12);
      this.audio.hit();
    }
  }

  protected bumpScore(n: number): void {
    super.bumpScore(Math.round(n * this.comboMul()));
  }

  private checkLevel(): void {
    if (this.kills >= this.level * KILLS_PER_LEVEL) {
      this.level++;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
      this.flash = Math.max(this.flash, 0.3);
      const note = this.level >= 7 ? "3 NAMLU AÇILDI!" : this.level >= 4 ? "2. NAMLU AÇILDI!" : "UZAYLILAR HIZLANIYOR";
      this.setBanner(`DALGA ${this.level}`, note);
    }
  }

  private spawnAlien(): void {
    const margin = 40;
    const kind = Math.floor(Math.random() * ALIEN_STYLES.length);
    const behaviors: AlienBehavior[] = ["drift", "weave", "dart"];
    const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
    const tanky = this.level >= 3 && Math.random() < 0.2;
    const hp = tanky ? 2 : 1;
    const r = tanky ? 30 : 21;
    const x = margin + Math.random() * (this.W - margin * 2);
    const vy = (behavior === "dart" ? 1.6 : 1) * (ALIEN_BASE_VY + (this.level - 1) * ALIEN_VY_PER_LEVEL) + Math.random() * 20;
    const vx = behavior === "weave" ? (Math.random() - 0.5) * 120 : (Math.random() - 0.5) * 40;
    this.aliens.push({
      x,
      y: -r - 10,
      vx,
      vy,
      r,
      hp,
      maxHp: hp,
      kind,
      wobble: Math.random() * Math.PI * 2,
      flash: 0,
      behavior,
      alive: true,
    });
  }

  private updateAliens(dt: number): void {
    const groundY = this.H * GROUND_Y_FRAC;
    for (const a of this.aliens) {
      a.wobble += dt * 4;
      if (a.flash > 0) a.flash -= dt;
      if (a.behavior === "weave") a.vx = Math.sin(a.wobble) * 90;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < a.r) {
        a.x = a.r;
        a.vx = Math.abs(a.vx);
      }
      if (a.x > this.W - a.r) {
        a.x = this.W - a.r;
        a.vx = -Math.abs(a.vx);
      }
      if (a.y > groundY) {
        a.alive = false;
        const style = ALIEN_STYLES[a.kind];
        this.explode(a.x, groundY, style.body, 14, 8, 120);
        this.registerHit();
      }
    }
    this.aliens = this.aliens.filter((a) => a.alive);
  }

  // ---- Rendering ----

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    this.drawGround(ctx);
    for (const a of this.aliens) this.drawAlien(ctx, a);
    for (const b of this.bullets) this.drawBullet(ctx, b);
    this.drawAimLine(ctx);
    if (this.player.alive) this.drawShip(ctx);
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const gy = this.H * GROUND_Y_FRAC;
    ctx.save();
    const g = ctx.createLinearGradient(0, gy, 0, this.H);
    g.addColorStop(0, "rgba(40,70,120,0.4)");
    g.addColorStop(1, "rgba(10,20,40,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, this.W, this.H - gy);
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(this.time * 4);
    ctx.strokeStyle = "#ff5a3c";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(this.W, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawAlien(ctx: CanvasRenderingContext2D, a: Alien): void {
    const style = ALIEN_STYLES[a.kind];
    const bob = Math.sin(a.wobble) * 3;
    ctx.save();
    ctx.translate(a.x, a.y + bob);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = style.accent;
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, a.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = a.flash > 0 ? "#ffffff" : style.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, a.r, a.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * a.r * 0.4, -a.r * 0.7);
      ctx.lineTo(k * a.r * 0.6, -a.r * 1.15);
      ctx.stroke();
      ctx.fillStyle = style.accent;
      ctx.beginPath();
      ctx.arc(k * a.r * 0.6, -a.r * 1.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = style.eye;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(k * a.r * 0.38, -a.r * 0.1, a.r * 0.16, a.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(k * a.r * 0.42, -a.r * 0.14, a.r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = style.eye;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, a.r * 0.15, a.r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
    if (a.maxHp > 1 && a.hp > 1) {
      ctx.save();
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(a.hp), a.x, a.y - a.r - 6);
      ctx.restore();
    }
  }

  private drawBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = "#bcd4ff";
    ctx.shadowColor = "#5b8dff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAimLine(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const len = 74;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#5b8dff";
    ctx.setLineDash([3, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(this.aim) * 26, p.y + Math.sin(this.aim) * 26);
    ctx.lineTo(p.x + Math.cos(this.aim) * (26 + len), p.y + Math.sin(this.aim) * (26 + len));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invincible > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    // Barrel (rotates to aim)
    ctx.save();
    ctx.rotate(this.aim);
    ctx.fillStyle = "#3a4a6a";
    ctx.strokeStyle = "#5b8dff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(0, -5, 28, 10);
    ctx.fill();
    ctx.stroke();
    if (this.muzzle > 0) {
      ctx.fillStyle = "#bcd4ff";
      ctx.shadowColor = "#5b8dff";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(30, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    // Turret body
    ctx.fillStyle = "#2a3a5a";
    ctx.strokeStyle = "#5b8dff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5b8dff";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
