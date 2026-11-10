"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, Header, Icon, SectionTitle, Segmented, Spinner, Stat } from "@/components/ui";
import { PRICES, brl } from "@/lib/pro";
import { supabase } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/util";

type Overview = {
  users_total: number; users_today: number; users_7d: number; users_30d: number; confirmed: number; onboarded: number;
  trialing: number; active: number; active_month: number; active_year: number; canceling: number; canceled: number; past_due: number;
  trained_7d: number; trained_ever: number; workouts_30d: number; meals_30d: number;
  ai_chat_pro_month: number; ai_chat_free_month: number; ai_food_month: number; ai_ficha_month: number; ai_resumo_month: number;
  signups_by_day: { day: string; n: number }[];
};
type Row = {
  id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null; confirmed: boolean; onboarded: boolean;
  status: string; plan_interval: string | null; cancel_at_period_end: boolean; current_period_end: string | null;
  workouts: number; last_workout: string | null; ai_messages: number;
};
type Filter = "todos" | "gratis" | "teste" | "pagos";

// custo médio por uso, em dólar (ver README → "Quanto custa a IA")
const COST = { chatPro: 0.016, chatFree: 0.005, food: 0.009, ficha: 0.03, resumo: 0.01 };
const USD_BRL = 5.4;

const PLAN: Record<string, { label: string; cls: string }> = {
  active: { label: "Pago", cls: "bg-good/15 text-good" },
  trialing: { label: "Teste", cls: "bg-accent-soft text-accent-ink" },
  past_due: { label: "Atrasado", cls: "bg-bad/15 text-bad" },
  canceled: { label: "Cancelou", cls: "bg-fill text-label-2" },
  none: { label: "Grátis", cls: "bg-fill text-label-2" },
};
const planOf = (s: string) => PLAN[s] ?? PLAN.canceled;
const ago = (iso: string | null) => {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
};

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [hideTests, setHideTests] = useState(true);
  const [ov, setOv] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase().rpc("is_admin").then(({ data }) => setAllowed(!!data));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const [o, u] = await Promise.all([supabase().rpc("admin_overview", { hide_tests: hideTests }), supabase().rpc("admin_users", { hide_tests: hideTests })]);
      if (o.error || u.error) setError("Não consegui carregar os números. Tenta de novo.");
      setOv(o.data as Overview);
      setRows((u.data ?? []) as Row[]);
    })();
  }, [allowed, hideTests]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      const okPlan = filter === "todos" || (filter === "pagos" ? r.status === "active" : filter === "teste" ? r.status === "trialing" : !["active", "trialing"].includes(r.status));
      const okText = !s || r.email.toLowerCase().includes(s) || (r.name ?? "").toLowerCase().includes(s);
      return okPlan && okText;
    });
  }, [rows, q, filter]);

  if (allowed === null) return <div className="flex justify-center pt-40"><Spinner /></div>;
  if (!allowed)
    return (
      <div className="flex flex-col items-center gap-3 px-8 pt-40 text-center">
        <Icon name="lock" size={32} className="text-label-3" />
        <p className="text-[17px] font-semibold">Área restrita</p>
        <Link href="/" className="text-[16px] font-semibold text-accent-ink">Voltar pro início</Link>
      </div>
    );

  const mrr = ov ? ov.active_month * PRICES.mensal.amount + (ov.active_year * PRICES.anual.amount) / 12 : 0;
  const aiUsd = ov ? ov.ai_chat_pro_month * COST.chatPro + ov.ai_chat_free_month * COST.chatFree + ov.ai_food_month * COST.food + ov.ai_ficha_month * COST.ficha + ov.ai_resumo_month * COST.resumo : 0;
  const maxDay = Math.max(1, ...(ov?.signups_by_day ?? []).map((d) => d.n));
  const funnel = ov ? [
    { label: "Cadastraram", n: ov.users_total },
    { label: "Confirmaram o e-mail", n: ov.confirmed },
    { label: "Fizeram a configuração", n: ov.onboarded },
    { label: "Registraram um treino", n: ov.trained_ever },
    { label: "Assinaram (teste ou pago)", n: ov.trialing + ov.active },
  ] : [];

  return (
    <>
      <Header
        title="Painel do dono"
        eyebrow="SÓ VOCÊ VÊ ISSO"
        back={{ href: "/perfil", label: "Perfil" }}
      />
      <label className="mx-5 mt-1 flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-2.5">
        <span className="text-[14px] text-label-2">Mostrar contas de teste (@carga.app)</span>
        <input type="checkbox" checked={!hideTests} onChange={(e) => setHideTests(!e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
      </label>
      {error && <p className="mx-5 mt-2 text-[15px] text-bad">{error}</p>}
      {!ov ? (
        <div className="flex justify-center pt-20"><Spinner /></div>
      ) : (
        <>
          <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
            <Stat label="Usuários" value={String(ov.users_total)} foot={`+${ov.users_7d} na semana · +${ov.users_today} hoje`} footTone={ov.users_7d ? "good" : "muted"} />
            <Stat label="Receita por mês" value={brl(mrr)} foot={`${ov.active} pagando · ${ov.trialing} em teste`} footTone="accent" />
            <Stat label="Treinaram em 7 dias" value={String(ov.trained_7d)} foot={ov.users_total ? `${Math.round((ov.trained_7d / ov.users_total) * 100)}% dos usuários` : undefined} />
            <Stat label="Custo da IA no mês" value={`US$ ${aiUsd.toFixed(2)}`} foot={`≈ ${brl(aiUsd * USD_BRL)} (estimativa)`} />
          </div>

          <SectionTitle>Cadastros nos últimos 30 dias</SectionTitle>
          <Card className="mx-5 px-4 pb-3 pt-4">
            <div className="flex h-[120px] items-end gap-[3px]" role="img" aria-label="Cadastros por dia nos últimos 30 dias">
              {ov.signups_by_day.map((d, i) => (
                <motion.div key={d.day} initial={{ height: 0 }} animate={{ height: `${Math.max(d.n ? 8 : 2, (d.n / maxDay) * 100)}%` }} transition={{ delay: i * 0.01 }} title={`${fmtDate(d.day)}: ${d.n}`} className={`flex-1 rounded-t-[3px] ${d.n ? "bg-accent" : "bg-fill"}`} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-label-2">
              <span>{fmtDate(ov.signups_by_day[0]?.day ?? new Date().toISOString())}</span>
              <span>hoje</span>
            </div>
          </Card>

          <SectionTitle>Planos</SectionTitle>
          <Card className="mx-5 overflow-hidden">
            {[
              ["Grátis", ov.users_total - ov.active - ov.trialing - ov.past_due, ""],
              ["Testando o Pro (7 dias)", ov.trialing, ""],
              ["Pro mensal", ov.active_month, brl(ov.active_month * PRICES.mensal.amount) + "/mês"],
              ["Pro anual", ov.active_year, brl(ov.active_year * PRICES.anual.amount) + "/ano"],
              ["Vão cancelar no fim do período", ov.canceling, ""],
              ["Pagamento atrasado", ov.past_due, ""],
              ["Já cancelaram", ov.canceled, ""],
            ].map(([label, n, extra]) => (
              <div key={label as string} className="flex items-center justify-between border-b border-sep px-4 py-3 last:border-b-0">
                <span className="text-[15px]">{label}</span>
                <span className="flex items-baseline gap-2">
                  {extra && <span className="text-[13px] text-label-2">{extra}</span>}
                  <span className="tabular text-[17px] font-bold">{n}</span>
                </span>
              </div>
            ))}
          </Card>

          <SectionTitle>Do cadastro ao pagamento</SectionTitle>
          <Card className="mx-5 flex flex-col gap-3 px-4 py-4">
            {funnel.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[14px]">
                  <span>{f.label}</span>
                  <span className="tabular font-semibold">
                    {f.n} <span className="font-normal text-label-2">{ov.users_total ? `(${Math.round((f.n / ov.users_total) * 100)}%)` : ""}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-fill">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${ov.users_total ? (f.n / ov.users_total) * 100 : 0}%` }} className="h-2 rounded-full bg-accent" />
                </div>
              </div>
            ))}
          </Card>

          <SectionTitle>Uso nos últimos 30 dias</SectionTitle>
          <div className="mx-5 grid grid-cols-2 gap-3">
            <Stat label="Treinos registrados" value={String(ov.workouts_30d)} />
            <Stat label="Refeições registradas" value={String(ov.meals_30d)} />
            <Stat label="Mensagens pra IA (mês)" value={String(ov.ai_chat_pro_month + ov.ai_chat_free_month)} foot={`${ov.ai_chat_pro_month} Pro · ${ov.ai_chat_free_month} grátis`} />
            <Stat label="Fotos e fichas (mês)" value={String(ov.ai_food_month + ov.ai_ficha_month)} foot={`${ov.ai_food_month} pratos · ${ov.ai_ficha_month} fichas`} />
          </div>

          <SectionTitle>Usuários</SectionTitle>
          <div className="mx-5 flex flex-col gap-3">
            <label className="flex h-11 items-center gap-2 rounded-xl bg-card px-3">
              <Icon name="search" size={18} className="text-label-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-3" />
            </label>
            <Segmented<Filter> value={filter} onChange={setFilter} options={[{ value: "todos", label: "Todos" }, { value: "gratis", label: "Grátis" }, { value: "teste", label: "Teste" }, { value: "pagos", label: "Pagos" }]} />
            <p className="text-[13px] text-label-2">{shown.length} {shown.length === 1 ? "usuário" : "usuários"}</p>
          </div>
          <Card className="mx-5 mt-2 overflow-hidden">
            {!rows ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : shown.length === 0 ? (
              <p className="px-4 py-6 text-center text-[15px] text-label-2">Ninguém por aqui.</p>
            ) : (
              shown.map((r) => {
                const p = planOf(r.status);
                return (
                  <div key={r.id} className="flex flex-col gap-1 border-b border-sep px-4 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[16px] font-semibold">{r.name || "Sem nome"}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${p.cls}`}>
                        {p.label}
                        {r.status === "active" && r.plan_interval ? ` · ${r.plan_interval}` : ""}
                        {r.cancel_at_period_end ? " · cancelando" : ""}
                      </span>
                    </div>
                    <span className="truncate text-[13px] text-label-2">{r.email}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-label-2">
                      <span>Entrou em {fmtDate(r.created_at, { year: true })}</span>
                      <span>Último acesso: {ago(r.last_sign_in_at)}</span>
                      <span>{r.workouts} {r.workouts === 1 ? "treino" : "treinos"}{r.last_workout ? ` (último ${ago(r.last_workout)})` : ""}</span>
                      {r.ai_messages > 0 && <span>{r.ai_messages} msgs pra IA</span>}
                      {!r.confirmed && <span className="font-semibold text-bad">não confirmou o e-mail</span>}
                      {r.confirmed && !r.onboarded && <span className="font-semibold text-accent-ink">não terminou a configuração</span>}
                    </div>
                  </div>
                );
              })
            )}
          </Card>
          <p className="mx-5 mt-3 text-[12px] leading-snug text-label-3">
            Receita por mês = assinantes pagando × preço (anual dividido por 12). O custo da IA é uma estimativa pelo número de usos; o valor exato fica no console da Anthropic.
          </p>
        </>
      )}
    </>
  );
}
