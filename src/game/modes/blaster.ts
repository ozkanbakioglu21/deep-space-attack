import { ENEMY_DEFS } from "../defs";
import { ENEMY_BULLET_SPEED, PLAYER_FIRE_RATE } from "../constants";
import { paintBullet, paintEnemy, paintPlayer } from "../painter";
import type { Bullet, ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const WAVE_TIME = 18;
const GROUND_Y_OFFSET = 48;
const AIM_SPEED = 5;
const CHAIN_RADIUS = 96;
const CHAIN_STAGGER = 0.075;
const BIG_CHAIN = 5;
const MAX_CHAIN = 48;

type Ring = {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
};

export class BlasterMode extends BaseMode {
  private meteors: Enemy[] = [];
  private bullets: Bullet[] = [];
  private nextId = 1;
  private spawnTimer = 0.9;
  private fireTimer = 0;
  private waveTimer = 0;

  private rings: Ring[] = [];
  private chainQueue: Array<{ x: number; y: number }> = [];
  private chainTimer = 0;
  private chainCount = 0;
  private chainSlowDone = false;
  private redFlash = 0;
  private muzzle = 0;
  private muzzleX = 0;
  private muzzleY = 0;

  protected get palette(): ChapterDef {
    return {
      name: "HEDEF AVCISI",
      top: "#22103a",
      mid: "#12081f",
      bottom: "#070309",
      star: "#ffd7f0",
      starSpeed: 1.3,
      nebulas: [{ x: 0.5, y: 0.25, r: 0.72, color: "rgba(255,80,200,0.12)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "blaster");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.meteors = [];
    this.bullets = [];
    this.rings = [];
    this.chainQueue = [];
    this.chainTimer = 0;
    this.chainCount = 0;
    this.chainSlowDone = false;
    this.redFlash = 0;
    this.muzzle = 0;
    this.spawnTimer = 0.9;
    this.fireTimer = 0;
    this.waveTimer = 0;
    this.player.x = this.W / 2;
    this.player.y = this.H - 70;
    this.setBanner("DALGA 1", "NİŞAN AL VE GÖKTAŞLARINI YOK ET!");
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.bullets = [];
    this.rings = [];
    this.player = this.makePlayer();
  }

  protected updateSub(dt: number): void {
    const p = this.player;
    p.x = this.W / 2;

    if (this.hasPointer) {
      const dx = this.pointerX - p.x;
      const dy = this.pointerY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const target = clamp(Math.atan2(dx / dist, -dy / dist), -1.15, 1.15);
      p.tilt += (target - p.tilt) * Math.min(1, dt * AIM_SPEED);
    } else {
      p.tilt += (0 - p.tilt) * Math.min(1, dt * AIM_SPEED);
    }

    const inter = Math.max(0.32, 0.9 - this.level * 0.05);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = inter * (0.7 + Math.random() * 0.6);
      this.pushMeteor();
    }

    const mult = 1 + (this.level - 1) * 0.1;
    const groundY = this.H - GROUND_Y_OFFSET;
    for (const m of this.meteors) {
      m.rot += m.rotSpeed * dt;
      m.y += m.vy * dt;
      m.wobble += m.wobbleSpeed * dt;
      m.x = m.baseX + Math.sin(m.wobble * 2) * 8 * mult;
      if (m.flash > 0) m.flash = Math.max(0, m.flash - dt);
      if (m.y >= groundY) {
        m.alive = false;
        this.groundImpact(m);
      }
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = PLAYER_FIRE_RATE;
      this.fireBullet();
    }

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > this.W + 20 || b.y < -30 || b.y > this.H + 30) {
        b.alive = false;
        continue;
      }
      for (const m of this.meteors) {
        if (!m.alive) continue;
        if (this.overlaps(b.x, b.y, b.w, b.h, m.x, m.y, m.w, m.h)) {
          b.alive = false;
          m.hp -= 1;
          m.flash = 0.14;
          this.explode(b.x, b.y, "#ffd166", 6, 4, 90);
          if (m.hp <= 0) this.killMeteor(m, false);
          break;
        }
      }
    }

    if (this.chainQueue.length > 0) {
      this.chainTimer -= dt;
      while (this.chainTimer <= 0 && this.chainQueue.length > 0) {
        const pos = this.chainQueue.shift();
        if (!pos) break;
        this.blast(pos.x, pos.y);
        this.chainTimer += CHAIN_STAGGER;
      }
    } else {
      this.chainCount = 0;
      this.chainSlowDone = false;
    }

    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 100);
    this.bullets = this.bullets.filter((b) => b.alive);

    for (const r of this.rings) {
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 9);
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    if (this.redFlash > 0) this.redFlash = Math.max(0, this.redFlash - dt * 2.4);
    if (this.muzzle > 0) this.muzzle = Math.max(0, this.muzzle - dt);

    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_TIME) {
      this.waveTimer = 0;
      this.level++;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
      this.setBanner(`DALGA ${this.level}`);
    }
  }

  private fireBullet(): void {
    const p = this.player;
    const speed = ENEMY_BULLET_SPEED * 1.9;
    let dx = 0;
    let dy = -1;
    if (this.hasPointer) {
      dx = this.pointerX - p.x;
      dy = this.pointerY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist;
      dy /= dist;
    }
    this.audio.shoot();
    this.muzzle = 0.06;
    this.muzzleX = p.x + dx * 22;
    this.muzzleY = p.y + dy * 22 - 10;
    this.bullets.push({
      id: this.nextId++,
      x: p.x + dx * 20,
      y: p.y + dy * 20 - 10,
      w: 6,
      h: 14,
      vx: dx * speed,
      vy: dy * speed,
      alive: true,
      friendly: true,
      damage: 1,
    });
  }

  private pushMeteor(): void {
    const def = ENEMY_DEFS.meteor;
    const mult = 1 + (this.level - 1) * 0.1;
    const hpHard = this.level >= 2 && Math.random() < 0.3 ? 3 : 2;
    const x = def.w / 2 + Math.random() * Math.max(0, this.W - def.w);
    this.meteors.push({
      id: this.nextId++,
      kind: "meteor",
      x,
      y: -def.h - 8,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.95 + Math.random() * 0.35),
      alive: true,
      hp: hpHard,
      baseX: x,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1.4,
      shootTimer: 9,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: 0.8 + Math.random() * 1.8,
      flash: 0,
      dive: false,
    });
  }

  private killMeteor(m: Enemy, byChain: boolean): void {
    m.alive = false;
    const def = ENEMY_DEFS.meteor;
    this.explode(m.x, m.y, "#ff9f43", 22, 11, 190);
    this.addRing(m.x, m.y, "#ffd166", 60, 3);
    this.bumpCombo();
    this.chainCount += 1;
    const base = byChain ? 25 : def.score;
    const gain = Math.round(base * this.comboMul());
    this.bumpScore(gain);
    this.addPopup(m.x, m.y - 18, byChain ? `ZİNCİR +${gain}` : `+${gain}`, byChain ? "#ffe08a" : "#ffd166", 14);
    const big = this.chainCount >= BIG_CHAIN;
    if (big && !this.chainSlowDone) {
      this.chainSlowDone = true;
      this.addHitStop(0.32);
      this.setBanner(`ZİNCİRLER x${this.chainCount}!`, "GÖKTAŞLAR ZİNCİRLE PATLIYOR");
      this.audio.combo(3);
    }
    this.audio.explosion(big);
    this.addHitStop(big ? 0.05 : 0.035);
    this.vibrate(big ? 24 : 12);
    this.shake = Math.min(18, this.shake + (big ? 6 : 4));
    if (this.chainQueue.length < MAX_CHAIN) {
      this.chainQueue.push({ x: m.x, y: m.y });
      this.chainTimer = 0;
    }
  }

  private blast(x: number, y: number): void {
    for (const m of this.meteors) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - x, m.y - y) <= CHAIN_RADIUS) {
        m.hp -= 1;
        m.flash = 0.16;
        this.explode(m.x, m.y, "#ffd166", 6, 4, 90);
        if (m.hp <= 0) this.killMeteor(m, true);
      }
    }
  }

  private groundImpact(m: Enemy): void {
    const groundY = this.H - GROUND_Y_OFFSET;
    this.explode(m.x, groundY, "#ff6a2a", 26, 12, 210);
    this.addRing(m.x, groundY, "#ff5a2a", 96, 4);
    this.redFlash = 1;
    this.shake = Math.min(20, this.shake + 9);
    this.audio.explosion(true);
    this.registerHit();
  }

  private addRing(x: number, y: number, color: string, maxR: number, width: number): void {
    this.rings.push({ x, y, r: 6, maxR, life: 0.5, maxLife: 0.5, color, width });
  }

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    const groundY = this.H - GROUND_Y_OFFSET;
    this.drawGroundLine(ctx, groundY);
    this.drawAim(ctx);
    for (const m of this.meteors) this.drawTrajectory(ctx, m, groundY);
    for (const r of this.rings) this.drawRing(ctx, r);
    for (const m of this.meteors) {
      paintEnemy(ctx, m, this.time);
      if (m.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, m.flash * 4);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.w * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const b of this.bullets) paintBullet(ctx, b);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
    if (this.muzzle > 0) this.drawMuzzle(ctx);
    this.drawFever(ctx);
    if (this.redFlash > 0) {
      const g = ctx.createRadialGradient(this.W / 2, this.H * 0.5, this.H * 0.25, this.W / 2, this.H * 0.5, this.H * 0.75);
      g.addColorStop(0, "rgba(255,40,20,0)");
      g.addColorStop(1, `rgba(255,40,20,${(this.redFlash * 0.5).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawGroundLine(ctx: CanvasRenderingContext2D, groundY: number): void {
    ctx.save();
    const grad = ctx.createLinearGradient(0, groundY - 14, 0, this.H);
    grad.addColorStop(0, "rgba(255,80,50,0)");
    grad.addColorStop(1, "rgba(255,80,50,0.14)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY - 14, this.W, this.H - (groundY - 14));
    ctx.strokeStyle = "rgba(255,90,50,0.5)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ff5a32";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.W, groundY);
    ctx.stroke();
    ctx.restore();
  }

  private drawAim(ctx: CanvasRenderingContext2D): void {
    if (!this.hasPointer) return;
    const p = this.player;
    const dx = this.pointerX - p.x;
    const dy = this.pointerY - p.y - 10;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const len = Math.min(190, dist);
    const tx = p.x + nx * len;
    const ty = p.y + ny * len - 10;
    const txWorld = p.x + nx * 20;
    const tyWorld = p.y + ny * 20 - 10;
    const heat = this.comboMul();
    const color = heat >= 4 ? "#ff5a32" : heat >= 3 ? "#ffd15c" : "#b18cff";
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.05 * Math.sin(this.time * 6) + (heat - 1) * 0.03;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 + (heat - 1) * 0.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(txWorld, tyWorld);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const rr = 8 + (heat - 1) * 1.5;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    const a = this.time * 3;
    for (let i = 0; i < 4; i++) {
      const t = a + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(t) * (rr + 3), ty + Math.sin(t) * (rr + 3));
      ctx.lineTo(tx + Math.cos(t) * (rr + 8), ty + Math.sin(t) * (rr + 8));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTrajectory(ctx: CanvasRenderingContext2D, m: Enemy, groundY: number): void {
    const danger = m.y > this.H * 0.45 || m.hp >= 3;
    const color = danger ? "255,150,60" : "150,150,190";
    const alpha = danger ? 0.22 : 0.08;
    ctx.save();
    ctx.strokeStyle = `rgba(${color},${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y + m.h * 0.4);
    ctx.lineTo(m.x, groundY);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 10);
    const s = 7 + pulse * 3;
    ctx.strokeStyle = `rgba(${color},${(alpha + 0.25).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m.x, groundY - s);
    ctx.lineTo(m.x - s, groundY);
    ctx.lineTo(m.x + s, groundY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, r: Ring): void {
    const a = Math.max(0, r.life / r.maxLife);
    ctx.save();
    ctx.globalAlpha = a * 0.7;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * a + 0.5;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 12 * a;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawMuzzle(ctx: CanvasRenderingContext2D): void {
    const a = this.muzzle / 0.06;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    const grad = ctx.createRadialGradient(this.muzzleX, this.muzzleY, 0, this.muzzleX, this.muzzleY, 16);
    grad.addColorStop(0, "rgba(255,240,180,0.9)");
    grad.addColorStop(1, "rgba(255,180,80,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.muzzleX, this.muzzleY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFever(ctx: CanvasRenderingContext2D): void {
    const heat = this.comboMul();
    if (heat < 3) return;
    const k = Math.min(1, (heat - 2) / 3);
    const a = (0.1 + 0.06 * Math.sin(this.time * 4)) * k;
    const color = heat >= 4 ? "255,90,42" : "255,180,60";
    const g = ctx.createRadialGradient(this.W / 2, this.H, this.H * 0.2, this.W / 2, this.H, this.H * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(${color},${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}