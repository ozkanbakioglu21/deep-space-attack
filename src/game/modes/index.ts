import { Game } from "../engine";
import { StormMode } from "./storm";
import { TomatoMode } from "./tomato";
import { GunMode } from "./gun";
import { ShockMode } from "./shock";
import { MeteorMode } from "./meteor";
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
    hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor" },
    controls: [
      "Sürükle veya A/D ile domates toplarını hareket ettir.",
      "Basılı tut (veya Boşluk) → domates at. Başta tek tek; seviye atladıkça hızlanır ve çoklu atış açılır!",
      "Domatesler uzaylıları ezer; büyükleri 2, devler 3 vuruş ister.",
      "Uzaylılar inerken hızlanıp dalar; bahçeye inerse can gider. Dikkatli ol!",
      "Arka arkaya vurdukça kombo çarpanın artar.",
    ],
  },
  {
    id: "gun",
    name: "SİLAH",
    tagline: "Gerçekçi ateş: geri tepme nişanı savurur, namlu ısınır — seriler halinde at!",
    accent: "#5b8dff",
    hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor" },
    controls: [
      "Parmağını / faresi nereye tutarsan namlu oraya nişan alır.",
      "Basılı tut (veya Boşluk) → o yöne mermi yağdır; A/D ile de kayabilirsin.",
      "Her atış namluyu ISITIR: aşırı ısınırsa BARREL HARETLİ olur, soğumasını bekle!",
      "Sıkışık ateş GERİ TEPMİ yapar, nişanı savurur → kısa, ritimli seriler isabetli.",
      "Bazı uzaylılar dalgalı uçar, bazıları dalar; büyükleri 2 vuruş ister.",
      "Uzaylılar alttaki hatta inerse can gider.",
    ],
  },
  {
    id: "shock",
    name: "ŞOK",
    tagline: "Atış değil, fizik: şok dalgası bırak, yeşil reaktifleri patlat, zincirleme reaksiyon kur!",
    accent: "#a86bff",
    hud: { showLevel: true, showCombo: true, levelLabel: "Dalga", scoreLabel: "Skor", lives: 5 },
    controls: [
      "Ekrana dokun (veya tıkla) → o noktaya genişleyen bir ŞOK dalgası bırakırsın.",
      "Tüm uzaylılar alttaki KESİK ÇİZGİYİ geçmeye çalışır; geçmeden patlat!",
      "5 kalple başlarsın: her 5 uzaylı çizgiyi geçerse 1 kalp gider, kalpler bitince oyun biter.",
      "Alt çizgideki 5 blok, bir kalbe ne kadar yaklaştığını gösterir.",
      "Her dalga enerji harcar → kümeleri vur. Yeşil REAKTİFler zincir kurar; kırmızı tanklar 2 vuruş ister.",
    ],
  },
  {
    id: "meteor",
    name: "GÖKTAŞI",
    tagline: "Göktaşlarını durdur, kazandığın ₺ ile silahını seç ve geliştir!",
    accent: "#ff9f43",
    hud: { showLevel: true, showCombo: false, levelLabel: "Dalga", scoreLabel: "Skor", lives: 5 },
    controls: [
      "Taret otomatik nişan alıp en acil göktaşına ateş eder; sen silahı yönetirsin.",
      "Göktaşını vur → ₺ kazan. Alt şeritten silah seç: kilitliyse al, seçiliyse geliştir.",
      "4 silah: PULSAR, SAÇMA (yelpaze), LEZER (huzme), MISİL (izleyen füze). Her biri 5 seviyeye yükselir.",
      "NOVA düğmesi: paraya ekranı temizler (acil durum).",
      "Göktaşı tabana ulaşırsa ♥ gider; 5 kalp biterse oyun biter. Büyük göktaşları patlayınca bölünür!",
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
    case "gun":
      return new GunMode(canvas, cbs);
    case "shock":
      return new ShockMode(canvas, cbs);
    case "meteor":
      return new MeteorMode(canvas, cbs);
    case "flow":
    default:
      return new Game(canvas, cbs);
  }
}