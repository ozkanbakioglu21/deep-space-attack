import { AudioManager } from "./audio";
import { loadHighScore, saveHighScore } from "./storage";
import { CHAPTERS, ENEMY_DEFS, POWERUP_INFO } from "./defs";
import {
  BASE_SPAWN_INTERVAL,
  COMBO_WINDOW,
  ENEMY_BULLET_SPEED,
  INVINCIBLE_TIME,
  LEVEL_DURATION,
  MAX_BULLETS,
  MAX_ENEMIES,
  MAX_LIVES,
  MAX_POWERUPS,
  PLAYER_BULLET_SPEED,
  PLAYER_FIRE_RATE,
  PLAYER_H,
  PLAYER_SPEED,
  PLAYER_W,
  POWERUP_SPEED,
  RAPID_TIME,
  SHIELD_TIME,
  START_LIVES,
} from "./constants";
import {
  paintBackground,
  paintBanner,
  paintBullet,
  paintEnemy,
  paintParticles,
  paintPlayer,
  paintPopups,
  paintPowerUp,
} from "./painter";
import type {
  Bullet,
  Enemy,
  EnemyKind,
  GameCallbacks,
  Particle,
  Popup,
  PowerKind,
  PowerUp,
  Star,
} from "./types";

export interface PlayerState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  tilt: number;
  alive: boolean;
  invincible: number;
  fireCooldown: number;
  shield: number;
  rapid: number;
}

type LevelEventKind =
  | "droneSpiral"
  | "fighterWing"
  | "spinnerFan"
  | "kamikazeSweep"
  | "tankSiege"
  | "meteorShower";

interface LevelEvent {
  kind: LevelEventKind;
  time: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return (
    Math.abs(ax - bx) < (aw + bw) * 0.5 &&
    Math.abs(ay - by) < (ah + bh) * 0.5
  );
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cbs: GameCallbacks;
  private readonly audio = new AudioManager();
  private readonly keys = new Set<string>();

  private W = 0;
  private H = 0;
  private raf = 0;
  private last = 0;
  private launched = false;
  private paused = false;
  private playing = false;

  private player: PlayerState = {
    x: 0,
    y: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    tilt: 0,
    alive: true,
    invincible: 0,
    fireCooldown: 0,
    shield: 0,
    rapid: 0,
  };

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private powerups: PowerUp[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private stars: Star[] = [];

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private high = 0;
  private time = 0;
  private spawnTimer = BASE_SPAWN_INTERVAL;
  private nextId = 1;
  private shake = 0;
  private flash = 0;
  private pointerId: number | null = null;
  private pointerX: number | null = null;

  private combo = 0;
  private comboTimer = 0;
  private lastMult = 1;

  private banner: string | null = null;
  private bannerTimer = 0;
  private bannerSub: string | null = null;
  private events: LevelEvent[] = [];
  private chapter = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.cbs = callbacks;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available.");
    this.ctx = ctx;
    this.high = loadHighScore();
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.bindInput();
  }

  launch(): void {
    if (this.launched) return;
    this.launched = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  beginGame(): void {
    this.audio.unlock();
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.high = loadHighScore();
    this.time = 0;
    this.spawnTimer = BASE_SPAWN_INTERVAL * 0.5;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastMult = 1;
    this.banner = null;
    this.playing = true;
    this.paused = false;
    this.player.x = this.W / 2;
    this.player.y = this.H - 90;
    this.player.vx = 0;
    this.player.tilt = 0;
    this.player.alive = true;
    this.player.invincible = 1;
    this.player.fireCooldown = 0;
    this.player.shield = 0;
    this.player.rapid = 0;
    this.cbs.onScore(this.score);
    this.cbs.onLives(this.lives);
    this.cbs.onLevel(this.level);
    this.cbs.onCombo(1);
    this.chapter = this.chapterFor(this.level);
    this.initStars();
    this.events = this.buildLevelEvents(this.level);
    this.setBanner(`BÖLÜM ${this.chapter + 1}`, CHAPTERS[this.chapter].name);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.last = 0;
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  toMenu(): void {
    this.playing = false;
    this.paused = false;
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.player.alive = true;
    this.player.x = this.W / 2;
    this.player.y = this.H - 90;
    this.player.vx = 0;
    this.player.tilt = 0;
    this.player.invincible = 0;
    this.player.shield = 0;
    this.player.rapid = 0;
    this.events = [];
    this.banner = null;
    this.bannerSub = null;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.player.x = clamp(this.player.x, this.player.w / 2, this.W - this.player.w / 2);
    this.player.y = this.H - 90;
    this.initStars();
  }

  private initStars(): void {
    const count = clamp(Math.floor((this.W * this.H) / 3600), 40, 150);
    const speedBase = 24 + this.chapter * 14;
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      size: Math.random() * 1.6 + 0.4,
      speed: speedBase + Math.random() * 70,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  private chapterFor(level: number): number {
    return Math.floor((level - 1) / 5) % CHAPTERS.length;
  }

  private bindInput(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", this.onPointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", this.onPointerUp, { passive: false });
    this.canvas.addEventListener("pointercancel", this.onPointerUp, { passive: false });
    this.canvas.addEventListener("pointerleave", this.onPointerLeave, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private rectX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return clientX - rect.left;
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.audio.unlock();
    this.pointerId = e.pointerId;
    this.pointerX = this.rectX(e.clientX);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId || this.pointerId === null) {
      this.pointerX = this.rectX(e.clientX);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.pointerId === e.pointerId) this.pointerId = null;
  };

  private onPointerLeave = (): void => {
    if (this.pointerId === null) this.pointerX = null;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (["arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
    this.keys.add(key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.last === 0) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (!this.paused) this.update(dt);
    this.render();
  };

  private update(dt: number): void {
    this.time += dt;
    this.updateStars(dt);
    this.advanceLevel();
    this.updateEvents();
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.updatePopups(dt);
    this.updateCombo(dt);
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 55);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.banner) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        this.bannerSub = null;
      }
    }
  }

  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > this.H + 2) {
        star.y = -2;
        star.x = Math.random() * this.W;
      }
    }
  }

  private setBanner(text: string, sub: string | null = null): void {
    this.banner = text;
    this.bannerSub = sub;
    this.bannerTimer = 2.2;
  }

  private advanceLevel(): void {
    if (!this.playing) return;
    const next = Math.floor(this.time / LEVEL_DURATION) + 1;
    if (next !== this.level) {
      this.level = next;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
      const bonus = this.level * 100;
      this.score += bonus;
      this.cbs.onScore(this.score);
      if (this.player.alive) {
        this.addPopup(
          this.player.x,
          this.player.y - 44,
          `SEVİYE TEMİZ +${bonus}`,
          "#8df0ff",
          15,
        );
      }
      this.events = this.buildLevelEvents(this.level);
      const newChapter = this.chapterFor(next);
      if (newChapter !== this.chapter) {
        this.chapter = newChapter;
        this.initStars();
        this.audio.chapter();
        this.flash = Math.max(this.flash, 0.6);
        this.shake = 12;
        this.setBanner(`BÖLÜM ${this.chapter + 1}`, CHAPTERS[this.chapter].name);
      } else {
        this.setBanner(`SEVİYE ${this.level}`);
      }
    }
  }

  private levelWindow(): number {
    return this.time - (this.level - 1) * LEVEL_DURATION;
  }

  private buildLevelEvents(level: number): LevelEvent[] {
    const pool = this.eventPool(level);
    const count = level === 1 ? 1 : level === 2 ? 2 : 3;
    const events: LevelEvent[] = [];
    const slot = (LEVEL_DURATION - 3) / Math.max(count, 1);
    for (let i = 0; i < count; i++) {
      const kind = pool[Math.floor(Math.random() * pool.length)];
      const time = Math.min(1.5 + i * slot + Math.random() * slot * 0.6, LEVEL_DURATION - 1.2);
      events.push({ kind, time });
    }
    return events;
  }

  private eventPool(level: number): LevelEventKind[] {
    const pool: LevelEventKind[] =
      level === 1 ? ["droneSpiral"] : ["droneSpiral", "fighterWing"];
    if (level >= 3) pool.push("spinnerFan");
    if (level >= 4) pool.push("kamikazeSweep");
    if (level >= 5) pool.push("tankSiege");
    if (this.chapterFor(level) >= 2) pool.push("meteorShower");
    return pool;
  }

  private updateEvents(): void {
    if (!this.playing) return;
    const window = this.levelWindow();
    const due = this.events.filter((e) => window >= e.time);
    if (due.length === 0) return;
    this.events = this.events.filter((e) => window < e.time);
    if (this.enemies.length >= MAX_ENEMIES) return;
    for (const ev of due) this.spawnEvent(ev.kind);
  }

  private spawnEvent(kind: LevelEventKind): void {
    switch (kind) {
      case "droneSpiral":
        this.spawnDroneSpiral();
        break;
      case "fighterWing":
        this.spawnFighterWing();
        break;
      case "spinnerFan":
        this.spawnSpinnerFan();
        break;
      case "kamikazeSweep":
        this.spawnKamikazeSweep();
        break;
      case "tankSiege":
        this.spawnTankSiege();
        break;
      case "meteorShower":
        this.spawnMeteorShower();
        break;
    }
  }

  private spawnDroneSpiral(): void {
    const count = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = ENEMY_DEFS.drone.w / 2 + t * (this.W - ENEMY_DEFS.drone.w);
      const y = -50 - Math.sin(t * Math.PI * 2) * 44;
      this.pushEnemy("drone", x, y);
    }
  }

  private spawnFighterWing(): void {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = this.W / 2 + side * (26 + i * 34);
        const y = -26 - i * 30;
        this.pushEnemy("fighter", x, y);
      }
    }
  }

  private spawnSpinnerFan(): void {
    for (let i = 0; i < 4; i++) {
      const x = (this.W * (i + 0.5)) / 4;
      this.pushEnemy("spinner", x, -ENEMY_DEFS.spinner.h - 10);
    }
  }

  private spawnKamikazeSweep(): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const x = (this.W * (i + 0.5)) / count + (Math.random() - 0.5) * 16;
      const y = -40 - i * 20;
      this.pushEnemy("kamikaze", x, y);
    }
  }

  private spawnTankSiege(): void {
    for (let i = 0; i < 3; i++) {
      const x = (this.W * (i + 0.5)) / 3 + (Math.random() - 0.5) * 8;
      this.pushEnemy("tank", x, -ENEMY_DEFS.tank.h - 20 - i * 34);
    }
  }

  private spawnMeteorShower(): void {
    const count = 7 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const x = (this.W * (i + 0.5)) / count + (Math.random() - 0.5) * 20;
      const y = -60 - i * 26;
      this.pushEnemy("meteor", x, y);
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const moveLeft = this.keys.has("arrowleft") || this.keys.has("a");
    const moveRight = this.keys.has("arrowright") || this.keys.has("d");

    const prevX = p.x;
    if (moveLeft && !moveRight) {
      p.x -= PLAYER_SPEED * dt;
    } else if (moveRight && !moveLeft) {
      p.x += PLAYER_SPEED * dt;
    } else if (this.pointerX !== null && p.alive) {
      const dx = this.pointerX - p.x;
      const step = PLAYER_SPEED * dt;
      if (Math.abs(dx) <= step) p.x = this.pointerX;
      else p.x += Math.sign(dx) * step;
    }
    if (p.alive) p.x = clamp(p.x, p.w / 2, this.W - p.w / 2);
    p.vx = dt > 0 ? (p.x - prevX) / dt : 0;
    const targetTilt = clamp((p.vx / PLAYER_SPEED) * 0.4, -0.4, 0.4);
    p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 12);

    if (p.invincible > 0) p.invincible -= dt;
    if (p.shield > 0) p.shield -= dt;
    if (p.rapid > 0) p.rapid -= dt;

    if (p.alive && Math.abs(p.vx) > 90 && Math.random() < 0.6) {
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * 10,
        y: p.y + p.h * 0.45,
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 40,
        life: 0.2,
        maxLife: 0.28,
        size: 2 + Math.random() * 2,
        color: "#5ad8ff",
        gravity: 0,
      });
    }

    p.fireCooldown -= dt;
    if (p.alive && this.playing && p.fireCooldown <= 0) {
      p.fireCooldown = p.rapid > 0 ? PLAYER_FIRE_RATE * 0.55 : PLAYER_FIRE_RATE;
      this.firePlayerBullets();
    }
  }

  private firePlayerBullets(): void {
    if (this.bullets.length >= MAX_BULLETS) return;
    const p = this.player;
    const y = p.y - 16;
    if (p.rapid > 0) {
      const spread = 22;
      this.spawnBullet(p.x - spread, y, -PLAYER_BULLET_SPEED, true);
      this.spawnBullet(p.x, y - 6, -PLAYER_BULLET_SPEED - 60, true);
      this.spawnBullet(p.x + spread, y, -PLAYER_BULLET_SPEED, true);
    } else {
      const cannon = 11;
      this.spawnBullet(p.x - cannon, y, -PLAYER_BULLET_SPEED, true);
      this.spawnBullet(p.x + cannon, y, -PLAYER_BULLET_SPEED, true);
    }
    this.audio.shoot();
  }

  private spawnBullet(
    x: number,
    y: number,
    vy: number,
    friendly: boolean,
    vx = 0,
  ): void {
    this.bullets.push({
      id: this.nextId++,
      x,
      y,
      w: friendly ? 5 : 6,
      h: 14,
      vx,
      vy,
      alive: true,
      friendly,
      damage: 1,
    });
  }

  private updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (
        bullet.y < -30 ||
        bullet.y > this.H + 30 ||
        bullet.x < -30 ||
        bullet.x > this.W + 30
      ) {
        bullet.alive = false;
        continue;
      }
      if (bullet.friendly) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (
            overlaps(
              bullet.x,
              bullet.y,
              bullet.w,
              bullet.h,
              enemy.x,
              enemy.y,
              enemy.w,
              enemy.h,
            )
          ) {
            bullet.alive = false;
            this.hitEnemy(enemy);
            break;
          }
        }
      } else if (
        this.player.alive &&
        overlaps(
          bullet.x,
          bullet.y,
          bullet.w,
          bullet.h,
          this.player.x,
          this.player.y,
          this.player.w * 0.7,
          this.player.h * 0.7,
        )
      ) {
        bullet.alive = false;
        this.damagePlayer();
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  private hitEnemy(enemy: Enemy): void {
    const def = ENEMY_DEFS[enemy.kind];
    enemy.hp -= 1;
    enemy.flash = 0.1;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.killEnemy(enemy, def);
    } else {
      this.audio.hit();
      this.explode(enemy.x, enemy.y, def.color, 7, 1.3);
    }
  }

  private killEnemy(enemy: Enemy, def: (typeof ENEMY_DEFS)[EnemyKind]): void {
    const mult = this.multiplier();
    const gain = def.score * mult;
    this.score += gain;
    this.cbs.onScore(this.score);
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    this.cbs.onCombo(this.multiplier());
    this.addPopup(enemy.x, enemy.y - 8, `+${gain}`, def.color, mult > 1 ? 16 : 13);
    const big = enemy.kind === "tank" || enemy.kind === "spinner";
    this.audio.explosion(big);
    this.shake = Math.min(14, this.shake + (big ? 6 : 3));
    this.explode(enemy.x, enemy.y, def.color, big ? 32 : 20, big ? 4 : 2.4);
    this.maybeDropPowerUp(enemy);
  }

  private maybeDropPowerUp(enemy: Enemy): void {
    let chance: number;
    switch (enemy.kind) {
      case "drone":
        chance = 0.07;
        break;
      case "fighter":
        chance = 0.15;
        break;
      case "tank":
        chance = 0.32;
        break;
      case "spinner":
        chance = 0.24;
        break;
      default:
        chance = 0.12;
        break;
    }
    if (Math.random() >= chance || this.powerups.length >= MAX_POWERUPS) return;
    const roll = Math.random();
    let kind: PowerKind;
    if (this.lives < START_LIVES && roll < 0.18) kind = "life";
    else if (roll < 0.5) kind = "shield";
    else if (roll < 0.85) kind = "rapid";
    else kind = "bomb";
    this.spawnPowerUp(kind, enemy.x, enemy.y);
  }

  private spawnPowerUp(kind: PowerKind, x: number, y: number): void {
    this.powerups.push({
      id: this.nextId++,
      x,
      y,
      w: 26,
      h: 26,
      vx: 0,
      vy: POWERUP_SPEED,
      alive: true,
      kind,
      rot: Math.random() * Math.PI * 2,
    });
  }

  private updatePowerups(dt: number): void {
    for (const pu of this.powerups) {
      pu.y += pu.vy * dt;
      pu.rot += dt * 3;
      if (pu.y > this.H + 30) {
        pu.alive = false;
        continue;
      }
      if (
        this.player.alive &&
        overlaps(
          pu.x,
          pu.y,
          pu.w,
          pu.h,
          this.player.x,
          this.player.y,
          this.player.w * 0.9,
          this.player.h * 0.9,
        )
      ) {
        pu.alive = false;
        this.applyPowerUp(pu);
      }
    }
    this.powerups = this.powerups.filter((p) => p.alive);
  }

  private applyPowerUp(pu: PowerUp): void {
    const info = POWERUP_INFO[pu.kind];
    this.addPopup(this.player.x, this.player.y - 44, info.label, info.color, 15);
    switch (pu.kind) {
      case "shield":
        this.player.shield = SHIELD_TIME;
        this.audio.powerup();
        break;
      case "rapid":
        this.player.rapid = RAPID_TIME;
        this.audio.powerup();
        break;
      case "bomb":
        this.triggerBomb();
        break;
      case "life":
        if (this.lives < MAX_LIVES) {
          this.lives++;
          this.cbs.onLives(this.lives);
          this.audio.powerup();
        } else {
          this.score += 300;
          this.cbs.onScore(this.score);
          this.audio.powerup();
        }
        break;
    }
  }

  private triggerBomb(): void {
    let gained = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const def = ENEMY_DEFS[enemy.kind];
      gained += def.score;
      this.explode(enemy.x, enemy.y, def.color, 18, 3);
      enemy.alive = false;
    }
    for (const bullet of this.bullets) {
      if (!bullet.friendly) bullet.alive = false;
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.bullets = this.bullets.filter((b) => b.alive);
    if (gained > 0) {
      this.score += gained;
      this.cbs.onScore(this.score);
      this.addPopup(this.player.x, this.player.y - 66, `+${gained}`, "#ff9f43", 16);
    }
    this.audio.bomb();
    this.flash = Math.max(this.flash, 0.7);
    this.shake = 18;
  }

  private updateEnemies(dt: number): void {
    if (this.playing && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer =
          Math.max(0.3, BASE_SPAWN_INTERVAL - (this.level - 1) * 0.08) *
          (0.75 + Math.random() * 0.5);
        if (Math.random() < 0.3 && this.level >= 2) this.spawnDroneLine();
        else this.spawnEnemy();
      }
    }

    const mult = 1 + (this.level - 1) * 0.12;
    for (const enemy of this.enemies) {
      enemy.rot += enemy.rotSpeed * dt;
      enemy.y += enemy.vy * dt;
      enemy.wobble += enemy.wobbleSpeed * dt;
      enemy.x = enemy.baseX + Math.sin(enemy.wobble * 2) * 20 * mult;
      enemy.x = clamp(enemy.x, enemy.w / 2, this.W - enemy.w / 2);
      if (enemy.flash > 0) enemy.flash -= dt;

      if (this.playing && enemy.y > 10) {
        if (enemy.kind === "spinner" && enemy.y < this.H * 0.8) {
          enemy.shootTimer -= dt;
          if (enemy.shootTimer <= 0 && this.bullets.length < MAX_BULLETS) {
            enemy.shootTimer = ENEMY_DEFS.spinner.shootEvery * (0.85 + Math.random() * 0.3);
            this.fireSpinnerBullets(enemy);
          }
        } else if (ENEMY_DEFS[enemy.kind].shoot && enemy.y < this.H * 0.78) {
          enemy.shootTimer -= dt;
          if (enemy.shootTimer <= 0 && this.bullets.length < MAX_BULLETS) {
            enemy.shootTimer = ENEMY_DEFS[enemy.kind].shootEvery * (0.8 + Math.random() * 0.5);
            this.fireEnemyBullet(enemy);
          }
        }
      }

      if (enemy.kind === "kamikaze" && !enemy.dive && enemy.y > this.H * 0.22 && this.player.alive) {
        enemy.dive = true;
      }
      if (enemy.kind === "kamikaze" && enemy.dive && this.player.alive) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 230 * mult;
        enemy.vx = (dx / dist) * speed;
        enemy.vy = (dy / dist) * speed;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
      }

      if (enemy.y > this.H + 70) enemy.alive = false;

      if (
        enemy.alive &&
        this.player.alive &&
        overlaps(
          enemy.x,
          enemy.y,
          enemy.w,
          enemy.h,
          this.player.x,
          this.player.y,
          this.player.w * 0.7,
          this.player.h * 0.7,
        )
      ) {
        enemy.alive = false;
        this.damagePlayer();
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private fireEnemyBullet(enemy: Enemy): void {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = ENEMY_BULLET_SPEED * (0.9 + Math.random() * 0.2);
    this.spawnBulletWithVelocity(
      enemy.x,
      enemy.y + enemy.h * 0.4,
      (dx / dist) * speed,
      (dy / dist) * speed,
      false,
    );
    this.audio.enemyShot();
  }

  private fireSpinnerBullets(enemy: Enemy): void {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const aim = Math.atan2(dy, dx);
    const speed = ENEMY_BULLET_SPEED * 0.9;
    for (const offset of [-0.45, 0, 0.45]) {
      const angle = aim + offset;
      this.spawnBulletWithVelocity(
        enemy.x,
        enemy.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        false,
      );
    }
    this.audio.enemyShot();
  }

  private spawnBulletWithVelocity(
    x: number,
    y: number,
    vx: number,
    vy: number,
    friendly: boolean,
  ): void {
    this.bullets.push({
      id: this.nextId++,
      x,
      y,
      w: 6,
      h: 14,
      vx,
      vy,
      alive: true,
      friendly,
      damage: 1,
    });
  }

  private spawnEnemy(): void {
    const kind = this.pickKind();
    const def = ENEMY_DEFS[kind];
    const x = clamp(
      def.w / 2 + 10 + Math.random() * Math.max(0, this.W - def.w - 20),
      def.w / 2,
      this.W - def.w / 2,
    );
    this.pushEnemy(kind, x, -def.h - 8);
  }

  private spawnDroneLine(): void {
    const count = Math.min(6, 4 + Math.floor(Math.random() * 2));
    const spacing = 48;
    const total = (count - 1) * spacing;
    const cx = this.W / 2;
    for (let i = 0; i < count; i++) {
      const x = cx - total / 2 + i * spacing;
      const y = -20 - i * 14;
      this.pushEnemy("drone", x, y);
    }
  }

  private pushEnemy(kind: EnemyKind, x: number, y: number): void {
    const def = ENEMY_DEFS[kind];
    const mult = 1 + (this.level - 1) * 0.12;
    this.enemies.push({
      id: this.nextId++,
      kind,
      x,
      y,
      w: def.w,
      h: def.h,
      vx: 0,
      vy: def.speed * mult * (0.85 + Math.random() * 0.35),
      alive: true,
      hp: def.hp,
      baseX: x,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 1.6,
      shootTimer: 1.1 + Math.random() * 1.8,
      rot: 0,
      rotSpeed: 1 + Math.random(),
      flash: 0,
      dive: false,
    });
  }

  private pickKind(): EnemyKind {
    const lvl = this.level;
    const fw = Math.min(0.36, 0.1 + lvl * 0.03);
    const tw = Math.min(0.22, 0.02 + lvl * 0.02);
    const sw = lvl >= 3 ? Math.min(0.22, 0.05 + lvl * 0.02) : 0;
    const kw = lvl >= 4 ? Math.min(0.24, 0.04 + lvl * 0.02) : 0;
    const mw = this.chapterFor(lvl) >= 2 ? Math.min(0.2, 0.08 + lvl * 0.008) : 0;
    let roll = Math.random();
    if (roll < mw) return "meteor";
    roll -= mw;
    if (roll < tw) return "tank";
    roll -= tw;
    if (roll < fw) return "fighter";
    roll -= fw;
    if (roll < sw) return "spinner";
    roll -= sw;
    if (roll < kw) return "kamikaze";
    return "drone";
  }

  private damagePlayer(): void {
    const p = this.player;
    if (!p.alive || p.invincible > 0) return;
    if (p.shield > 0) {
      p.shield = 0;
      this.addPopup(p.x, p.y - 44, "KALKAN KIRILDI", "#4dd6ff", 14);
      this.explode(p.x, p.y, "#4dd6ff", 26, 3);
      this.audio.hit();
      this.shake = Math.min(14, this.shake + 8);
      p.invincible = 0.8;
      for (const bullet of this.bullets) {
        if (!bullet.friendly) bullet.alive = false;
      }
      this.bullets = this.bullets.filter((b) => b.alive);
      return;
    }
    this.lives--;
    this.cbs.onLives(this.lives);
    this.audio.hit();
    this.explode(p.x, p.y, "#6ff3ff", 26, 3);
    this.shake = Math.min(16, this.shake + 9);
    this.flash = 1;
    p.invincible = INVINCIBLE_TIME;
    for (const bullet of this.bullets) {
      if (!bullet.friendly) bullet.alive = false;
    }
    this.bullets = this.bullets.filter((b) => b.alive);
    if (this.lives <= 0) this.finishGame();
  }

  private finishGame(): void {
    this.playing = false;
    this.player.alive = false;
    this.explode(this.player.x, this.player.y, "#6ff3ff", 42, 5);
    this.shake = 20;
    this.flash = 1;
    this.audio.gameOver();
    this.cbs.onCombo(1);
    const record = this.score > this.high && this.score > 0;
    this.high = Math.max(this.high, this.score);
    saveHighScore(this.high);
    this.cbs.onGameOver({
      score: this.score,
      highScore: this.high,
      isRecord: record,
    });
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updatePopups(dt: number): void {
    for (const popup of this.popups) {
      popup.life -= dt;
      popup.y += popup.vy * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  private addPopup(
    x: number,
    y: number,
    text: string,
    color: string,
    size = 14,
  ): void {
    this.popups.push({
      x,
      y,
      vy: -46,
      life: 0.9,
      maxLife: 0.9,
      text,
      color,
      size,
    });
  }

  private updateCombo(dt: number): void {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    const m = this.multiplier();
    if (m !== this.lastMult) {
      this.lastMult = m;
      this.cbs.onCombo(m);
    }
  }

  private multiplier(): number {
    return Math.min(1 + Math.floor(this.combo / 5), 8);
  }

  private explode(x: number, y: number, color: string, count: number, size: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * (120 + size * 30);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: size * (0.5 + Math.random() * 0.9),
        color,
        gravity: 60,
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const { W, H, shake } = this;

    ctx.save();
    paintBackground(ctx, W, H, this.time, this.stars, CHAPTERS[this.chapter]);

    ctx.save();
    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    }
    for (const pu of this.powerups) paintPowerUp(ctx, pu, this.time);
    for (const bullet of this.bullets) paintBullet(ctx, bullet);
    for (const enemy of this.enemies) paintEnemy(ctx, enemy, this.time);
    if (this.player.alive) paintPlayer(ctx, this.player, this.time);
    paintParticles(ctx, this.particles);
    paintPopups(ctx, this.popups);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.banner) paintBanner(ctx, W, H, this.banner, this.bannerTimer, this.bannerSub);
    ctx.restore();
  }
}