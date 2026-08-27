export type Question = {
  id: string;
  question: string;
  options: [string, string, string, string, string];
  /** 0-based index of the correct option */
  answer: 0 | 1 | 2 | 3 | 4;
  explanation: string;
};

export type Level = {
  id: number;
  title: string;
  topics: string[];
  difficulty: "Kolay" | "Orta" | "Zor" | "Çok Zor" | "Uzman";
  questions: Question[];
};

export const POINTS_PER_QUESTION = 4;
export const PASS_SCORE = 70;

export function gradeLabel(score: number): string {
  if (score >= 90) return "Edebiyat Uzmanı";
  if (score >= 75) return "Başarılı";
  if (score >= 50) return "Gelişiyor";
  return "Daha Fazla Çalışmalısın";
}
