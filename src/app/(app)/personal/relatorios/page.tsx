"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Card, Icon, Spinner } from "@/components/ui";
import { PHeader, PersonalNav, StudentLine, useTrainer } from "@/components/personal/common";
import { trainerDashboard, type DashRow } from "@/lib/personal";
import { MONTHS_LONG, todayISO } from "@/lib/util";

export default function Reports() {
  const me = useTrainer();
  const [rows, setRows] = useState<DashRow[] | null>(null);
  const [m, setM] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

  useEffect(() => {
    if (me) trainerDashboard().then(setRows).catch(() => setRows([]));
  }, [me]);

  const de = todayISO(m);
  const ate = todayISO(new Date(m.getFullYear(), m.getMonth() + 1, 0));
  const future = m > new Date();

  return (
    <>
      <PHeader title="Relatórios" sub="Um PDF por aluno com a evolução do mês, com seu nome e CREF" />
      <PersonalNav />
      <div className="mx-5 mt-2 flex items-center justify-between">
        <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mês anterior" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card"><Icon name="back" size={20} /></button>
        <span className="text-[17px] font-semibold">{MONTHS_LONG[m.getMonth()]} {m.getFullYear()}</span>
        <button disabled={future} onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Próximo mês" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card disabled:opacity-30"><Icon name="chevron" size={20} /></button>
      </div>
      <p className="mx-5 mt-2 text-[13px] leading-snug text-label-2">Todo dia 1 você recebe um aviso lembrando de gerar os relatórios do mês que passou. Toque no aluno, gere o PDF e mande no WhatsApp.</p>
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nenhum aluno ainda.</p>
      ) : (
        <Card className="mx-5 mt-3 overflow-hidden">
          {rows.map((r, i) => (
            <motion.div key={r.student_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <StudentLine
                id={r.student_id}
                name={r.name}
                href={`/relatorio?aluno=${r.student_id}&de=${de}&ate=${ate}`}
                sub={`${r.workouts_30d} ${r.workouts_30d === 1 ? "treino" : "treinos"} nos últimos 30 dias`}
                right={
                  <span className="flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-[13px] font-semibold text-on-accent">
                    <Icon name="download" size={15} /> PDF
                  </span>
                }
              />
            </motion.div>
          ))}
        </Card>
      )}
      <Link href="/personal/alunos" className="mx-5 mt-3 block text-center text-[14px] font-semibold text-accent-ink">Ver todos os alunos</Link>
    </>
  );
}
