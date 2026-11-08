import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Entre na sua conta primeiro." }, { status: 401 });
  const { data: sub } = await sb.from("subscriptions").select("stripe_customer_id").maybeSingle();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "Nenhuma assinatura encontrada." }, { status: 404 });
  const session = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${req.nextUrl.origin}/pro`, locale: "pt-BR" });
  return NextResponse.json({ url: session.url });
}
