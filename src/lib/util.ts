import type { SessionSet } from "./types";

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];
export const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const num = (v: number, digits = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 === 0 ? 0 : digits, maximumFractionDigits: digits });

export const kg = (v: number) => `${num(v)} kg`;

export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function fmtDate(iso: string, opts: { year?: boolean } = {}) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]}${opts.year ? ` de ${y}` : ""}`;
}

export function longToday() {
  const d = new Date();
  const wd = WEEKDAYS[d.getDay()];
  return `${wd}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`.toUpperCase();
}

/** 1RM estimado (Epley) */
export const epley = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

/** Faixa de repetições "8-12" -> [8, 12]; "10" -> [10, 10] */
export function repRange(reps: string): [number, number] {
  const m = reps.match(/(\d+)\s*[-–a]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = parseInt(reps, 10);
  return Number.isFinite(n) ? [n, n] : [10, 10];
}

/** Incremento de carga conforme o tamanho da carga e o equipamento */
export function increment(weight: number, equipment?: string) {
  if (equipment === "Halter") return weight >= 20 ? 2 : 1;
  if (weight >= 100) return 5;
  return 2.5;
}

export type Suggestion = { weight: number; reps: number; reason: string; up: boolean } | null;

/**
 * Dupla progressão: se na última sessão todas as séries válidas bateram o topo da
 * faixa de repetições, sobe a carga e volta para a base da faixa.
 */
export function suggest(last: SessionSet[], reps: string, sets: number, equipment?: string): Suggestion {
  const done = last.filter((s) => s.done && s.reps > 0);
  if (!done.length) return null;
  const [lo, hi] = repRange(reps);
  const top = Math.max(...done.map((s) => s.weight));
  const working = done.filter((s) => s.weight === top);
  const hitTop = working.length >= Math.min(sets, done.length) && working.every((s) => s.reps >= hi);
  if (hitTop && top > 0) {
    const next = top + increment(top, equipment);
    const minReps = Math.min(...working.map((s) => s.reps));
    return { weight: next, reps: lo, up: true, reason: `Você fez ${working.length}×${minReps} com ${num(top)} kg. Hora de subir.` };
  }
  const best = Math.max(...working.map((s) => s.reps));
  return { weight: top, reps: Math.min(hi, best + 1), up: false, reason: `Mantenha ${num(top)} kg e tente ${Math.min(hi, best + 1)} repetições.` };
}

/** Início da semana (domingo) */
export function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

/** Semanas seguidas batendo a meta (a semana atual conta se já bateu) */
export function weekStreak(dates: string[], goal: number) {
  const counts = new Map<number, Set<string>>();
  for (const iso of dates) {
    const d = new Date(iso);
    const key = weekStart(d).getTime();
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)!.add(todayISO(d));
  }
  let streak = 0;
  const cursor = weekStart(new Date());
  const cur = counts.get(cursor.getTime())?.size ?? 0;
  if (cur >= goal) streak++;
  for (let i = 0; i < 520; i++) {
    cursor.setDate(cursor.getDate() - 7);
    if ((counts.get(cursor.getTime())?.size ?? 0) >= goal) streak++;
    else break;
  }
  return streak;
}

export function vibrate(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem suporte */
  }
}

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
