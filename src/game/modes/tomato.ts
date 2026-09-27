import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const LAUNCHER_Y_FRAC = 0.85;
const GROUND_Y_FRAC = 0.93;
const TOMATO_SPEED = 470;
const GRAVITY = 180;
const ALIEN_BASE_VY = 92;
const ALIEN_VY_PER_LEVEL = 15;
const ALIEN_ACCEL = 26;
const KILLS_PER_LEVEL = 10;

interface Tomato {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  alive: boolean;
}

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
  alive: boolean;
}

const ALIEN_STYLES: { body: string; accent: string; eye: string }[] = [
  { body: "#8be05a", accent: "#3f9e2a", eye: "#0a1a06" },
  { body: "#c59bff", accent: "#7a4fd0", eye: "#140a2a" },
  { body: "#6fd8ff", accent: "#2a9fd0", eye: "#06161a" },
  { body: "#ff9fc0", accent: "#d04f7a", eye: "#2a0612" },
];

export class TomatoMode extends BaseMode {
  private tomatoes: Tomato[] = [];
  private aliens: Alien[] = [];
  private alienTimer = 0.8;
  private throwAccum = 0;
  private kills = 0;

  protected get palette(): ChapterDef {
    return {
      name: "DOMATES",
      top: "#241033",
      mid: "#160a24",
      bottom: "#070310",
      star: "#ffd9a8",
      starSpeed: 1.5,
      nebulas: [{ x: 0.5, y: 0.35, r: 0.55, color: "rgba(190,90,255,0.10)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "tomato");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.tomatoes = [];
    this.aliens = [];
    this.alienTimer = 0.8;
    this.throwAccum = 0;
    this.kills = 0;
    this.player.x = this.W / 2;
    this.player.y = this.H * LAUNCHER_Y_FRAC;
    this.setBanner("UZAYLILAR İNİYOR!", "DOMATESLERİ HAZIRLA");
  }

  protected resetIdle(): void {
    this.tomatoes = [];
    this.aliens = [];
    this.player = this.makePlayer();
    this.player.y = this.H * LAUNCHER_Y_FRAC;
  }

  protected updateSub(dt: number): void {
    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Move launcher: follow pointer, or A/D / arrow keys
    let targetX = p.x;
    if (this.hasPointer) targetX = clamp(this.pointerX, 24, this.W - 24);
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");
    if (left) targetX = p.x - 220;
    if (right) targetX = p.x + 220;
    targetX = clamp(targetX, 24, this.W - 24);
    const prevX = p.x;
    p.x += (targetX - p.x) * Math.min(1, dt * 16);
    const vxNow = (p.x - prevX) / Math.max(dt, 0.001);
    const tiltTarget = clamp(vxNow * 0.0004, -0.4, 0.4);
    p.tilt += (tiltTarget - p.tilt) * Math.min(1, dt * 10);

    // Throw tomatoes while holding (touch/mouse) or Space
    const throwing = this.hasPointer || this.keys.has(" ");
    if (throwing) {
      this.throwAccum += dt;
      const interval = 1 / this.throwRate;
      while (this.throwAccum >= interval) {
        this.throwAccum -= interval;
        this.throwTomato();
      }
    } else {
      this.throwAccum = 0;
    }

    // Spawn aliens (frequent, with bursts at higher waves)
    this.alienTimer -= dt;
    if (this.alienTimer <= 0) {
      const interval = Math.max(0.3, 0.82 - (this.level - 1) * 0.05) * (0.7 + Math.random() * 0.5);
      this.alienTimer = interval;
      this.spawnAlien();
      if (this.level >= 2 && Math.random() < 0.4) this.spawnAlien();
      if (this.level >= 3 && Math.random() < 0.45) this.spawnAlien();
      if (this.level >= 5 && Math.random() < 0.4) this.spawnAlien();
    }

    this.updateTomatoes(dt);
    this.updateAliens(dt);
  }

  // ---- Throwing ----

  // Throwing scales with level: start at one tomato at a time, gain speed
  // and multi-shot (fan) as you level up.
  private get throwRate(): number {
    return Math.min(7, 1.4 + (this.level - 1) * 0.5);
  }

  private get shotsPerThrow(): number {
    return Math.min(4, 1 + Math.floor((this.level - 1) / 2));
  }

  private throwTomato(): void {
    const p = this.player;
    if (!p.alive) return;
    const n = this.shotsPerThrow;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const angle = t * 0.7;
      this.tomatoes.push({
        x: p.x + Math.sin(p.tilt) * 26,
        y: p.y - 30,
        vx: Math.sin(angle) * TOMATO_SPEED + (Math.random() - 0.5) * 26,
        vy: -Math.cos(angle) * TOMATO_SPEED,
        r: 11,
        spin: Math.random() * Math.PI * 2,
        alive: true,
      });
    }
    this.audio.shoot();
    this.shake = Math.min(4, this.shake + 1);
  }

  protected onPointerDownHook(): void {
    if (this.playing && this.player.alive) {
      this.throwTomato();
      this.throwAccum = 0;
    }
  }

  private updateTomatoes(dt: number): void {
    for (const t of this.tomatoes) {
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.spin += dt * 9;
      for (const a of this.aliens) {
        if (!a.alive) continue;
        if (this.overlaps(t.x, t.y, t.r * 2, t.r * 2, a.x, a.y, a.r * 1.9, a.r * 1.9)) {
          t.alive = false;
          this.hitAlien(a, t);
          break;
        }
      }
      if (t.y > this.H + 40 || t.y < -60 || t.x < -40 || t.x > this.W + 40) t.alive = false;
    }
    this.tomatoes = this.tomatoes.filter((t) => t.alive);
  }

  private hitAlien(a: Alien, t: Tomato): void {
    this.explode(t.x, t.y, "#ff5a3c", 10, 7, 120);
    this.explode(t.x, t.y, "#ff9a7a", 6, 5, 90);
    a.hp--;
    a.flash = 0.12;
    if (a.hp <= 0) {
      a.alive = false;
      const style = ALIEN_STYLES[a.kind];
      this.explode(a.x, a.y, style.body, 18, 10, 150);
      this.explode(a.x, a.y, style.accent, 10, 7, 110);
      this.bumpScore(100);
      this.bumpCombo();
      this.kills++;
      this.addPopup(a.x, a.y, `+${100 * this.comboMul()}`, "#8be05a", 15);
      this.audio.explosion();
      this.vibrate(14);
      this.shake = Math.min(8, this.shake + 3);
      this.checkLevel();
    } else {
      this.addPopup(a.x, a.y - a.r, "ÇARPTI!", "#ff9a7a", 12);
      this.audio.hit();
      this.vibrate(8);
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
      this.setBanner(`DALGA ${this.level}`, "UZAYLILAR HIZLANIYOR");
    }
  }

  // ---- Aliens ----

  private spawnAlien(): void {
    const margin = 40;
    const kind = Math.floor(Math.random() * ALIEN_STYLES.length);
    const titan = this.level >= 6 && Math.random() < 0.12;
    const brutal = !titan && this.level >= 3 && Math.random() < 0.18;
    const big = !titan && !brutal && this.level >= 2 && Math.random() < 0.28;
    const hp = titan ? 4 : brutal ? 3 : big ? 2 : 1;
    const r = titan ? 35 : brutal ? 32 : big ? 29 : 21;
    const x = margin + Math.random() * (this.W - margin * 2);
    const vy = ALIEN_BASE_VY + (this.level - 1) * ALIEN_VY_PER_LEVEL + Math.random() * 28;
    const vx = (Math.random() - 0.5) * 110;
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
      alive: true,
    });
  }

  private updateAliens(dt: number): void {
    const groundY = this.H * GROUND_Y_FRAC;
    for (const a of this.aliens) {
      a.wobble += dt * 4;
      if (a.flash > 0) a.flash -= dt;
      a.vy += ALIEN_ACCEL * dt; // dive: aliens accelerate as they descend
      a.x += a.vx * dt + Math.sin(a.wobble) * 26 * dt;
      a.y += a.vy * dt;
      if (a.x < a.r && a.vx < 0) a.vx = -a.vx;
      if (a.x > this.W - a.r && a.vx > 0) a.vx = -a.vx;
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
    for (const t of this.tomatoes) this.drawTomato(ctx, t);
    this.drawAimHint(ctx);
    if (this.player.alive) {
      this.drawLauncher(ctx);
      if (this.shotsPerThrow > 1) this.drawThrowBadge(ctx);
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const gy = this.H * GROUND_Y_FRAC;
    ctx.save();
    const g = ctx.createLinearGradient(0, gy, 0, this.H);
    g.addColorStop(0, "rgba(70,130,45,0.45)");
    g.addColorStop(1, "rgba(20,55,15,0.7)");
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
    // glow
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = style.accent;
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, a.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // body
    ctx.fillStyle = a.flash > 0 ? "#ffffff" : style.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, a.r, a.r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // antennae
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
    // eyes
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
    // mouth
    ctx.strokeStyle = style.eye;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, a.r * 0.15, a.r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
    // HP pips for multi-hit aliens
    if (a.maxHp > 1 && a.hp > 1) {
      ctx.save();
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(a.hp), a.x, a.y - a.r - 6);
      ctx.restore();
    }
  }

  private drawTomato(ctx: CanvasRenderingContext2D, t: Tomato): void {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.fillStyle = "#e8402a";
    ctx.shadowColor = "#ff6a4a";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(-t.r * 0.32, -t.r * 0.34, t.r * 0.34, t.r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // green calyx
    ctx.fillStyle = "#4aa83a";
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2 + t.spin * 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * 3, Math.sin(ang) * 3 - t.r * 0.12, 4, 2, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAimHint(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#ff6a4a";
    ctx.setLineDash([4, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 30);
    ctx.lineTo(p.x, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawLauncher(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt * 0.5);
    if (p.invincible > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    // wheels
    ctx.fillStyle = "#241640";
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(k * 15, 16, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // body
    ctx.fillStyle = "#4a3a6a";
    ctx.strokeStyle = "#b58cff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 12);
    ctx.lineTo(-14, -4);
    ctx.lineTo(14, -4);
    ctx.lineTo(18, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // barrel (points up)
    ctx.fillStyle = "#5a4a7a";
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-8, -30);
    ctx.lineTo(8, -30);
    ctx.lineTo(6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // tomato loaded on top
    ctx.fillStyle = "#e8402a";
    ctx.beginPath();
    ctx.arc(0, -34, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawThrowBadge(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#8be05a";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`🍅 ×${this.shotsPerThrow}`, p.x, p.y + 34);
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
