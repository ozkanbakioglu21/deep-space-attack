import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const BULLET_SPEED = 560;
const GROUND_Y_FRAC = 0.94;
const SHIP_Y_FRAC = 0.86;
const ALIEN_BASE_VY = 58;
const ALIEN_VY_PER_LEVEL = 10;
const KILLS_PER_LEVEL = 10;

// Realistic weapon behavior: recoil, barrel heat/overheat, casings, tracers.
const HEAT_PER_SHOT = 5;
const COOL_FIRING = 16; // heat/s shed while firing
const COOL_IDLE = 42; // heat/s shed while not firing
const OVERHEAT_AT = 100;
const OVERHEAT_RESET = 42; // hysteresis: can fire again below this
const RECOIL_KICK = 0.5;
const RECOIL_DECAY = 7; // /s

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alive: boolean;
}

interface Casing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
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
  private casings: Casing[] = [];
  private alienTimer = 0.8;
  private fireAccum = 0;
  private kills = 0;
  private aim = -Math.PI / 2;
  private muzzle = 0;
  private heat = 0;
  private overheated = false;
  private recoil = 0;

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
    this.casings = [];
    this.alienTimer = 0.8;
    this.fireAccum = 0;
    this.kills = 0;
    this.aim = -Math.PI / 2;
    this.muzzle = 0;
    this.heat = 0;
    this.overheated = false;
    this.recoil = 0;
    this.player.x = this.W / 2;
    this.player.y = this.H * SHIP_Y_FRAC;
    this.setBanner("GERÇEKÇİ ATEŞ", "Namlu ısınıyor — seriler halinde at!");
  }

  protected resetIdle(): void {
    this.bullets = [];
    this.aliens = [];
    this.casings = [];
    this.player = this.makePlayer();
    this.player.x = this.W / 2;
    this.player.y = this.H * SHIP_Y_FRAC;
    this.aim = -Math.PI / 2;
    this.heat = 0;
    this.overheated = false;
    this.recoil = 0;
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

    // Recoil recovery + barrel heat cooling
    this.recoil = Math.max(0, this.recoil - RECOIL_DECAY * dt);
    const holding = this.hasPointer || this.keys.has(" ");
    this.heat = Math.max(0, this.heat - ((holding && !this.overheated) ? COOL_FIRING : COOL_IDLE) * dt);

    // Fire while holding (touch/mouse) or Space — blocked while overheated
    if (this.overheated) {
      this.fireAccum = 0;
    } else if (holding) {
      this.fireAccum += dt;
      const interval = 1 / this.fireRate;
      while (this.fireAccum >= interval) {
        this.fireAccum -= interval;
        this.fireBullet();
      }
    } else {
      this.fireAccum = 0;
    }

    // Overheat transitions
    if (!this.overheated && this.heat >= OVERHEAT_AT) {
      this.heat = OVERHEAT_AT;
      this.overheated = true;
      this.fireAccum = 0;
      this.addPopup(p.x, p.y - 34, "AŞIRI ISITILDI!", "#ff5a3c", 16);
      this.setBanner("BARREL HARETLİ", "Soğumasını bekle!");
      this.audio.hit();
      this.vibrate(30);
    } else if (this.overheated && this.heat <= OVERHEAT_RESET) {
      this.overheated = false;
      this.addPopup(p.x, p.y - 34, "ATEŞE HAZIR", "#7cff6b", 13);
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
    this.updateCasings(dt);
  }

  protected onPointerDownHook(): void {
    if (this.playing && this.player.alive) {
      this.fireBullet();
      this.fireAccum = 0;
    }
  }

  private fireBullet(): void {
    const p = this.player;
    if (!p.alive || this.overheated) return;
    const n = this.barrels;
    const gap = 0.09;
    const spreadTotal = (n - 1) * gap;
    const spread = 0.012 + this.recoil * 0.09; // recoil widens the spray
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const jitter = (Math.random() - 0.5) * 2 * spread;
      const ang = this.aim + t * spreadTotal + jitter;
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
    this.heat = Math.min(OVERHEAT_AT, this.heat + HEAT_PER_SHOT);
    this.recoil = Math.min(1, this.recoil + RECOIL_KICK);
    this.muzzle = 0.06;
    this.ejectCasing();
    this.audio.shoot();
    this.shake = Math.min(5, this.shake + 0.7 + this.recoil * 0.6);
  }

  private ejectCasing(): void {
    const p = this.player;
    const side = Math.random() < 0.5 ? 1 : -1;
    const ex = Math.cos(this.aim + (Math.PI / 2) * side);
    const ey = Math.sin(this.aim + (Math.PI / 2) * side);
    const sp = 110 + Math.random() * 70;
    this.casings.push({
      x: p.x + ex * 10,
      y: p.y + ey * 10,
      vx: ex * sp + (Math.random() - 0.5) * 50,
      vy: ey * sp - 60,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 34,
      life: 0.7 + Math.random() * 0.3,
    });
  }

  private updateCasings(dt: number): void {
    for (const c of this.casings) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 520 * dt;
      c.rot += c.vr * dt;
      c.life -= dt;
    }
    this.casings = this.casings.filter((c) => c.life > 0 && c.y < this.H + 20);
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
    for (const c of this.casings) this.drawCasing(ctx, c);
    this.drawAimLine(ctx);
    if (this.player.alive) this.drawShip(ctx);
    this.drawHeatGauge(ctx);
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
    // Tracer trail
    const tl = 18;
    const grad = ctx.createLinearGradient(-tl, 0, 0, 0);
    grad.addColorStop(0, "rgba(91,141,255,0)");
    grad.addColorStop(1, "rgba(130,170,255,0.75)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-tl, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    // Bullet head
    ctx.fillStyle = "#e2ecff";
    ctx.shadowColor = "#5b8dff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCasing(ctx: CanvasRenderingContext2D, c: Casing): void {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.globalAlpha = Math.min(1, c.life / 0.3);
    ctx.fillStyle = "#d4a017";
    ctx.shadowColor = "rgba(212,160,23,0.6)";
    ctx.shadowBlur = 4;
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }

  private drawHeatGauge(ctx: CanvasRenderingContext2D): void {
    const gw = 7;
    const gh = this.H * 0.14;
    const gx = 8;
    const gyBottom = this.H * 0.9;
    const gy = gyBottom - gh;
    const frac = this.heat / OVERHEAT_AT;
    const col = this.overheated ? "#ff5a3c" : frac < 0.5 ? "#7cff6b" : frac < 0.8 ? "#ffd166" : "#ff5a3c";
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);
    const fillH = gh * frac;
    ctx.fillStyle = col;
    ctx.fillRect(gx, gyBottom - fillH, gw, fillH);
    const tickY = gyBottom - gh * (OVERHEAT_RESET / OVERHEAT_AT);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(gx - 3, tickY, gw + 6, 1.5);
    ctx.save();
    ctx.translate(gx - 1, gyBottom - gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ISITMA", 0, 0);
    ctx.restore();
    if (this.overheated) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 14);
      ctx.fillStyle = "#ff5a3c";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BARREL HARETLİ - SOĞUMASINI BEKLE!", this.W / 2, gy + 6);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawAimLine(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    // The guide shortens as recoil builds (the sight wobbles).
    const len = 74 * (1 - this.recoil * 0.4);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = this.overheated ? "#ff5a3c" : "#5b8dff";
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
    const rec = this.recoil;
    // Recoil kicks the whole ship backward along the aim axis.
    const kickX = Math.cos(this.aim) * rec * 4;
    const kickY = Math.sin(this.aim) * rec * 4;
    ctx.save();
    ctx.translate(p.x - kickX, p.y - kickY);
    if (p.invincible > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    const heatFrac = this.heat / OVERHEAT_AT;
    // Barrel (rotates to aim, recoils backward when firing)
    ctx.save();
    ctx.rotate(this.aim);
    const recX = -rec * 7;
    ctx.fillStyle = "#3a4a6a";
    ctx.strokeStyle = "#5b8dff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(recX, -5, 28, 10);
    ctx.fill();
    ctx.stroke();
    // Heat glow on the barrel
    if (heatFrac > 0.45 || this.overheated) {
      ctx.globalAlpha = this.overheated ? 0.9 : (heatFrac - 0.45) * 1.2;
      ctx.strokeStyle = "#ff5a3c";
      ctx.shadowColor = "#ff5a3c";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(recX, -6, 28, 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // Muzzle flash (brighter + light cone)
    if (this.muzzle > 0) {
      const m = this.muzzle / 0.06;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#8ab4ff";
      ctx.shadowBlur = 18 * m;
      ctx.beginPath();
      ctx.arc(30 + recX, 0, 6 + 6 * m, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3 * m;
      ctx.fillStyle = "#bcd4ff";
      ctx.beginPath();
      ctx.moveTo(30 + recX, 0);
      ctx.lineTo(30 + recX + 34, -15);
      ctx.lineTo(30 + recX + 34, 15);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    // Turret body
    ctx.fillStyle = "#2a3a5a";
    ctx.strokeStyle = this.overheated ? "#ff5a3c" : "#5b8dff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.overheated ? "#ff5a3c" : "#5b8dff";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
