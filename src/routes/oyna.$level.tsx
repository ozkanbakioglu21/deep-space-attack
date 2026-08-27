import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getLevel, levels } from "../data/questions";
import { POINTS_PER_QUESTION, PASS_SCORE, gradeLabel, type Question } from "../data/types";
import { saveResult } from "../lib/progress";
import { loadSettings } from "./ayarlar";

export const Route = createFileRoute("/oyna/$level")({
  head: () => ({
    meta: [
      { title: "Soru Ekranı — Yeni Türk Edebiyatı Ustası" },
      {
        name: "description",
        content: "25 çoktan seçmeli soru, anında geri bildirim ve kısa açıklamalarla seviye sınavı.",
      },
      { property: "og:title", content: "Soru Ekranı — Yeni Türk Edebiyatı Ustası" },
      { property: "og:description", content: "Seviyeyi geçmek için 100 üzerinden en az 70 puan al." },
    ],
  }),
  component: Play,
});

const LETTERS = ["A", "B", "C", "D", "E"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function Play() {
  const { level: levelParam } = Route.useParams();
  const levelId = Number(levelParam);
  const level = getLevel(levelId);
  const settings = useMemo(() => loadSettings(), []);

  const [round, setRound] = useState(0);
  const questions = useMemo<Question[]>(() => {
    if (!level) return [];
    return settings.shuffle ? shuffle(level.questions) : level.questions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, settings.shuffle, round]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!level) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary">Seviye bulunamadı</h1>
        <Link to="/seviyeler" className="btn-base btn-primary mt-5">
          Seviyelere dön
        </Link>
      </main>
    );
  }

  const question = questions[index]!;
  const score = correctCount * POINTS_PER_QUESTION;

  function restart() {
    setRound((r) => r + 1);
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setFinished(false);
  }

  function choose(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === question.answer) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      const finalCorrect = correctCount;
      saveResult(level.id, finalCorrect * POINTS_PER_QUESTION);
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  }

  if (finished) {
    const wrong = questions.length - correctCount;
    const passed = score >= PASS_SCORE;
    const nextLevel = levels.find((l) => l.id === level.id + 1);
    return (
      <main className="mx-auto max-w-2xl px-5 py-14">
        <div className="parchment rounded-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Seviye {level.id} Tamamlandı</h1>
          <p className="mt-1 text-muted-foreground">{level.title}</p>
          <div className="mt-6 space-y-1 text-lg">
            <p>
              Doğru: <strong>{correctCount} / {questions.length}</strong>
            </p>
            <p>
              Yanlış: <strong>{wrong} / {questions.length}</strong>
            </p>
            <p>
              Başarı: <strong>{score} / 100</strong>
            </p>
          </div>
          <p className="font-display mt-5 text-2xl font-semibold text-primary">{gradeLabel(score)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {passed
              ? "Bu seviyeyi geçtin, sıradaki seviye açıldı."
              : `Geçmek için en az ${PASS_SCORE} puan gerekiyor. Tekrar denemelisin.`}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button className="btn-base btn-outline" onClick={restart}>
              Tekrar Oyna
            </button>
            {passed && nextLevel && (
              <Link
                to="/oyna/$level"
                params={{ level: String(nextLevel.id) }}
                className="btn-base btn-primary"
                onClick={restart}
              >
                Seviye {nextLevel.id}
              </Link>
            )}
            <Link to="/seviyeler" className="btn-base btn-gold">
              Seviyeler
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="ink-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
        <div>
          <p className="font-display text-lg font-semibold">
            Seviye {level.id} · {level.title}
          </p>
          <p className="text-sm opacity-80">
            Soru {index + 1} / {questions.length}
          </p>
        </div>
        <p className="font-display text-xl font-bold">{score} puan</p>
      </header>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gold transition-all"
          style={{ width: `${((index + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <section className="parchment mt-5 rounded-xl p-6">
        <h1 className="text-xl leading-snug font-semibold text-primary">{question.question}</h1>

        <div className="mt-5 space-y-3">
          {question.options.map((option, i) => {
            const isAnswer = i === question.answer;
            const state =
              selected === null
                ? ""
                : isAnswer
                  ? "option-correct"
                  : i === selected
                    ? "option-wrong"
                    : "opacity-70";
            return (
              <button
                key={i}
                className={`option-card ${state}`}
                onClick={() => choose(i)}
                disabled={selected !== null}
              >
                <span className="font-display font-bold text-primary">{LETTERS[i]})</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-5 rounded-lg border border-border bg-secondary p-4">
            <p className="font-display font-semibold text-primary">
              {selected === question.answer ? "Doğru!" : `Yanlış — Doğru cevap: ${LETTERS[question.answer]}`}
            </p>
            {settings.showExplanations && (
              <p className="mt-1 text-muted-foreground">{question.explanation}</p>
            )}
            <button className="btn-base btn-primary mt-4" onClick={next}>
              {index + 1 >= questions.length ? "Sonuçları Gör" : "Sonraki Soru"}
            </button>
          </div>
        )}
      </section>

      <Link to="/seviyeler" className="mt-5 inline-block text-sm text-muted-foreground underline">
        Seviyelere dön
      </Link>
    </main>
  );
}
