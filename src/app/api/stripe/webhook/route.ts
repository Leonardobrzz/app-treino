import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { stripe, syncSubscription } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const userId = s.client_reference_id ?? s.metadata?.user_id;
      if (userId && s.subscription) {
        const sub = await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
        await syncSubscription(userId, sub);
      }
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) await syncSubscription(userId, sub);
    }
  } catch (e) {
    console.error("webhook", event.type, e);
    return NextResponse.json({ error: "falha ao sincronizar" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
