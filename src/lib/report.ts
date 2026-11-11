// Dados do relatório em PDF: tudo calculado no aparelho, a partir do que o usuário já tem no banco.
import { supabase } from "@/lib/supabase/client";
import { MEASURES, type BodyMeasurement, type BodyWeight, type MeasureKey, type Profile, type ProgressPhoto } from "@/lib/types";
import { epley } from "@/lib/util";

export type ExerciseProgress = { name: string; start: number; end: number; pct: number; sessions: number };
export type ReportPR = { name: string; weight: number; reps: number; date: string };
export type ReportData = {
  from: string;
  to: string;
  profile: Profile | null;
  workouts: number;
  perWeek: number;
  weeklyGoal: number;
  sets: number;
  volume: number;
  minutes: number;
  prs: ReportPR[];
  exercises: ExerciseProgress[];
  muscles: { group: string; sets: number }[];
  measureStart: { date: string; values: Partial<Record<MeasureKey, number>> } | null;
  measureEnd: { date: string; values: Partial<Record<MeasureKey, number>> } | null;
  weights: { date: string; weight: number }[];
  nutrition: { days: number; kcal: number; protein: number; carbs: number; fat: number } | null;
  photos: { start: { url: string; date: string } | null; end: { url: string; date: string } | null };
};

type SetRow = { weight: number; reps: number; exercise_id: string; session_id: string; exercises: { name: string; muscle_group: string } };

const day = (iso: string) => iso.slice(0, 10);

/** carrega o último valor conhecido de cada medida até a data (inclusive) */
function measuresAt(records: BodyMeasurement[], date: string) {
  const vals: Partial<Record<MeasureKey, number>> = {};
  let when = "";
  for (const r of records) {
    if (r.measured_on > date) break;
    for (const k of MEASURES) if (r[k] != null) vals[k] = Number(r[k]);
    when = r.measured_on;
  }
  return when ? { date: when, values: vals } : null;
}

type Raw = { profile: Profile | null; sessions: unknown[]; sets?: unknown[]; measurements: unknown[]; weights: unknown[]; meals: unknown[]; photos: unknown[] };

/** Dados do próprio usuário (RLS) ou, com `student`, do aluno do personal (função que confere o vínculo) */
async function loadRaw(from: string, to: string, student?: string): Promise<Raw> {
  const sb = supabase();
  if (student) {
    const { data, error } = await sb.rpc("trainer_report_raw", { p_student: student, p_to: to });
    if (error) throw error;
    const r = data as Raw;
    const meals = (r.meals as { eaten_on: string }[]).filter((m) => m.eaten_on >= from);
    const photos = (r.photos as { taken_on: string }[]).filter((f) => f.taken_on >= from && f.taken_on <= to);
    return { ...r, meals, photos };
  }
  const toEnd = `${to}T23:59:59`;
  const [prof, ses, meas, wts, meals, photos] = await Promise.all([
    sb.from("profiles").select("*").maybeSingle(),
    sb.from("sessions").select("id,started_at,finished_at").not("finished_at", "is", null).lte("started_at", toEnd).order("started_at"),
    sb.from("body_measurements").select("*").order("measured_on"),
    sb.from("body_weights").select("*").order("measured_on"),
    sb.from("meals").select("eaten_on,kcal,protein,carbs,fat").gte("eaten_on", from).lte("eaten_on", to),
    sb.from("progress_photos").select("*").eq("pose", "frente").gte("taken_on", from).lte("taken_on", to).order("taken_on"),
  ]);
  return { profile: prof.data as Profile | null, sessions: ses.data ?? [], measurements: meas.data ?? [], weights: wts.data ?? [], meals: meals.data ?? [], photos: photos.data ?? [] };
}

export async function loadReport(from: string, to: string, student?: string): Promise<ReportData> {
  const sb = supabase();
  const raw = await loadRaw(from, to, student);
  const ses = { data: raw.sessions };
  const meas = { data: raw.measurements };
  const wts = { data: raw.weights };
  const meals = { data: raw.meals };
  const photos = { data: raw.photos };
  const profile = raw.profile;

  // treinos: os do período + o histórico anterior (pra saber o que é recorde)
  const allSes = (ses.data ?? []) as { id: string; started_at: string; finished_at: string }[];
  const inP = allSes.filter((s) => day(s.started_at) >= from);
  const sesDate = new Map(allSes.map((s) => [s.id, s.started_at]));
  let rows: SetRow[] = [];
  if (raw.sets) rows = raw.sets as SetRow[];
  else if (allSes.length) {
    const { data } = await sb.from("session_sets").select("weight,reps,exercise_id,session_id,exercises(name,muscle_group)").eq("done", true).in("session_id", allSes.map((s) => s.id)).limit(20000);
    rows = (data ?? []) as unknown as SetRow[];
  }
  const inIds = new Set(inP.map((s) => s.id));
  const pRows = rows.filter((r) => inIds.has(r.session_id));

  const days = Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 864e5 + 1);
  const minutes = inP.length ? Math.round(inP.reduce((a, s) => a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0) / inP.length / 60000) : 0;

  // força: melhor 1RM estimado na primeira e na última sessão do período, por exercício
  const byEx = new Map<string, { name: string; perSession: Map<string, number>; before: number; best: number; bestRow: SetRow | null }>();
  for (const r of rows) {
    const e = epley(Number(r.weight), r.reps);
    const cur = byEx.get(r.exercise_id) ?? { name: r.exercises.name, perSession: new Map(), before: 0, best: 0, bestRow: null };
    if (inIds.has(r.session_id)) {
      cur.perSession.set(r.session_id, Math.max(cur.perSession.get(r.session_id) ?? 0, e));
      if (e > cur.best) { cur.best = e; cur.bestRow = r; }
    } else if (day(sesDate.get(r.session_id) ?? "") < from) cur.before = Math.max(cur.before, e);
    byEx.set(r.exercise_id, cur);
  }
  const exercises: ExerciseProgress[] = [...byEx.values()]
    .filter((x) => x.perSession.size >= 2)
    .map((x) => {
      const ordered = [...x.perSession.entries()].sort((a, b) => (sesDate.get(a[0]) ?? "").localeCompare(sesDate.get(b[0]) ?? ""));
      const start = ordered[0][1], end = ordered.at(-1)![1];
      return { name: x.name, start, end, pct: start ? ((end - start) / start) * 100 : 0, sessions: ordered.length };
    })
    .sort((a, b) => b.sessions - a.sessions || b.pct - a.pct)
    .slice(0, 8);
  // recordes: uma série que superou tudo o que o usuário já tinha feito naquele exercício (contando o próprio período)
  const best = new Map<string, number>();
  const prBy = new Map<string, ReportPR & { e: number }>();
  const ordered = [...rows].sort((a, b) => (sesDate.get(a.session_id) ?? "").localeCompare(sesDate.get(b.session_id) ?? ""));
  for (const r of ordered) {
    const e = epley(Number(r.weight), r.reps);
    const prev = best.get(r.exercise_id) ?? 0;
    if (inIds.has(r.session_id) && prev > 0 && e > prev) {
      const cur = prBy.get(r.exercise_id);
      if (!cur || e > cur.e) prBy.set(r.exercise_id, { name: r.exercises.name, weight: Number(r.weight), reps: r.reps, date: sesDate.get(r.session_id)!, e });
    }
    best.set(r.exercise_id, Math.max(prev, e));
  }
  const prs: ReportPR[] = [...prBy.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(({ e: _e, ...p }) => p);

  const mg = new Map<string, number>();
  pRows.forEach((r) => mg.set(r.exercises.muscle_group, (mg.get(r.exercises.muscle_group) ?? 0) + 1));

  // corpo: medidas no início (último registro até o começo, ou o primeiro do período) e no fim
  const recs = (meas.data ?? []) as BodyMeasurement[];
  const firstInP = recs.find((r) => r.measured_on >= from && r.measured_on <= to);
  const measureStart = measuresAt(recs, from) ?? (firstInP ? measuresAt(recs, firstInP.measured_on) : null);
  const measureEnd = measuresAt(recs, to);
  const sameMeasure = measureStart && measureEnd && measureStart.date === measureEnd.date;

  const allW = (wts.data ?? []) as BodyWeight[];
  const before = allW.filter((w) => w.measured_on < from).at(-1);
  const weights = [...(before ? [before] : []), ...allW.filter((w) => w.measured_on >= from && w.measured_on <= to)].map((w) => ({ date: w.measured_on, weight: Number(w.weight) }));

  const ml = (meals.data ?? []) as { eaten_on: string; kcal: number; protein: number; carbs: number; fat: number }[];
  const mDays = new Set(ml.map((m) => m.eaten_on)).size;
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") => ml.reduce((a, m) => a + Number(m[k]), 0) / Math.max(1, mDays);
  const nutrition = mDays ? { days: mDays, kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat") } : null;

  // fotos de progresso (frente): a primeira e a última do período
  const ph = (photos.data ?? []) as ProgressPhoto[];
  const signed = async (p: ProgressPhoto | undefined) => {
    if (!p) return null;
    const { data } = await sb.storage.from("progresso").createSignedUrl(p.path, 600);
    if (!data?.signedUrl) return null;
    // converte pra data URL: assim a imagem entra no PDF sem depender de outro domínio
    try {
      const blob = await (await fetch(data.signedUrl)).blob();
      const url = await new Promise<string>((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.onerror = err; fr.readAsDataURL(blob); });
      return { url, date: p.taken_on };
    } catch {
      return null;
    }
  };
  const [pStart, pEnd] = await Promise.all([signed(ph[0]), signed(ph.length > 1 ? ph.at(-1) : undefined)]);

  return {
    from, to, profile,
    workouts: inP.length,
    perWeek: inP.length / (days / 7),
    weeklyGoal: profile?.weekly_goal ?? 0,
    sets: pRows.length,
    volume: pRows.reduce((a, r) => a + Number(r.weight) * r.reps, 0),
    minutes, prs, exercises,
    muscles: [...mg.entries()].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets).slice(0, 8),
    measureStart: sameMeasure ? null : measureStart,
    measureEnd,
    weights, nutrition,
    photos: { start: pStart, end: pEnd },
  };
}
