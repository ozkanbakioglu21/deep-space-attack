import type { EnemyDef, EnemyKind, PowerKind } from "./types";

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
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
  spinner: {
    w: 46,
    h: 46,
    hp: 2,
    speed: 72,
    score: 250,
    color: "#ff9f43",
    shoot: true,
    shootEvery: 1.9,
  },
  kamikaze: {
    w: 30,
    h: 34,
    hp: 1,
    speed: 150,
    score: 200,
    color: "#ffe08a",
    shoot: false,
    shootEvery: 0,
  },
};

export const POWERUP_INFO: Record<PowerKind, { color: string; label: string }> = {
  shield: { color: "#4dd6ff", label: "KALKAN" },
  rapid: { color: "#ffd166", label: "HIZLI ATEŞ" },
  bomb: { color: "#ff9f43", label: "BOMBA" },
  life: { color: "#ff5d8f", label: "+1 CAN" },
};