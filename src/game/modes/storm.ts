import { ENEMY_DEFS } from "../defs";
import { PLAYER_SPEED } from "../constants";
import { paintEnemy, paintPlayer } from "../painter";
import type { ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const SPEED_BASE = 85;
const SPEED_MAX = 150;
const SPEED_DECAY = 12;
const LAP_DIST = 500;
const GATE_BOOST = 12;
const ESCAPE_BOOST = 5;
const GOLD_ESCAPE_BOOST = 18;
const NEAR_MISS_BOOST = 4;

interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
}

export class StormMode extends BaseMode {
  private meteors: Enemy[] = [];
  private gates: Gate[] = [];
  private nextId = 1;
  private spawnTimer = 0.8;
  private gateTimer = 1;
  private distTick = 0;
  private distance = 0;
  private lap = 1;
  private speed = SPEED_BASE;

  protected get palette(): ChapterDef {
    return {
      name: "METEOR YARIŞI",
      top: "#2b1608",
      mid: "#180b04",
      bottom: "#060301",
      star: "#ffd9a8",
      starSpeed: 1.9,
      nebulas: [{ x: 0.2, y: 0.7, r: 0.6, color: "rgba(255,120,50,0.08)" }],
      rocks: 5,
      rockColor: "#7a4630",
      rockSpeed: 130,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "storm");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.meteors = [];
    this.gates = [];
    this.spawnTimer = 0.8;
    this.gateTimer = 1;
    this.distTick = 0;
    this.distance = 0;
    this.lap = 1;
    this.speed = SPEED_BASE;
    this.setBanner("YARIŞ BAŞLADI!", `HEDEF ${LAP_DIST} m`);
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.gates = [];
    this.player = this.makePlayer();
  }

  protected updateSub(dt: number): void {
    this.moveShip(dt);
    this.spawnThruster("#ffcf8a");

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    this.speed = Math.max(SPEED_BASE, this.speed - SPEED_DECAY * dt);
    const ratio = this.speed / SPEED_BASE;

    this.distance += this.speed * dt;
    this.distTick += dt;
    if (this.distTick >= 0.25) {
      this.distTick -= 0.25;
      this.bumpScore(Math.round(this.distance));
    }

    if (this.distance >= this.lap * LAP_DIST) {
      this.lap++;
      this.level = this.lap;
      this.cbs.onLevel(this.lap);
      this.bumpCombo();
      this.speed = Math.min(SPEED_MAX, this.speed + 45);
      this.audio.levelUp();
      this.flash = Math.max(this.flash, 0.35);
      this.addHitStop(0.04);
      this.setBanner(`TÜR ${this.lap}`, `HEDEF ${(this.lap + 1) * LAP_DIST} m`);
    }

    this.gateTimer -= dt;
    if (this.gateTimer <= 0) {
      this.gateTimer = 1.15 - Math.min(0.75, (this.lap - 1) * 0.07);
      this.spawnGate();
    }
    for (const g of this.gates) {
      g.y += 150 * ratio * dt;
      if (g.y > this.H + 40) {
        g.alive = false;
      } else if (
        this.overlaps(g.x, g.y, g.w, g.h, p.x, p.y, p.w * 1.1, p.h * 1.1)
      ) {
        g.alive = false;
        const boost = GATE_BOOST + this.lap * 2;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.addPopup(g.x, g.y - 18, `İVME +${boost}`, "#ffe08a", 15);
        this.explode(g.x, g.y, "#ffe08a", 10, 4, 90);
        this.audio.powerup();
        this.addHitStop(0.025);
        this.vibrate(12);
        this.bumpCombo();
        this.flash = Math.max(this.flash, 0.12);
      }
    }
    this.gates = this.gates.filter((g) => g.alive);

    const inter = Math.max(0.34, 1.05 - (this.lap - 1) * 0.06);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = inter * (0.7 + Math.random() * 0.6);
      this.pushMeteor(ratio);
    }

    const mult = 1 + (this.lap - 1) * 0.1;
    for (const m of this.meteors) {
      m.rot += m.rotSpeed * dt;
      m.y += m.vy * dt;
      m.wobble += m.wobbleSpeed * dt;
      m.x = m.baseX + Math.sin(m.wobble * 2) * 12 * mult;
      if (m.y > this.H + 60) {
        m.alive = false;
        const boost = m.gold ? GOLD_ESCAPE_BOOST : ESCAPE_BOOST;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.addPopup(
          m.x,
          this.H - 30,
          m.gold ? `ALTIN +${boost} HIZ` : `RÜZGAR +${boost}`,
          m.gold ? "#ffd166" : "#ffc987",
          m.gold ? 16 : 13,
        );
        this.bumpCombo();
        this.addHitStop(m.gold ? 0.05 : 0.02);
        this.vibrate(m.gold ? 26 : 12);
      } else if (
        p.invincible <= 0 &&
        this.overlaps(m.x, m.y, m.w, m.h, p.x, p.y, p.w * 0.7, p.h * 0.7)
      ) {
        m.alive = false;
        this.explode(m.x, m.y, "#ff9f43", 18, 10, 170);
        this.speed = SPEED_BASE;
        this.registerHit();
      } else if (this.applyNearMiss(m, 25, "ÇOK YAKIN!", "#ffe08a")) {
        this.speed = Math.min(SPEED_MAX, this.speed + NEAR_MISS_BOOST);
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 300);
  }

  private moveShip(dt: number): void {
    const p = this.player;
    const prevX = p.x;
    const speed = PLAYER_SPEED * 0.95;
    let dx = 0;
    let dy = 0;
    if (this.hasPointer) {
      dx = this.pointerX - p.x;
      dy = this.pointerY - p.y;
    } else {
      if (this.keys.has("arrowleft") || this.keys.has("a")) dx = -1;
      if (this.keys.has("arrowright") || this.keys.has("d")) dx = 1;
      if (this.keys.has("arrowup") || this.keys.has("w")) dy = -1;
      if (this.keys.has("arrowdown") || this.keys.has("s")) dy = 1;
    }
    const mag = Math.hypot(dx, dy);
    if (mag > 2) {
      p.x += (dx / mag) * speed * dt;
      p.y += (dy / mag) * speed * dt;
    }
    p.x = clamp(p.x, p.w / 2, this.W - p.w / 2);
    p.y = clamp(p.y, 40, this.H - 30);
    p.vx = dt > 0 ? (p.x - prevX) / dt : 0;
    const targetTilt = clamp((p.vx / PLAYER_SPEED) * 0.5, -0.5, 0.5);
    p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 10);
  }

  private spawnGate(): void {
    const size = 34;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.gates.push({
      x: clamp(this.W / 2 + side * (40 + Math.random() * this.W * 0.28), size / 2, this.W - size / 2),
      y: -size - 24,
      w: size,
      h: size * 0.7,
      alive: true,
    });
  }

  private pushMeteor(ratio: number): void {
    const def = ENEMY_DEFS.meteor;
    const mult = 1 + (this.lap - 1) * 0.1;
    const x = def.w / 2 + Math.random() * Math.max(0, this.W - def.w);
    this.meteors.push({
      id: this.nextId++,
      kind: "meteor",
      x,
      y: -def.h - 10,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.8 + Math.random() * 0.5) * ratio * 1.4,
      alive: true,
      hp: ENEMY_DEFS.meteor.hp,
      baseX: x,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 1.4,
      shootTimer: 9,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: 0.8 + Math.random() * 1.8,
      flash: 0,
      dive: false,
      gold: Math.random() < 0.13,
      nearMissed: false,
    });
  }

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    if (this.speed > SPEED_BASE * 1.12) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#ffd9a8";
      for (let i = 0; i < 9; i++) {
        const h = (Math.sin(i * 127.1) * 43758.5453) % 1;
        const x = Math.abs(h) * this.W;
        const len = 26 + (h * 1000) % 60;
        ctx.lineWidth = 1.2;
        const yTop = -(((this.time * 500 + ((i * 71 + 40) % 500)) % (this.H + 140))) + (this.H - (h * 1000) % 160);
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yTop + len);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const g of this.gates) this.drawGate(ctx, g);
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
  }

  private drawGate(ctx: CanvasRenderingContext2D, g: Gate): void {
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 7 + g.x);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.globalAlpha = 0.35 + pulse * 0.65;
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 14;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * g.w * 0.45, -g.h * 0.5);
      ctx.lineTo(k * g.w * 0.9, 0);
      ctx.lineTo(k * g.w * 0.45, g.h * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}