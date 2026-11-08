/** "Como você está hoje?" — ajusta o treino do dia sem precisar de IA */

export type Readiness = { sono: 0 | 1 | 2; energia: 0 | 1 | 2; dor: PainArea[] };
export type DayMode = "leve" | "normal" | "forte";

export const PAIN_AREAS = ["Ombro", "Cotovelo/punho", "Lombar", "Joelho"] as const;
export type PainArea = (typeof PAIN_AREAS)[number];

const PAIN_GROUPS: Record<PainArea, string[]> = {
  Ombro: ["Ombros", "Peito", "Trapézio"],
  "Cotovelo/punho": ["Bíceps", "Tríceps", "Antebraço"],
  Lombar: [],
  Joelho: ["Quadríceps", "Adutores"],
};
const PAIN_NAMES: Record<PainArea, RegExp | null> = {
  Ombro: /desenvolvimento|supino|paralela|mergulho|elevacao lateral|elevacao frontal/,
  "Cotovelo/punho": /rosca|triceps|barra fixa/,
  Lombar: /terra|agachamento livre|remada curvada|stiff|bom dia|good morning|kettlebell swing/,
  Joelho: /agachamento|leg press|afundo|passada|bulgaro|extensora|hack|salto|burpee/,
};
const n = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function dayMode(r: Readiness | null): DayMode {
  if (!r) return "normal";
  const score = r.sono + r.energia;
  return score <= 1 ? "leve" : score >= 4 ? "forte" : "normal";
}

/** Área de dor que esse exercício pode incomodar (ou null) */
export function painFor(r: Readiness | null, ex: { name: string; group: string }): PainArea | null {
  if (!r?.dor.length) return null;
  for (const a of r.dor) {
    if (PAIN_GROUPS[a].includes(ex.group) || PAIN_NAMES[a]?.test(n(ex.name))) return a;
  }
  return null;
}

/** Carga reduzida em ~10% (sempre para baixo), num valor que existe na academia */
export function lighter(weight: number, equipment?: string) {
  if (weight <= 0) return 0;
  const step = equipment === "Halter" || weight < 10 ? 1 : 2.5;
  return Math.max(step, Math.floor((weight * 0.9) / step) * step);
}

export const MODE_TEXT: Record<DayMode, { title: string; text: string }> = {
  leve: { title: "Dia mais leve", text: "Tirei 1 série de cada exercício e baixei uns 10% da carga. Foco em técnica e em sair melhor do que entrou." },
  normal: { title: "Dia normal", text: "Treino como planejado. Siga as sugestões de carga." },
  forte: { title: "Dia forte", text: "Você está bem! Se as séries ficarem fáceis, tente a carga sugerida ou 1 repetição a mais." },
};
