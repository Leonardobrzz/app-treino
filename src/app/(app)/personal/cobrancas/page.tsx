"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/motion";
import { Card, Icon, Segmented, Spinner } from "@/components/ui";
import { ChargeRow, chargeTone } from "@/components/personal/ChargeRow";
import { PHeader, PersonalNav, useTrainer } from "@/components/personal/common";
import { brl, trainerDashboard, type Charge } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { MONTHS_LONG, todayISO } from "@/lib/util";

type F = "todas" | "confirmar" | "abertas" | "pagas";

export default function Charges() {
  const me = useTrainer();
  const [m, setM] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [list, setList] = useState<Charge[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [phones, setPhones] = useState<Map<string, string | null>>(new Map());
  const [f, setF] = useState<F>("todas");

  const load = useCallback(async () => {
    if (!me) return;
    const a = todayISO(m);
    const b = todayISO(new Date(m.getFullYear(), m.getMonth() + 1, 0));
    // do mês escolhido + tudo que ficou em aberto de antes
    const [{ data: inMonth }, { data: late }] = await Promise.all([
      supabase().from("charges").select("*").eq("trainer_id", me.id).gte("due_on", a).lte("due_on", b).order("due_on"),
      supabase().from("charges").select("*").eq("trainer_id", me.id).lt("due_on", a).eq("status", "aberta").order("due_on"),
    ]);
    setList([...((late ?? []) as Charge[]), ...((inMonth ?? []) as Charge[])]);
  }, [me, m]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (me) trainerDashboard().then((r) => (setNames(new Map(r.map((x) => [x.student_id, x.name]))), setPhones(new Map(r.map((x) => [x.student_id, x.phone]))))).catch(() => {});
  }, [me]);

  const t = useMemo(() => {
    const L = (list ?? []).filter((c) => c.status !== "cancelada");
    const sum = (x: Charge[]) => x.reduce((a, c) => a + Number(c.amount), 0);
    return {
      paid: sum(L.filter((c) => c.status === "paga")),
      open: sum(L.filter((c) => c.status === "aberta")),
      late: sum(L.filter((c) => chargeTone(c).tone === "bad")),
      confirm: L.filter((c) => c.status === "aberta" && c.receipt_path).length,
    };
  }, [list]);

  const shown = (list ?? []).filter((c) => (f === "todas" ? true : f === "pagas" ? c.status === "paga" : f === "abertas" ? c.status === "aberta" : c.status === "aberta" && !!c.receipt_path));

  return (
    <>
      <PHeader title="Cobranças" />
      <PersonalNav />
      {me && !me.pix_key && (
        <Link href="/personal/perfil" className="press mx-5 mt-2 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <Icon name="pix" size={22} className="text-accent-ink" />
          <span className="flex-1 text-[14px] font-medium leading-snug">Cadastre sua chave Pix pra o aluno pagar direto pelo app.</span>
          <Icon name="chevron" size={18} className="text-label-3" />
        </Link>
      )}
      <div className="mx-5 mt-3 flex items-center justify-between">
        <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mês anterior" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card"><Icon name="back" size={20} /></button>
        <span className="text-[17px] font-semibold">{MONTHS_LONG[m.getMonth()]} {m.getFullYear()}</span>
        <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Próximo mês" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card"><Icon name="chevron" size={20} /></button>
      </div>
      <div className="mx-5 mt-3 grid grid-cols-3 gap-2.5">
        {[
          ["Recebido", t.paid, "text-good"],
          ["Em aberto", t.open, ""],
          ["Atrasado", t.late, t.late ? "text-bad" : ""],
        ].map(([l, v, c]) => (
          <Card key={l as string} className="flex flex-col px-3 py-3">
            <span className="text-[12px] font-semibold text-label-2">{l as string}</span>
            <CountUp value={v as number} format={(x) => brl(x)} className={`text-[16px] font-bold ${c}`} />
          </Card>
        ))}
      </div>
      <div className="mx-5 mt-3">
        <Segmented<F> value={f} onChange={setF} options={[{ value: "todas", label: "Todas" }, { value: "confirmar", label: `Conferir${t.confirm ? ` (${t.confirm})` : ""}` }, { value: "abertas", label: "Abertas" }, { value: "pagas", label: "Pagas" }]} />
      </div>
      {!list ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="mx-5 mt-3 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nada por aqui. Configure mensalidade e vencimento na aba Financeiro de cada aluno.</p>
      ) : (
        <Card className="mx-5 mt-3 overflow-hidden">
          {shown.map((c) => (
            <ChargeRow key={c.id} c={c} name={names.get(c.student_id) ?? "Aluno"} phone={phones.get(c.student_id) ?? null} pix={me?.pix_key ? { key: me.pix_key, name: me.pix_name ?? me.name ?? "Personal", city: me.trainer_city ?? null } : null} onChange={(n) => setList((l) => l?.map((x) => (x.id === n.id ? n : x)) ?? null)} />
          ))}
        </Card>
      )}
      <p className="mx-5 mt-3 text-[12px] leading-snug text-label-3">O dinheiro vai direto do aluno pra sua chave Pix. O Carga não cobra taxa nem passa pelo pagamento: ele só organiza, lembra e mostra o comprovante.</p>
    </>
  );
}
