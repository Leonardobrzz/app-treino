"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProBadge } from "@/components/ProLock";
import { Icon, Spinner, type IconName } from "@/components/ui";
import { getSubscription } from "@/lib/data";
import { FREE_AI_MESSAGES, PRO_AI_MESSAGES, PRICES, brl, isPro, type Subscription } from "@/lib/pro";
import { fmtDate, vibrate } from "@/lib/util";

const ROWS: { icon: IconName; label: string; free: string | boolean; pro: string | boolean }[] = [
  { icon: "dumbbell", label: "Registrar treinos e séries", free: true, pro: true },
  { icon: "calendar", label: "Plano automático da semana", free: true, pro: true },
  { icon: "chart", label: "Sugestão de aumento de carga", free: true, pro: true },
  { icon: "spark", label: "Assistente de IA", free: `${FREE_AI_MESSAGES}/mês`, pro: `${PRO_AI_MESSAGES}/mês` },
  { icon: "apple", label: "Diário de alimentação e água", free: true, pro: true },
  { icon: "camera", label: "Foto do prato → calorias e macros", free: false, pro: true },
  { icon: "camera", label: "Importar ficha da academia por foto", free: "2/mês", pro: "15/dia" },
  { icon: "spark", label: "Sugestões da IA no resumo da semana", free: false, pro: true },
  { icon: "image", label: "Fotos de progresso: antes e depois", free: false, pro: true },
  { icon: "trophy", label: "Gráfico de força (1RM) por exercício", free: false, pro: true },
  { icon: "ruler", label: "Linha do tempo do corpo", free: false, pro: true },
  { icon: "download", label: "Relatório em PDF do período", free: false, pro: true },
  { icon: "clock", label: "Evolução do ano inteiro", free: false, pro: true },
];

export default function ProPage() {
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [plan, setPlan] = useState<"mensal" | "anual">("anual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    let alive = true;
    const justPaid = new URLSearchParams(location.search).get("status") === "ok";
    (async () => {
      let s = await getSubscription();
      // o webhook pode levar alguns segundos depois do pagamento
      for (let i = 0; justPaid && !isPro(s) && i < 12 && alive; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        s = await getSubscription();
      }
      if (!alive) return;
      setSub(s);
      if (justPaid && isPro(s)) {
        setWelcome(true);
        vibrate([20, 60, 20, 60, 40]);
        history.replaceState(null, "", "/pro");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function go(path: "checkout" | "portal") {
    setError("");
    setLoading(true);
    vibrate(10);
    try {
      const r = await fetch(`/api/stripe/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error);
      location.href = d.url;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não foi possível abrir o pagamento.");
      setLoading(false);
    }
  }

  const pro = isPro(sub);
  const monthlyOfYear = PRICES.anual.amount / 12;
  const saving = Math.round((1 - PRICES.anual.amount / (PRICES.mensal.amount * 12)) * 100);

  return (
    <div className="safe-top flex min-h-dvh flex-col px-5 pb-10">
      <div className="flex items-center justify-between py-2">
        <button onClick={() => (history.length > 1 ? router.back() : router.replace("/"))} aria-label="Fechar" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <Icon name="close" size={18} stroke={2.5} />
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="mb-3 flex h-20 w-20 items-center justify-center rounded-[24px] bg-accent text-on-accent shadow-[0_10px_40px_-8px_var(--accent)]">
          <Icon name="dumbbell" size={40} stroke={2.4} />
        </motion.div>
        <h1 className="flex items-center gap-2 text-[34px] font-bold tracking-[-0.5px]">
          Carga <ProBadge className="!text-[14px] !px-2" />
        </h1>
        <p className="mt-1 max-w-[300px] text-[17px] leading-snug text-label-2">Personal e nutri no bolso: IA à vontade, calorias pela foto do prato e a sua evolução inteira à vista.</p>
      </motion.div>

      {sub === undefined ? (
        <Spinner />
      ) : (
        <>
          {pro && sub && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col gap-1 rounded-2xl bg-card p-5">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-good">
                <Icon name="check" size={16} stroke={3} /> {sub.status === "trialing" ? "TESTE GRÁTIS ATIVO" : sub.status === "past_due" ? "PAGAMENTO PENDENTE" : "VOCÊ É PRO"}
              </span>
              <span className="text-[20px] font-bold">Plano {sub.plan_interval === "anual" ? "anual" : "mensal"}</span>
              {sub.current_period_end && (
                <span className="text-[15px] text-label-2">
                  {sub.cancel_at_period_end ? "Acesso até" : sub.status === "trialing" ? "Primeira cobrança em" : "Renova em"} {fmtDate(sub.current_period_end, { year: true })}
                </span>
              )}
              <button onClick={() => go("portal")} disabled={loading} className="press mt-3 h-12 rounded-xl bg-card-2 text-[16px] font-semibold text-accent-ink disabled:opacity-50">
                {loading ? "Abrindo…" : "Gerenciar assinatura"}
              </button>
            </motion.div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_52px_68px] items-center gap-2 border-b border-sep px-4 py-2.5 text-[12px] font-bold tracking-wide text-label-2">
              <span />
              <span className="text-center">GRÁTIS</span>
              <span className="text-center text-accent-ink">PRO</span>
            </div>
            {ROWS.map((r, i) => (
              <motion.div key={r.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="grid grid-cols-[minmax(0,1fr)_52px_68px] items-center gap-2 border-b border-sep px-4 py-3 last:border-b-0">
                <span className="flex items-center gap-3 text-[15px]">
                  <Icon name={r.icon} size={19} className="shrink-0 text-label-2" />
                  {r.label}
                </span>
                <Cell v={r.free} />
                <Cell v={r.pro} pro />
              </motion.div>
            ))}
          </div>

          {!pro && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Escolha o plano">
                {(["mensal", "anual"] as const).map((k) => {
                  const on = plan === k;
                  return (
                    <motion.button key={k} role="radio" aria-checked={on} whileTap={{ scale: 0.97 }} onClick={() => (vibrate(6), setPlan(k))} className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 px-3 pb-4 pt-5 transition-colors ${on ? "border-accent bg-accent-soft" : "border-transparent bg-card"}`}>
                      {k === "anual" && <span className="absolute -top-3 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-on-accent">ECONOMIZE {saving}%</span>}
                      <span className={`text-[13px] font-bold tracking-wide ${on ? "text-accent-ink" : "text-label-2"}`}>{PRICES[k].label.toUpperCase()}</span>
                      <span className="tabular text-[24px] font-bold">{brl(PRICES[k].amount)}</span>
                      <span className="text-[13px] text-label-2">{k === "anual" ? `${brl(monthlyOfYear)}/mês` : PRICES[k].per}</span>
                      <span className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-accent text-on-accent" : "ring-2 ring-fill"}`}>{on && <Icon name="check" size={14} stroke={3} />}</span>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={() => go("checkout")} disabled={loading} className="mt-5 h-[56px] rounded-2xl bg-accent text-[18px] font-bold text-on-accent shadow-[0_12px_30px_-10px_var(--accent)] disabled:opacity-60">
                {loading ? "Abrindo pagamento…" : sub?.trial_used ? "Assinar o Pro" : "Começar 7 dias grátis"}
              </motion.button>
              <p className="mt-2 text-center text-[13px] leading-snug text-label-2">
                {sub?.trial_used ? "Cancele quando quiser." : `Sem cobrança nos 7 primeiros dias. Depois, ${brl(PRICES[plan].amount)} ${PRICES[plan].per}. Cancele quando quiser.`}
              </p>
              <p className="mt-1 text-center text-[12px] leading-snug text-label-3">
                Ao assinar, você concorda com os{" "}
                <Link href="/termos" className="text-accent-ink">Termos de uso</Link> e a{" "}
                <Link href="/privacidade" className="text-accent-ink">Política de privacidade</Link>.
              </p>
              {process.env.NEXT_PUBLIC_STRIPE_TEST === "1" && (
                <p className="mt-3 rounded-xl bg-card p-3 text-center text-[13px] leading-snug text-label-2">
                  Modo de teste: use o cartão <b className="tabular text-label">4242 4242 4242 4242</b>, qualquer data futura e qualquer CVC.
                </p>
              )}
            </>
          )}
          {error && <p role="alert" className="mt-3 text-center text-[15px] text-bad">{error}</p>}
        </>
      )}

      <AnimatePresence>
        {welcome && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="w-full max-w-[340px] rounded-[28px] bg-card p-6 text-center">
              <motion.div initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 12 }} className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-on-accent">
                <Icon name="trophy" size={34} />
              </motion.div>
              <h2 className="text-[26px] font-bold">Bem-vindo ao Pro!</h2>
              <p className="mt-1 text-[15px] leading-snug text-label-2">IA à vontade, calorias pela foto, gráfico de força e a linha do tempo do corpo já estão liberados.</p>
              <button onClick={() => router.replace("/")} className="press mt-5 h-12 w-full rounded-xl bg-accent text-[16px] font-semibold text-on-accent">
                Bora treinar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Cell({ v, pro }: { v: string | boolean; pro?: boolean }) {
  if (v === true) return <span className={`flex justify-center ${pro ? "text-accent-ink" : "text-label-2"}`}><Icon name="check" size={18} stroke={3} /></span>;
  if (v === false) return <span className="text-center text-label-3">—</span>;
  return <span className={`tabular whitespace-nowrap text-center font-bold ${pro ? "text-[16px] text-accent-ink" : "text-[14px] text-label-2"}`}>{v}</span>;
}
