import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTargets } from "./nutrition";
import { epley } from "./util";

export type WeekSummary = {
  start: string; // ISO do domingo 00:00 (horário do aparelho)
  workouts: number;
  goal: number;
  sets: number;
  volume: number;
  prevVolume: number;
  prevWorkouts: number;
  minutesAvg: number;
  prs: { name: string; weight: number; reps: number }[];
  groups: { group: string; sets: number }[];
  lowGroups: string[];
  nutrition: { days: number; kcalAvg: number; proteinAvg: number; kcalTarget: number; proteinTarget: number } | null;
  weight: { first: number; last: number } | null;
  hardDays: number; // dias marcados como "leve" no "como você está hoje"
};

type SetRow = { weight: number; reps: number; exercise_id: string; session_id: string; exercises: { name: string; muscle_group: string } | null };

const TRAINED_GROUPS = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Quadríceps", "Posterior de coxa", "Glúteos"];
const day = 864e5;
const isoDay = (t: number) => {
  const d = new Date(t);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

/** Números da semana que começa em `startISO` (funciona no navegador e no servidor) */
export async function weekSummary(sb: SupabaseClient, startISO: string, dayFrom?: string, dayTo?: string): Promise<WeekSummary> {
  const start = new Date(startISO).getTime();
  const end = start + 7 * day;
  const prevStart = start - 7 * day;
  const fromDay = dayFrom ?? isoDay(start);
  const toDay = dayTo ?? isoDay(end - 1);

  const [{ data: ses }, { data: profile }, { data: meals }, { data: weights }] = await Promise.all([
    sb.from("sessions").select("id,started_at,finished_at,readiness").not("finished_at", "is", null).gte("started_at", new Date(prevStart).toISOString()).lt("started_at", new Date(end).toISOString()),
    sb.from("profiles").select("*").maybeSingle(),
    sb.from("meals").select("eaten_on,kcal,protein").gte("eaten_on", fromDay).lte("eaten_on", toDay),
    sb.from("body_weights").select("measured_on,weight").order("measured_on").lte("measured_on", toDay).limit(400),
  ]);

  const all = (ses ?? []) as { id: string; started_at: string; finished_at: string; readiness: { readiness?: { sono: number; energia: number } | null } | null }[];
  const cur = all.filter((s) => new Date(s.started_at).getTime() >= start);
  const prev = all.filter((s) => new Date(s.started_at).getTime() < start);
  const ids = cur.map((s) => s.id);
  const prevIds = new Set(prev.map((s) => s.id));

  let rows: SetRow[] = [];
  let prevRows: SetRow[] = [];
  if (all.length) {
    const { data } = await sb.from("session_sets").select("weight,reps,exercise_id,session_id,exercises(name,muscle_group)").eq("done", true).in("session_id", all.map((s) => s.id)).limit(5000);
    const list = (data ?? []) as unknown as SetRow[];
    rows = list.filter((r) => ids.includes(r.session_id));
    prevRows = list.filter((r) => prevIds.has(r.session_id));
  }
  const vol = (l: SetRow[]) => l.reduce((a, r) => a + Number(r.weight) * r.reps, 0);

  // recordes: melhor 1RM estimado da semana acima de tudo o que veio antes
  const prs: WeekSummary["prs"] = [];
  const exIds = [...new Set(rows.map((r) => r.exercise_id))];
  if (exIds.length) {
    const { data: hist } = await sb
      .from("session_sets")
      .select("weight,reps,exercise_id,sessions!inner(started_at,finished_at)")
      .in("exercise_id", exIds)
      .eq("done", true)
      .not("sessions.finished_at", "is", null)
      .lt("sessions.started_at", new Date(start).toISOString())
      .limit(5000);
    const before = new Map<string, number>();
    (hist ?? []).forEach((h: { weight: number; reps: number; exercise_id: string }) => before.set(h.exercise_id, Math.max(before.get(h.exercise_id) ?? 0, epley(Number(h.weight), h.reps))));
    for (const id of exIds) {
      const mine = rows.filter((r) => r.exercise_id === id && Number(r.weight) > 0);
      if (!mine.length) continue;
      const best = mine.reduce((a, r) => (epley(Number(r.weight), r.reps) > epley(Number(a.weight), a.reps) ? r : a));
      const b = before.get(id) ?? 0;
      if (b > 0 && epley(Number(best.weight), best.reps) > b) prs.push({ name: best.exercises?.name ?? "Exercício", weight: Number(best.weight), reps: best.reps });
    }
  }

  const byGroup = new Map<string, number>();
  rows.forEach((r) => {
    const g = r.exercises?.muscle_group ?? "Outro";
    byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
  });
  const groups = [...byGroup.entries()].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets);
  const lowGroups = cur.length ? TRAINED_GROUPS.filter((g) => (byGroup.get(g) ?? 0) < 10) : [];

  const w = (weights ?? []) as { measured_on: string; weight: number }[];
  const inWeek = w.filter((x) => x.measured_on >= fromDay);
  const lastBefore = w.filter((x) => x.measured_on < fromDay).at(-1);
  const weight = inWeek.length ? { first: Number((lastBefore ?? inWeek[0]).weight), last: Number(inWeek.at(-1)!.weight) } : null;

  const m = (meals ?? []) as { eaten_on: string; kcal: number; protein: number }[];
  const days = new Set(m.map((x) => x.eaten_on));
  const targets = computeTargets(profile, w.at(-1)?.weight ?? null);
  const nutrition = days.size
    ? {
        days: days.size,
        kcalAvg: Math.round(m.reduce((a, x) => a + Number(x.kcal), 0) / days.size),
        proteinAvg: Math.round(m.reduce((a, x) => a + Number(x.protein), 0) / days.size),
        kcalTarget: targets.kcal,
        proteinTarget: targets.protein,
      }
    : null;

  const minutes = cur.map((s) => (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000).filter((x) => x > 0 && x < 300);
  const hardDays = cur.filter((s) => {
    const r = s.readiness?.readiness;
    return r && r.sono + r.energia <= 1;
  }).length;

  return {
    start: new Date(start).toISOString(),
    workouts: new Set(cur.map((s) => isoDay(new Date(s.started_at).getTime()))).size,
    goal: profile?.weekly_goal ?? 4,
    sets: rows.length,
    volume: Math.round(vol(rows)),
    prevVolume: Math.round(vol(prevRows)),
    prevWorkouts: new Set(prev.map((s) => isoDay(new Date(s.started_at).getTime()))).size,
    minutesAvg: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0,
    prs: prs.slice(0, 8),
    groups,
    lowGroups,
    nutrition,
    weight,
    hardDays,
  };
}

/** Texto curto dos números pra IA (sem nada que identifique a pessoa) */
export function summaryForAI(s: WeekSummary, goalText: string | null) {
  const pct = s.prevVolume ? Math.round(((s.volume - s.prevVolume) / s.prevVolume) * 100) : null;
  return [
    `Objetivo: ${goalText ?? "não informado"}.`,
    `Treinos: ${s.workouts} de ${s.goal} (semana anterior: ${s.prevWorkouts}). Séries: ${s.sets}. Duração média: ${s.minutesAvg} min.`,
    `Volume: ${Math.round(s.volume)} kg${pct != null ? ` (${pct >= 0 ? "+" : ""}${pct}% vs semana anterior)` : ""}.`,
    `Recordes: ${s.prs.length ? s.prs.map((p) => `${p.name} ${p.weight}kg×${p.reps}`).join("; ") : "nenhum"}.`,
    `Séries por grupo: ${s.groups.map((g) => `${g.group} ${g.sets}`).join(", ") || "nenhuma"}. Abaixo de 10 séries: ${s.lowGroups.join(", ") || "nenhum"}.`,
    s.nutrition ? `Alimentação (${s.nutrition.days} dias registrados): média ${s.nutrition.kcalAvg} kcal (meta ${s.nutrition.kcalTarget}) e ${s.nutrition.proteinAvg} g de proteína (meta ${s.nutrition.proteinTarget}).` : "Alimentação: não registrada.",
    s.weight ? `Peso: ${s.weight.first} → ${s.weight.last} kg.` : "Peso: sem registro na semana.",
    `Dias em que se sentiu cansado/dormiu mal antes do treino: ${s.hardDays}.`,
  ].join("\n");
}
