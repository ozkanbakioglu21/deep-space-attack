import { ENEMY_DEFS } from "../defs";
import { PLAYER_SPEED } from "../constants";
import { paintEnemy, paintGlint, paintPlayer } from "../painter";
import type { ChapterDef, Enemy, GameCallbacks, Glint } from "../types";
import { BaseMode } from "./base";

const GLINTS_PER_WAVE = 10;
const GLINT_LIFE = 9;

export class GatherMode extends BaseMode {
  private glints: Glint[] = [];
  private meteors: Enemy[] = [];
  private nextId = 1;
  private spawnTimer = 1.2;
  private collected = 0;

  protected get palette(): ChapterDef {
    return {
      name: "YILDIZ TOPLAYICI",
      top: "#0b1f2e",
      mid: "#05111a",
      bottom: "#02050b",
      star: "#a9f2ff",
      starSpeed: 1.8,
      nebulas: [{ x: 0.5, y: 0.5, r: 0.9, color: "rgba(40,220,255,0.08)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "gather");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.glints = [];
    this.meteors = [];
    this.spawnTimer = 1.2;
    this.collected = 0;
    this.setBanner("DALGA 1", "YILDIZLARI TOPLA, GÖKTAŞLARINDAN KAÇ!");
  }

  protected resetIdle(): void {
    this.glints = [];
    this.meteors = [];
    this.player = this.makePlayer();
  }

  protected updateSub(dt: number): void {
    this.moveShip(dt);

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    const target = Math.min(8, 3 + this.level);
    if (this.glints.length < target) this.spawnGlint();

    const inter = Math.max(0.85, 1.6 - this.level * 0.07);
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
      m.x = m.baseX + Math.sin(m.wobble * 2) * 10 * mult;
      if (m.y > this.H + 60) {
        m.alive = false;
      } else if (
        p.invincible <= 0 &&
        this.overlaps(m.x, m.y, m.w, m.h, p.x, p.y, p.w * 0.7, p.h * 0.7)
      ) {
        m.alive = false;
        this.explode(m.x, m.y, "#ff9f43", 18, 10, 170);
        this.registerHit();
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive && m.y < this.H + 300);

    for (const g of this.glints) {
      g.life -= dt;
      g.rot += dt * 1.6;
      if (g.life <= 0) continue;
      if (
        this.overlaps(g.x, g.y, g.w, g.h, p.x, p.y, p.w * 0.9, p.h * 0.9)
      ) {
        g.life = 0;
        const gained = 50 * this.level;
        this.bumpScore(gained);
        this.collected++;
        this.addPopup(g.x, g.y - 20, `+${gained}`, "#9df4ff", 14);
        this.explode(g.x, g.y, "#8df0ff", 10, 5, 90);
        this.audio.powerup();
        if (this.collected % GLINTS_PER_WAVE === 0) {
          this.level++;
          this.cbs.onLevel(this.level);
          this.audio.levelUp();
          this.setBanner(`DALGA ${this.level}`);
        }
      }
    }
    this.glints = this.glints.filter((g) => g.life > 0);
  }

  private moveShip(dt: number): void {
    const p = this.player;
    const prevX = p.x;
    const speed = PLAYER_SPEED * 1.05;
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

  private spawnGlint(): void {
    const size = 20;
    this.glints.push({
      x: size / 2 + 8 + Math.random() * (this.W - size - 16),
      y: 60 + Math.random() * (this.H - 150),
      w: size,
      h: size * 0.8,
      rot: Math.random() * Math.PI * 2,
      life: GLINT_LIFE,
      maxLife: GLINT_LIFE,
      alive: true,
    });
  }

  private pushMeteor(): void {
    const def = ENEMY_DEFS.meteor;
    const mult = 1 + (this.level - 1) * 0.1;
    const x = def.w / 2 + Math.random() * Math.max(0, this.W - def.w);
    this.meteors.push({
      id: this.nextId++,
      kind: "meteor",
      x,
      y: -def.h - 6,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.9 + Math.random() * 0.4),
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
    });
  }

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    for (const g of this.glints) paintGlint(ctx, g, this.time);
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}