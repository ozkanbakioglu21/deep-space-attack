import { PASS_SCORE } from "../data/types";

export type LevelProgress = {
  bestScore: number;
  completed: boolean;
  attempts: number;
};

export type GameProgress = {
  levels: Record<string, LevelProgress>;
};

const KEY = "ytea-progress-v1";

const empty: GameProgress = { levels: {} };

export function loadProgress(): GameProgress {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as GameProgress;
    return parsed?.levels ? parsed : empty;
  } catch {
    return empty;
  }
}

export function saveResult(levelId: number, score: number): GameProgress {
  const progress = loadProgress();
  const prev = progress.levels[String(levelId)] ?? { bestScore: 0, completed: false, attempts: 0 };
  progress.levels[String(levelId)] = {
    bestScore: Math.max(prev.bestScore, score),
    completed: prev.completed || score >= PASS_SCORE,
    attempts: prev.attempts + 1,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage kapalı olabilir */
  }
  return progress;
}

export function isLevelUnlocked(levelId: number, progress: GameProgress): boolean {
  if (levelId === 1) return true;
  return Boolean(progress.levels[String(levelId - 1)]?.completed);
}

export function resetProgress() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}

export function totalScore(progress: GameProgress): number {
  return Object.values(progress.levels).reduce((sum, l) => sum + l.bestScore, 0);
}
