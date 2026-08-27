import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadProgress, resetProgress } from "../lib/progress";

export const Route = createFileRoute("/ayarlar")({
  head: () => ({
    meta: [
      { title: "Ayarlar — Yeni Türk Edebiyatı Ustası" },
      {
        name: "description",
        content: "Soru sırasını karıştırma, açıklama gösterimi ve kayıtlı ilerlemeyi sıfırlama seçenekleri.",
      },
      { property: "og:title", content: "Ayarlar — Yeni Türk Edebiyatı Ustası" },
      { property: "og:description", content: "Oyun tercihlerini yönet ve ilerlemeni sıfırla." },
    ],
  }),
  component: Settings,
});

const SETTINGS_KEY = "ytea-settings-v1";

export type Settings = { shuffle: boolean; showExplanations: boolean };

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { shuffle: true, showExplanations: true };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Settings) : { shuffle: true, showExplanations: true };
  } catch {
    return { shuffle: true, showExplanations: true };
  }
}

function Settings() {
  const [settings, setSettings] = useState<Settings>({ shuffle: true, showExplanations: true });
  const [cleared, setCleared] = useState(false);

  useEffect(() => setSettings(loadSettings()), []);

  function update(next: Settings) {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* yoksay */
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground underline">
        ← Ana menü
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-primary">Ayarlar</h1>

      <div className="parchment mt-6 space-y-4 rounded-xl p-5">
        <label className="flex items-center justify-between gap-4">
          <span>Soruları karıştır</span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--gold)]"
            checked={settings.shuffle}
            onChange={(e) => update({ ...settings, shuffle: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Cevaptan sonra açıklama göster</span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--gold)]"
            checked={settings.showExplanations}
            onChange={(e) => update({ ...settings, showExplanations: e.target.checked })}
          />
        </label>
      </div>

      <div className="parchment mt-5 rounded-xl p-5">
        <h2 className="text-xl font-semibold text-primary">İlerlemeyi sıfırla</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tamamlanan seviyeler ve en yüksek skorlar silinir.
        </p>
        <button
          className="btn-base btn-outline mt-3"
          onClick={() => {
            resetProgress();
            loadProgress();
            setCleared(true);
          }}
        >
          Kayıtları sil
        </button>
        {cleared && <p className="mt-2 text-sm text-muted-foreground">Kayıtlar silindi.</p>}
      </div>
    </main>
  );
}
