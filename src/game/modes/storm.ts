import { ENEMY_DEFS } from "../defs";
import { paintEnemy, paintPlayer } from "../painter";
import type { ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const SPEED_BASE = 90;
const SPEED_MAX = 175;
const SPEED_DECAY = 14;
const LAP_DIST = 350;
const NITRO_MAX = 100;
const PLAYER_Y = 0.82; // fraction down the screen

interface Gate {
  lane: number;
  y: number;
  alive: boolean;
  gold: boolean;
}

interface Orb {
  lane: number;
  y: number;
  alive: boolean;
  gold: boolean;
  phase: number;
}

interface Rival {
  name: string;
  color: string;
  lane: number;
  offset: number;
  dist: number;
  speed: number;
  baseSpeed: number;
  passed: boolean;
  y: number;
}

const RIVALS: { name: string; color: string; baseSpeed: number; lane: number }[] = [
  { name: "KYRA", color: "#ff5d8f", baseSpeed: 100, lane: 0 },
  { name: "VEX", color: "#ffab3c", baseSpeed: 106, lane: 1 },
  { name: "ZORB", color: "#7cff5d", baseSpeed: 112, lane: 2 },
];

export class StormMode extends BaseMode {
  private meteors: Enemy[] = [];
  private gates: Gate[] = [];
  private orbs: Orb[] = [];
  private rivals: Rival[] = [];
  private nextId = 1;
  private spawnTimer = 0.8;
  private gateTimer = 1;
  private orbTimer = 0.15;
  private distTick = 0;
  private distance = 0;
  private lap = 1;
  private speed = SPEED_BASE;
  private nitro = 0;
  private boosting = false;
  private boostTimer = 0;
  private pos = 1;
  private lanes = 3;
  private laneIdx = 1; // start middle

  protected get palette(): ChapterDef {
    return {
      name: "METEOR YARIŞI",
      top: "#2b1608",
      mid: "#180b04",
      bottom: "#060301",
      star: "#ffd9a8",
      starSpeed: 2.2,
      nebulas: [{ x: 0.2, y: 0.7, r: 0.6, color: "rgba(255,120,50,0.08)" }],
      rocks: 6,
      rockColor: "#7a4630",
      rockSpeed: 160,
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
    this.orbTimer = 0.15;
    this.distTick = 0;
    this.distance = 0;
    this.lap = 1;
    this.speed = SPEED_BASE;
    this.nitro = 0;
    this.boosting = false;
    this.boostTimer = 0;
    this.pos = 1;
    this.laneIdx = 1;
    this.rivals = RIVALS.map((r) => ({
      name: r.name,
      color: r.color,
      lane: r.lane,
      offset: (r.baseSpeed - SPEED_BASE) * 2,
      dist: r.baseSpeed * 3,
      speed: r.baseSpeed,
      baseSpeed: r.baseSpeed,
      passed: false,
      y: -30,
    }));
    this.setBanner("YARIŞ BAŞLADI!", "3 ŞERİTTE RAKİPLERİ GEÇ");
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.gates = [];
    this.orbs = [];
    this.rivals = [];
    this.player = this.makePlayer();
    this.player.y = this.H * PLAYER_Y;
  }

  protected updateSub(dt: number): void {
    this.updateLane(dt);
    this.spawnThruster(this.boosting ? "#7cf9ff" : "#ffcf8a");

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Nitro boost
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

    this.updateRivals(dt);
    this.distTick += dt;
    if (this.distTick >= 0.25) {
      this.distTick -= 0.25;
      const speedMult = 1 + (this.speed - SPEED_BASE) / 60;
      this.bumpScore(Math.round(this.distance * speedMult));
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
      this.gateTimer = (1.35 - Math.min(0.75, (this.lap - 1) * 0.08)) * (0.7 + Math.random() * 0.5);
      this.spawnGate();
    }
    this.updateGates(dt, ratio);

    this.orbTimer -= dt;
    if (this.orbTimer <= 0) {
      this.orbTimer = 1.6;
      this.spawnOrb();
    }
    this.updateOrbs(dt, ratio);

    const inter = Math.max(0.5, 1.35 - (this.lap - 1) * 0.07);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = inter * (0.6 + Math.random() * 0.7);
      this.pushMeteor(ratio);
    }
    this.updateMeteors(dt);
  }

  private updateGates(dt: number, ratio: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    for (const g of this.gates) {
      g.y += 170 * ratio * dt;
      const centerX = laneXs[g.lane];
      if (g.y > this.H + 60) {
        g.alive = false;
      } else if (this.overlaps(centerX, g.y, 26, 30, p.x, p.y, p.w, p.h)) {
        g.alive = false;
        this.nitro = Math.min(NITRO_MAX, this.nitro + (g.gold ? 60 : 40));
        const boost = g.gold ? 18 : 10;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.bumpScore(g.gold ? 250 : 0);
        this.addPopup(centerX, g.y - 18, g.gold ? `ALTIN HALKAYA! +${boost}` : `NİTRO +40`, g.gold ? "#ffd166" : "#9be8ff", g.gold ? 16 : 14);
        this.explode(centerX, g.y, g.gold ? "#ffd166" : "#9be8ff", 12, 4, 100);
        this.audio.powerup();
        this.addHitStop(0.025);
        this.vibrate(12);
        this.bumpCombo();
        this.flash = Math.max(this.flash, 0.12);
      }
    }
    this.gates = this.gates.filter((g) => g.alive);
  }

  private updateOrbs(dt: number, ratio: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    for (const o of this.orbs) {
      o.phase += 3 * dt;
      o.y += 155 * ratio * dt;
      const centerX = laneXs[o.lane];
      if (o.y > this.H + 30) {
        o.alive = false;
      } else if (this.overlaps(centerX, o.y, o.gold ? 22 : 16, o.gold ? 22 : 16, p.x, p.y, p.w, p.h)) {
        o.alive = false;
        this.nitro = Math.min(NITRO_MAX, this.nitro + (o.gold ? 30 : 14));
        this.bumpScore(o.gold ? 150 : 40);
        this.addPopup(centerX, o.y, o.gold ? `ALTIN +NİTRO` : `+40`, o.gold ? "#ffd166" : "#8dffb0", o.gold ? 16 : 13);
        this.explode(centerX, o.y, o.gold ? "#ffd166" : "#8dffb0", 8, 4, 80);
        this.audio.powerup();
        this.vibrate(o.gold ? 18 : 10);
        this.bumpCombo();
      }
    }
    this.orbs = this.orbs.filter((o) => o.alive);
  }

  private updateMeteors(dt: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    const mult = 1 + (this.lap - 1) * 0.1;
    for (const m of this.meteors) {
      m.rot += m.rotSpeed * dt;
      m.y += m.vy * dt;
      m.wobble += m.wobbleSpeed * dt;
      m.x = laneXs[m.lane ?? 1] + Math.sin(m.wobble * 2) * 8 * mult;
      if (m.y > this.H + 60) {
        m.alive = false;
        const boost = m.gold ? 14 : 4;
        this.speed = Math.min(SPEED_MAX, this.speed + boost);
        this.addPopup(m.x, this.H - 30, m.gold ? `ALTIN RÜZGAR +${boost}` : `RÜZGAR +${boost}`, m.gold ? "#ffd166" : "#ffc987", m.gold ? 15 : 12);
        this.bumpCombo();
        this.vibrate(m.gold ? 20 : 10);
      } else if (
        p.invincible <= 0 &&
        this.overlaps(m.x, m.y, m.w, m.h, p.x, p.y, p.w * 0.7, p.h * 0.7)
      ) {
        m.alive = false;
        this.explode(m.x, m.y, "#ff9f43", 18, 10, 170);
        this.speed = Math.max(SPEED_BASE, this.speed - 22);
        this.registerHit();
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 300);
  }

  private updateRivals(dt: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    for (const r of this.rivals) {
      r.speed = r.baseSpeed - (this.lap - 1) * 3;
      r.dist += r.speed * dt;
      // Rivals drive ahead of player; show them if not overtaken yet
      r.y = p.y - (r.dist - this.distance) * 1.3;
      // passed when their screen y crosses the player's fixed y
      if (!r.passed && r.y >= p.y) {
        r.passed = true;
        this.bumpScore(300);
        this.nitro = Math.min(NITRO_MAX, this.nitro + 30);
        this.bumpCombo();
        this.addPopup(laneXs[r.lane], p.y - 20, `GEÇİLDİ +300`, "#3dffa0", 16);
        this.vibrate(20);
        this.flash = Math.max(this.flash, 0.2);
      }
      // Draft: rival just ahead in the lane directly in front
      if (!r.passed && Math.abs(r.dist - this.distance) < 30 && Math.abs(r.y - p.y) < 20) {
        this.nitro = Math.min(NITRO_MAX, this.nitro + 22 * dt);
      }
    }
    const rank: { dist: number; player?: boolean }[] = [{ dist: this.distance, player: true }];
    for (const r of this.rivals) rank.push({ dist: r.dist });
    rank.sort((a, b) => b.dist - a.dist);
    this.pos = rank.findIndex((x) => x.player) + 1;
    if (this.pos < 1) this.pos = 1;
  }

  // ---- Lane input: swipe / arrows to change lane ----

  private updateLane(dt: number): void {
    if (this.keys.has("arrowleft") || this.keys.has("a")) {
      this.requestLane(this.laneIdx - 1);
    }
    if (this.keys.has("arrowright") || this.keys.has("d")) {
      this.requestLane(this.laneIdx + 1);
    }
    if (this.pointerLaneTarget !== null && this.pointerLaneTarget !== this.laneIdx) {
      this.laneIdx = this.pointerLaneTarget;
      this.pointerLaneTarget = null;
    }
    const targetX = this.lanePos(this.laneIdx);
    this.player.x += (targetX - this.player.x) * Math.min(1, dt * 14);
    const tilt = clamp((this.player.x - targetX) * 0.01, -0.4, 0.4);
    this.player.tilt += (tilt - this.player.tilt) * Math.min(1, dt * 12);
  }

  private requestLane(idx: number): void {
    this.laneIdx = clamp(idx, 0, this.lanes - 1);
  }

  private pointerLaneTarget: number | null = null;
  private swipeStartX = 0;
  private swipeActive = false;

  protected onPointerDownHook(): void {
    this.swipeStartX = this.pointerX;
    this.swipeActive = true;
    this.pointerLaneTarget = null;
  }

  // Hook called on pointer move while down
  protected onPointerMoveHook(): void {
    if (!this.swipeActive) return;
    const dx = this.pointerX - this.swipeStartX;
    if (dx < -24) {
      this.pointerLaneTarget = clamp(this.laneIdx - 1, 0, this.lanes - 1);
    } else if (dx > 24) {
      this.pointerLaneTarget = clamp(this.laneIdx + 1, 0, this.lanes - 1);
    }
  }

  protected onPointerUpHook(): void {
    this.swipeActive = false;
    this.tryBoost();
  }

  private lanePos(idx: number): number {
    return this.W / 2 + (idx - 1) * this.W * 0.28;
  }

  private laneXs(): number[] {
    return [0, 1, 2].map((i) => this.lanePos(i));
  }

  private tryBoost(): void {
    if (this.nitro >= 25 && !this.boosting && !this.swipeActive) {
      this.boosting = true;
      this.boostTimer = 0.8;
      this.nitro -= 25;
      this.audio.powerup();
      this.addPopup(this.player.x, this.player.y - 30, "NİTRO!", "#7cf9ff", 18);
      this.shake = Math.min(14, this.shake + 8);
    }
  }

  private spawnGate(): void {
    const lane = Math.floor(Math.random() * this.lanes);
    const gold = Math.random() < 0.16;
    this.gates.push({ lane, y: -40, alive: true, gold });
  }

  private spawnOrb(): void {
    const gold = Math.random() < 0.14;
    this.orbs.push({ lane: Math.floor(Math.random() * this.lanes), y: -20, alive: true, gold, phase: Math.random() * Math.PI * 2 });
  }

  private pushMeteor(ratio: number): void {
    const lane = Math.floor(Math.random() * this.lanes);
    const laneX = this.lanePos(lane);
    const def = ENEMY_DEFS.meteor;
    const mult = 1 + (this.lap - 1) * 0.1;
    this.meteors.push({
      id: this.nextId++,
      kind: "meteor",
      x: laneX,
      y: -def.h - 10,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.8 + Math.random() * 0.45) * ratio * 1.5,
      alive: true,
      hp: ENEMY_DEFS.meteor.hp,
      baseX: laneX,
      lane,
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
    this.drawTrack(ctx);
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
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    for (const r of this.rivals) this.drawRival(ctx, r);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
    this.drawHud(ctx);
  }

  private drawTrack(ctx: CanvasRenderingContext2D): void {
    const ratio = this.speed / SPEED_BASE;
    const dash = 44 * ratio * (this.boosting ? 1.8 : 1);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffc987";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = this.W / 2 + (i - 1.5) * this.W * 0.28;
      ctx.setLineDash([dash, 46]);
      ctx.lineDashOffset = -this.time * 320 * ratio;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x, this.H + 20);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Active lane highlight
    const laneXs = this.laneXs();
    const activeX = laneXs[this.laneIdx];
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#9be8ff";
    ctx.fillRect(activeX - this.W * 0.14, 0, this.W * 0.28, this.H);
    ctx.restore();

    // Nitro-ready pulsing ring
    if (this.nitro >= 25 && this.player.alive) {
      const p = this.player;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
      ctx.save();
      ctx.globalAlpha = 0.25 + pulse * 0.4;
      ctx.strokeStyle = "#7cf9ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#7cf9ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawGate(ctx: CanvasRenderingContext2D, g: Gate): void {
    const x = this.lanePos(g.lane);
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 7 + x);
    ctx.save();
    ctx.translate(x, g.y);
    ctx.globalAlpha = 0.35 + pulse * 0.65;
    ctx.strokeStyle = g.gold ? "#ffd166" : "#9be8ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = g.gold ? "#ffd166" : "#7cf9ff";
    ctx.shadowBlur = 16;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * 14, -15);
      ctx.lineTo(k * 26, 0);
      ctx.lineTo(k * 14, 15);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawOrb(ctx: CanvasRenderingContext2D, o: Orb): void {
    const x = this.lanePos(o.lane);
    const pulse = 0.7 + 0.3 * Math.sin(o.phase);
    ctx.save();
    ctx.translate(x, o.y);
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = o.gold ? "#ffd166" : "#8dffb0";
    ctx.shadowColor = o.gold ? "#ffd166" : "#8dffb0";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, (o.gold ? 11 : 8) * (0.8 + pulse * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRival(ctx: CanvasRenderingContext2D, r: Rival): void {
    const x = this.lanePos(r.lane);
    const y = r.y;
    if (y < -60 || y > this.H + 60) return;
    const wob = Math.sin(this.time * 5 + r.speed) * 0.03;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob);
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 12;

    // rear engine glow
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(this.time * 12 + r.speed);
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(-5, 15);
    ctx.lineTo(0, 26);
    ctx.lineTo(5, 15);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // wings
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-24, 10);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(24, 10);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();

    // fuselage
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#23273a";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(8, -2);
    ctx.lineTo(6, 14);
    ctx.lineTo(-6, 14);
    ctx.lineTo(-8, -2);
    ctx.closePath();
    ctx.fill();

    // cockpit canopy
    ctx.fillStyle = "#9be8ff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(4, -6);
    ctx.lineTo(-4, -6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // wingtip lights
    ctx.fillStyle = r.color;
    ctx.fillRect(-24, 8, 3, 3);
    ctx.fillRect(21, 8, 3, 3);

    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.name, x, y + 34);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
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

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(this.speed)} h`, this.W - 14, 20);

    const rankLabel = ["1.", "2.", "3.", "4."][Math.min(this.pos - 1, 3)];
    ctx.fillStyle = this.pos === 1 ? "#ffd166" : "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${rankLabel}`, bx, 40);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`TÜR ${this.lap}  •  ${Math.round(this.distance)}m`, this.W / 2, 40);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
