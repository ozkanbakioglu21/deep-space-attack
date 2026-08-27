import type { Level } from "../types";
import { level1Questions } from "./level1";
import { level2Questions } from "./level2";
import { level3Questions } from "./level3";
import { level4Questions } from "./level4";
import { level5Questions } from "./level5";
import { level6Questions } from "./level6";
import { level7Questions } from "./level7";
import { level8Questions } from "./level8";
import { level9Questions } from "./level9";
import { level10Questions } from "./level10";

/**
 * Soru paketleri. Yeni bir paket eklemek için yeni bir dosya oluşturup
 * buraya bir Level nesnesi eklemek yeterlidir.
 */
export const levels: Level[] = [
  {
    id: 1,
    title: "Temel Bilgiler",
    topics: ["Tanzimat'a giriş", "İlk sanatçılar", "İlk eserler", "Temel kavramlar"],
    difficulty: "Kolay",
    questions: level1Questions,
  },
  {
    id: 2,
    title: "Tanzimat Dönemi",
    topics: ["Şinasi", "Namık Kemal", "Ziya Paşa", "Ahmet Mithat Efendi"],
    difficulty: "Kolay",
    questions: level2Questions,
  },
  {
    id: 3,
    title: "Servet-i Fünun",
    topics: ["Tevfik Fikret", "Halit Ziya", "Mehmet Rauf", "Cenap Şahabettin"],
    difficulty: "Orta",
    questions: level3Questions,
  },
  {
    id: 4,
    title: "Fecr-i Âti ve Millî Edebiyat",
    topics: ["Ahmet Haşim", "Ömer Seyfettin", "Ziya Gökalp", "Yeni Lisan"],
    difficulty: "Orta",
    questions: level4Questions,
  },
  {
    id: 5,
    title: "Cumhuriyet Dönemi Başlangıcı",
    topics: ["Yakup Kadri", "Halide Edip", "Reşat Nuri", "Peyami Safa"],
    difficulty: "Orta",
    questions: level5Questions,
  },
  {
    id: 6,
    title: "Cumhuriyet Dönemi Şiiri",
    topics: ["Yahya Kemal", "Ahmet Haşim", "Nazım Hikmet", "Garip hareketi"],
    difficulty: "Zor",
    questions: level6Questions,
  },
  {
    id: 7,
    title: "Modern Türk Şiiri",
    topics: ["İkinci Yeni", "Cemal Süreya", "Turgut Uyar", "Edip Cansever"],
    difficulty: "Zor",
    questions: level7Questions,
  },
  {
    id: 8,
    title: "Roman ve Hikâye Gelişimi",
    topics: ["Modern roman", "Postmodern anlatılar", "Önemli eserler", "Teknikler"],
    difficulty: "Zor",
    questions: level8Questions,
  },
  {
    id: 9,
    title: "Akademik Düzey",
    topics: ["Edebî akımlar", "Anlatım teknikleri", "Metin çözümleme", "Karşılaştırma"],
    difficulty: "Çok Zor",
    questions: level9Questions,
  },
  {
    id: 10,
    title: "Uzman Seviyesi",
    topics: ["Ayrıntılı eser bilgisi", "Poetikalar", "Edebiyat tarihi ilişkileri", "Akademik yorum"],
    difficulty: "Uzman",
    questions: level10Questions,
  },
];

export function getLevel(id: number): Level | undefined {
  return levels.find((l) => l.id === id);
}
