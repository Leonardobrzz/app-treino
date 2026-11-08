import { isPro } from "./pro";
import type { supabaseServer } from "./supabase/server";

type SB = Awaited<ReturnType<typeof supabaseServer>>;

/** Limites das funções de IA com custo por uso */
export const LIMITS = {
  ficha: { free: 2, freeWindow: "mes", pro: 15 },
  resumo: { free: 0, freeWindow: "mes", pro: 10 },
} as const;

export async function proOf(sb: SB) {
  const { data } = await sb.from("subscriptions").select("status").maybeSingle();
  return isPro(data);
}

/** Quanto já foi usado: no Pro conta as últimas 24 h; no grátis, o mês atual */
export async function usageOf(sb: SB, kind: keyof typeof LIMITS, pro: boolean) {
  const since = new Date();
  if (pro) since.setTime(Date.now() - 24 * 3600 * 1000);
  else {
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
  }
  const { count } = await sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("created_at", since.toISOString());
  const limit = pro ? LIMITS[kind].pro : LIMITS[kind].free;
  return { used: count ?? 0, limit, left: Math.max(0, limit - (count ?? 0)), pro };
}
