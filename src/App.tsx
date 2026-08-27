import { useEffect, useRef, useState } from "react";
import { Game } from "./game/engine";
import { START_LIVES } from "./game/constants";
import { loadHighScore } from "./game/storage";
import type { GameOverResult } from "./game/types";

type Screen = "menu" | "playing" | "gameover";
type ScreenState = Screen | "paused";

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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [subscreen, setSubscreen] = useState<ScreenState>("menu");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(1);
  const [highScore, setHighScore] = useState(() => loadHighScore());
  const [result, setResult] = useState<GameOverResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas, {
      onScore: setScore,
      onLives: setLives,
      onLevel: setLevel,
      onCombo: setCombo,
      onGameOver: (r) => {
        setResult(r);
        setHighScore(r.highScore);
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

  const startGame = () => {
    gameRef.current?.beginGame();
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

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />

      {screen === "playing" && !paused && (
        <header className="hud">
          <div className="hud-cell hud-score">
            <span className="hud-label">Skor</span>
            <span className="hud-value">{score.toLocaleString("tr-TR")}</span>
          </div>
          <div className="hud-cell hud-lives">
            <span className="hud-label">Seviye {level}</span>
            <span className="hud-hearts">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <span key={i} className={i < lives ? "on" : "off"}>
                  {i < lives ? HEART_FULL : HEART_EMPTY}
                </span>
              ))}
            </span>
          </div>
          {combo > 1 && <div className="hud-combo">x{combo}</div>}
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
            <h1 className="title">DEEP SPACE</h1>
            <h1 className="title alt">ATTACK</h1>
          </div>
          <p className="tagline">Uzay savar, gezegenleri koru!</p>

          <button className="btn primary" onClick={startGame}>
            BAŞLAT
          </button>

          <div className="controls">
            <p className="controls-title">NASIL OYNANIR</p>
            <p>Parmağını sürükle / ok tuşları ile aracını hareket ettir.</p>
            <p>Aracın otomatik ateş eder. Düşman mermilerine çarpma!</p>
            <p>Düşmanlardan düşen güçleri topla: Kalkan, hızlı ateş, bomba, ekstra can.</p>
            <p>Hızlı seri öldürüşler komboyu yükseltir, skor çarpanın artar.</p>
            <p>Seviye 5'ten itibaren her 5 seviyede bir bölüm patronu gelir.</p>
          </div>

          <p className="best">EN İYİ SKOR: {highScore.toLocaleString("tr-TR")}</p>
        </div>
      )}

      {paused && screen === "playing" && (
        <div className="overlay pause">
          <h2 className="overlay-title">DURAKLATILDI</h2>
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
            <button className="btn primary" onClick={startGame}>
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