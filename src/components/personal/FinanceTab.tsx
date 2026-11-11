"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { ChargeRow } from "./ChargeRow";
import { Field2, inputCls } from "./common";
import { brl, type Charge, type StudentDetail } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { todayISO, vibrate } from "@/lib/util";

export function FinanceTab({ d, onSaved }: { d: StudentDetail; onSaved: () => void }) {
  const [fee, setFee] = useState(d.link.fee != null ? String(d.link.fee).replace(".", ",") : "");
  const [dueDay, setDueDay] = useState(d.link.due_day ? String(d.link.due_day) : "");
  const [ends, setEnds] = useState(d.link.plan_ends_on ?? "");
  const [phone, setPhone] = useState(d.link.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [list, setList] = useState<Charge[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayISO());
  const [desc, setDesc] = useState("Mensalidade");
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase().from("charges").select("*").eq("student_id", d.profile.id).eq("trainer_id", d.link.trainer_id).order("due_on", { ascending: false });
    setList((data ?? []) as Charge[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.profile.id]);

  async function save() {
    const f = fee.trim() ? Number(fee.replace(",", ".")) : null;
    const dd = dueDay ? Math.max(1, Math.min(28, Number(dueDay))) : null;
    await supabase().from("trainer_students").update({ fee: f, due_day: dd, plan_ends_on: ends || null, phone: phone.replace(/\D/g, "") || null }).eq("id", d.link.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    onSaved();
  }

  async function create() {
    const v = Number(amount.replace(",", "."));
    if (!(v > 0)) return setError("Coloque um valor.");
    setError("");
    const { error: e } = await supabase().from("charges").insert({ student_id: d.profile.id, amount: v, due_on: due, description: desc.trim() || null });
    if (e) return setError(e.message.includes("charges_once") ? "Já existe uma cobrança nessa data." : "Não consegui criar a cobrança.");
    pushNow();
    vibrate([10, 40, 10]);
    setCreating(false);
    load();
  }

  const open = (list ?? []).filter((c) => c.status === "aberta").reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="pt-3">
      <Card className="mx-5 flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field2 label="Mensalidade (R$)">
            <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="200,00" className={`${inputCls} !bg-card-2`} />
          </Field2>
          <Field2 label="Dia do vencimento">
            <input inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="10" className={`${inputCls} !bg-card-2`} />
          </Field2>
          <Field2 label="Plano acaba em">
            <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className={`${inputCls} !bg-card-2`} />
          </Field2>
          <Field2 label="WhatsApp do aluno">
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(85) 9…" className={`${inputCls} !bg-card-2`} />
          </Field2>
        </div>
        <p className="text-[12px] leading-snug text-label-3">Com mensalidade e dia, o Carga cria a cobrança sozinho 5 dias antes do vencimento e lembra o aluno. O Pix cai direto na sua chave.</p>
        <Button onClick={save}>{saved ? "Salvo ✓" : "Salvar"}</Button>
      </Card>

      <SectionTitle action={<button onClick={() => (setAmount(fee), setCreating(true))} className="text-[15px] font-semibold text-accent-ink">+ Nova</button>}>Cobranças</SectionTitle>
      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="mx-5 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nenhuma cobrança ainda.</p>
      ) : (
        <>
          {open > 0 && <p className="mx-5 mb-2 text-[14px] text-label-2">Em aberto: <b className="text-label">{brl(open)}</b></p>}
          <Card className="mx-5 overflow-hidden">
            {list.map((c) => (
              <ChargeRow key={c.id} c={c} onChange={(n) => setList((l) => l?.map((x) => (x.id === n.id ? n : x)) ?? null)} />
            ))}
          </Card>
        </>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nova cobrança">
        <div className="flex flex-col gap-3 pt-1">
          <Field2 label="Valor (R$)">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} autoFocus />
          </Field2>
          <Field2 label="Vencimento">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
          </Field2>
          <Field2 label="Descrição">
            <input value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 120))} className={inputCls} />
          </Field2>
          {error && <p className="text-[14px] text-bad">{error}</p>}
          <Button size="lg" onClick={create}>
            <Icon name="send" size={17} /> Criar e avisar o aluno
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
