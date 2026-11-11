"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button, Field, Header, Icon, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { ensurePlan, getActivePlan, type ActivePlan } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/util";

export default function WeekPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<number | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    getActivePlan().then((p) => {
      setPlan(p);
      setLoading(false);
    });
  }, []);

  async function addDay() {
    if (adding === null || !title.trim()) return;
    const p = await ensurePlan();
    const { data } = await supabase().from("plan_days").insert({ plan_id: p.id, weekday: adding, title: title.trim() }).select().single();
    if (data) router.push(`/treinos/${data.id}`);
  }

  const today = new Date().getDay();
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <Header
        title="Minha semana"
        right={
          <Link href="/exercicios" aria-label="Biblioteca de exercícios" className="press mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-accent-ink">
            <Icon name="search" size={19} />
          </Link>
        }
      />
      {loading ? (
        <Spinner />
      ) : (
        <>
          {(plan as { trainer_id?: string | null } | null)?.trainer_id && (
            <Link href="/meu-personal" className="press mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-accent p-4 text-on-accent">
              <Icon name="users" size={22} />
              <span className="flex flex-1 flex-col">
                <span className="text-[16px] font-semibold">Treino montado pelo seu personal</span>
                <span className="text-[13px] opacity-90">{plan!.name}</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          )}
          <Link href="/ia?prompt=monte" className="press mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
              <Icon name="spark" size={22} />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold">Montar com IA</span>
              <span className="text-[14px] text-label-2">“Treino ABC, 4x na semana, foco em pernas”</span>
            </div>
            <Icon name="chevron" size={18} className="text-label-3" />
          </Link>
          <Link href="/importar" className="press mx-5 mt-2.5 flex items-center gap-3 rounded-2xl bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon name="camera" size={21} />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold">Importar ficha da academia</span>
              <span className="text-[14px] text-label-2">Foto da ficha ou print do app da academia</span>
            </div>
            <Icon name="chevron" size={18} className="text-label-3" />
          </Link>

          <SectionTitle>Dias</SectionTitle>
          <div className="flex flex-col gap-2.5 px-5">
            {order.map((wd, idx) => {
              const day = plan?.plan_days.find((d) => d.weekday === wd);
              return (
                <motion.div key={wd} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.035 }}>
                  {day ? (
                    <Link href={`/treinos/${day.id}`} className="press flex items-center gap-3 rounded-2xl bg-card p-4">
                      <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[13px] font-bold ${wd === today ? "bg-accent text-on-accent" : "bg-accent-soft text-accent-ink"}`}>{WEEKDAYS_SHORT[wd]}</div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[17px] font-semibold">{day.title}</span>
                        <span className="truncate text-[13px] text-label-2">
                          {day.plan_exercises.length ? `${day.plan_exercises.length} exercícios · ${[...new Set(day.plan_exercises.map((e) => e.exercises.muscle_group))].slice(0, 3).join(", ")}` : "Sem exercícios ainda"}
                        </span>
                      </div>
                      <Icon name="chevron" size={18} className="text-label-3" />
                    </Link>
                  ) : (
                    <button onClick={() => { setAdding(wd); setTitle(""); }} className="press flex w-full items-center gap-3 rounded-2xl border border-dashed border-fill p-4 text-left">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold ${wd === today ? "text-accent-ink ring-2 ring-accent" : "bg-card text-label-3"}`}>{WEEKDAYS_SHORT[wd]}</div>
                      <span className="flex-1 text-[16px] text-label-2">Descanso</span>
                      <span className="flex items-center gap-1 text-[15px] font-semibold text-accent-ink">
                        <Icon name="plus" size={16} /> Treino
                      </span>
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
          <p className="px-5 pt-4 text-[13px] leading-snug text-label-2">Toque num dia para escolher os exercícios, séries, repetições e carga.</p>
        </>
      )}

      <Sheet open={adding !== null} onClose={() => setAdding(null)} title={adding !== null ? `Treino de ${WEEKDAYS[adding].toLowerCase()}` : ""}>
        <div className="flex flex-col gap-4 pt-2">
          <Field label="Nome do treino" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Treino A — Peito e tríceps" />
          <div className="flex flex-wrap gap-2">
            {["Peito e tríceps", "Costas e bíceps", "Pernas", "Ombros e abdômen", "Superiores", "Inferiores", "Full body"].map((s) => (
              <button key={s} onClick={() => setTitle(s)} className="press h-8 rounded-full bg-card px-3 text-[14px] font-medium">
                {s}
              </button>
            ))}
          </div>
          <Button size="lg" onClick={addDay} disabled={!title.trim()}>
            Criar e escolher exercícios
          </Button>
        </div>
      </Sheet>
    </>
  );
}
