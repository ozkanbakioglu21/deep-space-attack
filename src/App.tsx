import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MODES, createMode } from "./game/modes";
import type { GameAdapter, ModeId, ModeMeta } from "./game/modes/types";
import { START_LIVES } from "./game/constants";
import { loadHighScore, loadModeScore } from "./game/storage";
import type { GameOverResult } from "./game/types";

type Screen = "menu" | "playing" | "gameover";
type ScreenState = Screen | "paused";

const MODE_IDS: ModeId[] = MODES.map((m) => m.id);
type BestScores = Record<ModeId, number>;

function initialBests(): BestScores {
  const out = {} as BestScores;
  for (const id of MODE_IDS) {
    out[id] = id === "flow" ? loadHighScore() : loadModeScore(id);
  }
  return out;
}

const HEART_EMPTY = "♡";
const HEART_FULL = "♥";

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      {muted ? (
        <>
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M16 8.5a5 5 0 0 1 0 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function ModeIcon({ id }: { id: ModeId }) {
  const glyph =
    id === "flow" ? "➤" : id === "storm" ? "✧" : id === "gather" ? "✦" : "◎";
  return <span className="mode-icon" aria-hidden="true">{glyph}</span>;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameAdapter | null>(null);
  const modeRef = useRef<ModeId>("flow");

  const [screen, setScreen] = useState<Screen>("menu");
  const [subscreen, setSubscreen] = useState<ScreenState>("menu");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [modeId, setModeId] = useState<ModeId>("flow");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(1);
  const [best, setBest] = useState<BestScores>(initialBests);
  const [result, setResult] = useState<GameOverResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createMode(canvas, "flow", {
      onScore: setScore,
      onLives: setLives,
      onLevel: setLevel,
      onCombo: setCombo,
      onGameOver: (r) => {
        setResult(r);
        setBest((prev) => ({ ...prev, [modeRef.current]: r.highScore }));
        setScreen("gameover");
        setSubscreen("gameover");
      },
    });
    gameRef.current = game;
    game.launch();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const ensureGame = (id: ModeId): GameAdapter | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const current = gameRef.current;
    if (current && modeRef.current === id) return current;

    current?.destroy();
    const next = createMode(canvas, id, {
      onScore: setScore,
      onLives: setLives,
      onLevel: setLevel,
      onCombo: setCombo,
      onGameOver: (r) => {
        setResult(r);
        setBest((prev) => ({ ...prev, [modeRef.current]: r.highScore }));
        setScreen("gameover");
        setSubscreen("gameover");
      },
    });
    gameRef.current = next;
    modeRef.current = id;
    next.setMuted(muted);
    next.launch();
    return next;
  };

  const startGame = (id: ModeId) => {
    const game = ensureGame(id);
    if (!game) return;
    game.beginGame();
    setModeId(id);
    setScore(0);
    setLives(START_LIVES);
    setLevel(1);
    setCombo(1);
    setPaused(false);
    setResult(null);
    setScreen("playing");
    setSubscreen("playing");
  };

  const goToMenu = () => {
    gameRef.current?.toMenu();
    setPaused(false);
    setScreen("menu");
    setSubscreen("menu");
  };

  const togglePause = () => {
    setPaused((prev) => {
      gameRef.current?.setPaused(!prev);
      return !prev;
    });
  };

  const toggleMute = () => {
    setMuted((prev) => {
      gameRef.current?.setMuted(!prev);
      return !prev;
    });
  };

  const hud = MODES.find((m) => m.id === modeId) ?? MODES[0];

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />

      {screen === "playing" && !paused && (
        <header className="hud">
          <div className="hud-cell hud-score">
            <span className="hud-label">{hud.hud.scoreLabel}</span>
            <span className="hud-value">{score.toLocaleString("tr-TR")}</span>
          </div>
          <div className="hud-cell hud-lives">
            {hud.hud.showLevel && (
              <span className="hud-label">
                {hud.hud.levelLabel} {level}
              </span>
            )}
            <span className="hud-hearts">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <span key={i} className={i < lives ? "on" : "off"}>
                  {i < lives ? HEART_FULL : HEART_EMPTY}
                </span>
              ))}
            </span>
          </div>
          {hud.hud.showCombo && combo > 1 && <div className="hud-combo">x{combo}</div>}
          <div className="hud-cell hud-actions">
            <button
              className="hud-btn"
              onClick={toggleMute}
              aria-label={muted ? "Sesi aç" : "Sesi kapat"}
            >
              <SoundIcon muted={muted} />
            </button>
            <button className="hud-btn" onClick={togglePause} aria-label="Duraklat">
              <PauseIcon />
            </button>
          </div>
        </header>
      )}

      {subscreen === "menu" && (
        <div className="overlay menu">
          <div className="title-wrap">
            <h1 className="title">UZAY</h1>
            <h1 className="title alt">ARCADE</h1>
          </div>
          <p className="tagline">Dört oyun, tek ekran. Birini seç ve başla!</p>

          <div className="mode-grid">
            {MODES.map((m: ModeMeta) => (
              <button
                key={m.id}
                className="mode-card"
                style={{ "--accent": m.accent } as CSSProperties}
                onClick={() => startGame(m.id)}
              >
                <span className="mode-head">
                  <ModeIcon id={m.id} />
                  <span className="mode-name">{m.name}</span>
                </span>
                <span className="mode-desc">{m.tagline}</span>
                <span className="mode-best">
                  EN İYİ: {best[m.id].toLocaleString("tr-TR")}
                </span>
              </button>
            ))}
          </div>

          <p className="best">Geçerli modun en iyi skoru anında saklanır.</p>
        </div>
      )}

      {paused && screen === "playing" && (
        <div className="overlay pause">
          <h2 className="overlay-title">{hud.name}</h2>
          <div className="controls">
            <p className="controls-title">NASIL OYNANIR</p>
            {hud.controls.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="btn-group">
            <button className="btn primary" onClick={togglePause}>
              DEVAM ET
            </button>
            <button className="btn ghost" onClick={goToMenu}>
              ANA MENÜ
            </button>
          </div>
        </div>
      )}

      {subscreen === "gameover" && result && (
        <div className="overlay gameover">
          <h2 className="overlay-title danger">OYUN BİTTİ</h2>
          <p className="mode-name-over">{hud.name}</p>
          {result.isRecord && <p className="record">YENİ REKOR!</p>}
          <div className="result-row">
            <span>Skor</span>
            <strong>{result.score.toLocaleString("tr-TR")}</strong>
          </div>
          <div className="result-row">
            <span>En İyi</span>
            <strong>{result.highScore.toLocaleString("tr-TR")}</strong>
          </div>
          <div className="btn-group">
            <button className="btn primary" onClick={() => startGame(modeRef.current)}>
              TEKRAR OYNA
            </button>
            <button className="btn ghost" onClick={goToMenu}>
              ANA MENÜ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}