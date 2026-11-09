import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { aiError } from "@/lib/ai-errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { proOf, usageOf } from "@/lib/limits";
import { summaryForAI, weekSummary } from "@/lib/week-summary";

export const maxDuration = 60;

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  if (!isDay(from)) return NextResponse.json({ error: "semana inválida" }, { status: 400 });
  const { data } = await sb.from("weekly_reports").select("text,created_at").eq("week_start", from).maybeSingle();
  return NextResponse.json({ report: data ?? null, pro: await proOf(sb) });
}

/** Gera (ou refaz) as sugestões da IA para a semana — Pro */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const pro = await proOf(sb);
  if (!pro) return NextResponse.json({ error: "As sugestões da IA no resumo fazem parte do Carga Pro." }, { status: 402 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada." }, { status: 503 });
  const usage = await usageOf(sb, "resumo", pro);
  if (usage.left <= 0) return NextResponse.json({ error: "Limite de resumos por hoje atingido. Tente amanhã." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { start?: string; from?: string; to?: string };
  const start = new Date(body.start ?? "");
  if (Number.isNaN(start.getTime()) || !isDay(body.from) || !isDay(body.to) || Math.abs(Date.now() - start.getTime()) > 800 * 864e5) {
    return NextResponse.json({ error: "semana inválida" }, { status: 400 });
  }

  const s = await weekSummary(sb as unknown as SupabaseClient, start.toISOString(), body.from, body.to);
  const { data: profile } = await sb.from("profiles").select("goal,level").eq("id", u.user.id).maybeSingle();

  let text = "";
  try {
    const res = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 700,
      system: `Você é o personal trainer do app Carga. Com base nos números da semana do aluno, escreva de 3 a 5 sugestões práticas e específicas para a PRÓXIMA semana, em português do Brasil.
- Comece cada linha com "- " e seja curto (no máximo 2 frases por linha).
- Use os números (ex.: "faltaram 2 treinos", "costas ficou com 6 séries").
- Primeiro reconheça algo que foi bem (uma linha), depois o que ajustar.
- Treino: volume por grupo (ideal 10–20 séries/semana para quem busca hipertrofia), frequência, progressão de carga e descanso.
- Alimentação só se houver registro: proteína e calorias perto da meta, sem dietas extremas.
- Se houve dias de cansaço/sono ruim, sugira cuidar do sono e da recuperação.
- Nada de diagnóstico médico. Sem títulos e sem markdown além do "- ".`,
      messages: [{ role: "user", content: `Nível: ${profile?.level ?? "não informado"}.\n${summaryForAI(s, profile?.goal ?? null)}` }],
    });
    text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  } catch (e) {
    return aiError(e, "resumo da semana");
  }
  if (!text) return NextResponse.json({ error: "A IA não respondeu agora." }, { status: 502 });

  await sb.from("ai_usage").insert({ kind: "resumo" });
  const { data } = await sb.from("weekly_reports").upsert({ week_start: body.from, text: text.slice(0, 3000) }, { onConflict: "user_id,week_start" }).select("text,created_at").single();
  return NextResponse.json({ report: data ?? { text } });
}
