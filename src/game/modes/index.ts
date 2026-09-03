import { Game } from "../engine";
import { BlasterMode } from "./blaster";
import { GatherMode } from "./gather";
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
      name: "METEOR YARIŞI",
      tagline: "Yarış: rakipleri geç, nitro topla, enerji geçitlerinden geç ve bitiş çizgisine ilk sen ulaş.",
      accent: "#ff9f43",
      hud: { showLevel: true, showCombo: true, levelLabel: "Tür", scoreLabel: "Mesafe" },
      controls: [
        "3 şerit: sola/sağa kaydır ya da ok tuşları (A/D) ile araç şerit değiştirsin.",
        "Araç şeritte sabittir; pist ona doğru akar.",
        "Yoldaki trafiğe çarpma: şerit değiştirerek kaç, sıyırarak geç (YAKIN! bonusu).",
        "Enerji halkalarından (chevron) geç ve ALTIN küreleri topla → NİTRO dolar.",
        "KYRA, VEX ve ZORB'u şerit şerit geçerek GEÇİLDİ bonusu al; sıralamanı üstte gör.",
        "NİTRO dolunca dokun/boşluk → hız + skor katlansın.",
      ],
    },
    {
      id: "gather",
      name: "YILDIZ TOPLAYICI",
      tagline: "Ekrandaki yıldızları topla, göktaşlarından kaç ve dalgaları tamamla.",
      accent: "#9df4ff",
      hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor" },
      controls: [
        "Ekranda sürükle / ok tuşları ile her yöne hareket et.",
        "Parlayan yıldızların üzerinden geçerek topla; her biri skor kazandırır.",
        "ALTIN yıldız 5 kat değerinde; MIKNATIS yıldızları sana çeker.",
        "Göktaşlarına çarpma; yakın kaçışlar bonus verir.",
        "Her 10 yıldızda dalga atlarsın: yıldızlar artar, göktaşları hızlanır.",
      ],
    },
    {
      id: "blaster",
      name: "HEDEF AVCISI",
      tagline: "Nişancı: gemin sabit, parmağınla nişan al ve göktaşlarını yok et.",
      accent: "#b18cff",
      hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor" },
      controls: [
        "Gemin altta sabit; parmağınla / görüş yönüyle nişan al.",
        "Ateş otomatik: göktaşlarını yere düşmeden vur.",
        "Bazı göktaşları 3 vuruş ister; yere düşen göktaşı canını alır.",
        "Arka arkaya vuruşlarla kombo çarpanını yükselt; patlayan göktaşı yakındakileri zincirler!",
        "Her dalgada düşmanlar hızlanır ve yoğunlaşır.",
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
    case "gather":
      return new GatherMode(canvas, cbs);
    case "blaster":
      return new BlasterMode(canvas, cbs);
    case "flow":
    default:
      return new Game(canvas, cbs);
  }
}