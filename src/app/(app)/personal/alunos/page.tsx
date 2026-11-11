"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Icon, Spinner } from "@/components/ui";
import { PHeader, Pill, PersonalNav, StudentLine, useTrainer } from "@/components/personal/common";
import { daysSince, trainerDashboard, type DashRow } from "@/lib/personal";

export default function Students() {
  const me = useTrainer();
  const [rows, setRows] = useState<DashRow[] | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (me) trainerDashboard().then(setRows).catch(() => setRows([]));
  }, [me]);

  const link = typeof window !== "undefined" && me?.trainer_code ? `${location.origin}/convite-personal/${me.trainer_code}` : "";
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  async function share() {
    const text = "Bora treinar comigo no Carga! Entra pelo meu link pra receber seus treinos 💪";
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        return await nav.share({ title: "Carga", text, url: link });
      } catch {
        /* cancelou */
      }
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PHeader title="Alunos" sub={rows ? `${rows.length} ${rows.length === 1 ? "aluno ativo" : "alunos ativos"}` : undefined} />
      <PersonalNav />

      <Card className="mx-5 mt-2 flex items-center gap-3 p-3.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">Convidar aluno</span>
          <span className="truncate text-[13px] text-label-2">
            Código <b className="tracking-wider text-label">{me?.trainer_code ?? "…"}</b> · {link.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <button onClick={share} disabled={!link} className="press flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[15px] font-semibold text-on-accent">
          <Icon name="send" size={16} /> {copied ? "Copiado" : "Enviar"}
        </button>
      </Card>

      <label className="mx-5 mt-3 flex h-11 items-center gap-2 rounded-xl bg-card px-3">
        <Icon name="search" size={18} className="text-label-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno" aria-label="Buscar aluno" className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-3" />
      </label>

      {!rows ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] text-label-2">{rows.length ? "Ninguém com esse nome." : "Nenhum aluno ainda. Mande o convite acima."}</p>
      ) : (
        <Card className="mx-5 mt-3 overflow-hidden">
          {shown.map((r) => {
            const d = daysSince(r.last_workout);
            return (
              <StudentLine
                key={r.student_id}
                id={r.student_id}
                name={r.name}
                href={`/personal/aluno/${r.student_id}`}
                sub={d == null ? "ainda não treinou" : d === 0 ? "treinou hoje" : `último treino há ${d} ${d === 1 ? "dia" : "dias"} · ${r.workouts_30d} no mês`}
                right={
                  <span className="flex items-center gap-1.5">
                    {r.overdue_charges > 0 && <Pill tone="bad">atrasado</Pill>}
                    {r.anamnese === "pendente" && <Pill>anamnese</Pill>}
                    <Icon name="chevron" size={17} className="text-label-3" />
                  </span>
                }
              />
            );
          })}
        </Card>
      )}
    </>
  );
}
