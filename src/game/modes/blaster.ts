import { ENEMY_DEFS } from "../defs";
import { ENEMY_BULLET_SPEED, PLAYER_FIRE_RATE } from "../constants";
import { paintBullet, paintEnemy, paintPlayer } from "../painter";
import type { Bullet, ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const WAVE_TIME = 18;
const GROUND_Y_OFFSET = 48;
const AIM_SPEED = 5;

export class BlasterMode extends BaseMode {
  private meteors: Enemy[] = [];
  private bullets: Bullet[] = [];
  private nextId = 1;
  private spawnTimer = 0.9;
  private fireTimer = 0;
  private waveTimer = 0;

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
    for (const m of this.meteors) {
      m.rot += m.rotSpeed * dt;
      m.y += m.vy * dt;
      m.wobble += m.wobbleSpeed * dt;
      m.x = m.baseX + Math.sin(m.wobble * 2) * 8 * mult;
      if (m.y > this.H - GROUND_Y_OFFSET) {
        m.alive = false;
        this.explode(m.x, this.H - GROUND_Y_OFFSET, "#ff9f43", 24, 12, 200);
        this.shake = Math.min(14, this.shake + 7);
        this.registerHit();
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
      if (
        b.x < -20 ||
        b.x > this.W + 20 ||
        b.y < -30 ||
        b.y > this.H + 30
      ) {
        b.alive = false;
        continue;
      }
      for (const m of this.meteors) {
        if (!m.alive) continue;
        if (this.overlaps(b.x, b.y, b.w, b.h, m.x, m.y, m.w, m.h)) {
          b.alive = false;
          m.hp -= 1;
          this.explode(b.x, b.y, "#ffd166", 6, 4, 90);
          if (m.hp <= 0) {
            m.alive = false;
            const def = ENEMY_DEFS.meteor;
            this.explode(m.x, m.y, "#ff9f43", 22, 11, 190);
            this.bumpCombo();
            const gain = Math.round(def.score * this.comboMul());
            this.bumpScore(gain);
            this.addPopup(m.x, m.y - 18, `+${gain}`, "#ffd166", 14);
            this.audio.explosion();
            this.addHitStop(0.035);
            this.vibrate(12);
            this.shake = Math.min(10, this.shake + 4);
            this.chainBoom(m.x, m.y);
          }
          break;
        }
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 100);
    this.bullets = this.bullets.filter((b) => b.alive);

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

  private chainBoom(x: number, y: number): void {
    const radius = 96;
    const stack: Array<{ x: number; y: number }> = [{ x, y }];
    let chains = 0;
    while (stack.length > 0 && chains < 14) {
      const pos = stack.pop();
      if (!pos) break;
      for (const m of this.meteors) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - pos.x, m.y - pos.y) <= radius) {
          m.hp -= 1;
          this.explode(m.x, m.y, "#ffd166", 6, 4, 90);
          if (m.hp <= 0) {
            m.alive = false;
            chains++;
            const gain = Math.round(15 * this.comboMul());
            this.bumpScore(gain);
            this.addPopup(m.x, m.y - 16, `ZİNCİR +${gain}`, "#ffe08a", 13);
            stack.push({ x: m.x, y: m.y });
          }
        }
      }
    }
    if (chains > 0) {
      this.audio.explosion();
      this.addHitStop(0.04);
      this.vibrate(18);
    }
  }

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    if (this.hasPointer) {
      const p = this.player;
      const dx = this.pointerX - p.x;
      const dy = this.pointerY - p.y - 10;
      const dist = Math.hypot(dx, dy) || 1;
      const len = Math.min(180, dist);
      const tx = p.x + (dx / dist) * len;
      const ty = p.y + (dy / dist) * len - 10;
      const txWorld = p.x + (dx / dist) * 20;
      const tyWorld = p.y + (dy / dist) * 20 - 10;
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(this.time * 6);
      ctx.strokeStyle = "#b18cff";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#b18cff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(txWorld, tyWorld);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx, ty, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const b of this.bullets) paintBullet(ctx, b);
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}