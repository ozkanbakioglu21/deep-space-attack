import { ENEMY_DEFS } from "../defs";
import { PLAYER_SPEED } from "../constants";
import { paintEnemy, paintPlayer } from "../painter";
import type { ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const SPEED_BASE = 80;
const SPEED_MAX = 165;
const SPEED_DECAY = 16;
const LAP_DIST = 400;
const GATE_BOOST = 10;
const ORB_BOOST = 6;
const GOLD_ORB_BOOST = 14;
const NEAR_MISS_BOOST = 4;
const NITRO_MAX = 100;

interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
}

interface Orb {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  gold: boolean;
  phase: number;
}

interface Rival {
  name: string;
  x: number;
  y: number;
  dist: number;
  speed: number;
  baseSpeed: number;
  targetLane: number;
  turb: number;
  alive: boolean;
  passed: boolean;
  color: string;
}

const RIVALS: { name: string; color: string; baseSpeed: number }[] = [
  { name: "KYRA", color: "#ff5d8f", baseSpeed: 95 },
  { name: "VEX", color: "#ffab3c", baseSpeed: 102 },
  { name: "ZORB", color: "#7cff5d", baseSpeed: 108 },
];

export class StormMode extends BaseMode {
  private meteors: Enemy[] = [];
  private gates: Gate[] = [];
  private orbs: Orb[] = [];
  private rivals: Rival[] = [];
  private nextId = 1;
  private spawnTimer = 0.8;
  private gateTimer = 1;
  private orbTimer = 0.2;
  private distTick = 0;
  private distance = 0;
  private lap = 1;
  private speed = SPEED_BASE;
  private nitro = 0;
  private boosting = false;
  private boostTimer = 0;
  private pos = 1; // 1-based rank

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
    this.orbs = [];
    this.spawnTimer = 0.8;
    this.gateTimer = 1;
    this.orbTimer = 0.2;
    this.distTick = 0;
    this.distance = 0;
    this.lap = 1;
    this.speed = SPEED_BASE;
    this.nitro = 0;
    this.boosting = false;
    this.boostTimer = 0;
    this.pos = 1;
    this.rivals = RIVALS.map((r) => ({
      name: r.name,
      color: r.color,
      baseSpeed: r.baseSpeed,
      speed: r.baseSpeed,
      dist: r.baseSpeed * 0.6,
      targetLane: 0,
      x: 40 + Math.random() * (this.W - 80),
      y: -20,
      turb: 0,
      alive: true,
      passed: false,
    })).map((r, i) => ({ ...r, targetLane: (i - 1) * 0.8 }));
    this.setBanner("YARIŞ BAŞLADI!", `RAKİPLER SENİ BEKLİYOR`);
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.gates = [];
    this.orbs = [];
    this.rivals = [];
    this.player = this.makePlayer();
  }

  protected updateSub(dt: number): void {
    this.moveShip(dt);
    this.spawnThruster(this.boosting ? "#7cf9ff" : "#ffcf8a");

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Nitro boost handling
    if (this.boosting && this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) this.boosting = false;
      this.speed = Math.min(SPEED_MAX + 60, this.speed + 60);
      this.shake = Math.min(14, this.shake + 10);
    } else {
      this.speed = Math.max(SPEED_BASE, this.speed - SPEED_DECAY * dt);
    }

    const ratio = this.speed / SPEED_BASE;
    this.distance += this.speed * dt;

    // Rival movement & rank
    this.updateRivals(dt);
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
      this.speed = Math.min(SPEED_MAX, this.speed + 30);
      this.audio.levelUp();
      this.flash = Math.max(this.flash, 0.35);
      this.addHitStop(0.04);
      this.setBanner(`TÜR ${this.lap}`, `HEDEF ${(this.lap + 1) * LAP_DIST} m`);
    }

    this.gateTimer -= dt;
    if (this.gateTimer <= 0) {
      this.gateTimer = 1.2 - Math.min(0.75, (this.lap - 1) * 0.07);
      this.spawnGate();
    }
    for (const g of this.gates) {
      g.y += 150 * ratio * dt;
      if (g.y > this.H + 40) {
        g.alive = false;
      } else if (
        this.overlaps(g.x, g.y, g.w, g.h, p.x, p.y, p.w * 1.15, p.h * 1.15)
      ) {
        g.alive = false;
        this.nitro = Math.min(NITRO_MAX, this.nitro + 40);
        const boost = GATE_BOOST + this.lap;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.addPopup(g.x, g.y - 18, `NİTRO +40`, "#9be8ff", 15);
        this.explode(g.x, g.y, "#9be8ff", 10, 4, 90);
        this.audio.powerup();
        this.addHitStop(0.025);
        this.vibrate(12);
        this.bumpCombo();
        this.flash = Math.max(this.flash, 0.12);
      }
    }
    this.gates = this.gates.filter((g) => g.alive);

    this.orbTimer -= dt;
    if (this.orbTimer <= 0) {
      this.orbTimer = 1.4;
      this.spawnOrb();
    }
    for (const o of this.orbs) {
      o.phase += 3 * dt;
      o.y += 155 * ratio * dt;
      if (o.y > this.H + 30) {
        o.alive = false;
      } else if (
        this.overlaps(o.x, o.y, o.w, o.h, p.x, p.y, p.w, p.h)
      ) {
        o.alive = false;
        const boost = o.gold ? GOLD_ORB_BOOST : ORB_BOOST;
        this.nitro = Math.min(NITRO_MAX, this.nitro + (o.gold ? 30 : 12));
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.bumpScore(o.gold ? 150 : 40);
        this.addPopup(o.x, o.y, o.gold ? `ALTIN +${boost} HIZ` : `+${boost}`, o.gold ? "#ffd166" : "#8dffb0", o.gold ? 16 : 13);
        this.explode(o.x, o.y, o.gold ? "#ffd166" : "#8dffb0", 8, 4, 80);
        this.audio.powerup();
        this.vibrate(o.gold ? 18 : 10);
        this.bumpCombo();
      }
    }
    this.orbs = this.orbs.filter((o) => o.alive);

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
        const boost = m.gold ? 16 : 4;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.addPopup(m.x, this.H - 30, m.gold ? `ALTIN +${boost} HIZ` : `RÜZGAR +${boost}`, m.gold ? "#ffd166" : "#ffc987", m.gold ? 16 : 13);
        this.bumpCombo();
        this.addHitStop(m.gold ? 0.05 : 0.02);
        this.vibrate(m.gold ? 26 : 12);
      } else if (
        p.invincible <= 0 &&
        this.overlaps(m.x, m.y, m.w, m.h, p.x, p.y, p.w * 0.7, p.h * 0.7)
      ) {
        m.alive = false;
        this.explode(m.x, m.y, "#ff9f43", 18, 10, 170);
        this.speed = Math.max(SPEED_BASE, this.speed - 24);
        this.registerHit();
      } else if (this.applyNearMiss(m, 25, "ÇOK YAKIN!", "#ffe08a")) {
        this.speed = Math.min(SPEED_MAX, this.speed + NEAR_MISS_BOOST);
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 300);
  }

  private updateRivals(dt: number): void {
    const p = this.player;
    for (const r of this.rivals) {
      if (!r.alive) continue;
      r.turb += (Math.random() - 0.5) * 14 * dt;
      r.turb = Math.max(-8, Math.min(8, r.turb));
      r.speed = Math.max(70, r.baseSpeed + (Math.sin(this.time * 0.6 + r.baseSpeed) * 14) + r.turb * 0.2 - (this.lap - 1) * 4);
      r.dist += r.speed * dt;
      r.x += (this.W / 2 + r.targetLane * this.W * 0.28 - r.x) * Math.min(1, dt * 1.4);
      r.y = this.H * 0.35 + ((r.dist % 60) / 60) * this.H * 0.25;

      // Overtake check: rival overlaps player
      if (!r.passed && r.y >= p.y && this.overlaps(r.x, r.y, 40, 30, p.x, p.y, p.w, p.h)) {
        r.passed = true;
        this.bumpScore(300);
        this.bumpCombo();
        this.addPopup(r.x, r.y - 20, `GEÇİLDİ +300`, "#3dffa0", 16);
        this.vibrate(20);
        this.flash = Math.max(this.flash, 0.2);
      }
    }
    // Rank by distance among all racers
    interface RankEntry { dist: number; player?: boolean }
    const rank: RankEntry[] = [{ dist: this.distance, player: true }];
    for (const r of this.rivals) rank.push({ dist: r.dist });
    rank.sort((a, b) => b.dist - a.dist);
    this.pos = rank.findIndex((x) => x.player) + 1;
    if (this.pos < 1) this.pos = 1;
  }

  private moveShip(dt: number): void {
    const p = this.player;
    const prevX = p.x;
    const speed = PLAYER_SPEED * 1.0;
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

  private tryBoost(): void {
    if (this.nitro >= 25 && !this.boosting) {
      this.boosting = true;
      this.boostTimer = 0.8;
      this.nitro -= 25;
      this.audio.powerup();
      this.addPopup(this.player.x, this.player.y - 30, "NİTRO!", "#7cf9ff", 18);
      this.shake = Math.min(14, this.shake + 8);
    }
  }

  private spawnGate(): void {
    const size = 34;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.gates.push({
      x: clamp(this.W / 2 + side * (40 + Math.random() * this.W * 0.3), size / 2, this.W - size / 2),
      y: -size - 24,
      w: size,
      h: size * 0.7,
      alive: true,
    });
  }

  private spawnOrb(): void {
    const gold = Math.random() < 0.14;
    const size = gold ? 20 : 14;
    this.orbs.push({
      x: clamp(size / 2 + Math.random() * (this.W - size), size / 2, this.W - size / 2),
      y: -size - 10,
      w: size,
      h: size,
      alive: true,
      gold,
      phase: Math.random() * Math.PI * 2,
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
    if (this.speed > SPEED_BASE * 1.12 || this.boosting) {
      ctx.save();
      ctx.globalAlpha = this.boosting ? 0.75 : 0.55;
      ctx.strokeStyle = this.boosting ? "#7cf9ff" : "#ffd9a8";
      for (let i = 0; i < 11; i++) {
        const h = (Math.sin(i * 127.1) * 43758.5453) % 1;
        const x = Math.abs(h) * this.W;
        const len = 26 + (h * 1000) % 60;
        ctx.lineWidth = this.boosting ? 2.2 : 1.2;
        const yTop = -(((this.time * (this.boosting ? 900 : 500) + ((i * 71 + 40) % 500)) % (this.H + 140))) + (this.H - (h * 1000) % 160);
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yTop + len);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const g of this.gates) this.drawGate(ctx, g);
    for (const o of this.orbs) this.drawOrb(ctx, o);
    for (const r of this.rivals) this.drawRival(ctx, r);
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
    this.drawHud(ctx);
  }

  private drawGate(ctx: CanvasRenderingContext2D, g: Gate): void {
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 7 + g.x);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.globalAlpha = 0.35 + pulse * 0.65;
    ctx.strokeStyle = "#9be8ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#7cf9ff";
    ctx.shadowBlur = 16;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * g.w * 0.45, -g.h * 0.5);
      ctx.lineTo(k * g.w * 0.9, 0);
      ctx.lineTo(k * g.w * 0.45, g.h * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawOrb(ctx: CanvasRenderingContext2D, o: Orb): void {
    const pulse = 0.7 + 0.3 * Math.sin(o.phase);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = o.gold ? "#ffd166" : "#8dffb0";
    ctx.shadowColor = o.gold ? "#ffd166" : "#8dffb0";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, o.w / 2 * (0.8 + pulse * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRival(ctx: CanvasRenderingContext2D, r: Rival): void {
    if (!r.alive) return;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(Math.sin(this.time * 6 + r.speed) * 0.06);
    ctx.fillStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.name, 0, 26);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    // Nitro bar
    const bw = this.W - 24;
    const bx = 12;
    const by = 12;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#000";
    ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.restore();
    const frac = clamp(this.nitro / NITRO_MAX, 0, 1);
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = "#7cf9ff";
    ctx.fillRect(bx, by, bw * frac, 8);
    const ready = this.nitro >= 25;
    ctx.fillStyle = ready ? "#7cf9ff" : "rgba(255,255,255,0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(ready ? "NİTRO HAZIR" : "NİTRO", bx, by - 5);

    // Speed
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(this.speed)} h`, this.W - 14, 20);

    // Rank
    const rankLabel = ["1.", "2.", "3.", "4."][Math.min(this.pos - 1, 3)];
    ctx.fillStyle = this.pos === 1 ? "#ffd166" : "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${rankLabel}`, bx, 40);

    // Lap / distance (upper center under nitro)
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`TÜR ${this.lap}  •  ${Math.round(this.distance)}m`, this.W / 2, 40);
  }

  protected onPointerDownHook(): void {
    this.tryBoost();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
