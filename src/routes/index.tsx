import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yeni Türk Edebiyatı Ustası — Bilgi Yarışması" },
      {
        name: "description",
        content:
          "10 seviye, 250 soru: Tanzimat'tan modern romana Yeni Türk Edebiyatı bilgi yarışması. Açıklamalı sorularla kendini sına.",
      },
      { property: "og:title", content: "Yeni Türk Edebiyatı Ustası" },
      {
        property: "og:description",
        content: "10 seviye ve 250 açıklamalı soruyla Yeni Türk Edebiyatı bilgi yarışması.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-5 py-16 text-center">
      <div className="parchment w-full rounded-xl px-6 py-12">
        <p className="font-display text-sm tracking-[0.35em] text-muted-foreground uppercase">
          Edebiyat Bilgi Yarışması
        </p>
        <h1 className="mt-4 text-4xl leading-tight font-bold text-primary sm:text-5xl">
          Yeni Türk Edebiyatı Ustası
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Tanzimat'tan modern romana; 10 seviye, 250 açıklamalı soru. Her seviyede 25 soru, her soru 4
          puan. Bir sonraki seviyeye geçmek için 70 puan yeterli.
        </p>

        <div className="mt-9 flex flex-col items-stretch gap-3 sm:mx-auto sm:w-80">
          <Link to="/oyna/$level" params={{ level: "1" }} className="btn-base btn-primary">
            Oyuna Başla
          </Link>
          <Link to="/seviyeler" className="btn-base btn-gold">
            Seviyeler
          </Link>
          <Link to="/basarilar" className="btn-base btn-outline">
            Başarılar
          </Link>
          <Link to="/ayarlar" className="btn-base btn-outline">
            Ayarlar
          </Link>
        </div>
      </div>
    </main>
  );
}
