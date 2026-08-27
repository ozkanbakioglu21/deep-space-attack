import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { levels } from "../data/questions";
import { isLevelUnlocked, loadProgress, type GameProgress } from "../lib/progress";

export const Route = createFileRoute("/seviyeler")({
  head: () => ({
    meta: [
      { title: "Seviyeler — Yeni Türk Edebiyatı Ustası" },
      {
        name: "description",
        content: "Tanzimat'tan uzman seviyesine 10 bölüm: konular, zorluk dereceleri ve en yüksek skorların.",
      },
      { property: "og:title", content: "Seviyeler — Yeni Türk Edebiyatı Ustası" },
      { property: "og:description", content: "10 seviyelik edebiyat yarışmasında ilerlemeni takip et." },
    ],
  }),
  component: Levels,
});

function Levels() {
  const [progress, setProgress] = useState<GameProgress>({ levels: {} });
  useEffect(() => setProgress(loadProgress()), []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground underline">
        ← Ana menü
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-primary">Seviyeler</h1>
      <div className="mt-6 space-y-3">
        {levels.map((level) => {
          const unlocked = isLevelUnlocked(level.id, progress);
          const record = progress.levels[String(level.id)];
          return (
            <div key={level.id} className="parchment rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-primary">
                    Seviye {level.id} — {level.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {level.topics.join(" · ")} · Zorluk: {level.difficulty} · {level.questions.length} soru
                  </p>
                  <p className="mt-1 text-sm">
                    {record
                      ? `En yüksek: ${record.bestScore}/100 · Deneme: ${record.attempts} ${record.completed ? "· Tamamlandı ✓" : ""}`
                      : "Henüz oynanmadı"}
                  </p>
                </div>
                {unlocked ? (
                  <Link
                    to="/oyna/$level"
                    params={{ level: String(level.id) }}
                    className="btn-base btn-primary"
                  >
                    {record?.completed ? "Tekrar Oyna" : "Başla"}
                  </Link>
                ) : (
                  <span className="btn-base btn-outline cursor-not-allowed opacity-60">🔒 Kilitli</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
