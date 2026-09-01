const KEY = "deep-space-attack-high-score";
const EGGS_KEY = "deep-space-attack-dragon-eggs";
const modeKey = (mode: string) => `${KEY}-${mode}`;

export function loadHighScore(): number {
  return read(KEY);
}

export function saveHighScore(value: number): void {
  write(KEY, value);
}

export function loadModeScore(mode: string): number {
  return read(modeKey(mode));
}

export function saveModeScore(mode: string, value: number): void {
  write(modeKey(mode), value);
}

export function loadDragonEggs(): number {
  return read(EGGS_KEY);
}

export function saveDragonEggs(value: number): void {
  write(EGGS_KEY, value);
}

export function addDragonEggs(delta: number): number {
  const total = Math.max(0, loadDragonEggs() + delta);
  saveDragonEggs(total);
  return total;
}

function read(key: string): number {
  try {
    const value = Number(localStorage.getItem(key) ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.floor(value)));
  } catch {
    /* private mode — ignore */
  }
}