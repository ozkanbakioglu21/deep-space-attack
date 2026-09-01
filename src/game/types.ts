export interface Vec {
  x: number;
  y: number;
}

export type EnemyKind =
  | "drone"
  | "fighter"
  | "tank"
  | "spinner"
  | "kamikaze"
  | "meteor"
  | "speeder"
  | "mine";

export type PowerKind =
  | "shield"
  | "rapid"
  | "bomb"
  | "life"
  | "magnet"
  | "dual"
  | "freeze";

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
  lane?: number;
  gold?: boolean;
  nearMissed?: boolean;
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

export interface Glint {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  life: number;
  maxLife: number;
  alive: boolean;
  gold?: boolean;
  magnet?: boolean;
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
  onEgg?: (total: number) => void;
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

export interface NebulaDef {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface ChapterDef {
  name: string;
  top: string;
  mid: string;
  bottom: string;
  star: string;
  starSpeed: number;
  nebulas: NebulaDef[];
  rocks: number;
  rockColor: string;
  rockSpeed: number;
}