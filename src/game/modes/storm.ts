import { ENEMY_DEFS } from "../defs";
import { PLAYER_SPEED } from "../constants";
import { paintEnemy, paintPlayer } from "../painter";
import type { ChapterDef, Enemy, GameCallbacks } from "../types";
import { BaseMode } from "./base";

const WAVE_TIME = 16;
const escapeBonus = (wave: number) => 12 + wave * 4;

export class StormMode extends BaseMode {
  private meteors: Enemy[] = [];
  private nextId = 1;
  private spawnTimer = 0.6;
  private waveTimer = 0;
  private dripTimer = 0;

  protected get palette(): ChapterDef {
    return {
      name: "METEOR FIRTINASI",
      top: "#2b1608",
      mid: "#180b04",
      bottom: "#060301",
      star: "#ffd9a8",
      starSpeed: 1.6,
      nebulas: [{ x: 0.2, y: 0.7, r: 0.6, color: "rgba(255,120,50,0.08)" }],
      rocks: 6,
      rockColor: "#7a4630",
      rockSpeed: 90,
    };
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "storm");
    this.resetIdle();
  }

  beginGame(): void {
    super.startRun();
    this.meteors = [];
    this.spawnTimer = 0.6;
    this.waveTimer = 0;
    this.dripTimer = 0;
    this.setBanner("DALGA 1", "GÖKTAŞLARINDAN KAÇ!");
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.player = this.makePlayer();
  }

  protected updateSub(dt: number): void {
    this.moveShip(dt);

    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    const inter = Math.max(0.3, 0.9 - this.level * 0.05);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = inter * (0.7 + Math.random() * 0.6);
      this.pushMeteor();
    }

    const mult = 1 + (this.level - 1) * 0.11;
    for (const m of this.meteors) {
      m.rot += m.rotSpeed * dt;
      m.y += m.vy * dt;
      m.wobble += m.wobbleSpeed * dt;
      m.x = m.baseX + Math.sin(m.wobble * 2) * 12 * mult;
      if (m.y > this.H + 60) {
        m.alive = false;
        const bonus = escapeBonus(this.level);
        this.bumpScore(bonus);
        this.addPopup(m.x, this.H - 30, `+${bonus}`, "#ffc987", 13);
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

    this.dripTimer += dt;
    if (this.dripTimer >= 0.4) {
      this.dripTimer -= 0.4;
      this.bumpScore(1 * this.level);
    }

    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_TIME) {
      this.waveTimer = 0;
      this.level++;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
      this.setBanner(`DALGA ${this.level}`);
    }
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

  private pushMeteor(): void {
    const def = ENEMY_DEFS.meteor;
    const mult = 1 + (this.level - 1) * 0.11;
    const x = def.w / 2 + Math.random() * Math.max(0, this.W - def.w);
    this.meteors.push({
      id: this.nextId++,
      kind: "meteor",
      x,
      y: -def.h - 10,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.9 + Math.random() * 0.45),
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
    for (const m of this.meteors) paintEnemy(ctx, m, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}