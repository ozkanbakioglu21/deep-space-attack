import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { levels } from "../data/questions";
import { gradeLabel } from "../data/types";
import { loadProgress, totalScore, type GameProgress } from "../lib/progress";

export const Route = createFileRoute("/basarilar")({
  head: () => ({
    meta: [
      { title: "Başarılar — Yeni Türk Edebiyatı Ustası" },
      {
        name: "description",
        content: "Tamamladığın seviyeler, en yüksek puanlar ve kazandığın edebiyat başarı unvanları.",
      },
      { property: "og:title", content: "Başarılar — Yeni Türk Edebiyatı Ustası" },
      { property: "og:description", content: "Edebiyat yarışmasındaki rozetlerin ve en yüksek skorların." },
    ],
  }),
  component: Achievements,
});

function Achievements() {
  const [progress, setProgress] = useState<GameProgress>({ levels: {} });
  useEffect(() => setProgress(loadProgress()), []);

  const completed = levels.filter((l) => progress.levels[String(l.id)]?.completed).length;
  const badges = [
    { label: "İlk Adım", done: completed >= 1, desc: "1 seviye tamamla" },
    { label: "Tanzimat Bilgini", done: completed >= 2, desc: "2 seviye tamamla" },
    { label: "Servet-i Fünun Uzmanı", done: completed >= 3, desc: "3 seviye tamamla" },
    { label: "Cumhuriyet Okuru", done: completed >= 5, desc: "5 seviye tamamla" },
    { label: "Modern Şiir Takipçisi", done: completed >= 7, desc: "7 seviye tamamla" },
    { label: "Edebiyat Ustası", done: completed >= 10, desc: "Tüm seviyeleri tamamla" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground underline">
        ← Ana menü
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-primary">Başarılar</h1>
      <div className="parchment mt-5 rounded-xl p-5">
        <p className="text-lg">
          Tamamlanan seviye: <strong>{completed}/10</strong>
        </p>
        <p className="text-lg">
          Toplam puan: <strong>{totalScore(progress)}</strong> / 1000
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {badges.map((b) => (
          <div key={b.label} className="parchment rounded-xl p-4">
            <p className="font-display text-lg font-semibold text-primary">
              {b.done ? "🏅" : "🔒"} {b.label}
            </p>
            <p className="text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-2xl font-semibold text-primary">Seviye Skorları</h2>
      <div className="mt-3 space-y-2">
        {levels.map((l) => {
          const rec = progress.levels[String(l.id)];
          return (
            <div key={l.id} className="flex justify-between rounded-lg border border-border bg-card px-4 py-2">
              <span>
                Seviye {l.id} — {l.title}
              </span>
              <span className="text-muted-foreground">
                {rec ? `${rec.bestScore}/100 · ${gradeLabel(rec.bestScore)}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
