"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { CountUp } from "@/components/motion";
import { Card, Icon, SectionTitle } from "@/components/ui";
import { daysSince, type StudentDetail } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { MEASURES, MEASURE_LABEL } from "@/lib/types";
import { fmtDate, num, weekStart } from "@/lib/util";

type SetRow = { exercise: string; set_number: number; weight: number; reps: number };

export function StudentSummary({ d, onSaved }: { d: StudentDetail; onSaved: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sets, setSets] = useState<Record<string, SetRow[]>>({});
  const [notes, setNotes] = useState(d.link.notes ?? "");
  const [saved, setSaved] = useState(false);

  const s30 = d.sessions.filter((s) => daysSince(s.started_at)! <= 30);
  const vol30 = s30.reduce((a, s) => a + Number(s.volume), 0);
  const last = d.sessions[0];
  const gone = daysSince(last?.finished_at ?? null);

  const weeks = useMemo(() => {
    const out: { label: string; n: number }[] = [];
    const w0 = weekStart(new Date());
    for (let i = 11; i >= 0; i--) {
      const a = new Date(w0);
      a.setDate(a.getDate() - i * 7);
      const b = new Date(a);
      b.setDate(b.getDate() + 7);
      out.push({ label: `${a.getDate()}/${a.getMonth() + 1}`, n: d.sessions.filter((s) => new Date(s.started_at) >= a && new Date(s.started_at) < b).length });
    }
    return out;
  }, [d.sessions]);
  const maxW = Math.max(1, ...weeks.map((w) => w.n));

  async function toggle(id: string) {
    setOpen((o) => (o === id ? null : id));
    if (!sets[id]) {
      const { data } = await supabase().rpc("trainer_student_sets", { p_student: d.profile.id, p_session: id });
      setSets((x) => ({ ...x, [id]: (data ?? []) as SetRow[] }));
    }
  }

  async function saveNotes() {
    await supabase().from("trainer_students").update({ notes: notes.trim() || null }).eq("id", d.link.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    onSaved();
  }

  const lastM = d.measurements.at(-1);
  const firstM = d.measurements[0];
  const weights = d.weights.map((w) => ({ x: w.measured_on, y: Number(w.weight) }));

  return (
    <div className="pt-3">
      <div className="mx-5 grid grid-cols-3 gap-2.5">
        {[
          ["Treinos (30d)", s30.length, (v: number) => String(Math.round(v))],
          ["Por semana", s30.length / (30 / 7), (v: number) => num(v)],
          ["Volume (30d)", vol30 / 1000, (v: number) => `${num(v)} t`],
        ].map(([l, v, f]) => (
          <Card key={l as string} className="flex flex-col gap-0.5 px-3 py-3">
            <span className="text-[12px] font-semibold text-label-2">{l as string}</span>
            <CountUp value={v as number} format={f as (v: number) => string} className="text-[20px] font-bold" />
          </Card>
        ))}
      </div>
      <p className="mx-5 mt-2 text-[13px] text-label-2">{gone == null ? "Ainda não registrou treinos." : gone === 0 ? "Treinou hoje." : `Último treino há ${gone} ${gone === 1 ? "dia" : "dias"}.`}</p>

      <Link href={`/relatorio?aluno=${d.profile.id}`} className="press mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Icon name="download" size={20} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[16px] font-semibold">Relatório em PDF</span>
          <span className="text-[13px] text-label-2">Com a sua marca, pra mandar pro aluno</span>
        </span>
        <Icon name="chevron" size={18} className="text-label-3" />
      </Link>

      <SectionTitle>Frequência (12 semanas)</SectionTitle>
      <Card className="mx-5 p-4">
        <div className="flex h-28 items-end gap-1.5">
          {weeks.map((w, i) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="tabular text-[11px] font-semibold text-label-2">{w.n || ""}</span>
              <motion.div className={`w-full rounded-md ${w.n ? "bg-accent" : "bg-fill"}`} initial={{ height: 0 }} animate={{ height: `${Math.max(6, (w.n / maxW) * 80)}px` }} transition={{ delay: i * 0.03, type: "spring", stiffness: 200, damping: 22 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-label-3">
          <span>{weeks[0].label}</span>
          <span>esta semana</span>
        </div>
      </Card>

      {weights.length > 1 && (
        <>
          <SectionTitle>Peso</SectionTitle>
          <Card className="mx-5 p-4">
            <LineChart points={weights} format={(v) => `${num(v)} kg`} label="Peso corporal" height={120} />
          </Card>
        </>
      )}

      {lastM && (
        <>
          <SectionTitle>Medidas</SectionTitle>
          <Card className="mx-5 grid grid-cols-2 gap-x-4 gap-y-2 p-4">
            {MEASURES.filter((k) => lastM[k] != null).map((k) => {
              const diff = firstM && firstM !== lastM && firstM[k] != null ? Number(lastM[k]) - Number(firstM[k]) : null;
              return (
                <div key={k} className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="text-label-2">{MEASURE_LABEL[k]}</span>
                  <span className="tabular font-semibold">
                    {num(Number(lastM[k]))} cm
                    {diff != null && diff !== 0 && <span className={`ml-1 text-[12px] ${diff > 0 ? "text-accent-ink" : "text-good"}`}>{diff > 0 ? "+" : ""}{num(diff)}</span>}
                  </span>
                </div>
              );
            })}
            <span className="col-span-2 text-[12px] text-label-3">Registrado pelo aluno em {fmtDate(lastM.measured_on, { year: true })}</span>
          </Card>
        </>
      )}

      <SectionTitle>Últimos treinos</SectionTitle>
      {d.sessions.length === 0 ? (
        <p className="mx-5 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nenhum treino registrado ainda.</p>
      ) : (
        <Card className="mx-5 overflow-hidden">
          {d.sessions.slice(0, 12).map((s) => (
            <div key={s.id} className="border-b border-sep last:border-b-0">
              <button onClick={() => toggle(s.id)} aria-expanded={open === s.id} className="press flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{s.title}</span>
                  <span className="text-[13px] text-label-2">
                    {fmtDate(s.started_at)} · {s.sets} séries · {num(Number(s.volume) / 1000)} t · {Math.max(1, Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000))} min
                  </span>
                </div>
                <motion.span animate={{ rotate: open === s.id ? 90 : 0 }} className="text-label-3">
                  <Icon name="chevron" size={17} />
                </motion.span>
              </button>
              <AnimatePresence>
                {open === s.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-3">
                      {!sets[s.id] ? (
                        <span className="text-[13px] text-label-3">Carregando…</span>
                      ) : (
                        Object.entries(
                          sets[s.id].reduce<Record<string, SetRow[]>>((acc, r) => ((acc[r.exercise] ??= []).push(r), acc), {}),
                        ).map(([ex, rs]) => (
                          <div key={ex} className="flex justify-between gap-3 py-1 text-[13px]">
                            <span className="min-w-0 truncate font-medium">{ex}</span>
                            <span className="tabular shrink-0 text-label-2">{rs.map((r) => `${num(Number(r.weight))}×${r.reps}`).join("  ")}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle>Anotações (só você vê)</SectionTitle>
      <div className="mx-5">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} rows={4} placeholder="Preferências, limitações, combinados…" className="w-full resize-none rounded-2xl bg-card px-4 py-3 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
        <button onClick={saveNotes} disabled={notes === (d.link.notes ?? "")} className="press mt-1 h-10 rounded-xl bg-card px-4 text-[15px] font-semibold text-accent-ink disabled:opacity-40">
          {saved ? "Salvo ✓" : "Salvar anotações"}
        </button>
      </div>
    </div>
  );
}
