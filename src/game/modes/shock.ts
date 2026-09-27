import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

// ŞOK (Shockwave): tap to drop an expanding shockwave (costs energy). Reactive
// (green) aliens emit a smaller chain shock when destroyed, triggering cascades.
const SHOCK_COST = 22;
const ENERGY_MAX = 100;
const ENERGY_REGEN = 16;
const SHOCK_MAX_R = 118;
const SHOCK_SPEED = 340;
const CHAIN_MAX_R = 62;
const CHAIN_SPEED = 300;
const GROUND_Y_FRAC = 0.94;
const ALIEN_BASE_VY = 52;
const ALIEN_VY_PER_LEVEL = 9;
const KILLS_PER_LEVEL = 8;
const ACCENT = "#a86bff";
const CHAIN_COL = "#7cff6b";

interface Shock {
  x: number;
  y: number;
  r: number;
  maxR: number;
  speed: number;
  id: number;
  chain: boolean;
  alive: boolean;
}
type AlienType = "normal" | "reactive" | "tank";
type FleeDir = "left" | "right" | "up" | null;
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
  type: AlienType;
  hitByShock: number;
  flee: boolean;
  fleeDir: FleeDir;
  phase: number;
  alive: boolean;
}

const ALIEN_STYLES: { body: string; accent: string; eye: string }[] = [
  { body: "#ffd166", accent: "#d99a2b", eye: "#1a1406" }, // normal (yellow)
  { body: "#7cff6b", accent: "#3fa532", eye: "#06140a" }, // reactive (green)
  { body: "#ff6b6b", accent: "#c0392b", eye: "#1a0606" }, // tank (red)
];

export class ShockMode extends BaseMode {
  private shocks: Shock[] = [];
  private aliens: Alien[] = [];
  private alienTimer = 0.9;
  private kills = 0;
  private energy = ENERGY_MAX;
  private shockSeq = 0;
  private chainFlash = 0;
  private fleeHinted = false;

  protected get palette(): ChapterDef {
    return {
      name: "ŞOK",
      top: "#140a26",
      mid: "#0b0618",
      bottom: "#05030e",
      star: "#d4b8ff",
      starSpeed: 1.5,
      nebulas: [{ x: 0.5, y: 0.45, r: 0.55, color: "rgba(150,90,255,0.12)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "shock");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.shocks = [];
    this.aliens = [];
    this.alienTimer = 0.9;
    this.kills = 0;
    this.energy = ENERGY_MAX;
    this.shockSeq = 0;
    this.chainFlash = 0;
    this.fleeHinted = false;
    this.player.y = this.H * 0.5;
    this.setBanner("ŞOK DALGASI", "Enerjini yönet, reaktifleri patlat, zincir kur!");
  }

  protected resetIdle(): void {
    this.shocks = [];
    this.aliens = [];
    this.energy = ENERGY_MAX;
    this.fleeHinted = false;
  }

  protected updateSub(dt: number) {
    this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_REGEN * dt);
    this.chainFlash = Math.max(0, this.chainFlash - dt);

    // Spawn aliens.
    this.alienTimer -= dt;
    if (this.alienTimer <= 0) {
      const interval =
        Math.max(0.42, 1.0 - (this.level - 1) * 0.05) * (0.7 + Math.random() * 0.5);
      this.alienTimer = interval;
      this.spawnAlien();
      if (this.level >= 3 && Math.random() < 0.4) this.spawnAlien();
    }

    this.updateShocks(dt);
    this.updateAliens(dt);
  }

  // A tap drops a shockwave at the pointer (costs energy).
  protected onPointerDownHook(): void {
    if (!this.playing) return;
    if (this.energy < SHOCK_COST) {
      this.addPopup(this.pointerX, this.pointerY, "ENERJİ YOK", "rgba(255,255,255,0.55)", 12);
      return;
    }
    this.energy -= SHOCK_COST;
    this.shocks.push({
      x: this.pointerX,
      y: this.pointerY,
      r: 0,
      maxR: SHOCK_MAX_R,
      speed: SHOCK_SPEED,
      id: this.shockSeq++,
      chain: false,
      alive: true,
    });
    this.flash = Math.max(this.flash, 0.12);
    this.audio.powerup();
  }

  private spawnAlien() {
    const r = 15 + Math.random() * 8;
    let x = r + Math.random() * (this.W - 2 * r);
    let type: AlienType = "normal";
    let hp = 1;
    let kind = 0;
    if (this.level >= 3 && Math.random() < 0.16) {
      type = "tank";
      hp = 2;
      kind = 2;
    } else if (Math.random() < Math.min(0.42, 0.18 + this.level * 0.025)) {
      type = "reactive";
      kind = 1;
    }

    // Fleeing aliens bail toward an edge (or back up) instead of just falling.
    const fleeProb = Math.min(0.4, 0.1 + this.level * 0.035);
    const flee = Math.random() < fleeProb;
    let fleeDir: FleeDir = null;
    let phase = 0;
    let vx = (Math.random() - 0.5) * 20;
    let vy = ALIEN_BASE_VY + (this.level - 1) * ALIEN_VY_PER_LEVEL + Math.random() * 20;
    if (flee) {
      const dirs: Exclude<FleeDir, null>[] = ["left", "right", "up"];
      fleeDir = dirs[Math.floor(Math.random() * dirs.length)];
      const sp = 120 + this.level * 6 + Math.random() * 40;
      x = this.W * 0.3 + Math.random() * this.W * 0.4; // spawn central so it is catchable
      if (fleeDir === "left") {
        vx = -sp;
        vy = 24 + Math.random() * 16;
      } else if (fleeDir === "right") {
        vx = sp;
        vy = 24 + Math.random() * 16;
      } else {
        vx = 0;
        vy = 60 + Math.random() * 30; // up: descends a touch, then flees back up (phase 1)
      }
      if (!this.fleeHinted) {
        this.fleeHinted = true;
        this.setBanner("DİKKAT: BAZILARI KAÇIYOR!", "Kaçmalarına mani ol — ekrandan çıkarsa can gider.");
      }
    }

    this.aliens.push({
      x,
      y: -r,
      vx,
      vy,
      r,
      hp,
      maxHp: hp,
      kind,
      wobble: Math.random() * 6.28,
      flash: 0,
      type,
      hitByShock: -1,
      flee,
      fleeDir,
      phase,
      alive: true,
    });
  }

  private updateShocks(dt: number) {
    for (let i = 0; i < this.shocks.length; i++) {
      const s = this.shocks[i];
      s.r += s.speed * dt;
      if (s.r >= s.maxR) {
        s.alive = false;
        continue;
      }
      for (const a of this.aliens) {
        if (!a.alive || a.hitByShock === s.id) continue;
        const d = Math.hypot(a.x - s.x, a.y - s.y);
        if (Math.abs(d - s.r) < a.r + 12) {
          a.hitByShock = s.id;
          a.hp--;
          a.flash = 0.1;
          if (a.hp <= 0) {
            this.destroyAlien(a, s.chain);
          } else {
            this.audio.hit();
            this.explode(a.x, a.y, "#ffffff", 6, 5, 90);
          }
        }
      }
    }
    this.shocks = this.shocks.filter((s) => s.alive);
    this.aliens = this.aliens.filter((a) => a.alive);
  }

  private destroyAlien(a: Alien, byChain: boolean) {
    a.alive = false;
    const style = ALIEN_STYLES[a.kind];
    this.explode(a.x, a.y, style.body, 16, 9, 150);
    this.bumpScore(100);
    this.bumpCombo();
    this.kills++;
    if (byChain) {
      this.addPopup(a.x, a.y, "ZİNCİR!", CHAIN_COL, 16);
      this.chainFlash = Math.max(this.chainFlash, 0.4);
    }
    this.audio.explosion();
    this.vibrate(12);
    this.shake = Math.min(9, this.shake + 3);
    // Reactive aliens propagate the chain reaction.
    if (a.type === "reactive") {
      this.shocks.push({
        x: a.x,
        y: a.y,
        r: 0,
        maxR: CHAIN_MAX_R,
        speed: CHAIN_SPEED,
        id: this.shockSeq++,
        chain: true,
        alive: true,
      });
    }
    this.checkLevel();
  }

  private updateAliens(dt: number) {
    const groundY = this.H * GROUND_Y_FRAC;
    for (const a of this.aliens) {
      if (!a.alive) continue;
      a.wobble += dt * 4;
      a.flash = Math.max(0, a.flash - dt);

      // "Up" fleeters come down a touch, then turn and flee back to the top.
      if (a.flee && a.fleeDir === "up" && a.phase === 0) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.y >= this.H * 0.12) {
          a.phase = 1;
          a.vx = 0;
          a.vy = -(100 + this.level * 6 + Math.random() * 30);
        }
        if (a.y + a.r > groundY) {
          a.alive = false;
          this.escape(a);
        }
        continue;
      }

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.flee) {
        // No wall bounce: any screen exit (up / side) or the ground = escape.
        if (a.x < a.r || a.x > this.W - a.r || a.y < -a.r || a.y + a.r > groundY) {
          a.alive = false;
          this.escape(a);
        }
      } else {
        if (a.x < a.r || a.x > this.W - a.r) a.vx *= -1;
        if (a.y + a.r > groundY) {
          a.alive = false;
          this.escape(a);
        }
      }
    }
    this.aliens = this.aliens.filter((a) => a.alive);
  }

  private escape(a: Alien): void {
    this.explode(clamp(a.x, 8, this.W - 8), clamp(a.y, 8, this.H - 8), "#ff9f43", 12, 8, 130);
    this.addPopup(clamp(a.x, 34, this.W - 34), clamp(a.y, 34, this.H - 34), "KAÇTI! -1 CAN", "#ff5a3c", 14);
    this.vibrate(16);
    this.registerHit();
  }

  private checkLevel() {
    if (this.kills >= this.level * KILLS_PER_LEVEL) {
      this.level++;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
      this.flash = Math.max(this.flash, 0.3);
      const note =
        this.level >= 5 ? "Reaktifler her yanda!" : this.level >= 2 ? "Zincir dalgalar başlıyor!" : "Yeşilleri patlat, zincir kur!";
      this.setBanner(`DALGA ${this.level}`, note);
    }
  }

  protected renderEntities(ctx: CanvasRenderingContext2D) {
    const gY = this.H * GROUND_Y_FRAC;

    // Ground line.
    const grad = ctx.createLinearGradient(0, gY - 14, 0, gY);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(168,107,255,0.12)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, gY - 14, this.W, 14);
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(this.time * 4);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(this.W, gY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (const s of this.shocks) this.drawShock(ctx, s);
    for (const a of this.aliens) this.drawAlien(ctx, a);

    this.drawEnergyBar(ctx, gY);

    if (this.playing) this.drawReticle(ctx);
  }

  private drawShock(ctx: CanvasRenderingContext2D, s: Shock) {
    const life = 1 - s.r / s.maxR;
    const col = s.chain ? CHAIN_COL : ACCENT;
    ctx.save();
    ctx.globalAlpha = 0.25 + life * 0.65;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3 + life * 4;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1, s.r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.05 + life * 0.05;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1, s.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAlien(ctx: CanvasRenderingContext2D, a: Alien) {
    const style = ALIEN_STYLES[a.kind];
    const wob = Math.sin(a.wobble) * 2;
    const r = a.r;
    const x = a.x;
    const y = a.y;
    const flash = a.flash > 0;

    // Reactive aliens get a pulsing green aura (chain cue).
    if (a.type === "reactive") {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(a.wobble * 2);
      ctx.strokeStyle = CHAIN_COL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = style.body;
    ctx.shadowBlur = flash ? 18 : 10;
    ctx.fillStyle = flash ? "#ffffff" : style.body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = flash ? "#ffffff" : style.eye;
    for (const ex of [-r * 0.38, r * 0.38]) {
      ctx.beginPath();
      ctx.arc(x + ex, y - r * 0.15, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = flash ? "#ffffff" : style.accent;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      const tipX = x + s * r * 0.5 + Math.sin(a.wobble + s) * 1.5;
      const tipY = y - r - 5 + wob;
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.45, y - r * 0.5);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = flash ? "#ffffff" : style.body;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (a.type === "tank" && a.maxHp > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(a.hp), x, y - r - 8);
    }

    // Fleeing cue: pulsing orange ring + arrow pointing the escape direction.
    if (a.flee && a.fleeDir) {
      let dx = 0;
      let dy = 0;
      if (a.fleeDir === "left") dx = -1;
      else if (a.fleeDir === "right") dx = 1;
      else dy = -1;
      const pulse = 0.5 + 0.5 * Math.sin(a.wobble * 3);
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.4 * pulse;
      ctx.strokeStyle = "#ff9f43";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const ax = x + dx * (r + 12);
      const ay = y + dy * (r + 12);
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.fillStyle = "#ff9f43";
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawReticle(ctx: CanvasRenderingContext2D) {
    const ready = this.energy >= SHOCK_COST;
    ctx.save();
    ctx.globalAlpha = ready ? 0.6 : 0.25;
    ctx.strokeStyle = ready ? ACCENT : "#6a5a82";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.pointerX, this.pointerY, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.pointerX, this.pointerY, 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fill();
    ctx.restore();
  }

  private drawEnergyBar(ctx: CanvasRenderingContext2D, gY: number) {
    const w = this.W * 0.52;
    const x = (this.W - w) / 2;
    const y = gY - 26;
    const h = 9;
    const frac = this.energy / ENERGY_MAX;
    const ready = this.energy >= SHOCK_COST;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = ready ? ACCENT : "#5a4a72";
    ctx.fillRect(x, y, w * frac, h);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + w * (SHOCK_COST / ENERGY_MAX), y - 2, 1.5, h + 4);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ENERJİ", this.W / 2, y - 5);
    if (!ready && this.playing) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 10);
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("ŞARJ...", this.W / 2, y + h + 12);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
