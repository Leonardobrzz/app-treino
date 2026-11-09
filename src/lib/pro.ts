export type Subscription = {
  status: string;
  plan_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_used: boolean;
  stripe_customer_id: string | null;
};

export const PRO_STATUSES = ["trialing", "active", "past_due"];
export const isPro = (s?: Pick<Subscription, "status"> | null) => !!s && PRO_STATUSES.includes(s.status);

/** Mensagens com a IA por mês no plano grátis */
export const FREE_AI_MESSAGES = 5;

/** Uso justo do Pro: mensagens com a IA por mês (protege de uso abusivo/robôs) */
export const PRO_AI_MESSAGES = 300;

export const PRICES = {
  mensal: { label: "Mensal", amount: 14.9, per: "por mês" },
  anual: { label: "Anual", amount: 99.9, per: "por ano" },
} as const;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
