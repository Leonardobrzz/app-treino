import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendPushes, type PushRow } from "@/lib/push-server";

// Envia os pushes dos avisos que a pessoa logada acabou de gerar (o banco confere quem gerou)
export async function POST() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { data, error } = await sb.rpc("take_my_pushes");
  if (error) return NextResponse.json({ error: "falhou" }, { status: 500 });
  const r = await sendPushes((data ?? []) as PushRow[]);
  return NextResponse.json(r);
}
