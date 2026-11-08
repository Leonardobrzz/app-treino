import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

let client: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Grava o estado da assinatura no banco (via função protegida por segredo) */
export async function syncSubscription(userId: string, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await sb.rpc("sync_subscription", {
    p_secret: process.env.SUBSCRIPTION_SYNC_SECRET,
    p_user: userId,
    p_customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_subscription: sub.id,
    p_status: sub.status,
    p_interval: item?.price.recurring?.interval === "year" ? "anual" : "mensal",
    p_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    p_cancel_at_period_end: sub.cancel_at_period_end || !!sub.cancel_at,
  });
  if (error) throw new Error(error.message);
}
