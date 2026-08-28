export interface Vec {
  x: number;
  y: number;
}

export type EnemyKind = "drone" | "fighter" | "tank" | "spinner" | "kamikaze";

export type PowerKind = "shield" | "rapid" | "bomb" | "life";

export interface BaseEntity {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface Enemy extends BaseEntity {
  kind: EnemyKind;
  hp: number;
  baseX: number;
  wobble: number;
  wobbleSpeed: number;
  shootTimer: number;
  rot: number;
  rotSpeed: number;
  flash: number;
  dive: boolean;
}

export interface Bullet extends BaseEntity {
  friendly: boolean;
  damage: number;
}

export interface PowerUp extends BaseEntity {
  kind: PowerKind;
  rot: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  twinkle: number;
}

export interface GameOverResult {
  score: number;
  highScore: number;
  isRecord: boolean;
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onCombo: (multiplier: number) => void;
  onGameOver: (result: GameOverResult) => void;
}

export interface EnemyDef {
  w: number;
  h: number;
  hp: number;
  speed: number;
  score: number;
  color: string;
  shoot: boolean;
  shootEvery: number;
}