import { paintPlayer } from "../painter";
import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const SPEED_BASE = 90;
const SPEED_MAX = 200;
const SPEED_RAMP = 1.2;
const LAP_DIST = 350;
const PLAYER_Y = 0.82;
const DIAMOND_POINTS = 50;
const NEAR_MISS_POINTS = 40;
const BOOST_MAX = 100;
const BOOST_FILL = 11;
const BOOST_DURATION = 2.5;
const BOOST_SPEED = 130;

interface Diamond {
  lane: number;
  y: number;
  alive: boolean;
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
  private diamonds: Diamond[] = [];
  private traffic: Traffic[] = [];
  private diamondTimer = 0.6;
  private trafficTimer = 1.4;
  private distTick = 0;
  private distance = 0;
  private lap = 1;
  private speed = SPEED_BASE;
  private boostCharge = 0;
  private boostActive = 0;
  private countdown = 0;
  private comboHeat = 0;
  private lastMult = 1;
  private lanes = 3;
  private laneIdx = 1;
  private invertLeft = 0;
  private invertCooldown = 8;
  private leftDown = false;
  private rightDown = false;
  private pointerLaneTarget: number | null = null;
  private swipeStartX = 0;
  private swipeActive = false;
  private swipeDone = false;
  private tapX = 0;

  protected get palette(): ChapterDef {
    return {
      name: "ELMAS YARIŞI",
      top: "#0a0824",
      mid: "#060518",
      bottom: "#02010c",
      star: "#b8c6ff",
      starSpeed: 2.2,
      nebulas: [{ x: 0.2, y: 0.7, r: 0.6, color: "rgba(100,120,255,0.08)" }],
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
    this.diamonds = [];
    this.traffic = [];
    this.diamondTimer = 0.6;
    this.trafficTimer = 1.4;
    this.distTick = 0;
    this.distance = 0;
    this.lap = 1;
    this.speed = SPEED_BASE;
    this.boostCharge = 0;
    this.boostActive = 0;
    this.countdown = 3.0;
    this.comboHeat = 0;
    this.lastMult = 1;
    this.laneIdx = 1;
    this.invertLeft = 0;
    this.invertCooldown = 8;
    this.leftDown = false;
    this.rightDown = false;
    this.setBanner("YARIŞ BAŞLADI!", "3 ŞERİTTEN GEÇ");
  }

  protected resetIdle(): void {
    this.diamonds = [];
    this.traffic = [];
    this.player = this.makePlayer();
    this.player.y = this.H * PLAYER_Y;
  }

  protected updateSub(dt: number): void {
    this.updateLane(dt);
    this.spawnThruster("#ff9f43");

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    // Countdown: 3-2-1 then GO
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

    // Speed ramp: gradually加速
    this.speed = Math.min(SPEED_MAX, this.speed + SPEED_RAMP * dt);

    // HIZ boost: fixed-duration speed burst; recharges over time while not active
    if (this.boostActive > 0) {
      this.boostActive -= dt;
      if (this.boostActive <= 0) this.boostActive = 0;
      this.spawnFlame();
    } else if (this.countdown <= 0) {
      this.boostCharge = Math.min(BOOST_MAX, this.boostCharge + BOOST_FILL * dt);
    }

    // Distance + score accumulation
    this.distance += this.effSpeed * dt;
    this.distTick += dt;
    if (this.distTick >= 0.25) {
      this.distTick -= 0.25;
      this.bumpScore(Math.round(this.effSpeed * 0.25));
    }

    // Lap progression
    if (this.distance >= this.lap * LAP_DIST) {
      this.lap++;
      this.level = this.lap;
      this.cbs.onLevel(this.lap);
      this.bumpCombo();
      this.audio.levelUp();
      this.flash = Math.max(this.flash, 0.35);
      this.addHitStop(0.04);
      this.setBanner(`DALGA ${this.lap}`, `HEDEF ${(this.lap + 1) * LAP_DIST}m`);
    }

    // Spawn diamonds
    this.diamondTimer -= dt;
    if (this.diamondTimer <= 0) {
      this.diamondTimer = Math.max(0.5, 1.2 - (this.lap - 1) * 0.06) * (0.7 + Math.random() * 0.5);
      this.spawnDiamond();
    }
    this.updateDiamonds(dt);

    // Spawn traffic
    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = Math.max(0.75, 1.5 - (this.lap - 1) * 0.08) * (0.7 + Math.random() * 0.6);
      this.spawnTraffic();
    }
    this.updateTraffic(dt);
  }

  // ---- Diamonds ----

  private spawnDiamond(): void {
    const lane = Math.floor(Math.random() * this.lanes);
    this.diamonds.push({
      lane,
      y: -20,
      alive: true,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private updateDiamonds(dt: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    for (const d of this.diamonds) {
      d.phase += 3 * dt;
      d.y += this.effSpeed * 1.3 * dt;
      const cx = laneXs[d.lane];
      if (d.y > this.H + 30) {
        d.alive = false;
      } else if (this.overlaps(cx, d.y, 18, 18, p.x, p.y, p.w, p.h)) {
        d.alive = false;
        this.bumpScore(DIAMOND_POINTS);
        this.addPopup(cx, d.y - 14, `ELMAS +${DIAMOND_POINTS}`, "#00e5ff", 16);
        this.explode(cx, d.y, "#00e5ff", 10, 4, 100);
        this.explode(cx, d.y, "#80f0ff", 6, 3, 70);
        this.audio.powerup();
        this.vibrate(12);
        this.bumpCombo();
        this.addComboHeat(12);
        this.boostCharge = Math.min(BOOST_MAX, this.boostCharge + 10);
        this.flash = Math.max(this.flash, 0.1);
      }
    }
    this.diamonds = this.diamonds.filter((d) => d.alive);
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, d: Diamond): void {
    const x = this.lanePos(d.lane);
    const y = d.y;
    if (y < -30 || y > this.H + 30) return;
    const pulse = 0.7 + 0.3 * Math.sin(d.phase);
    ctx.save();
    ctx.translate(x, y);
    // Glow
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 13 * (0.8 + pulse * 0.3), 0, Math.PI * 2);
    ctx.fill();
    // Diamond shape (rhombus)
    ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#00e5ff";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    // Inner highlight
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#b0f8ff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- Traffic ----

  private spawnTraffic(): void {
    const open: number[] = [];
    for (let lane = 0; lane < this.lanes; lane++) {
      const blocked = this.traffic.some(
        (t) => t.lane === lane && t.y < 150,
      );
      if (!blocked) open.push(lane);
    }
    if (open.length <= 1) return;
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

  private updateTraffic(dt: number): void {
    const p = this.player;
    const laneXs = this.laneXs();
    const speed = this.effSpeed * 1.1;
    for (const t of this.traffic) {
      t.y += speed * dt;
      const cx = laneXs[t.lane];
      const cross = !t.nearMissed && t.y >= p.y - 4 && t.y <= p.y + 12;
      if (cross) {
        t.nearMissed = true;
        const dx = Math.abs(cx - p.x);
        const laneGap = this.W * 0.28;
        if (dx < laneGap * 1.9) {
          this.bumpScore(NEAR_MISS_POINTS);
          this.bumpCombo();
          this.addComboHeat(18);
          this.boostCharge = Math.min(BOOST_MAX, this.boostCharge + 8);
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
        this.registerHit();
      }
    }
    this.traffic = this.traffic.filter((t) => t.alive && t.y < this.H + 300);
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

    ctx.fillStyle = "rgba(150,225,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(0, nose + 7);
    ctx.lineTo(5, nose + 18);
    ctx.lineTo(0, nose + 24);
    ctx.lineTo(-5, nose + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(0, nose + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---- Scoring ----

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

  private get effSpeed(): number {
    return this.boostActive > 0 ? this.speed + BOOST_SPEED : this.speed;
  }

  // ---- Lane input ----

  private updateLane(dt: number): void {
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

  protected onPointerDownHook(): void {
    const b = this.boostBtn();
    if (Math.hypot(this.pointerX - b.x, this.pointerY - b.y) <= b.r + 6) {
      this.tryActivateBoost();
      this.tapX = -1;
      this.swipeActive = false;
      return;
    }
    this.swipeStartX = this.pointerX;
    this.tapX = this.pointerX;
    this.swipeActive = true;
    this.swipeDone = false;
    this.pointerLaneTarget = null;
  }

  protected onPointerMoveHook(): void {
    if (!this.swipeActive || this.swipeDone) return;
    const dx = this.pointerX - this.swipeStartX;
    if (dx < -24) {
      this.swipeDone = true;
      this.pointerLaneTarget = clamp(this.laneIdx + (this.invertLeft > 0 ? 1 : -1), 0, this.lanes - 1);
    } else if (dx > 24) {
      this.swipeDone = true;
      this.pointerLaneTarget = clamp(this.laneIdx + (this.invertLeft > 0 ? -1 : 1), 0, this.lanes - 1);
    }
  }

  protected onPointerUpHook(): void {
    this.swipeActive = false;
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

  // ---- HIZ boost button ----

  private boostBtn(): { x: number; y: number; r: number } {
    return { x: this.W - 52, y: this.H - 66, r: 34 };
  }

  private tryActivateBoost(): void {
    if (this.boostActive > 0) return;
    if (this.boostCharge < BOOST_MAX) {
      const b = this.boostBtn();
      this.addPopup(b.x, b.y - b.r - 10, "HAZIR DEĞİL", "rgba(255,255,255,0.45)", 11);
      return;
    }
    this.boostActive = BOOST_DURATION;
    this.boostCharge = 0;
    this.flash = Math.max(this.flash, 0.45);
    this.shake = Math.min(14, this.shake + 8);
    this.audio.boost();
    this.setBanner("HIZ!", "ROKET ATEŞİ", 1.2);
  }

  private spawnFlame(): void {
    const p = this.player;
    if (!p.alive) return;
    const colors = ["#ff5a1a", "#ff8c1a", "#ffd166", "#ff3b1a"];
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * 12,
        y: p.y + 14 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 46,
        vy: 70 + Math.random() * 130,
        life: 0.3 + Math.random() * 0.28,
        maxLife: 0.58,
        size: 3 + Math.random() * 4.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0,
      });
    }
  }

  // ---- Rendering ----

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    this.drawTrack(ctx);
    for (const d of this.diamonds) this.drawDiamond(ctx, d);
    for (const t of this.traffic) this.drawTraffic(ctx, t);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time, false);
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
    const dash = 44;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffc987";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = this.W / 2 + (i - 1.5) * this.W * 0.28;
      ctx.setLineDash([dash, 46]);
      ctx.lineDashOffset = -this.time * 320;
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
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(this.distance)}m`, this.W - 14, 20);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(`${Math.round(this.effSpeed)} h`, this.W - 14, 34);

    // Diamond count with icon
    ctx.textAlign = "left";
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("💎", 14, 20);
    ctx.fillText(`×${this.diamondCount}`, 34, 20);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`DALGA ${this.lap}`, this.W / 2, 40);

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

  private drawBoostButton(ctx: CanvasRenderingContext2D): void {
    const b = this.boostBtn();
    const frac = clamp(this.boostCharge / BOOST_MAX, 0, 1);
    const active = this.boostActive > 0;
    const activeFrac = active ? this.boostActive / BOOST_DURATION : 0;
    const ready = this.boostCharge >= BOOST_MAX;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
    ctx.save();
    // Base disc
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    // Charge (idle) or drain (active) ring
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (active ? activeFrac : frac));
    ctx.strokeStyle = active ? "#ff5a1a" : ready ? "#ffd166" : "rgba(124,249,255,0.55)";
    ctx.lineWidth = active ? 6 : 4;
    ctx.lineCap = "round";
    ctx.shadowColor = active ? "#ff5a1a" : ready ? "#ffd166" : "#7cf9ff";
    ctx.shadowBlur = active ? 18 : ready ? 14 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Ready glow fill
    if (ready && !active) {
      ctx.globalAlpha = 0.25 + 0.4 * pulse;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 9, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd166";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Active burn fill
    if (active) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 9, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5a1a";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Flame/lightning icon
    const iconColor = active ? "#ffffff" : ready ? "#2a1600" : "rgba(255,255,255,0.7)";
    ctx.fillStyle = iconColor;
    ctx.beginPath();
    ctx.moveTo(b.x + 3, b.y - 16);
    ctx.lineTo(b.x - 8, b.y + 2);
    ctx.lineTo(b.x - 1, b.y + 2);
    ctx.lineTo(b.x - 4, b.y + 16);
    ctx.lineTo(b.x + 8, b.y - 1);
    ctx.lineTo(b.x + 1, b.y - 1);
    ctx.closePath();
    ctx.fill();
    // Label
    ctx.fillStyle = active ? "#ff9f6a" : ready ? "#ffd166" : "rgba(255,255,255,0.7)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(active ? "HIZ!" : "HIZ", b.x, b.y + b.r + 14);
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

  private get diamondCount(): number {
    // Count collected diamonds: comboHeat / 12 gives an approximation of diamonds collected
    // but we track it properly via score. For display we use a running count.
    return Math.floor(this.score / DIAMOND_POINTS);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}