import type { MealType, Profile } from "./types";

export type Targets = { kcal: number; protein: number; carbs: number; fat: number; water: number; auto: boolean };

export type FoodItem = { name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number };

/** Refeições por dia liberadas na análise com IA (Pro) — evita abuso e custo descontrolado */
export const DAILY_SCANS = 40;

function age(birth: string | null) {
  if (!birth) return 28;
  const b = new Date(birth + "T12:00:00");
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return Math.min(90, Math.max(14, a));
}

const round = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Metas diárias calculadas pelo perfil (Mifflin-St Jeor × atividade, ajustadas pelo objetivo).
 * Se o usuário definiu metas próprias, elas têm prioridade.
 */
export function computeTargets(p: Pick<Profile, "sex" | "birth_date" | "height_cm" | "goal" | "weekly_goal" | "kcal_target" | "protein_target" | "carbs_target" | "fat_target" | "water_target_ml"> | null, weightKg: number | null): Targets {
  const w = weightKg && weightKg > 25 ? weightKg : 70;
  const h = p?.height_cm && p.height_cm > 100 ? p.height_cm : p?.sex === "feminino" ? 162 : 174;
  const a = age(p?.birth_date ?? null);
  const sexK = p?.sex === "feminino" ? -161 : p?.sex === "masculino" ? 5 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * a + sexK;
  const days = p?.weekly_goal ?? 3;
  const activity = days <= 2 ? 1.375 : days <= 4 ? 1.55 : 1.725;
  const goal = p?.goal ?? "";
  const factor = goal.startsWith("Perder") ? 0.8 : goal.startsWith("Ganhar") ? 1.1 : goal.startsWith("Recomp") ? 0.9 : 1;
  const floor = p?.sex === "feminino" ? 1200 : 1500;
  const kcalAuto = round(Math.max(floor, bmr * activity * factor), 10);
  const protPerKg = goal.startsWith("Perder") || goal.startsWith("Recomp") ? 2 : goal.startsWith("Ganhar") ? 1.8 : 1.6;

  const kcal = p?.kcal_target ?? kcalAuto;
  const protein = p?.protein_target ?? round(w * protPerKg, 5);
  const fat = p?.fat_target ?? round(Math.max(w * 0.8, (kcal * 0.25) / 9), 5);
  const carbs = p?.carbs_target ?? Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));
  const water = p?.water_target_ml ?? round(w * 35, 250);
  const auto = p?.kcal_target == null && p?.protein_target == null && p?.carbs_target == null && p?.fat_target == null;
  return { kcal, protein, carbs, fat, water, auto };
}

/** Refeição mais provável pelo horário */
export function mealForHour(h = new Date().getHours()): MealType {
  if (h < 10) return "cafe";
  if (h < 15) return "almoco";
  if (h < 18) return "lanche";
  return "jantar";
}

const n = (v: unknown, max: number) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x * 10) / 10)) : 0;
};

/** Normaliza o que vem da IA (ou do cliente) para um item válido de refeição */
export function cleanItem(raw: Record<string, unknown>): FoodItem | null {
  const name = String(raw.nome ?? raw.name ?? "").trim().slice(0, 120);
  if (!name) return null;
  return {
    name,
    portion: String(raw.porcao ?? raw.portion ?? "").trim().slice(0, 80),
    kcal: n(raw.kcal, 10000),
    protein: n(raw.proteina_g ?? raw.protein, 1000),
    carbs: n(raw.carboidrato_g ?? raw.carbs, 1000),
    fat: n(raw.gordura_g ?? raw.fat, 1000),
  };
}

export const ITEM_SCHEMA = {
  type: "object",
  properties: {
    nome: { type: "string", description: "Nome do alimento em português, ex.: 'Arroz branco cozido'" },
    porcao: { type: "string", description: "Quantidade estimada, ex.: '4 colheres de sopa (100 g)'" },
    kcal: { type: "number" },
    proteina_g: { type: "number" },
    carboidrato_g: { type: "number" },
    gordura_g: { type: "number" },
  },
  required: ["nome", "porcao", "kcal", "proteina_g", "carboidrato_g", "gordura_g"],
} as const;
