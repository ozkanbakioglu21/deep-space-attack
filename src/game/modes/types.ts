export type ModeId = "flow" | "storm" | "gather" | "blaster";

export interface GameAdapter {
  launch(): void;
  beginGame(): void;
  toMenu(): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export interface ModeHud {
  showLevel: boolean;
  showCombo: boolean;
  levelLabel: string;
  scoreLabel: string;
}

export interface ModeMeta {
  id: ModeId;
  name: string;
  tagline: string;
  accent: string;
  hud: ModeHud;
  controls: string[];
}