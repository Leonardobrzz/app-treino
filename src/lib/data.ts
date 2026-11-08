import { supabase } from "./supabase/client";
import type { Exercise, Plan, PlanDay, PlanExercise, Profile, SessionSet } from "./types";

export type DayWithExercises = PlanDay & { plan_exercises: (PlanExercise & { exercises: Exercise })[] };
export type ActivePlan = Plan & { plan_days: DayWithExercises[] };

export async function getUserId() {
  const { data } = await supabase().auth.getUser();
  return data.user?.id ?? null;
}

export async function getProfile(): Promise<Profile | null> {
  const id = await getUserId();
  if (!id) return null;
  const { data } = await supabase().from("profiles").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getActivePlan(): Promise<ActivePlan | null> {
  const { data } = await supabase()
    .from("plans")
    .select("*, plan_days(*, plan_exercises(*, exercises(*)))")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const plan = data as ActivePlan;
  plan.plan_days.sort((a, b) => a.weekday - b.weekday);
  plan.plan_days.forEach((d) => d.plan_exercises.sort((a, b) => a.position - b.position));
  return plan;
}

export async function ensurePlan(): Promise<ActivePlan> {
  const existing = await getActivePlan();
  if (existing) return existing;
  const { data, error } = await supabase().from("plans").insert({ name: "Minha semana" }).select().single();
  if (error) throw error;
  return { ...(data as Plan), plan_days: [] };
}

/** Séries da última sessão concluída em que cada exercício apareceu */
export async function lastSetsByExercise(exerciseIds: string[]): Promise<Record<string, SessionSet[]>> {
  if (!exerciseIds.length) return {};
  const { data } = await supabase()
    .from("session_sets")
    .select("*, sessions!inner(finished_at)")
    .in("exercise_id", exerciseIds)
    .not("sessions.finished_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);
  const out: Record<string, SessionSet[]> = {};
  const sessionOf: Record<string, string> = {};
  for (const s of (data ?? []) as SessionSet[]) {
    if (!sessionOf[s.exercise_id]) sessionOf[s.exercise_id] = s.session_id;
    if (sessionOf[s.exercise_id] === s.session_id) (out[s.exercise_id] ??= []).push(s);
  }
  Object.values(out).forEach((l) => l.sort((a, b) => a.set_number - b.set_number));
  return out;
}

export async function checkInToday() {
  await supabase().from("checkins").upsert({}, { onConflict: "user_id,checked_on", ignoreDuplicates: true });
}
