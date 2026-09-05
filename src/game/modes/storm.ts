import { paintPlayer } from "../painter";
import type { ChapterDef, GameCallbacks } from "../types";
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

interface Traffic {
  lane: number;
  y: number;
  kind: number;
  w: number;
  h: number;
  wobble: number;
  alive: boolean;
  nearMissed: boolean;
}

const TRAFFIC_STYLES: { body: string; accent: string }[] = [
  { body: "#5a4636", accent: "#ffb347" },
  { body: "#38455f", accent: "#4fd0ff" },
  { body: "#3a5a38", accent: "#a0ff5d" },
  { body: "#5a385a", accent: "#ff7ce0" },
];

export class StormMode extends BaseMode {
  private gates: Gate[] = [];
  private orbs: Orb[] = [];
  private traffic: Traffic[] = [];
  private trafficTimer = 1.4;
  private gateTimer = 1;
  private orbTimer = 0.15;
  private distTick = 0;
  private distance = 0;
  private lap = 1;
  private speed = SPEED_BASE;
  private nitro = 0;
  private boosting = false;
  private countdown = 0;
  private surge = 0;
  private surgeTimer = 14;
  private surgeCd = 10;
  private comboHeat = 0;
  private lastMult = 1;
  private lanes = 3;
  private laneIdx = 1; // start middle
  private invertLeft = 0;
  private invertCooldown = 8;

  protected get palette(): ChapterDef {
    return {
      name: "METEOR YARIŞI",
      top: "#2b1608",
      mid: "#180b04",
      bottom: "#060301",
      star: "#ffd9a8",
      starSpeed: 2.2,
      nebulas: [{ x: 0.2, y: 0.7, r: 0.6, color: "rgba(255,120,50,0.08)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "storm");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.gates = [];
    this.orbs = [];
    this.traffic = [];
    this.trafficTimer = 1.4;
    this.gateTimer = 1;
    this.orbTimer = 0.15;
    this.distTick = 0;
    this.distance = 0;
    this.lap = 1;
    this.speed = SPEED_BASE;
    this.nitro = 0;
    this.boosting = false;
    this.countdown = 3.0;
    this.surge = 0;
    this.surgeTimer = 0;
    this.surgeCd = 11;
    this.comboHeat = 0;
    this.lastMult = 1;
    this.laneIdx = 1;
    this.invertLeft = 0;
    this.invertCooldown = 8;
    this.leftDown = false;
    this.rightDown = false;
    this.wasTurboHeld = false;
    this.setBanner("YARIŞ BAŞLADI!", "3 ŞERİTTEN GEÇ");
  }

  protected resetIdle(): void {
    this.gates = [];
    this.orbs = [];
    this.traffic = [];
    this.player = this.makePlayer();
    this.player.y = this.H * PLAYER_Y;
  }

  protected updateSub(dt: number): void {
    this.updateLane(dt);
    this.spawnThruster(this.boosting ? "#ff6a1a" : this.surge > 0 ? "#ffd166" : "#ffcf8a");

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Countdown: 3-2-1 then GO (freeze the race until GO)
    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after < before && after >= 1) this.audio.countBeep(false);
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.audio.countBeep(true);
        this.setBanner("BAŞLA!", null, 0.9);
        this.flash = Math.max(this.flash, 0.6);
        this.shake = Math.min(12, this.shake + 8);
      }
      return;
    }

    // Inverted controls window (TERS TUR)
    if (this.invertLeft > 0) {
      this.invertLeft -= dt;
    } else {
      this.invertCooldown -= dt;
      if (this.invertCooldown <= 0) {
        this.invertLeft = 2.5;
        this.invertCooldown = 9 + Math.random() * 5;
        this.setBanner("TERS TUR!", "KONTROLLER TERS ÇEVİRİLDİ", 1.6);
        this.audio.combo(2);
        this.shake = Math.min(8, this.shake + 3);
      }
    }

    // Photon storm: periodic surge of speed + score
    this.surgeCd -= dt;
    if (this.surgeCd <= 0) {
      this.surgeCd = 12 + Math.random() * 6;
      this.surgeTimer = 1.6;
      this.setBanner("FOTON FIRTINASI!", "HIZ + SKOR PATLAMASI", 1.6);
      this.flash = Math.max(this.flash, 0.5);
      this.shake = Math.min(16, this.shake + 10);
      this.audio.boost();
      this.addComboHeat(15);
    }
    if (this.surgeTimer > 0) {
      this.surgeTimer -= dt;
      this.surge = 1;
      this.speed = Math.min(SPEED_MAX + 60, this.speed + 80 * dt);
      this.nitro = Math.min(NITRO_MAX, this.nitro + 30 * dt);
      this.bumpScore(Math.round(140 * dt));
    } else {
      this.surge = 0;
    }

    // Combo heat decay + multiplier-up feedback
    if (this.comboHeat > 0) this.comboHeat = Math.max(0, this.comboHeat - 11 * dt);
    const mult = this.multiplier();
    if (mult > this.lastMult) {
      this.audio.combo(Math.min(5, mult));
      this.addPopup(this.player.x, this.player.y - 46, `x${mult}!`, "#ffd166", 16 + mult * 2);
      if (mult >= 5) {
        this.setBanner("MAX KOMBO!", "SKOR x5", 1.0);
        this.flash = Math.max(this.flash, 0.5);
      }
    }
    this.lastMult = mult;

    // Turbo: hold (Tab / button) drains the ring to zero while accelerating
    const turboHeld = this.keys.has("tab") || this.turboBtn;
    if (turboHeld && !this.wasTurboHeld && this.countdown <= 0) {
      this.addPopup(this.player.x, this.player.y - 30, "TURBO!", "#7cf9ff", 18);
      this.audio.boost();
      this.shake = Math.min(14, this.shake + 6);
    }
    this.wasTurboHeld = turboHeld;
    const turboActive = turboHeld && this.nitro > 0 && this.countdown <= 0;
    if (turboActive) {
      this.boosting = true;
      this.nitro = Math.max(0, this.nitro - 42 * dt);
      this.speed = Math.min(SPEED_MAX + 90, this.speed + 85 * dt);
      this.shake = Math.min(13, this.shake + 8);
      if (this.nitro <= 0) this.boosting = false;
    } else {
      this.boosting = false;
      this.nitro = Math.min(NITRO_MAX, this.nitro + 6 * dt);
      const paceFloor = SPEED_BASE + Math.min(60, this.distance * 0.045);
      this.speed = Math.max(paceFloor, this.speed - SPEED_DECAY * dt);
    }

    const ratio = this.speed / SPEED_BASE;
    this.distance += this.speed * dt;

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

    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = Math.max(0.75, 1.5 - (this.lap - 1) * 0.08) * (0.7 + Math.random() * 0.6);
      this.spawnTraffic();
    }
    this.updateTraffic(dt, ratio);
  }

  private spawnTraffic(): void {
    // Avoid sealing all three lanes near the top: skip if two lanes already
    // have a vehicle close to the spawn line.
    const open: number[] = [];
    for (let lane = 0; lane < this.lanes; lane++) {
      const blocked = this.traffic.some(
        (t) => t.lane === lane && t.y < 150,
      );
      if (!blocked) open.push(lane);
    }
    if (open.length <= 1) return; // would block the track, skip this spawn
    const lane = open[Math.floor(Math.random() * open.length)];
    const kind = Math.floor(Math.random() * TRAFFIC_STYLES.length);
    const w = 34;
    const h = 46;
    this.traffic.push({
      lane,
      y: -h - 20,
      kind,
      w,
      h,
      wobble: Math.random() * Math.PI * 2,
      alive: true,
      nearMissed: false,
    });
  }

  private updateTraffic(dt: number, ratio: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    const speed = 132 * ratio;
    for (const t of this.traffic) {
      t.y += speed * dt;
      const cx = laneXs[t.lane];
      // Near-miss: the traffic car clears the player's line without a hit, very close.
      const cross = !t.nearMissed && t.y >= p.y - 4 && t.y <= p.y + 12;
      if (cross) {
        t.nearMissed = true;
        const dx = Math.abs(cx - p.x);
        const laneGap = this.W * 0.28;
        if (dx < laneGap * 1.9) {
          this.nitro = Math.min(NITRO_MAX, this.nitro + 6);
          this.bumpScore(40);
          this.bumpCombo();
          this.addComboHeat(18);
          this.addPopup(cx, t.y - 12, "YAKIN! +40", "#ffd166", 12);
          this.vibrate(6);
        }
      }
      if (t.y > this.H + 60) {
        t.alive = false;
      } else if (
        p.invincible <= 0 &&
        this.overlaps(cx, t.y, t.w, t.h, p.x, p.y, p.w * 0.7, p.h * 0.7)
      ) {
        t.alive = false;
        this.explode(cx, t.y, "#ff9f43", 16, 10, 160);
        this.speed = Math.max(SPEED_BASE, this.speed - 22);
        this.registerHit();
      }
    }
    this.traffic = this.traffic.filter((t) => t.alive && t.y < this.H + 300);
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
        this.addPopup(centerX, g.y - 18, g.gold ? `ALTIN HALKAYA! +${boost}` : `TURBO +40`, g.gold ? "#ffd166" : "#9be8ff", g.gold ? 16 : 14);
        this.explode(centerX, g.y, g.gold ? "#ffd166" : "#9be8ff", 12, 4, 100);
        this.audio.powerup();
        this.addHitStop(0.025);
        this.vibrate(12);
        this.bumpCombo();
        this.addComboHeat(g.gold ? 28 : 12);
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
        this.addPopup(centerX, o.y, o.gold ? `ALTIN +TURBO` : `+40`, o.gold ? "#ffd166" : "#8dffb0", o.gold ? 16 : 13);
        this.explode(centerX, o.y, o.gold ? "#ffd166" : "#8dffb0", 8, 4, 80);
        this.audio.powerup();
        this.vibrate(o.gold ? 18 : 10);
        this.bumpCombo();
        this.addComboHeat(o.gold ? 14 : 8);
      }
    }
    this.orbs = this.orbs.filter((o) => o.alive);
  }

  protected bumpScore(n: number): void {
    super.bumpScore(Math.round(n * this.multiplier()));
  }

  private multiplier(): number {
    if (this.comboHeat >= 90) return 5;
    if (this.comboHeat >= 72) return 4;
    if (this.comboHeat >= 48) return 3;
    if (this.comboHeat >= 24) return 2;
    return 1;
  }

  private addComboHeat(n: number): void {
    this.comboHeat = Math.min(100, this.comboHeat + n);
  }

  // ---- Lane input: swipe / arrows to change lane ----

  private leftDown = false;
  private rightDown = false;
  private turboBtn = false;
  private wasTurboHeld = false;

  private updateLane(dt: number): void {
    // Edge-triggered arrow keys: one lane per fresh key press
    const left = this.keys.has("arrowleft") || this.keys.has("a");
    const right = this.keys.has("arrowright") || this.keys.has("d");
    if (left && !this.leftDown) this.requestLane(this.laneIdx - 1);
    if (right && !this.rightDown) this.requestLane(this.laneIdx + 1);
    this.leftDown = left;
    this.rightDown = right;
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
    let dir = idx - this.laneIdx;
    if (this.invertLeft > 0) dir = -dir;
    this.laneIdx = clamp(this.laneIdx + dir, 0, this.lanes - 1);
  }

  private pointerLaneTarget: number | null = null;
  private swipeStartX = 0;
  private swipeActive = false;
  private swipeDone = false;
  private tapX = 0;

  protected onPointerDownHook(): void {
    const b = this.boostBtn();
    if (Math.hypot(this.pointerX - b.x, this.pointerY - b.y) <= b.r + 6) {
      this.tapX = -1;
      this.swipeActive = false;
      this.turboBtn = true;
      return;
    }
    this.swipeStartX = this.pointerX;
    this.tapX = this.pointerX;
    this.swipeActive = true;
    this.swipeDone = false;
    this.pointerLaneTarget = null;
  }

  // Hook called on pointer move while down
  protected onPointerMoveHook(): void {
    if (!this.swipeActive || this.swipeDone) return;
    const dx = this.pointerX - this.swipeStartX;
    // One gesture = one lane (edge-triggered, like the arrow keys)
    if (dx < -24) {
      this.swipeDone = true;
      this.tapX = -1;
      this.pointerLaneTarget = clamp(this.laneIdx + (this.invertLeft > 0 ? 1 : -1), 0, this.lanes - 1);
    } else if (dx > 24) {
      this.swipeDone = true;
      this.tapX = -1;
      this.pointerLaneTarget = clamp(this.laneIdx + (this.invertLeft > 0 ? -1 : 1), 0, this.lanes - 1);
    }
  }

  protected onPointerUpHook(): void {
    this.swipeActive = false;
    this.turboBtn = false;
    // Plain tap: change one lane toward the tapped half of the screen.
    if (this.pointerLaneTarget === null && this.tapX >= 0) {
      if (this.tapX < this.W / 2) this.requestLane(this.laneIdx - 1);
      else this.requestLane(this.laneIdx + 1);
    }
  }

  private lanePos(idx: number): number {
    return this.W / 2 + (idx - 1) * this.W * 0.28;
  }

  private laneXs(): number[] {
    return [0, 1, 2].map((i) => this.lanePos(i));
  }

  private boostBtn(): { x: number; y: number; r: number } {
    return { x: this.W - 48, y: this.H - 66, r: 32 };
  }

  private drawBoostButton(ctx: CanvasRenderingContext2D): void {
    const b = this.boostBtn();
    const frac = clamp(this.nitro / NITRO_MAX, 0, 1);
    const ready = this.nitro >= 25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = ready ? "#7cf9ff" : "rgba(124,249,255,0.4)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    if (ready) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 9, 0, Math.PI * 2);
      ctx.fillStyle = "#7cf9ff";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = ready ? "#04121a" : "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(b.x + 3, b.y - 15);
    ctx.lineTo(b.x - 8, b.y + 1);
    ctx.lineTo(b.x - 1, b.y + 1);
    ctx.lineTo(b.x - 4, b.y + 15);
    ctx.lineTo(b.x + 8, b.y - 1);
    ctx.lineTo(b.x + 1, b.y - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ready ? "#7cf9ff" : "rgba(255,255,255,0.6)";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TURBO / TAB", b.x, b.y + b.r + 13);
    ctx.restore();
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

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    this.drawTrack(ctx);
    if (this.speed > SPEED_BASE * 1.12 || this.boosting || this.surge > 0) {
      ctx.save();
      ctx.globalAlpha = this.boosting ? 0.75 : this.surge > 0 ? 0.6 : 0.55;
      ctx.strokeStyle = this.boosting ? "#7cf9ff" : this.surge > 0 ? "#ffd166" : "#ffd9a8";
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
    for (const t of this.traffic) this.drawTraffic(ctx, t);
    this.drawAfterimage(ctx);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time, this.boosting);
this.drawHud(ctx);
    this.drawBoostButton(ctx);
    this.drawCountdown(ctx);
    if (this.invertLeft > 0) this.drawInvert(ctx);
  }

  private drawInvert(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.invertLeft / 0.4);
    ctx.save();
    ctx.fillStyle = `rgba(255,60,150,${(0.1 * a).toFixed(3)})`;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#ff5fd0";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff5fd0";
    ctx.shadowBlur = 10;
    const cy = this.H * 0.5;
    ctx.beginPath();
    ctx.moveTo(30, cy);
    ctx.lineTo(54, cy);
    ctx.moveTo(46, cy - 8);
    ctx.lineTo(54, cy);
    ctx.lineTo(46, cy + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.W - 30, cy);
    ctx.lineTo(this.W - 54, cy);
    ctx.moveTo(this.W - 46, cy - 8);
    ctx.lineTo(this.W - 54, cy);
    ctx.lineTo(this.W - 46, cy + 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff5fd0";
    ctx.font = "700 15px Rajdhani, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TERS!", this.W / 2, 84);
    ctx.restore();
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

  private drawTraffic(ctx: CanvasRenderingContext2D, t: Traffic): void {
    const x = this.lanePos(t.lane);
    const y = t.y;
    if (y < -60 || y > this.H + 60) return;
    const style = TRAFFIC_STYLES[t.kind];
    const w = t.w;
    const h = t.h;
    ctx.save();
    ctx.translate(x, y);

    const nose = -h / 2;
    const tail = h / 2;

    // engine glow at the tail (facing the player)
    const flick = 0.6 + 0.4 * Math.sin(this.time * 14 + t.wobble);
    ctx.globalAlpha = 0.55 + 0.35 * flick;
    ctx.fillStyle = style.accent;
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-5, tail - 4);
    ctx.lineTo(0, tail + 6 + flick * 5);
    ctx.lineTo(5, tail - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // wings (angular, kind varies the sweep)
    const sweep = 0.75 + (t.kind % 3) * 0.16;
    ctx.fillStyle = style.body;
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 1.5;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * 4, -2);
      ctx.lineTo(k * (w / 2 + 4), 8 + sweep * 6);
      ctx.lineTo(k * (w / 2 - 2), 4 + sweep * 4);
      ctx.lineTo(k * 5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // fuselage
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = style.body;
    ctx.beginPath();
    ctx.moveTo(0, nose);
    ctx.lineTo(w / 3, nose + h * 0.4);
    ctx.lineTo(w / 4, tail - 4);
    ctx.lineTo(-w / 4, tail - 4);
    ctx.lineTo(-w / 3, nose + h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // cockpit canopy
    ctx.fillStyle = "rgba(150,225,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(0, nose + 7);
    ctx.lineTo(5, nose + 18);
    ctx.lineTo(0, nose + 24);
    ctx.lineTo(-5, nose + 18);
    ctx.closePath();
    ctx.fill();

    // nose light
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(0, nose + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawAfterimage(ctx: CanvasRenderingContext2D): void {
    if (!this.boosting && this.surge <= 0) return;
    const p = this.player;
    const color = this.surge > 0 ? "#ffd166" : "#7cf9ff";
    ctx.save();
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.22 - i * 0.045;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 20 - i * 16);
      ctx.lineTo(p.x + 9, p.y + 8 - i * 16);
      ctx.lineTo(p.x - 9, p.y + 8 - i * 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCountdown(ctx: CanvasRenderingContext2D): void {
    if (this.countdown <= 0) return;
    const n = Math.min(3, Math.max(1, Math.ceil(this.countdown)));
    const frac = this.countdown - Math.floor(this.countdown);
    const scale = 1 + (1 - frac) * 0.5;
    const cx = this.W / 2;
    const cy = this.H * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, cy - 60, this.W, 120);
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#ffd166";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 24;
    ctx.font = "bold 84px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 0, 0);
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
    ctx.fillText(ready ? "TURBO HAZIR" : "TURBO", bx, by - 5);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(this.speed)} h`, this.W - 14, 20);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`TÜR ${this.lap}  •  ${Math.round(this.distance)}m`, this.W / 2, 40);

    const mult = this.multiplier();
    if (mult > 1) {
      const heat = this.comboHeat / 100;
      const mc = mult >= 5 ? "#ff5c8a" : mult >= 3 ? "#ffd166" : "#3dffa0";
      ctx.fillStyle = mc;
      ctx.font = `bold ${15 + Math.round(heat * 7)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`KOMBO x${mult}`, this.W / 2, 60);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(this.W / 2 - 40, 65, 80, 4);
      ctx.fillStyle = mc;
      ctx.fillRect(this.W / 2 - 40, 65, 80 * heat, 4);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
