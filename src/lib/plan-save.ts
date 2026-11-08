import type { supabaseServer } from "./supabase/server";

type SB = Awaited<ReturnType<typeof supabaseServer>>;
export type Ex = { id: string; name: string; muscle_group: string; equipment: string };

export type PlanInputExercise = { nome: string; grupo?: string; series: number; repeticoes: string; carga_kg?: number | null; descanso_s?: number | null; nota?: string | null };
export type PlanInputDay = { dia_semana: number; titulo: string; exercicios: PlanInputExercise[] };
export type PlanInput = { nome: string; dias: PlanInputDay[] };

export const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Procura o exercício do catálogo com o nome mais parecido (sem criar) */
export function findMatch(catalog: Ex[], name: string): Ex | undefined {
  const n = norm(name);
  if (!n) return undefined;
  let ex = catalog.find((e) => norm(e.name) === n) ?? catalog.find((e) => norm(e.name).includes(n) || n.includes(norm(e.name)));
  if (!ex) {
    const words = n.split(" ").filter((w) => w.length > 3);
    ex = catalog
      .map((e) => ({ e, score: words.filter((w) => norm(e.name).includes(w)).length }))
      .filter((x) => x.score >= Math.max(2, words.length - 1))
      .sort((a, b) => b.score - a.score)[0]?.e;
  }
  return ex;
}

export async function findOrCreate(sb: SB, userId: string, catalog: Ex[], name: string, group?: string) {
  const ex = findMatch(catalog, name);
  if (ex) return ex;
  const { data } = await sb.from("exercises").insert({ name: name.slice(0, 80), muscle_group: group || "Outro", equipment: "Outro", created_by: userId }).select("id,name,muscle_group,equipment").single();
  if (data) catalog.push(data as Ex);
  return data as Ex | null;
}

/** Salva uma semana nova como plano ativo (desativa o anterior) */
export async function savePlan(sb: SB, userId: string, catalog: Ex[], input: PlanInput) {
  const dias = (input.dias ?? []).filter((d) => Number.isInteger(d.dia_semana) && d.dia_semana >= 0 && d.dia_semana <= 6);
  await sb.from("plans").update({ active: false }).eq("active", true);
  const { data: plan, error } = await sb.from("plans").insert({ name: String(input.nome || "Minha semana").slice(0, 80) }).select("id").single();
  if (error || !plan) return { ok: false as const, days: 0 };
  const seen = new Set<number>();
  for (const d of dias) {
    if (seen.has(d.dia_semana)) continue;
    seen.add(d.dia_semana);
    const { data: day } = await sb.from("plan_days").insert({ plan_id: plan.id, weekday: d.dia_semana, title: String(d.titulo || "Treino").slice(0, 80) }).select("id").single();
    if (!day) continue;
    const rows = [];
    for (const [i, e] of (d.exercicios ?? []).entries()) {
      if (!e?.nome?.trim()) continue;
      const ex = await findOrCreate(sb, userId, catalog, e.nome.trim(), e.grupo);
      if (!ex) continue;
      rows.push({
        plan_day_id: day.id,
        exercise_id: ex.id,
        position: i,
        sets: Math.min(10, Math.max(1, Math.round(Number(e.series) || 3))),
        reps: String(e.repeticoes || "10").slice(0, 8),
        target_weight: e.carga_kg ? Number(e.carga_kg) : null,
        rest_seconds: Math.min(600, Math.max(15, Math.round(Number(e.descanso_s) || 90))),
        notes: e.nota ? String(e.nota).slice(0, 200) : null,
      });
    }
    if (rows.length) await sb.from("plan_exercises").insert(rows);
  }
  return { ok: true as const, days: seen.size, planId: plan.id as string };
}
