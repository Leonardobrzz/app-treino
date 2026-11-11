"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Segmented, Sheet, Spinner } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { ChallengeCard } from "@/components/personal/ChallengeCard";
import { Field2, PHeader, PersonalNav, inputCls, useTrainer } from "@/components/personal/common";
import { type Challenge } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { todayISO, vibrate } from "@/lib/util";

export default function Challenges() {
  const me = useTrainer();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [form, setForm] = useState<null | { title: string; metric: Challenge["metric"]; starts: string; ends: string; prize: string }>(null);
  const [party, setParty] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase().from("challenges").select("*").eq("trainer_id", me.id).order("ends_on", { ascending: false });
    setList((data ?? []) as Challenge[]);
  }, [me]);
  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    const s = new Date();
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    setError("");
    setForm({ title: "Desafio do mês", metric: "treinos", starts: todayISO(s), ends: todayISO(e), prize: "" });
  }

  async function create() {
    if (!form) return;
    if (!form.title.trim() || form.ends < form.starts) return setError("Confira o nome e as datas.");
    const { error: e } = await supabase().from("challenges").insert({ title: form.title.trim(), metric: form.metric, starts_on: form.starts, ends_on: form.ends, prize: form.prize.trim() || null });
    if (e) return setError("Não consegui criar.");
    pushNow();
    vibrate([10, 40, 10]);
    setForm(null);
    setParty(true);
    setTimeout(() => setParty(false), 2500);
    load();
  }

  async function remove(c: Challenge) {
    setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
    await supabase().from("challenges").delete().eq("id", c.id);
  }

  const active = (list ?? []).filter((c) => c.ends_on >= todayISO());
  const past = (list ?? []).filter((c) => c.ends_on < todayISO());

  return (
    <>
      <Confetti active={party} />
      <PHeader
        title="Desafios"
        right={
          <button onClick={openNew} aria-label="Novo desafio" className="press mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="plus" size={22} stroke={2.5} />
          </button>
        }
      />
      <PersonalNav />
      <p className="mx-5 mt-1 text-[14px] leading-snug text-label-2">Ranking entre os seus alunos. Só aparece quem aceitou entrar no ranking da turma.</p>
      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center">
          <motion.span initial={{ rotate: -15, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB800] text-black">
            <Icon name="trophy" size={28} />
          </motion.span>
          <span className="text-[17px] font-semibold">Crie o primeiro desafio</span>
          <span className="text-[14px] leading-snug text-label-2">Ex.: “Quem treinar mais dias em novembro ganha uma aula extra”. Os alunos recebem um aviso na hora.</span>
          <Button onClick={openNew}>Criar desafio</Button>
        </div>
      ) : (
        <div className="mx-5 mt-3 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {[...active, ...past].map((c) => (
              <motion.div key={c.id} layout exit={{ opacity: 0, scale: 0.95 }}>
                <ChallengeCard c={c} onDelete={() => remove(c)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Sheet open={!!form} onClose={() => setForm(null)} title="Novo desafio">
        {form && (
          <div className="flex flex-col gap-3 pt-1">
            <Field2 label="Nome">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 80) })} className={inputCls} />
            </Field2>
            <Field2 label="Quem ganha">
              <Segmented<Challenge["metric"]> value={form.metric} onChange={(v) => setForm({ ...form, metric: v })} options={[{ value: "treinos", label: "Mais dias" }, { value: "series", label: "Mais séries" }, { value: "volume", label: "Mais volume" }]} />
            </Field2>
            <div className="grid grid-cols-2 gap-2">
              <Field2 label="Começa">
                <input type="date" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className={inputCls} />
              </Field2>
              <Field2 label="Termina">
                <input type="date" value={form.ends} min={form.starts} onChange={(e) => setForm({ ...form, ends: e.target.value })} className={inputCls} />
              </Field2>
            </div>
            <Field2 label="Prêmio (opcional)">
              <input value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value.slice(0, 120) })} placeholder="Ex.: uma aula extra" className={inputCls} />
            </Field2>
            {error && <p className="text-[14px] text-bad">{error}</p>}
            <Button size="lg" onClick={create}>Criar e avisar os alunos</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
