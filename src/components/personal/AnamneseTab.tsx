"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button, Card, Icon, Spinner } from "@/components/ui";
import { ANAMNESE, PARQ_KEYS, type Anamnese, type StudentDetail } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { fmtDate, vibrate } from "@/lib/util";

export function AnamneseView({ a }: { a: Anamnese }) {
  const ans = a.answers ?? {};
  const parqYes = PARQ_KEYS.filter((k) => ans[k] === "Sim");
  return (
    <div className="flex flex-col gap-3">
      {parqYes.length > 0 ? (
        <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="flex gap-3 rounded-2xl bg-bad/10 p-4 text-bad">
          <Icon name="help" size={22} className="shrink-0" />
          <span className="text-[14px] font-medium leading-snug">
            {parqYes.length} {parqYes.length === 1 ? "resposta “sim”" : "respostas “sim”"} no PAR-Q. Recomende uma liberação médica antes de começar ou intensificar os treinos.
          </span>
        </motion.div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-good-soft p-3.5 text-[14px] font-medium text-good">
          <Icon name="check" size={18} stroke={3} /> PAR-Q sem nenhum “sim”
        </div>
      )}
      {ANAMNESE.map((s) => (
        <Card key={s.title} className="p-4">
          <span className="text-[13px] font-semibold text-label-2">{s.title}</span>
          <div className="mt-2 flex flex-col gap-2.5">
            {s.questions.map((q) => (
              <div key={q.key} className="flex flex-col">
                <span className="text-[13px] leading-snug text-label-2">{q.label}</span>
                <span className={`text-[15px] font-semibold ${q.parq && ans[q.key] === "Sim" ? "text-bad" : ""}`}>{ans[q.key]?.trim() || "—"}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {a.extra_questions.length > 0 && (
        <Card className="p-4">
          <span className="text-[13px] font-semibold text-label-2">Perguntas do personal</span>
          <div className="mt-2 flex flex-col gap-2.5">
            {a.extra_questions.map((q, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[13px] leading-snug text-label-2">{q}</span>
                <span className="text-[15px] font-semibold">{ans[`extra_${i}`]?.trim() || "—"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {a.answered_at && <p className="text-[12px] text-label-3">Respondida em {fmtDate(a.answered_at, { year: true })}</p>}
    </div>
  );
}

export function AnamneseTab({ d }: { d: StudentDetail }) {
  const [list, setList] = useState<Anamnese[] | null>(null);
  const [extra, setExtra] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase().from("anamneses").select("*").eq("student_id", d.profile.id).eq("trainer_id", d.link.trainer_id).order("requested_at", { ascending: false });
    setList((data ?? []) as Anamnese[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.profile.id]);

  async function request() {
    setBusy(true);
    const qs = extra.split("\n").map((x) => x.trim()).filter(Boolean);
    await supabase().rpc("request_anamnese", { p_student: d.profile.id, p_extra: qs });
    pushNow();
    vibrate([10, 40, 10]);
    setBusy(false);
    setAsking(false);
    setExtra("");
    load();
  }

  if (!list) return <Spinner />;
  const answered = list.find((a) => a.answered_at);
  const pending = list.find((a) => !a.answered_at);

  return (
    <div className="mx-5 flex flex-col gap-3 pt-3">
      {pending && (
        <div className="flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <Icon name="clock" size={20} className="text-accent-ink" />
          <span className="flex-1 text-[14px] font-medium">Anamnese enviada em {fmtDate(pending.requested_at)}. Esperando o aluno responder.</span>
        </div>
      )}
      {!asking ? (
        <Button variant={answered || pending ? "secondary" : "primary"} size="lg" className={answered || pending ? "!bg-card" : ""} onClick={() => setAsking(true)}>
          <Icon name="clipboard" size={18} /> {answered || pending ? "Pedir de novo" : "Pedir anamnese"}
        </Button>
      ) : (
        <Card className="flex flex-col gap-3 p-4">
          <span className="text-[15px] font-semibold">Perguntas extras (opcional)</span>
          <span className="text-[13px] leading-snug text-label-2">O aluno responde objetivo, rotina, PAR-Q, saúde e hábitos. Quer perguntar mais alguma coisa? Uma por linha.</span>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder={"Ex.: Pratica algum esporte?\nQual horário prefere treinar?"} className="w-full resize-none rounded-xl bg-card-2 px-3.5 py-2.5 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={request}>
              {busy ? "Enviando…" : "Enviar pro aluno"}
            </Button>
            <Button variant="plain" onClick={() => setAsking(false)}>Cancelar</Button>
          </div>
        </Card>
      )}
      {answered ? <AnamneseView a={answered} /> : !pending && <p className="rounded-2xl bg-card p-4 text-[15px] text-label-2">O aluno ainda não respondeu nenhuma anamnese.</p>}
    </div>
  );
}
