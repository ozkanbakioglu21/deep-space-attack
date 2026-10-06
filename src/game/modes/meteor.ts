import type { ChapterDef, GameCallbacks } from "../types";
import { BaseMode } from "./base";

// GÖKTAŞI (Meteor defense): a fixed turret auto-aims at the most urgent meteor.
// The player earns credits (₺) from kills and spends them to unlock/upgrade one of
// four distinct weapons, plus a NOVA button that clears the screen for a price.
const NOVA_COST = 100;
const NOVA_RADIUS = 240;
const START_MONEY = 50;
const WAVE_KILLS = 12;
const WAVE_BONUS = 30;
const MAX_METEORS = 40;

type MeteorKind = "small" | "medium" | "large" | "golden";
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: MeteorKind;
  rot: number;
  rotSpeed: number;
  flash: number;
  alive: boolean;
}
type ProjKind = "bolt" | "pellet" | "missile";
interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  kind: ProjKind;
  target: Meteor | null;
  alive: boolean;
  life: number;
}
interface Weapon {
  id: string;
  name: string;
  color: string;
  icon: string;
  unlocked: boolean;
  level: number;
  unlockCost: number;
  maxLevel: number;
}

function meteorStyle(kind: MeteorKind): { color: string; glow: string } {
  switch (kind) {
    case "golden":
      return { color: "#ffd700", glow: "#fff0a0" };
    case "large":
      return { color: "#a85f2a", glow: "#ff9f43" };
    case "medium":
      return { color: "#8d6e63", glow: "#c98a5e" };
    default:
      return { color: "#9e9e9e", glow: "#e0e0e0" };
  }
}
function meteorPay(kind: MeteorKind): number {
  switch (kind) {
    case "golden":
      return 60;
    case "large":
      return 40;
    case "medium":
      return 20;
    default:
      return 10;
  }
}
function meteorHp(kind: MeteorKind): number {
  switch (kind) {
    case "large":
      return 4;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export class MeteorMode extends BaseMode {
  private meteors: Meteor[] = [];
  private projectiles: Projectile[] = [];
  private weapons: Weapon[] = [];
  private equipped = "pulsar";
  private money = 0;
  private meteorTimer = 1.2;
  private fireAccum = 0;
  private aim = -Math.PI / 2;
  private laserOn = false;
  private laserX = 0;
  private laserY = 0;
  private wave = 1;
  private kills = 0;
  private novaFlash = 0;

  protected get palette(): ChapterDef {
    return {
      name: "GÖKTAŞI",
      top: "#1c1008",
      mid: "#140a05",
      bottom: "#070302",
      star: "#ffd9a0",
      starSpeed: 1.4,
      nebulas: [{ x: 0.5, y: 0.35, r: 0.6, color: "rgba(255,140,60,0.10)" }],
      rocks: 0,
      rockColor: "#000000",
      rockSpeed: 0,
    };
  }

  private get baseY(): number {
    return this.H - 110;
  }

  constructor(canvas: HTMLCanvasElement, cbs: GameCallbacks) {
    super(canvas, cbs, "meteor", 5);
    this.resetIdle();
  }

  private defaultWeapons(): Weapon[] {
    return [
      { id: "pulsar", name: "PULSAR", color: "#8df0ff", icon: "➤", unlocked: true, level: 1, unlockCost: 0, maxLevel: 5 },
      { id: "spread", name: "SAÇMA", color: "#ffd166", icon: "✳", unlocked: false, level: 0, unlockCost: 120, maxLevel: 5 },
      { id: "laser", name: "LEZER", color: "#7cff6b", icon: "≡", unlocked: false, level: 0, unlockCost: 200, maxLevel: 5 },
      { id: "missile", name: "MISİL", color: "#ff9f43", icon: "↗", unlocked: false, level: 0, unlockCost: 300, maxLevel: 5 },
    ];
  }

  beginGame(): void {
    super.startRun();
    this.meteors = [];
    this.projectiles = [];
    this.weapons = this.defaultWeapons();
    this.equipped = "pulsar";
    this.money = START_MONEY;
    this.meteorTimer = 1.2;
    this.fireAccum = 0;
    this.aim = -Math.PI / 2;
    this.laserOn = false;
    this.wave = 1;
    this.kills = 0;
    this.novaFlash = 0;
    this.player.y = this.baseY;
    this.setBanner("GÖKTAŞI SAVUNMASI", "Kazan, geliştir, hayatta kal!");
  }

  protected resetIdle(): void {
    this.meteors = [];
    this.projectiles = [];
    this.weapons = this.defaultWeapons();
    this.equipped = "pulsar";
    this.money = 0;
    this.laserOn = false;
    this.player = this.makePlayer();
    this.player.y = this.baseY;
  }

  private levelOf(id: string): number {
    return this.weapons.find((w) => w.id === id)?.level ?? 1;
  }
  private upgradeCost(w: Weapon): number {
    return 50 + w.level * 40;
  }

  protected updateSub(dt: number) {
    this.novaFlash = Math.max(0, this.novaFlash - dt * 2);

    // Spawn meteors (pacing scales with wave).
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0 && this.meteors.length < MAX_METEORS) {
      const interval = Math.max(0.32, 1.0 - this.wave * 0.06) * (0.7 + Math.random() * 0.6);
      this.meteorTimer = interval;
      this.spawnMeteor();
      if (this.wave >= 3 && Math.random() < 0.4) this.spawnMeteor();
    }

    // Auto-aim at the most urgent meteor (closest to the base) and fire.
    const target = this.pickTarget();
    if (target) {
      this.aim = Math.atan2(target.y - this.baseY, target.x - this.W / 2);
      const lv = this.levelOf(this.equipped);
      if (this.equipped === "laser") {
        this.laserOn = true;
        this.laserX = target.x;
        this.laserY = target.y;
        target.hp -= (3 + lv * 1.6) * dt;
        if (Math.random() < 0.5) this.explode(target.x, target.y, "#7cff6b", 2, 3, 90);
        if (target.hp <= 0) this.killMeteor(target, true);
      } else {
        this.laserOn = false;
        this.fireAccum += dt;
        const interval = 1 / this.fireRateFor(lv);
        while (this.fireAccum >= interval) {
          this.fireAccum -= interval;
          this.fireWeapon(lv, target);
        }
      }
    } else {
      this.laserOn = false;
      this.fireAccum = 0;
    }

    this.updateProjectiles(dt);
    this.updateMeteors(dt);
  }

  protected onPointerDownHook(): void {
    if (!this.playing) return;
    const px = this.pointerX;
    const py = this.pointerY;
    const nr = this.novaRect();
    if (this.pointIn(nr, px, py)) {
      if (this.money >= NOVA_COST) {
        this.money -= NOVA_COST;
        this.fireNova();
      } else {
        this.addPopup(px, py, "₺" + NOVA_COST + " gerek", "#ff5a3c", 12);
      }
      return;
    }
    for (const s of this.slotRects()) {
      if (this.pointIn(s, px, py)) {
        this.tapWeapon(s.id, px, py);
        return;
      }
    }
  }

  private tapWeapon(id: string, px: number, py: number): void {
    const w = this.weapons.find((x) => x.id === id);
    if (!w) return;
    if (!w.unlocked) {
      if (this.money >= w.unlockCost) {
        this.money -= w.unlockCost;
        w.unlocked = true;
        w.level = 1;
        this.equipped = id;
        this.addPopup(this.W / 2, this.baseY - 34, w.name + " AÇILDI!", w.color, 15);
        this.audio.powerup();
      } else {
        this.addPopup(px, py, "₺" + w.unlockCost + " gerek", "#ff5a3c", 12);
      }
    } else if (this.equipped !== id) {
      this.equipped = id;
      this.audio.powerup();
    } else if (w.level >= w.maxLevel) {
      this.addPopup(px, py, "MAKS SEVİYE", "#ffd166", 12);
    } else {
      const cost = this.upgradeCost(w);
      if (this.money >= cost) {
        this.money -= cost;
        w.level++;
        this.addPopup(this.W / 2, this.baseY - 34, w.name + " Lv" + w.level, w.color, 14);
        this.audio.powerup();
      } else {
        this.addPopup(px, py, "₺" + cost + " gerek", "#ff5a3c", 12);
      }
    }
  }

  private fireNova(): void {
    this.novaFlash = 1;
    this.shake = Math.min(20, this.shake + 14);
    this.flash = 0.5;
    this.audio.explosion(true);
    this.vibrate(60);
    this.explode(this.W / 2, this.baseY, "#ffd166", 60, 12, 340);
    let cleared = 0;
    for (const m of this.meteors) {
      if (m.alive) {
        this.killMeteor(m, false);
        cleared++;
      }
    }
    this.addPopup(this.W / 2, this.baseY - 46, "NOVA! " + cleared + " temizlendi", "#ffd166", 16);
  }

  // ---- Meteors ----

  private pickTarget(): Meteor | null {
    let best: Meteor | null = null;
    for (const m of this.meteors) {
      if (!m.alive) continue;
      if (!best || m.y > best.y) best = m;
    }
    return best;
  }

  private spawnMeteor(x?: number, y?: number, kind?: MeteorKind, split = false): void {
    const k: MeteorKind = kind ?? this.rollKind();
    const hp = meteorHp(k);
    const r =
      k === "large" ? 30 + Math.random() * 8 : k === "medium" ? 20 + Math.random() * 6 : k === "golden" ? 14 : 12 + Math.random() * 4;
    const speedScale = 1 + (this.wave - 1) * 0.08;
    const vy =
      (k === "small" ? 90 : k === "large" ? 40 : k === "golden" ? 120 : 66) * speedScale + (split ? 20 : 0);
    this.meteors.push({
      x: x ?? r + Math.random() * (this.W - 2 * r),
      y: y ?? -r,
      vx: split ? (Math.random() - 0.5) * 120 : (Math.random() - 0.5) * 30,
      vy: split ? Math.max(40, vy * 0.6) : vy,
      r,
      hp,
      maxHp: hp,
      kind: k,
      rot: Math.random() * 6.28,
      rotSpeed: (Math.random() - 0.5) * 3,
      flash: 0,
      alive: true,
    });
  }

  private rollKind(): MeteorKind {
    if (Math.random() < 0.05) return "golden";
    const roll = Math.random();
    if (roll < 0.16 + this.wave * 0.02) return "large";
    if (roll < 0.52) return "medium";
    return "small";
  }

  private updateMeteors(dt: number) {
    const by = this.baseY;
    for (const m of this.meteors) {
      if (!m.alive) continue;
      m.rot += m.rotSpeed * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.flash = Math.max(0, m.flash - dt);
      if (m.x < m.r || m.x > this.W - m.r) m.vx *= -1;
      if (m.y + m.r >= by) {
        m.alive = false;
        this.explode(m.x, by, "#ff9f43", 18, 10, 170);
        this.hitBase(m.x);
      }
    }
    this.meteors = this.meteors.filter((m) => m.alive);
  }

  private killMeteor(m: Meteor, canSplit: boolean): void {
    m.alive = false;
    const pay = meteorPay(m.kind);
    this.money += pay;
    this.bumpScore(pay);
    this.kills++;
    const st = meteorStyle(m.kind);
    this.explode(m.x, m.y, st.color, 14, 8, 150);
    this.addPopup(m.x, m.y, "+" + pay + "₺", "#ffd166", 13);
    this.audio.explosion();
    if (m.kind === "large" && canSplit) {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) this.spawnMeteor(m.x, m.y, "small", true);
    }
    this.checkWave();
  }

  private hitBase(x: number): void {
    this.lives--;
    this.cbs.onLives(this.lives);
    this.explode(clamp(x, 20, this.W - 20), this.baseY, "#ff3b3b", 24, 11, 200);
    this.addPopup(clamp(x, 50, this.W - 50), this.baseY - 24, "TAHRİBAT! ♥-1", "#ff5a3c", 15);
    this.shake = Math.min(18, this.shake + 10);
    this.flash = 0.6;
    this.addHitStop(0.15);
    this.vibrate(50);
    this.resetCombo();
    if (this.lives <= 0) {
      this.player.alive = false;
      this.finish();
    }
  }

  private checkWave(): void {
    if (this.kills >= this.wave * WAVE_KILLS) {
      this.wave++;
      this.money += WAVE_BONUS;
      this.cbs.onLevel(this.wave);
      this.audio.levelUp();
      this.addPopup(this.W / 2, this.H * 0.3, "DALGA " + this.wave + "  +" + WAVE_BONUS + "₺", "#8df0ff", 15);
      this.setBanner("DALGA " + this.wave, "Göktaşları hızlanıyor ve çoğalıyor!");
    }
  }

  // ---- Weapons ----

  private fireRateFor(lv: number): number {
    switch (this.equipped) {
      case "pulsar":
        return 4 + lv * 0.6;
      case "spread":
        return 2.4 + lv * 0.35;
      case "missile":
        return 1.0 + lv * 0.15;
      default:
        return 4;
    }
  }

  private mkProj(x: number, y: number, ang: number, speed: number, r: number, dmg: number, kind: ProjKind, target: Meteor | null): Projectile {
    return {
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r,
      dmg,
      kind,
      target,
      alive: true,
      life: 3,
    };
  }

  private fireWeapon(lv: number, target: Meteor): void {
    const ox = this.W / 2;
    const oy = this.baseY - 16;
    if (this.equipped === "pulsar") {
      const bolts = lv >= 3 ? 2 : 1;
      const dmg = 1 + lv * 0.5;
      for (let i = 0; i < bolts; i++) {
        const off = bolts > 1 ? (i - (bolts - 1) / 2) * 0.07 : 0;
        this.projectiles.push(this.mkProj(ox, oy, this.aim + off, 520, 5, dmg, "bolt", null));
      }
      this.audio.shoot();
    } else if (this.equipped === "spread") {
      const pellets = 3 + lv;
      const dmg = 0.6 + lv * 0.22;
      const fan = 0.55;
      for (let i = 0; i < pellets; i++) {
        const t = i / (pellets - 1) - 0.5;
        this.projectiles.push(this.mkProj(ox, oy, this.aim + t * fan, 470, 4, dmg, "pellet", null));
      }
      this.audio.shoot();
    } else if (this.equipped === "missile") {
      const missiles = 1 + Math.floor(lv / 2);
      const dmg = 3 + lv * 1.3;
      for (let i = 0; i < missiles; i++) {
        const off = (i - (missiles - 1) / 2) * 0.14;
        this.projectiles.push(this.mkProj(ox, oy, this.aim + off, 190, 6, dmg, "missile", target));
      }
      this.audio.shoot();
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      if (p.kind === "missile") {
        if (!p.target || !p.target.alive) p.target = this.pickTarget();
        if (p.target && p.target.alive) {
          const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          const sp = Math.hypot(p.vx, p.vy);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = Math.min(Math.abs(d), 5 * dt) * Math.sign(d);
          const na = cur + turn;
          p.vx = Math.cos(na) * sp;
          p.vy = Math.sin(na) * sp;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y < -30 || p.y > this.H + 30 || p.x < -30 || p.x > this.W + 30) {
        p.alive = false;
        continue;
      }
      for (const m of this.meteors) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) < m.r + p.r) {
          m.hp -= p.dmg;
          m.flash = 0.1;
          p.alive = false;
          const big = p.kind === "missile";
          this.explode(p.x, p.y, big ? "#ff9f43" : "#8df0ff", big ? 14 : 6, big ? 9 : 4, big ? 170 : 100);
          if (m.hp <= 0) this.killMeteor(m, true);
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  // ---- UI geometry ----

  private novaRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.W - 82, y: 50, w: 68, h: 24 };
  }
  private slotRects(): { x: number; y: number; w: number; h: number; id: string }[] {
    const w = 72;
    const gap = 6;
    const totalW = this.weapons.length * w + (this.weapons.length - 1) * gap;
    const x0 = (this.W - totalW) / 2;
    const y = this.H - 62;
    const h = 46;
    return this.weapons.map((wp, i) => ({ x: x0 + i * (w + gap), y, w, h, id: wp.id }));
  }
  private pointIn(r: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // ---- Rendering ----

  protected renderEntities(ctx: CanvasRenderingContext2D): void {
    this.drawBase(ctx);
    for (const m of this.meteors) this.drawMeteor(ctx, m);
    for (const p of this.projectiles) this.drawProjectile(ctx, p);
    if (this.laserOn) this.drawLaser(ctx);
    this.drawTurret(ctx);
    if (this.novaFlash > 0) this.drawNovaFlash(ctx);
    this.drawTopHud(ctx);
    this.drawWeaponBar(ctx);
  }

  private drawBase(ctx: CanvasRenderingContext2D): void {
    const by = this.baseY;
    const g = ctx.createLinearGradient(0, by, 0, this.H);
    g.addColorStop(0, "rgba(120,60,30,0.35)");
    g.addColorStop(1, "rgba(20,10,5,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, by, this.W, this.H - by);
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(this.time * 4);
    ctx.strokeStyle = "#ff9f43";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, by);
    ctx.lineTo(this.W, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // little city skyline
    ctx.fillStyle = "#1a1a2a";
    const bw = [26, 34, 22, 40, 28];
    let cx = 10;
    for (let i = 0; i < bw.length; i++) {
      const bh = 14 + ((i * 37) % 22);
      ctx.fillRect(cx, by - bh, bw[i], bh);
      cx += bw[i] + 8;
    }
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor): void {
    const st = meteorStyle(m.kind);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    ctx.shadowColor = st.glow;
    ctx.shadowBlur = m.kind === "golden" ? 22 : 10;
    ctx.fillStyle = m.flash > 0 ? "#ffffff" : st.color;
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = m.r * (0.82 + 0.18 * Math.sin(m.rot * 2 + i * 1.7));
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(-m.r * 0.3, m.r * 0.1, m.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(m.r * 0.25, -m.r * 0.25, m.r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (m.maxHp > 1 && m.hp < m.maxHp) {
      const bw = m.r * 1.6;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(m.x - bw / 2, m.y - m.r - 8, bw, 4);
      ctx.fillStyle = "#7cff6b";
      ctx.fillRect(m.x - bw / 2, m.y - m.r - 8, bw * (m.hp / m.maxHp), 4);
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === "missile") {
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = "#ff9f43";
      ctx.shadowColor = "#ff9f43";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-12 - Math.random() * 6, -2);
      ctx.lineTo(-12, 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = p.kind === "pellet" ? "#ffd166" : "#bcd4ff";
      ctx.shadowColor = p.kind === "pellet" ? "#ffd166" : "#5b8dff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.kind === "pellet" ? 4 : 7, p.kind === "pellet" ? 3 : 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLaser(ctx: CanvasRenderingContext2D): void {
    const ox = this.W / 2;
    const oy = this.baseY - 16;
    const lv = this.levelOf("laser");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#7cff6b";
    ctx.lineWidth = 4 + lv * 1.5;
    ctx.shadowColor = "#7cff6b";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(this.laserX, this.laserY);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#eaffea";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(this.laserX, this.laserY);
    ctx.stroke();
    ctx.restore();
  }

  private drawTurret(ctx: CanvasRenderingContext2D): void {
    const x = this.W / 2;
    const y = this.baseY;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#2a2a3a";
    ctx.strokeStyle = "#ff9f43";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, 18);
    ctx.lineTo(26, 18);
    ctx.lineTo(18, 2);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // barrel points along aim
    ctx.save();
    ctx.rotate(this.aim);
    ctx.fillStyle = "#3a3a4a";
    ctx.strokeStyle = "#ff9f43";
    ctx.fillRect(0, -5, 26, 10);
    ctx.strokeRect(0, -5, 26, 10);
    ctx.restore();
    ctx.fillStyle = "#2a2a3a";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff9f43";
    ctx.stroke();
    ctx.fillStyle = this.laserOn ? "#7cff6b" : "#ff9f43";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawNovaFlash(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createRadialGradient(this.W / 2, this.baseY, 10, this.W / 2, this.baseY, NOVA_RADIUS);
    g.addColorStop(0, `rgba(255,220,120,${(0.5 * this.novaFlash).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  private drawTopHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Money
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("₺ " + this.money, 12, 66);
    // Wave
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DALGA " + this.wave, this.W / 2, 66);
    // NOVA button
    const nr = this.novaRect();
    const afford = this.money >= NOVA_COST;
    ctx.fillStyle = afford ? "rgba(255,209,102,0.25)" : "rgba(120,60,60,0.25)";
    roundRect(ctx, nr.x, nr.y, nr.w, nr.h, 8);
    ctx.fill();
    ctx.strokeStyle = afford ? "#ffd166" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, nr.x, nr.y, nr.w, nr.h, 8);
    ctx.stroke();
    ctx.fillStyle = afford ? "#ffd166" : "rgba(255,255,255,0.5)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOVA ₺" + NOVA_COST, nr.x + nr.w / 2, nr.y + 16);
    ctx.restore();
  }

  private drawWeaponBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const s of this.slotRects()) {
      const wp = this.weapons.find((w) => w.id === s.id)!;
      const equipped = this.equipped === s.id;
      ctx.fillStyle = equipped ? "rgba(168,107,255,0.3)" : "rgba(18,18,34,0.72)";
      roundRect(ctx, s.x, s.y, s.w, s.h, 8);
      ctx.fill();
      ctx.strokeStyle = wp.unlocked ? wp.color : "rgba(255,255,255,0.2)";
      ctx.lineWidth = equipped ? 2 : 1;
      roundRect(ctx, s.x, s.y, s.w, s.h, 8);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = wp.unlocked ? wp.color : "rgba(255,255,255,0.3)";
      ctx.font = "15px system-ui, sans-serif";
      ctx.fillText(wp.icon, s.x + s.w / 2, s.y + 19);
      ctx.fillStyle = wp.unlocked ? "#ffffff" : "rgba(255,255,255,0.5)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(wp.name, s.x + s.w / 2, s.y + 31);
      ctx.font = "8px system-ui, sans-serif";
      if (!wp.unlocked) {
        ctx.fillStyle = this.money >= wp.unlockCost ? "#ffd166" : "#ff5a3c";
        ctx.fillText("₺" + wp.unlockCost, s.x + s.w / 2, s.y + 42);
      } else if (equipped) {
        if (wp.level >= wp.maxLevel) {
          ctx.fillStyle = "#ffd166";
          ctx.fillText("MAX", s.x + s.w / 2, s.y + 42);
        } else {
          const c = this.upgradeCost(wp);
          ctx.fillStyle = this.money >= c ? "#7cff6b" : "#ff5a3c";
          ctx.fillText("▲ ₺" + c, s.x + s.w / 2, s.y + 42);
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText("Lv" + wp.level, s.x + s.w / 2, s.y + 42);
      }
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
