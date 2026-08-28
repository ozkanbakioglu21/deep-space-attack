# Deep Space Attack

2D mobil uzay savunma oyunu. Dik telefon ekranında oynanır; uzay aracınız ekranın
altında, düşman uzay araçları yukarıdan iner.

## Nasıl oynanır

- Parmağınızı ekranda sürükleyerek (veya masaüstünde ok tuşları / fare ile) uzay
  aracınızı hareket ettirin.
- Aracınız yukarıya otomatik ateş eder.
- Gelen düşman dalgalarını (drone, avcı, tank, döner, kamikaze) yok edin; düşman
  mermilerine ve çarpışmalara dikkat edin.
- Düşmanlardan düşen güçleri toplayın: Kalkan, hızlı ateş, bomba ve ekstra can.
- Her seviyede sürpriz hücum düzenleri bekler: drone spiralleri, avcı kolları,
  döner fanları, kamikaze saldırıları, tank kuşatmaları ve meteor yağmurları.
- Her 5 seviyede bir yeni bölüm başlar: Derin Uzay, Nebula, Asteroit Kuşağı,
  Hiper Uzay ve Kara Delik; her bölümün kendi arka planı, yıldız alanı ve hızı vardır.
- Hızlı seri imhalar komboyu yükseltir ve skor çarpanınızı artırır.
- Her 18 saniyede bir seviye atlanır; seviyeyi temizlediğiniz için bonus skor,
  düşmanlar hızlanır ve çeşitlenir.

En iyi skor tarayıcınızda (`localStorage`) saklanır.

## Geliştirme

Node.js ve npm gerekir.

```sh
npm install
npm run dev
```

## Yapı

- `src/game/engine.ts` - canvas tabanlı oyun döngüsü, çarpışma ve oyun mantığı
- `src/game/painter.ts` - tüm canvas çizimleri (düşmanlar, güçler, efektler)
- `src/game/defs.ts` - düşman ve güç tanımları
- `src/game/types.ts` - varlık tipleri
- `src/game/constants.ts` - oyun denge sabitleri
- `src/game/audio.ts` - Web Audio ile ses efektleri
- `src/game/storage.ts` - en iyi skor saklama
- `src/App.tsx` - menü/HUD/oyun sonu arayüzü

## Teknolojiler

- Vite + React 19 + TypeScript
- HTML5 Canvas 2D
- Vercel (statik dağıtım)