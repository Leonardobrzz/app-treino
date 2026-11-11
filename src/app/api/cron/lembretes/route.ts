import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushes, type PushRow } from "@/lib/push-server";

// Roda todo dia (vercel.json): gera mensalidades, lembra cobranças, plano vencendo, aluno sumido e aula de amanhã
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await sb.rpc("monthly_report_reminders", { p_secret: secret });
  const { data, error } = await sb.rpc("daily_reminders", { p_secret: secret });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const r = await sendPushes((data ?? []) as PushRow[]);
  return NextResponse.json({ ok: true, ...r });
}
