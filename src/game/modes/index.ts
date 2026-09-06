import { Game } from "../engine";
import { StormMode } from "./storm";
import type { GameAdapter, ModeId, ModeMeta } from "./types";
import type { GameCallbacks } from "../types";

export const MODES: ModeMeta[] = [
  {
    id: "flow",
    name: "AKIŞ",
    tagline: "Klasik dalga savunması: otomatik ateş, kombo, güçler ve temalı bölümler.",
    accent: "#8df0ff",
    hud: { showLevel: true, showCombo: true, levelLabel: "Seviye", scoreLabel: "Skor" },
    controls: [
      "Parmağını sürükle / ok tuşları ile aracını hareket ettir.",
      "Aracın otomatik ateş eder. Düşman mermilerine ve çarpışmalara dikkat et.",
      "Düşmanlardan düşen güçleri topla: Kalkan, hızlı ateş, bomba, ekstra can.",
      "Hızlı seri öldürüşler komboyu yükseltir; her 5 seviyede yeni bir bölüm başlar.",
    ],
  },
  {
    id: "storm",
    name: "ELMAS YARIŞI",
    tagline: "Trafikten kaç, elmasları topla ve KOMBO çarpanını büyüt.",
    accent: "#ff9f43",
    hud: { showLevel: true, showCombo: true, levelLabel: "Tür", scoreLabel: "Mesafe" },
      controls: [
        "3 şerit: sola/sağa kaydır ya da ok tuşları (A/D) ile araç şerit değiştirsin.",
        "Araç şeritte sabittir; pist ona doğru akar.",
        "Yoldaki uzay gemilerine çarpma: şerit değiştirerek kaç, sıyırarak geç (YAKIN! bonusu).",
        "Parlayan elmastan topla → skor kazan ve KOMBO oluştur.",
        "Yakın geçiş + elmas toplamak KOMBO ısısı biriktir; skor x5 çarpanına ulaş.",
      ],
  },
];

export function createMode(
  canvas: HTMLCanvasElement,
  id: ModeId,
  cbs: GameCallbacks,
): GameAdapter {
  switch (id) {
    case "storm":
      return new StormMode(canvas, cbs);
    case "flow":
    default:
      return new Game(canvas, cbs);
  }
}