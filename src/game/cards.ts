export type Element = "koz" | "tas" | "firtina" | "dalga" | "golge" | "aether";
export type Pantheon = "olympos" | "asgard" | "duat" | "yomotsu";
export type Kind = "yaratik" | "kahraman" | "tanni" | "guc" | "eser" | "ayin";

export type EffectId = "kalkan" | "mjolnir" | "hile" | "ruhartarisi" | "yansima";

export interface AttackDef {
  name: string;
  cost: Element[];
  base: number;
  effect?: EffectId;
  text: string;
}

export interface CardDef {
  id: string;
  kind: Kind;
  name: string;
  element?: Element;
  pantheon: Pantheon;
  hp?: number;
  retreat: Element[];
  attack?: AttackDef;
  weakness?: Element;
  resistance?: Element;
  text?: string;
}

export const ELEMENT_NAMES: Record<Element, string> = {
  koz: "Köz",
  tas: "Taş",
  firtina: "Fırtına",
  dalga: "Dalga",
  golge: "Gölge",
  aether: "Aether",
};

export const ELEMENT_COLORS: Record<Element, string> = {
  koz: "#ff8a3d",
  tas: "#b8a888",
  firtina: "#ffd94a",
  dalga: "#4ac3ff",
  golge: "#a86bff",
  aether: "#cfd8ff",
};

export const PANTHEON_NAMES: Record<Pantheon, string> = {
  olympos: "Olimpos",
  asgard: "Asgard",
  duat: "Duat",
  yomotsu: "Yomotsu",
};

export const PANTHEON_COLORS: Record<Pantheon, string> = {
  olympos: "#e8b64c",
  asgard: "#7ec8e3",
  duat: "#5fd4a0",
  yomotsu: "#ff6b5e",
};

const BEATS: Record<Element, Element | null> = {
  koz: "tas",
  tas: "firtina",
  firtina: "dalga",
  dalga: "golge",
  golge: "koz",
  aether: null,
};

export function elementMultiplier(att: Element | undefined, def: Element | undefined): number {
  if (!att || !def) return 1;
  if (att === "aether") return def === "golge" ? 0.5 : 1;
  if (def === "aether") return 1;
  if (BEATS[att] === def) return 1.5;
  if (BEATS[def] === att) return 0.5;
  return 1;
}

export const CARD_POOL: Record<string, CardDef> = {
  "e-koz": { id: "e-koz", kind: "guc", name: "Köz Gücü", element: "koz", pantheon: "olympos", retreat: [] },
  "e-tas": { id: "e-tas", kind: "guc", name: "Taş Gücü", element: "tas", pantheon: "duat", retreat: [] },
  "e-firtina": { id: "e-firtina", kind: "guc", name: "Fırtına Gücü", element: "firtina", pantheon: "asgard", retreat: [] },
  "e-dalga": { id: "e-dalga", kind: "guc", name: "Dalga Gücü", element: "dalga", pantheon: "olympos", retreat: [] },
  "e-golge": { id: "e-golge", kind: "guc", name: "Gölge Gücü", element: "golge", pantheon: "duat", retreat: [] },
  "e-aether": { id: "e-aether", kind: "guc", name: "Aether Gücü", element: "aether", pantheon: "olympos", retreat: [] },
  kerberos: {
    id: "kerberos",
    kind: "yaratik",
    name: "Kerberos",
    element: "golge",
    pantheon: "duat",
    hp: 130,
    retreat: ["golge"],
    attack: { name: "Üç Başlı Isırık", cost: ["golge"], base: 45, text: "45" },
    weakness: "koz",
  },
  mantikor: {
    id: "mantikor",
    kind: "yaratik",
    name: "Mantikor",
    element: "tas",
    pantheon: "duat",
    hp: 140,
    retreat: ["tas"],
    attack: { name: "Diken", cost: ["tas"], base: 60, text: "60" },
    weakness: "firtina",
  },
  perseus: {
    id: "perseus",
    kind: "kahraman",
    name: "Perseus",
    element: "aether",
    pantheon: "olympos",
    hp: 160,
    retreat: ["aether"],
    attack: { name: "Yansıma", cost: ["aether"], base: 50, effect: "yansima", text: "50. Rakibin zayıflığı ile direnci yer değiştirir." },
    weakness: "golge",
    resistance: "tas",
  },
  odysseus: {
    id: "odysseus",
    kind: "kahraman",
    name: "Odysseus",
    element: "dalga",
    pantheon: "olympos",
    hp: 170,
    retreat: ["dalga"],
    attack: { name: "Zeka Tuzakları", cost: ["dalga"], base: 60, text: "60" },
    weakness: "firtina",
    resistance: "koz",
  },
  athena: {
    id: "athena",
    kind: "tanni",
    name: "Athena",
    element: "aether",
    pantheon: "olympos",
    hp: 240,
    retreat: ["aether"],
    attack: { name: "Kalkan", cost: ["aether"], base: 80, effect: "kalkan", text: "80. Sahnede 3+ Aether gücü varsa +40." },
    weakness: "golge",
  },
  thor: {
    id: "thor",
    kind: "tanni",
    name: "Thor",
    element: "firtina",
    pantheon: "asgard",
    hp: 220,
    retreat: ["firtina"],
    attack: { name: "Mjölnir", cost: ["firtina", "firtina"], base: 120, effect: "mjolnir", text: "120. Rakibin aktifi Aether ise +60." },
    weakness: "tas",
    resistance: "dalga",
  },
  loki: {
    id: "loki",
    kind: "tanni",
    name: "Loki",
    element: "golge",
    pantheon: "asgard",
    hp: 180,
    retreat: ["golge"],
    attack: { name: "Hile", cost: ["golge"], base: 40, effect: "hile", text: "40 + rakibin bağlı 1 gücünü destanına karıştır." },
    weakness: "koz",
    resistance: "aether",
  },
  anubis: {
    id: "anubis",
    kind: "tanni",
    name: "Anubis",
    element: "golge",
    pantheon: "duat",
    hp: 200,
    retreat: ["golge"],
    attack: { name: "Ruh Tartısı", cost: ["golge"], base: 60, effect: "ruhartarisi", text: "60. Rakip destanı 5'in altındaysa +80." },
    weakness: "aether",
  },
  amaterasu: {
    id: "amaterasu",
    kind: "tanni",
    name: "Amaterasu",
    element: "koz",
    pantheon: "yomotsu",
    hp: 230,
    retreat: ["koz"],
    attack: { name: "Güneş Işığı", cost: ["koz", "koz"], base: 100, text: "100" },
    weakness: "dalga",
    resistance: "tas",
  },
  excalibur: {
    id: "excalibur",
    kind: "eser",
    name: "Excalibur",
    pantheon: "olympos",
    retreat: [],
    text: "Bir yaratığına bu tur +60 hasar.",
  },
  "helios-arabasi": {
    id: "helios-arabasi",
    kind: "eser",
    name: "Helios Arabası",
    pantheon: "yomotsu",
    retreat: [],
    text: "Aktifin bu tur +30 hasar. Bu tur geri çekilemez.",
  },
  "altin-yun": {
    id: "altin-yun",
    kind: "eser",
    name: "Altın Yün",
    pantheon: "olympos",
    retreat: [],
    text: "Bir yaratığını ve bağlı güçlerini eline geri al.",
  },
  "kahin-kehaneti": {
    id: "kahin-kehaneti",
    kind: "ayin",
    name: "Kâhinin Kehaneti",
    pantheon: "olympos",
    retreat: [],
    text: "Rakip destanının ilk 4 kartından 1'ini eline al; gerisini karıştır.",
  },
  "kan-feda": {
    id: "kan-feda",
    kind: "ayin",
    name: "Kan Feda",
    pantheon: "duat",
    retreat: [],
    text: "Bir yaratığını feda et; 3 kart çek.",
  },
  "dionysos-bayrami": {
    id: "dionysos-bayrami",
    kind: "ayin",
    name: "Dionysos Bayramı",
    pantheon: "olympos",
    retreat: [],
    text: "Tüm yaratıkların bu tur +30 HP.",
  },
};

export const DECKS: Record<"olympos" | "asgard", string[]> = {
  olympos: [
    "kerberos", "kerberos", "mantikor", "mantikor",
    "perseus", "perseus", "odysseus", "athena", "anubis",
    "e-golge", "e-golge", "e-golge", "e-tas", "e-tas", "e-aether", "e-aether", "e-dalga",
    "excalibur", "helios-arabasi", "kahin-kehaneti", "dionysos-bayrami",
  ],
  asgard: [
    "thor", "thor", "loki", "kerberos", "kerberos",
    "mantikor", "mantikor", "odysseus",
    "e-firtina", "e-firtina", "e-firtina", "e-golge", "e-golge", "e-tas", "e-tas", "e-aether", "e-dalga",
    "helios-arabasi", "altin-yun", "kan-feda", "kahin-kehaneti",
  ],
};

export const ULTIMATES: Record<Pantheon | "mixed", { name: string; text: string }> = {
  olympos: { name: "Kaderin Hükmü", text: "Tüm yaratıkların +50 HP." },
  asgard: { name: "Ragnarök Şafağı", text: "Bir sonraki saldırın 2x hasar." },
  duat: { name: "Ölüler Geçidi", text: "Rakibin bağlı 2 gücünü destanına karıştır." },
  yomotsu: { name: "Güneşin Dönüşü", text: "3 kart çek, aktifin 50 HP iyileşir." },
  mixed: { name: "Mit Yankısı", text: "2 kart çek." },
};

export type Scene = { text: string; next?: string; choice?: { a: string; b: string; deck: "olympos" | "asgard" } };

export const PROLOGUE: Record<string, Scene> = {
  s1: { text: "Son ateş söndü. Pantheonların sesleri yankıya döndü; tanrılar artık sadece birer fısıltı.", next: "s2" },
  s2: { text: "Yıkık tapınakların arasında rakip bir Destan Yönlendiren kamp kurdu. Sesi çalan odur.", next: "s3" },
  s3: { text: "Ama sen hâlâ yazıyorsun. Destanın ilk cümlesi seçtiğin pantheonun adıdır. Miti son cümlesine sen yazacaksın.", next: "s4" },
  s4: {
    text: "Hangi pantheonun bereketini üstleneceksin?",
    choice: { a: "Olimpos — Kaderin Hediyesi", b: "Asgard — Valhalla Yemini", deck: "olympos" },
  },
};

export const EPILOGUE_WIN =
  "Yankı, sesini buldu. Tanrılar adlarını hatırladı. Miti son cümlesine yazan senin ellerindir — ve destan, artık senin destanın.";
export const EPILOGUE_LOSE =
  "Yankı soludu... Ama mit bitmedi. Her son cümle, yeni bir destanın ilk harfidir. Tekrar dene, Yönlendiren.";