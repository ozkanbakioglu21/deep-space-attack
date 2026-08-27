import { AudioManager } from "./audio";
import { loadHighScore, saveHighScore } from "./storage";
import {
  BASE_SPAWN_INTERVAL,
  ENEMY_BULLET_SPEED,
  INVINCIBLE_TIME,
  LEVEL_DURATION,
  MAX_BULLETS,
  MAX_ENEMIES,
  PLAYER_BULLET_SPEED,
  PLAYER_FIRE_RATE,
  PLAYER_H,
  PLAYER_SPEED,
  PLAYER_W,
  START_LIVES,
} from "./constants";
import type {
  Bullet,
  Enemy,
  EnemyDef,
  EnemyKind,
  GameCallbacks,
  Particle,
  Star,
} from "./types";

const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  drone: {
    w: 34,
    h: 30,
    hp: 1,
    speed: 80,
    score: 100,
    color: "#ff5d7a",
    shoot: false,
    shootEvery: 0,
  },
  fighter: {
    w: 40,
    h: 36,
    hp: 1,
    speed: 125,
    score: 180,
    color: "#b18cff",
    shoot: true,
    shootEvery: 2.3,
  },
  tank: {
    w: 54,
    h: 48,
    hp: 3,
    speed: 62,
    score: 320,
    color: "#38e1ff",
    shoot: true,
    shootEvery: 2.9,
  },
};

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  tilt: number;
  alive: boolean;
  invincible: number;
  fireCooldown: number;
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

  private player: Player = {
    x: 0,
    y: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    tilt: 0,
    alive: true,
    invincible: 0,
    fireCooldown: 0,
  };

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
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
    this.particles = [];
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.high = loadHighScore();
    this.time = 0;
    this.spawnTimer = BASE_SPAWN_INTERVAL * 0.5;
    this.playing = true;
    this.paused = false;
    this.player.x = this.W / 2;
    this.player.y = this.H - 90;
    this.player.vx = 0;
    this.player.tilt = 0;
    this.player.alive = true;
    this.player.invincible = 1;
    this.player.fireCooldown = 0;
    this.cbs.onScore(this.score);
    this.cbs.onLives(this.lives);
    this.cbs.onLevel(this.level);
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
    this.particles = [];
    this.player.alive = true;
    this.player.x = this.W / 2;
    this.player.y = this.H - 90;
    this.player.vx = 0;
    this.player.tilt = 0;
    this.player.invincible = 0;
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
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      size: Math.random() * 1.6 + 0.4,
      speed: 24 + Math.random() * 70,
      twinkle: Math.random() * Math.PI * 2,
    }));
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
    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 55);
    this.flash = Math.max(0, this.flash - dt * 2.2);
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

  private advanceLevel(): void {
    if (!this.playing) return;
    const next = Math.floor(this.time / LEVEL_DURATION) + 1;
    if (next !== this.level) {
      this.level = next;
      this.cbs.onLevel(this.level);
      this.audio.levelUp();
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
    if (p.alive) {
      p.x = clamp(p.x, p.w / 2, this.W - p.w / 2);
    }
    p.vx = dt > 0 ? (p.x - prevX) / dt : 0;
    const targetTilt = clamp((p.vx / PLAYER_SPEED) * 0.4, -0.4, 0.4);
    p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 12);

    if (p.invincible > 0) p.invincible -= dt;
    p.fireCooldown -= dt;
    if (p.alive && this.playing && p.fireCooldown <= 0) {
      p.fireCooldown = PLAYER_FIRE_RATE;
      this.firePlayerBullets();
    }
  }

  private firePlayerBullets(): void {
    if (this.bullets.length >= MAX_BULLETS) return;
    const y = this.player.y - 16;
    const cannon = 11;
    this.spawnBullet(this.player.x - cannon, y, -PLAYER_BULLET_SPEED, true);
    this.spawnBullet(this.player.x + cannon, y, -PLAYER_BULLET_SPEED, true);
    this.audio.shoot();
  }

  private spawnBullet(x: number, y: number, vy: number, friendly: boolean): void {
    this.bullets.push({
      id: this.nextId++,
      x,
      y,
      w: friendly ? 5 : 6,
      h: friendly ? 14 : 14,
      vx: 0,
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
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.score += def.score;
      this.cbs.onScore(this.score);
      const tank = enemy.kind === "tank";
      this.audio.explosion(tank);
      this.shake = Math.min(14, this.shake + (tank ? 6 : 3));
      this.explode(enemy.x, enemy.y, def.color, tank ? 34 : 20, tank ? 4 : 2.4);
    } else {
      this.audio.hit();
      this.explode(enemy.x, enemy.y, def.color, 8, 1.4);
    }
  }

  private updateEnemies(dt: number): void {
    if (this.playing && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer =
          Math.max(0.3, BASE_SPAWN_INTERVAL - (this.level - 1) * 0.08) *
          (0.75 + Math.random() * 0.5);
        this.spawnEnemy();
      }
    }

    const mult = 1 + (this.level - 1) * 0.12;
    for (const enemy of this.enemies) {
      enemy.y += enemy.vy * dt;
      enemy.wobble += enemy.wobbleSpeed * dt;
      enemy.x = enemy.baseX + Math.sin(enemy.wobble * 2) * 20 * mult;
      enemy.x = clamp(enemy.x, enemy.w / 2, this.W - enemy.w / 2);

      const def = ENEMY_DEFS[enemy.kind];
      if (def.shoot && this.playing && enemy.y > 10 && enemy.y < this.H * 0.78) {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && this.bullets.length < MAX_BULLETS) {
          enemy.shootTimer = def.shootEvery * (0.8 + Math.random() * 0.5);
          this.fireEnemyBullet(enemy);
        }
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
    const bullet: Bullet = {
      id: this.nextId++,
      x: enemy.x,
      y: enemy.y + enemy.h * 0.4,
      w: 6,
      h: 14,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      alive: true,
      friendly: false,
      damage: 1,
    };
    this.bullets.push(bullet);
    this.audio.enemyShot();
  }

  private spawnEnemy(): void {
    const kind = this.pickKind();
    const def = ENEMY_DEFS[kind];
    const mult = 1 + (this.level - 1) * 0.12;
    const x = clamp(
      def.w / 2 + 10 + Math.random() * (this.W - def.w - 20),
      def.w / 2,
      this.W - def.w / 2,
    );
    this.enemies.push({
      id: this.nextId++,
      kind,
      x,
      y: -def.h - 8,
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
    });
  }

  private pickKind(): EnemyKind {
    const lvl = this.level;
    const fighterW = Math.min(0.36, 0.1 + lvl * 0.03);
    const tankW = Math.min(0.22, 0.02 + lvl * 0.02);
    const roll = Math.random();
    if (roll < tankW) return "tank";
    if (roll < tankW + fighterW) return "fighter";
    return "drone";
  }

  private damagePlayer(): void {
    const p = this.player;
    if (!p.alive || p.invincible > 0) return;
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
    ctx.fillStyle = "#04040c";
    ctx.fillRect(0, 0, W, H);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#0c1233");
    gradient.addColorStop(0.55, "#070a1c");
    gradient.addColorStop(1, "#04040c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const nebula = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    nebula(W * 0.2, H * 0.18, W * 0.55, "rgba(88, 44, 255, 0.10)");
    nebula(W * 0.85, H * 0.5, W * 0.5, "rgba(255, 60, 160, 0.07)");
    nebula(W * 0.3, H * 0.82, W * 0.5, "rgba(0, 200, 255, 0.06)");

    ctx.save();
    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake,
      );
    }

    for (const star of this.stars) {
      ctx.globalAlpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(this.time * 2 + star.twinkle));
      ctx.fillStyle = "#cfe8ff";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    this.renderBullets();
    for (const enemy of this.enemies) this.renderEnemy(enemy);
    if (this.player.alive) this.renderPlayer();

    for (const particle of this.particles) {
      const t = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = t;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  private renderPlayer(): void {
    const ctx = this.ctx;
    const p = this.player;
    const blink = p.invincible > 0 && Math.floor(this.time * 14) % 2 === 0;
    const flicker = 5 + Math.random() * 6;
    const x = p.x;
    const y = p.y + Math.sin(this.time * 4) * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.tilt);
    if (blink) ctx.globalAlpha = 0.35;

    const flame = ctx.createLinearGradient(0, p.h * 0.42, 0, p.h * 0.42 + flicker + 8);
    flame.addColorStop(0, "rgba(255,180,60,0.95)");
    flame.addColorStop(0.55, "rgba(255,90,40,0.7)");
    flame.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-6, p.h * 0.42);
    ctx.lineTo(0, p.h * 0.42 + flicker + 10);
    ctx.lineTo(6, p.h * 0.42);
    ctx.closePath();
    ctx.fill();

    const body = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
    body.addColorStop(0, "#dffcff");
    body.addColorStop(0.5, "#46c6f5");
    body.addColorStop(1, "#0e4f8f");
    ctx.fillStyle = body;
    ctx.strokeStyle = "#8df0ff";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(80,220,255,0.9)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -p.h / 2);
    ctx.lineTo(p.w / 2, -p.h * 0.05);
    ctx.lineTo(p.w * 0.3, p.h * 0.28);
    ctx.lineTo(p.w * 0.14, p.h * 0.42);
    ctx.lineTo(-p.w * 0.14, p.h * 0.42);
    ctx.lineTo(-p.w * 0.3, p.h * 0.28);
    ctx.lineTo(-p.w / 2, -p.h * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(220,250,255,0.9)";
    ctx.beginPath();
    ctx.arc(0, p.h * 0.02, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, -p.h * 0.05);
    ctx.lineTo(-p.w * 0.18, -p.h * 0.18);
    ctx.moveTo(p.w / 2, -p.h * 0.05);
    ctx.lineTo(p.w * 0.18, -p.h * 0.18);
    ctx.stroke();

    ctx.restore();
  }

  private renderBullets(): void {
    const ctx = this.ctx;
    for (const bullet of this.bullets) {
      const friendly = bullet.friendly;
      const color = friendly ? "#8df0ff" : "#ff5d7a";
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      const w = bullet.w;
      const h = bullet.h;
      if (friendly) {
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
      } else {
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, 0);
        ctx.lineTo(0, h / 2);
        ctx.lineTo(-w / 2, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  private renderEnemy(enemy: Enemy): void {
    const ctx = this.ctx;
    const def = ENEMY_DEFS[enemy.kind];
    const x = enemy.x;
    const y = enemy.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10;

    if (enemy.kind === "drone") {
      ctx.fillStyle = "#2a0f1d";
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -def.h / 2);
      ctx.lineTo(def.w * 0.34, -def.h * 0.2);
      ctx.lineTo(def.w / 2, def.h * 0.25);
      ctx.lineTo(def.w * 0.22, def.h / 2);
      ctx.lineTo(-def.w * 0.22, def.h / 2);
      ctx.lineTo(-def.w / 2, def.h * 0.25);
      ctx.lineTo(-def.w * 0.34, -def.h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, def.h * 0.08, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === "fighter") {
      ctx.fillStyle = "#1d1435";
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -def.h / 2);
      ctx.lineTo(def.w / 2, def.h * 0.1);
      ctx.lineTo(def.w * 0.24, def.h / 2);
      ctx.lineTo(-def.w * 0.24, def.h / 2);
      ctx.lineTo(-def.w / 2, def.h * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.fillRect(-def.w * 0.18, -def.h * 0.18, def.w * 0.36, 4);
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(i === 0 ? -def.w * 0.32 : def.w * 0.32, def.h * 0.12, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#06222a";
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(angle) * (def.w / 2);
        const py = Math.sin(angle) * (def.h / 2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, -def.h * 0.32, 16, 3);
    }
    ctx.restore();
  }
}