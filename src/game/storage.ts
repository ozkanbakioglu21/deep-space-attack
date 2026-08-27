const KEY = "deep-space-attack-high-score";

export function loadHighScore(): number {
  try {
    const value = Number(localStorage.getItem(KEY) ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(value: number): void {
  try {
    localStorage.setItem(KEY, String(Math.floor(value)));
  } catch {
    /* private mode — ignore */
  }
}