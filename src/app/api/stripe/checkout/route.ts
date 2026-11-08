import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { isPro } from "@/lib/pro";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Entre na sua conta primeiro." }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: "mensal" | "anual" };
  const price = plan === "anual" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  if (!price) return NextResponse.json({ error: "Pagamento ainda não configurado." }, { status: 503 });

  const { data: sub } = await sb.from("subscriptions").select("*").maybeSingle();
  if (isPro(sub)) return NextResponse.json({ error: "Você já é Pro." }, { status: 400 });

  const origin = req.nextUrl.origin;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(sub?.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: u.user.email }),
    client_reference_id: u.user.id,
    subscription_data: {
      metadata: { user_id: u.user.id },
      ...(sub?.trial_used ? {} : { trial_period_days: 7 }),
    },
    metadata: { user_id: u.user.id },
    allow_promotion_codes: true,
    locale: "pt-BR",
    adaptive_pricing: { enabled: false },
    success_url: `${origin}/pro?status=ok`,
    cancel_url: `${origin}/pro`,
  });
  return NextResponse.json({ url: session.url });
}
