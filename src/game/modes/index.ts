import { Game } from "../engine";
import { StormMode } from "./storm";
import { TomatoMode } from "./tomato";
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
        "Sağ alttaki HIZ tuşu zamanla dolar; dolunca basınca kısa süre roket hızı ve arkandan alev!",
      ],
  },
  {
    id: "tomato",
    name: "DOMATES",
    tagline: "Uzaylılar iniyor, sen domates atıyorsun: patlat, kaçırma, kombo yap!",
    accent: "#ff5a3c",
    hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor", lives: 2 },
    controls: [
      "Sürükle veya A/D ile domates toplarını hareket ettir.",
      "Basılı tut (veya Boşluk) → domates at. Başta tek tek; seviye atladıkça hızlanır ve çoklu atış açılır!",
      "Domatesler uzaylıları ezer; büyükleri 2, devler 3 vuruş ister.",
      "Uzaylılar inerken hızlanıp DALAR; tek biri bahçeye inerse can gider — çok zordur!",
      "Arka arkaya vurdukça kombo çarpanın artar.",
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
    case "tomato":
      return new TomatoMode(canvas, cbs);
    case "flow":
    default:
      return new Game(canvas, cbs);
  }
}