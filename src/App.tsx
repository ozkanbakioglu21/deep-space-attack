import type { ReactNode } from "react";

type ElementId = "koz" | "tas" | "firtina" | "dalga" | "golge" | "aether";
type PantheonId = "olympos" | "asgard" | "duat" | "yomotsu";
type CardKind = "Tanrı" | "Kahraman" | "Yaratık" | "Eser" | "Ayin";

type SampleCard = {
  kind: CardKind;
  name: string;
  element?: ElementId;
  pantheon: PantheonId | "Ortak";
  hp?: number;
  ability?: string;
  attack?: { name: string; cost: string; text: string };
  text?: string;
  weakness?: string;
  resistance?: string;
  retreat?: string;
};

const ELEMENTS: Record<
  ElementId,
  { name: string; color: string; beats: string | null; note: string }
> = {
  koz: { name: "Köz", color: "#ff8a3d", beats: "Taş", note: "Körük gibi yakar; kayağı eritir." },
  tas: { name: "Taş", color: "#b8a888", beats: "Fırtına", note: "Yıldırımı emen sağlam zemin." },
  firtina: { name: "Fırtına", color: "#ffd94a", beats: "Dalga", note: "Köpüren denizi parçalar." },
  dalga: { name: "Dalga", color: "#4ac3ff", beats: "Gölge", note: "Karanlığı yıkan su." },
  golge: { name: "Gölge", color: "#a86bff", beats: "Köz", note: "Ateşi yutan karanlık." },
  aether: {
    name: "Aether",
    color: "#cfd8ff",
    beats: null,
    note: "İlahi element: herkesten nötr yer alır, yalnızca Gölge'den dirençli (x0.5).",
  },
};

const PANTHEONS: Record<PantheonId, { name: string; color: string; blessing: string }> = {
  olympos: {
    name: "Olimpos",
    color: "#e8b64c",
    blessing: "Kaderin Hediyesi — Aether bir yaratık oynadığında 1 kart çek.",
  },
  asgard: {
    name: "Asgard",
    color: "#7ec8e3",
    blessing: "Valhalla Yemini — 100+ hasar veren Fırtına saldırısı 1 Kâder kazandırır.",
  },
  duat: {
    name: "Duat",
    color: "#5fd4a0",
    blessing: "Ölüler Geçidi — Bir yaratığın düşürülmesiyle elden 1 kart çek.",
  },
  yomotsu: {
    name: "Yomotsu",
    color: "#ff6b5e",
    blessing: "Sonsuz Gün — İlk turunda 2 yaratık oynayabilirsin.",
  },
};

const CARDS: SampleCard[] = [
  {
    kind: "Tanrı",
    name: "Athena",
    element: "aether",
    pantheon: "olympos",
    hp: 240,
    ability: "Bilgelik — Tur başı 1 Fırtına gücünü Aether sayabilirsin.",
    attack: { name: "Kalkan", cost: "Aether", text: "80. 3+ Aether gücün varsa +40." },
    weakness: "Gölge",
    resistance: "—",
    retreat: "Aether 1",
  },
  {
    kind: "Tanrı",
    name: "Thor",
    element: "firtina",
    pantheon: "asgard",
    hp: 220,
    attack: { name: "Mjölnir", cost: "Fırtına x2", text: "120. Rakibin aktifi Aether ise +60." },
    weakness: "Taş",
    resistance: "Dalga",
    retreat: "Fırtına 1",
  },
  {
    kind: "Tanrı",
    name: "Loki",
    element: "golge",
    pantheon: "asgard",
    hp: 180,
    ability: "Biçim Değiştir — Loki'yi ücretsiz geri çekebilirsin.",
    attack: { name: "Hile", cost: "Gölge", text: "40 + rakibin 1 gücünü destanına karıştır." },
    weakness: "Köz",
    resistance: "Aether",
    retreat: "Gölge 1",
  },
  {
    kind: "Tanrı",
    name: "Anubis",
    element: "golge",
    pantheon: "duat",
    hp: 200,
    attack: { name: "Ruh Tartısı", cost: "Gölge", text: "60. Rakip destanı 5'in altındaysa +80." },
    weakness: "Aether",
    resistance: "—",
    retreat: "Gölge 1",
  },
  {
    kind: "Tanrı",
    name: "Amaterasu",
    element: "koz",
    pantheon: "yomotsu",
    hp: 230,
    ability: "Parıltı — 2+ Köz gücün varken Köz saldırıları +20.",
    attack: { name: "Güneş Işığı", cost: "Köz x2", text: "100" },
    weakness: "Dalga",
    resistance: "Taş",
    retreat: "Köz 1",
  },
  {
    kind: "Kahraman",
    name: "Perseus",
    element: "aether",
    pantheon: "olympos",
    hp: 160,
    attack: { name: "Yansıma", cost: "Aether", text: "50. Rakibin zayıflığı ile direnci yer değiştirir." },
    weakness: "Gölge",
    resistance: "Taş",
    retreat: "Aether 1",
  },
  {
    kind: "Kahraman",
    name: "Odysseus",
    element: "dalga",
    pantheon: "olympos",
    hp: 170,
    ability: "Göçebe — İlk turun ücretsiz geri çekilme.",
    attack: { name: "Zeka Tuzakları", cost: "Dalga", text: "60" },
    weakness: "Fırtına",
    resistance: "Köz",
    retreat: "Dalga 1",
  },
  {
    kind: "Yaratık",
    name: "Kerberos",
    element: "golge",
    pantheon: "duat",
    hp: 130,
    attack: { name: "Üç Başlı Isırık", cost: "Gölge", text: "45" },
    weakness: "Köz",
    resistance: "—",
    retreat: "Gölge 1",
  },
  {
    kind: "Yaratık",
    name: "Mantikor",
    element: "tas",
    pantheon: "duat",
    hp: 140,
    attack: { name: "Diken", cost: "Taş", text: "60" },
    weakness: "Fırtına",
    resistance: "Köz",
    retreat: "Taş 1",
  },
  {
    kind: "Eser",
    name: "Altın Yün",
    pantheon: "olympos",
    text: "Bir yaratığını ve bir gücünü eline geri al.",
  },
  {
    kind: "Eser",
    name: "Excalibur",
    pantheon: "olympos",
    text: "Bir kahramanına bu tur +60 hasar.",
  },
  {
    kind: "Eser",
    name: "Helios Arabası",
    pantheon: "yomotsu",
    text: "Aktifin bu tur +30 hasar. Bu tur geri çekilemez.",
  },
  {
    kind: "Ayin",
    name: "Kâhinin Kehaneti",
    pantheon: "olympos",
    text: "Rakip destanının ilk 4 kartını gör; 1'ini eline koy, gerisini karıştır.",
  },
  {
    kind: "Ayin",
    name: "Kan Feda",
    pantheon: "duat",
    text: "Bir yaratığını at; 3 kart çek.",
  },
  {
    kind: "Ayin",
    name: "Dionysos Bayramı",
    pantheon: "olympos",
    text: "Tüm yaratıkların bu tur +30 HP.",
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="gdd-section" id={id}>
      <h2 className="gdd-h2">{title}</h2>
      {children}
    </section>
  );
}

function ElementBadge({ id }: { id: ElementId }) {
  const el = ELEMENTS[id];
  return (
    <span className="el-badge" style={{ color: el.color, borderColor: el.color }}>
      {el.name}
    </span>
  );
}

function CardMock({ c }: { c: SampleCard }) {
  const ptColor =
    c.pantheon === "Ortak" ? "#9aa7b8" : PANTHEONS[c.pantheon as PantheonId].color;
  const isCreature = c.hp !== undefined;
  return (
    <div className="card" style={{ borderColor: ptColor }}>
      <div className="card-head" style={{ background: `linear-gradient(135deg, ${ptColor}33, transparent)` }}>
        <span className="card-name">{c.name}</span>
        <span className="card-meta">
          {c.element ? <ElementBadge id={c.element} /> : null}
          {c.hp !== undefined ? <span className="card-hp">{c.hp} HP</span> : null}
        </span>
      </div>
      <div className="card-kind" style={{ background: ptColor, color: "#05050f" }}>
        {c.kind} · {c.pantheon === "Ortak" ? "Ortak" : PANTHEONS[c.pantheon as PantheonId].name}
      </div>
      <div className="card-body">
        {c.ability ? <p className="card-ability">{c.ability}</p> : null}
        {c.attack ? (
          <p className="card-attack">
            <strong>{c.attack.name}</strong>{" "}
            <span className="card-cost">[{c.attack.cost}]</span>
            <br />
            {c.attack.text}
          </p>
        ) : null}
        {c.text ? <p className="card-attack">{c.text}</p> : null}
      </div>
      {isCreature ? (
        <div className="card-foot">
          <span>Zayıf: {c.weakness}</span>
          <span>Direnç: {c.resistance}</span>
          <span>Geri Çekilme: {c.retreat}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="gdd-hero">
        <p className="gdd-kicker">Oyun Tasarım Dokümanı · v1.0</p>
        <h1 className="gdd-title">
          PANTHEON
          <span className="gdd-title-alt">Mitoloji Kart Oyunu</span>
        </h1>
        <p className="gdd-tagline">
          İki Destan Yönlendiren, Olimpos'tan Yomotsu'ya tanrıları çağırır.
          <br />
          Kazanan, miti son cümlesine yazandır.
        </p>
        <nav className="gdd-toc">
          <a href="#kimlik">Kimlik</a>
          <a href="#dongu">Döngü</a>
          <a href="#turler">Kart Türleri</a>
          <a href="#elementler">Elementler</a>
          <a href="#savas">Savaş</a>
          <a href="#kader">Kâder</a>
          <a href="#pantheon">Pantheon</a>
          <a href="#kazanma">Kazanma</a>
          <a href="#deck">Deck</a>
          <a href="#kartlar">Örnek Kartlar</a>
          <a href="#ui">Arayüz</a>
          <a href="#roadmap">Yol Haritası</a>
        </nav>
      </header>

      <main className="gdd-main">
        <Section id="kimlik" title="Oyun Kimliği">
          <p>
            <strong>Pantheon</strong>, 2 kişilik taktiksel bir kart savaşçısıdır. Oyuncular
            farklı mitolojik pantheonlardan (Olimpos, Asgard, Duat, Yomotsu) tanrı, kahraman ve
            mitik yaratıklar çağırarak bir mitolojik arenada çarpışır.
          </p>
          <ul className="gdd-list">
            <li>Süre: maç başı 15–30 dk</li>
            <li>Oyuncu: 2 kişi (MVP'de oyuncu + yapay zekâ)</li>
            <li>Hedef kitle: Pokémon TCG'sini bilen, taktik derinlik arayan 12+ yaş</li>
            <li>Fizik + dijital: kurallar fiziksel desteye uygun kalır (zar yok)</li>
          </ul>
        </Section>

        <Section id="dongu" title="Çekirdek Döngü (Tur)">
          <ol className="gdd-loop">
            <li>1 kart çek.</li>
            <li>1 İlahi Güç bağla (ücretsiz eylem, her tur 1 kez).</li>
            <li>Yavrunun (yaratığın) birini bankaya kur; elden kart oyna.</li>
            <li>Bankadan birini aktife taşı (geri çekilme, güç maliyeti öder).</li>
            <li>Aktifle 1 saldırı yap.</li>
            <li>1 Ayin ve/veya 1 Eser kullanabilirsin.</li>
            <li>Kâderini kontrol et, turu bitir.</li>
          </ol>
        </Section>

        <Section id="turler" title="Kart Türleri">
          <div className="gdd-table-wrap">
            <table className="gdd-table">
              <thead>
                <tr>
                  <th>Tür</th>
                  <th>Rol</th>
                  <th>Güç Seviyesi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Yaratık</td>
                  <td>Mitik canavar — ucuz, hızlı açılış</td>
                  <td>Temel</td>
                </tr>
                <tr>
                  <td>Kahraman</td>
                  <td>Ana saldırgan — dengeli</td>
                  <td>Orta</td>
                </tr>
                <tr>
                  <td>Tanrı</td>
                  <td>Yüksek HP, yetenek; nadir ve güçlü</td>
                  <td>Zirve</td>
                </tr>
                <tr>
                  <td>İlahi Güç</td>
                  <td>Element taşıyan enerji kaynağı</td>
                  <td>Kaynak</td>
                </tr>
                <tr>
                  <td>Eser</td>
                  <td>Tek kullanımlık / aktif nesne</td>
                  <td>Destek</td>
                </tr>
                <tr>
                  <td>Ayin</td>
                  <td>Tur başına 1 destek efektli kart</td>
                  <td>Destek</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="elementler" title="Elementler ve Zayıflık">
          <p>
            5 element bir çember oluşturur: her biri sıradakinin <strong>x1.5</strong> hasar
            verir, bir öncekinden <strong>x0.5</strong> yer.
          </p>
          <div className="gdd-cycle">
            {(["koz", "tas", "firtina", "dalga", "golge"] as ElementId[]).map((id, i) => (
              <span key={id} className="gdd-cycle-item">
                <ElementBadge id={id} />
                {i < 4 ? <span className="gdd-cycle-arrow">x1.5</span> : null}
              </span>
            ))}
            <span className="gdd-cycle-arrow gdd-cycle-return">x1.5 →</span>
            <ElementBadge id="koz" />
          </div>
          <div className="gdd-elements">
            {(Object.keys(ELEMENTS) as ElementId[]).map((id) => (
              <div key={id} className="gdd-element" style={{ borderColor: ELEMENTS[id].color }}>
                <ElementBadge id={id} />
                {ELEMENTS[id].beats ? <span className="gdd-element-beats">üstün: {ELEMENTS[id].beats}</span> : null}
                <p className="gdd-element-note">{ELEMENTS[id].note}</p>
              </div>
            ))}
          </div>
          <p className="gdd-note">
            Hasar hesabı: taban hasar → element çarpanı (x1.5 / x0.5 / x1) → saldırı efekt
            bonusları → 10'a yuvarla.
          </p>
        </Section>

        <Section id="savas" title="Savaş">
          <p>Her savaş kartı şu istatistikleri taşır:</p>
          <ul className="gdd-list">
            <li><strong>HP</strong> — düşürülünce bankaya/aktiften kalkar.</li>
            <li><strong>Element</strong> — zayıflık matrisi.</li>
            <li><strong>Pantheon</strong> — destan kimliği ve bereket.</li>
            <li><strong>Saldırı</strong> — güç sembolü maliyet + sabit hasar + efekt (zar yok).</li>
            <li><strong>Zayıflık</strong> — o elementten x1.5 yer.</li>
            <li><strong>Direnç</strong> — o elementten x0.5 yer.</li>
            <li><strong>Geri Çekilme</strong> — bankaya inmenin güç maliyeti.</li>
          </ul>
        </Section>

        <Section id="kader" title="Kâder — Destan Yazımı (Özgün Katman)">
          <p>
            Saldırı yaptığın her tur <strong>1 Kâder</strong> kazanırsın. 3 Kâder birikince{" "}
            <strong>Destanı Yaz</strong>: pantheonunun ultimate'ini bir kez tetiklersin.
          </p>
          <div className="gdd-ultimates">
            {(Object.keys(PANTHEONS) as PantheonId[]).map((id) => (
              <div key={id} className="gdd-ult" style={{ borderColor: PANTHEONS[id].color }}>
                <span className="gdd-ult-name" style={{ color: PANTHEONS[id].color }}>
                  {PANTHEONS[id].name}
                </span>
                <p className="gdd-ult-text">
                  {id === "olympos" && "Kaderin Hükmü — tüm yaratıkların +50 HP."}
                  {id === "asgard" && "Ragnarök Şafağı — bir sonraki saldırın 2x hasar."}
                  {id === "duat" && "Ölüler Geçidi — rakibin 2 gücünü destanına karıştır."}
                  {id === "yomotsu" && "Güneşin Dönüşü — 3 kart çek, aktifin 50 HP iyileşir."}
                </p>
              </div>
            ))}
          </div>
          <p className="gdd-note">
            Karışık destan (2+ pantheon) ultimate'i: <strong>Mit Yankısı</strong> — 2 kart çek.
          </p>
        </Section>

        <Section id="pantheon" title="Pantheon Kimliği">
          <p>
            Deck'in <strong>tek pantheonlu</strong>ysa o pantheonun <strong>pantheon
            bereketi</strong> pasifi aktif olur:
          </p>
          <div className="gdd-blessings">
            {(Object.keys(PANTHEONS) as PantheonId[]).map((id) => (
              <div key={id} className="gdd-blessing" style={{ borderColor: PANTHEONS[id].color }}>
                <span className="gdd-ult-name" style={{ color: PANTHEONS[id].color }}>
                  {PANTHEONS[id].name}
                </span>
                <p className="gdd-ult-text">{PANTHEONS[id].blessing}</p>
              </div>
            ))}
          </div>
          <p className="gdd-note">Karışık deckler esnektir ama bereketten vazgeçer.</p>
        </Section>

        <Section id="kazanma" title="Kazanma Şartları">
          <ol className="gdd-list">
            <li>Rakibin <strong>tüm savaş kartları</strong> (aktif + banka) düşürülür.</li>
            <li>Rakip destanı biter.</li>
            <li>Bir <strong>Tanrı öldürülür</strong> (özel, hızlı ama riskli yol).</li>
          </ol>
        </Section>

        <Section id="deck" title="Deck Kuralları">
          <ul className="gdd-list">
            <li>30–40 kart.</li>
            <li>Aynı kart en fazla 4 adet; <strong>Tanrı</strong> kartları en fazla 2.</li>
            <li>En az 1 Yaratık ve önerilen 10+ İlahi Güç.</li>
            <li>Destanın tamamı tek pantheon = bereket pasifi.</li>
          </ul>
        </Section>

        <Section id="kartlar" title="Örnek Kartlar (Set 1: Pantheonların Uyanışı)">
          <div className="gdd-card-grid">
            {CARDS.map((c) => (
              <CardMock key={c.name} c={c} />
            ))}
          </div>
        </Section>

        <Section id="ui" title="Arayüz (Dijital)">
          <ul className="gdd-list">
            <li><strong>Üst bar:</strong> rakip destan adedi, Kâder göstergesi (3 yuva), rakip aktif + bankası.</li>
            <li><strong>Savaş sahası:</strong> rakip aktif vs senin aktifin; hasar pop-up'ları.</li>
            <li><strong>Alt bar:</strong> bankan + yelpaze şeklinde el; eylem düğmeleri (Çek, Bağla, Oyna, Saldır, Turu Bitir).</li>
            <li><strong>Mobil:</strong> dokun ile oyna/saldır; el kartları büyütülmeli.</li>
            <li><strong>Anasayfa:</strong> Yeni Maç · Deck · Koleksiyon · Nasıl Oynanır.</li>
          </ul>
        </Section>

        <Section id="roadmap" title="Yol Haritası">
          <ol className="gdd-list">
            <li><strong>MVP:</strong> oyuncu vs basit AI — deck, çekme, güç bağlama, kart oynama, saldırı, zayıflık hesabı, kazanma şartları.</li>
            <li><strong>Kâder + yetenek katmanı</strong> (ultimate'ler, pasif bereket).</li>
            <li>AI geliştirme + deck editörü.</li>
            <li>Koleksiyon + paket sistemi (başlangıç paketi).</li>
            <li>Online PvP + sezonluk setler.</li>
          </ol>
        </Section>
      </main>

      <footer className="gdd-footer">
        PANTHEON — Mitoloji Kart Oyunu · GDD v1.0
      </footer>
    </div>
  );
}