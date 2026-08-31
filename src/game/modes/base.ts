import { AudioManager } from "../audio";
import { loadModeScore, saveModeScore } from "../storage";
import {
  paintBackground,
  paintBanner,
  paintParticles,
  paintPopups,
} from "../painter";
import { PLAYER_H, PLAYER_W } from "../constants";
import type {
  ChapterDef,
  Enemy,
  GameCallbacks,
  Particle,
  Popup,
  Star,
} from "../types";
import type { PlayerState } from "../engine";
import type { GameAdapter } from "./types";

export abstract class BaseMode implements GameAdapter {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected cbs: GameCallbacks;
  protected audio = new AudioManager();

  protected W = 360;
  protected H = 640;
  protected time = 0;
  protected score = 0;
  protected high = 0;
  protected lives = 0;
  protected level = 1;
  protected playing = false;
  protected paused = false;
  protected shake = 0;
  protected flash = 0;

  protected stars: Star[] = [];
  protected particles: Particle[] = [];
  protected popups: Popup[] = [];

  protected combo = 0;
  protected maxComboMult = 8;
  protected hitStop = 0;
  protected lastDt = 1 / 60;

  protected banner: string | null = null;
  protected bannerSub: string | null = null;
  protected bannerTimer = 0;

  protected keys = new Set<string>();
  protected pointerId: number | null = null;
  protected pointerX = 0;
  protected pointerY = 0;
  protected hasPointer = false;

  protected player: PlayerState = this.makePlayer();

  private raf = 0;
  private last = 0;
  private scoreKey: string;
  private maxLives: number;

  protected abstract get palette(): ChapterDef;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    scoreKey: string,
    maxLives = 3,
  ) {
    this.canvas = canvas;
    this.cbs = callbacks;
    this.scoreKey = scoreKey;
    this.maxLives = maxLives;
    this.lives = maxLives;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available.");
    this.ctx = ctx;
    this.high = loadModeScore(scoreKey);
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.bindInput();
  }

  launch(): void {
    if (this.raf) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
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
    this.popups = [];
    this.banner = null;
    this.bannerSub = null;
    this.combo = 0;
    this.hitStop = 0;
    this.resetIdle();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  // ---- Subclass hooks ----

  abstract beginGame(): void;
  protected abstract updateSub(dt: number): void;
  protected abstract renderEntities(ctx: CanvasRenderingContext2D): void;
  protected resetIdle(): void {}
  protected onPointerDownHook(): void {}
  protected onPointerMoveHook(): void {}
  protected onPointerUpHook(): void {}

  // ---- Loop ----

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
    this.lastDt = dt;
    let d = dt;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      d = dt * 0.1;
    }
    this.time += d;
    this.updateStars(d);
    this.updateParticles(d);
    this.updatePopups(d);
    if (this.banner) {
      this.bannerTimer -= d;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        this.bannerSub = null;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 55);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.playing) this.updateSub(d);
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

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updatePopups(dt: number): void {
    for (const popup of this.popups) {
      popup.y += popup.vy * dt;
      popup.life -= dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  private render(): void {
    const ctx = this.ctx;
    paintBackground(ctx, this.W, this.H, this.time, this.stars, this.palette);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }
    this.renderEntities(ctx);
    paintParticles(ctx, this.particles);
    paintPopups(ctx, this.popups);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.banner) paintBanner(ctx, this.W, this.H, this.banner, this.bannerTimer, this.bannerSub);
  }

  // ---- Shared helpers ----

  protected makePlayer(): PlayerState {
    return {
      x: this.W / 2,
      y: this.H - 90,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      tilt: 0,
      alive: true,
      invincible: 0,
      fireCooldown: 0,
      shield: 0,
      rapid: 0,
      magnet: 0,
      dual: 0,
      freeze: 0,
    };
  }

  protected startRun(): void {
    this.time = 0;
    this.score = 0;
    this.lives = this.maxLives;
    this.level = 1;
    this.playing = true;
    this.paused = false;
    this.flash = 0;
    this.shake = 0;
    this.particles = [];
    this.popups = [];
    this.banner = null;
    this.bannerSub = null;
    this.combo = 0;
    this.hitStop = 0;
    this.pointerId = null;
    this.hasPointer = false;
    this.keys.clear();
    this.player = this.makePlayer();
    this.cbs.onScore(0);
    this.cbs.onLives(this.lives);
    this.cbs.onLevel(1);
    this.cbs.onCombo(1);
  }

  protected finish(): void {
    this.playing = false;
    const isRecord = this.score > this.high;
    if (isRecord) {
      this.high = this.score;
      saveModeScore(this.scoreKey, this.score);
    }
    this.cbs.onGameOver({
      score: this.score,
      highScore: this.high,
      isRecord,
    });
  }

  protected bumpScore(n: number): void {
    this.score += n;
    this.cbs.onScore(this.score);
  }

  protected addPopup(
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

  protected explode(
    x: number,
    y: number,
    color: string,
    count = 16,
    size = 9,
    speed = 140,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        maxLife: life,
        size: size * (0.5 + Math.random() * 0.7),
        color,
        gravity: 120,
      });
    }
  }

  protected setBanner(text: string, sub: string | null = null, dur = 2.2): void {
    this.banner = text;
    this.bannerSub = sub;
    this.bannerTimer = dur;
  }

  protected overlaps(
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
      Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2
    );
  }

  protected registerHit(grace = 1.3): void {
    if (this.player.invincible > 0) return;
    this.lives--;
    this.cbs.onLives(this.lives);
    this.audio.hit();
    this.explode(this.player.x, this.player.y, "#6ff3ff", 26, 11, 190);
    this.shake = Math.min(16, this.shake + 9);
    this.flash = 1;
    this.vibrate(45);
    this.player.invincible = grace;
    this.resetCombo();
    if (this.lives <= 0) {
      this.player.alive = false;
      this.finish();
    }
  }

  protected comboMul(): number {
    return Math.min(1 + Math.floor(this.combo / 5), this.maxComboMult);
  }

  protected bumpCombo(): void {
    this.combo++;
    this.cbs.onCombo(this.comboMul());
  }

  protected resetCombo(): void {
    this.combo = 0;
    this.cbs.onCombo(1);
  }

  protected addHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  protected vibrate(ms: number): void {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  }

  protected spawnThruster(color = "#8df0ff"): void {
    const p = this.player;
    if (!p.alive) return;
    const tailX = p.x - Math.sin(p.tilt) * p.h * 0.45;
    const tailY = p.y + Math.cos(p.tilt) * p.h * 0.45;
    this.particles.push({
      x: tailX + (Math.random() - 0.5) * 6,
      y: tailY,
      vx: (Math.random() - 0.5) * 26 - 16,
      vy: -30 - Math.random() * 40,
      life: 0.28 + Math.random() * 0.16,
      maxLife: 0.42,
      size: 2 + Math.random() * 2.2,
      color,
      gravity: 0,
    });
  }

  protected applyNearMiss(
    m: Enemy,
    bonus: number,
    label: string,
    color: string,
  ): boolean {
    if (!m.alive || m.nearMissed) return false;
    const p = this.player;
    const hitTh = (m.w + p.w * 0.7) / 2;
    const nearTh = hitTh + 22;
    const prevY = m.y - m.vy * this.lastDt;
    const crossed = prevY <= p.y && m.y > p.y;
    if (!crossed) return false;
    const dx = Math.abs(m.x - p.x);
    if (dx >= hitTh && dx <= nearTh) {
      m.nearMissed = true;
      this.bumpScore(bonus);
      this.addPopup(m.x, p.y - 26, `${label} +${bonus}`, color, 15);
      this.vibrate(14);
      this.flash = Math.max(this.flash, 0.22);
      return true;
    }
    return false;
  }

  // ---- Input ----

  private rectX(clientX: number): number {
    return clientX - this.canvas.getBoundingClientRect().left;
  }

  private rectY(clientY: number): number {
    return clientY - this.canvas.getBoundingClientRect().top;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerId = e.pointerId;
    this.hasPointer = true;
    this.pointerX = this.rectX(e.clientX);
    this.pointerY = this.rectY(e.clientY);
    e.preventDefault();
    this.onPointerDownHook();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) {
      this.pointerX = this.rectX(e.clientX);
      this.pointerY = this.rectY(e.clientY);
      this.onPointerMoveHook();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) {
      this.pointerId = null;
      this.hasPointer = false;
      this.onPointerUpHook();
    }
  };

  private onPointerLeave = (): void => {
    this.pointerId = null;
    this.hasPointer = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private bindInput(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown, {
      passive: false,
    });
    this.canvas.addEventListener("pointermove", this.onPointerMove, {
      passive: false,
    });
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.canvas.clientWidth || 360;
    this.H = this.canvas.clientHeight || 640;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = clamp(Math.floor((this.W * this.H) / 3600), 40, 150);
    const starBase = this.palette.starSpeed;
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      size: Math.random() * 1.6 + 0.4,
      speed: starBase * (24 + Math.random() * 65),
      twinkle: Math.random() * Math.PI * 2,
    }));
    this.player.x = clamp(this.player.x, PLAYER_W / 2, this.W - PLAYER_W / 2);
    this.player.y = clamp(this.player.y, 40, this.H - 40);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}