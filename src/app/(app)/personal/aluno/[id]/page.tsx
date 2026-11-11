"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Button, Icon, Sheet, Spinner } from "@/components/ui";
import { PersonalNav, QuickMessage, useTrainer } from "@/components/personal/common";
import { StudentSummary } from "@/components/personal/StudentSummary";
import { PlanEditor } from "@/components/personal/PlanEditor";
import { AssessmentsTab } from "@/components/personal/AssessmentsTab";
import { AnamneseTab } from "@/components/personal/AnamneseTab";
import { PhotosTab } from "@/components/personal/PhotosTab";
import { FinanceTab } from "@/components/personal/FinanceTab";
import { DietTab } from "@/components/personal/DietTab";
import { MealsTab } from "@/components/personal/MealsTab";
import { ageFrom, studentDetail, type StudentDetail } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";

const TABS = [
  ["resumo", "Resumo"],
  ["treino", "Treino"],
  ["dieta", "Alimentação"],
  ["diario", "Diário"],
  ["avaliacao", "Avaliação"],
  ["anamnese", "Anamnese"],
  ["fotos", "Fotos"],
  ["financeiro", "Financeiro"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useTrainer();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await studentDetail(id));
    } catch {
      setError("Esse aluno não está mais na sua lista.");
    }
  }, [id]);

  useEffect(() => {
    const a = new URLSearchParams(location.search).get("aba") as Tab | null;
    if (a && TABS.some((t) => t[0] === a)) setTab(a);
  }, []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  function pick(t: Tab) {
    setTab(t);
    history.replaceState(null, "", `?aba=${t}`);
  }

  async function end() {
    await supabase().rpc("trainer_end_student", { p_student: id });
    router.replace("/personal/alunos");
  }

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 px-8 pt-40 text-center">
        <p className="text-[17px] font-semibold">{error}</p>
        <Link href="/personal/alunos" className="text-[16px] font-semibold text-accent-ink">Voltar pros alunos</Link>
      </div>
    );

  const p = d?.profile;
  const brand = { name: me?.name ?? "Personal", cref: me?.cref ?? null };
  const age = ageFrom(p?.birth_date);

  return (
    <>
      <header className="safe-top px-5 pb-1">
        <Link href="/personal/alunos" className="press -ml-1 mb-1 flex h-8 w-fit items-center gap-0.5 text-[17px] text-accent-ink">
          <Icon name="back" size={22} /> Alunos
        </Link>
        {p ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
            <Avatar id={p.id} name={p.name ?? "?"} size={56} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.4px]">{p.name ?? "Sem nome"}</h1>
              <span className="truncate text-[14px] text-label-2">{[age ? `${age} anos` : null, p.goal, p.level].filter(Boolean).join(" · ") || "Sem dados do perfil"}</span>
            </div>
            <QuickMessage name={p.name ?? "Aluno"} phone={d!.link.phone} className="!h-11 !w-11" />
          </motion.div>
        ) : (
          <div className="h-14" />
        )}
      </header>
      <PersonalNav />
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-sep px-5">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => pick(k)} className={`relative h-11 shrink-0 px-2.5 text-[15px] ${tab === k ? "font-semibold text-label" : "font-medium text-label-2"}`}>
            {l}
            {tab === k && <motion.span layoutId="stab" className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {!d ? (
        <Spinner />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            {tab === "resumo" && <StudentSummary d={d} onSaved={load} />}
            {tab === "treino" && <PlanEditor d={d} onSent={load} trainer={brand} />}
            {tab === "dieta" && <DietTab d={d} trainer={brand} />}
            {tab === "diario" && <MealsTab d={d} />}
            {tab === "avaliacao" && <AssessmentsTab d={d} />}
            {tab === "anamnese" && <AnamneseTab d={d} />}
            {tab === "fotos" && <PhotosTab d={d} />}
            {tab === "financeiro" && <FinanceTab d={d} onSaved={load} />}
          </motion.div>
        </AnimatePresence>
      )}

      {d && (
        <div className="px-5 pt-10">
          <Button variant="plain" className="w-full !text-bad" onClick={() => setEnding(true)}>
            Encerrar acompanhamento
          </Button>
        </div>
      )}
      <Sheet open={ending} onClose={() => setEnding(false)} title="Encerrar acompanhamento?">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] leading-snug text-label-2">O aluno sai da sua lista e você deixa de ver os dados dele. Ele continua com a conta, os treinos e o histórico.</p>
          <Button variant="danger" size="lg" className="!bg-card" onClick={end}>
            Encerrar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
