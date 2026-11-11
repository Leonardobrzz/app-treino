"use client";

import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button, Header, Spinner } from "@/components/ui";
import { ANAMNESE, type Anamnese, type Question } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { vibrate } from "@/lib/util";

export default function AnswerAnamnese() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [a, setA] = useState<Anamnese | null | undefined>(undefined);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase().from("anamneses").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setA(data as Anamnese | null);
      if (data?.answers) setAns(data.answers as Record<string, string>);
    });
  }, [id]);

  const sections = useMemo(() => {
    const s = ANAMNESE.map((x) => ({ ...x }));
    if (a?.extra_questions.length) s.push({ title: "Perguntas do seu personal", questions: a.extra_questions.map((q, i): Question => ({ key: `extra_${i}`, label: q, type: "text" })) });
    return s;
  }, [a]);

  if (a === undefined) return <Spinner />;
  if (!a) return <p className="px-6 pt-40 text-center text-[17px]">Anamnese não encontrada.</p>;

  const sec = sections[step];
  const missing = sec.questions.filter((q) => (q.type === "choice" || q.type === "yesno") && !ans[q.key]);
  const last = step === sections.length - 1;

  async function submit() {
    setBusy(true);
    setError("");
    const { error: e } = await supabase().rpc("answer_anamnese", { p_id: id, p_answers: ans });
    if (e) {
      setBusy(false);
      return setError("Não consegui enviar. Tenta de novo.");
    }
    pushNow();
    vibrate([10, 40, 10, 40]);
    router.replace("/meu-personal");
  }

  const set = (k: string, v: string) => setAns((x) => ({ ...x, [k]: v }));

  return (
    <>
      <Header title="Anamnese" back={{ href: "/meu-personal", label: "Meu personal" }} />
      <div className="mx-5 mt-1 flex gap-1.5" aria-label={`Parte ${step + 1} de ${sections.length}`}>
        {sections.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
            <motion.div className="h-full bg-accent" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="mx-5 mt-5 flex flex-col gap-5">
          <h2 className="text-[22px] font-bold">{sec.title}</h2>
          {sec.questions.map((q) => (
            <div key={q.key} className="flex flex-col gap-2">
              <span className="text-[16px] font-semibold leading-snug">{q.label}</span>
              {q.type === "text" ? (
                <textarea value={ans[q.key] ?? ""} onChange={(e) => set(q.key, e.target.value.slice(0, 500))} rows={2} placeholder="Se não tiver, deixe em branco" className="w-full resize-none rounded-xl bg-card px-3.5 py-2.5 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(q.type === "yesno" ? ["Não", "Sim"] : q.options!).map((o) => (
                    <motion.button key={o} whileTap={{ scale: 0.94 }} onClick={() => set(q.key, o)} aria-pressed={ans[q.key] === o} className={`h-11 rounded-xl px-4 text-[15px] font-semibold ${ans[q.key] === o ? "bg-accent text-on-accent" : "bg-card"}`}>
                      {o}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      {error && <p className="mx-5 mt-3 text-[14px] text-bad">{error}</p>}
      <div className="mx-5 mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" size="lg" className="!bg-card" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        )}
        <Button size="lg" className="flex-1" disabled={missing.length > 0 || busy} onClick={() => (last ? submit() : (setStep(step + 1), window.scrollTo({ top: 0, behavior: "smooth" })))}>
          {last ? (busy ? "Enviando…" : "Enviar pro personal") : missing.length ? `Faltam ${missing.length}` : "Continuar"}
        </Button>
      </div>
    </>
  );
}
