"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExerciseList } from "@/components/ExercisePicker";
import { ExerciseGuideSheet, type GuideExercise } from "@/components/ExerciseGuide";
import { Button, Header, Icon, LinkButton, Sheet, Spinner } from "@/components/ui";
import type { DayWithExercises } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/util";

type Row = DayWithExercises["plan_exercises"][number];

export default function DayEditor() {
  const { dayId } = useParams<{ dayId: string }>();
  const router = useRouter();
  const [day, setDay] = useState<DayWithExercises | null>(null);
  const [guide, setGuide] = useState<GuideExercise | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Map<string, Exercise>>(new Map());
  const [settings, setSettings] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    const { data } = await supabase().from("plan_days").select("*, plan_exercises(*, exercises(*))").eq("id", dayId).maybeSingle();
    if (!data) return router.replace("/treinos");
    const d = data as DayWithExercises;
    d.plan_exercises.sort((a, b) => a.position - b.position);
    setDay(d);
  }, [dayId, router]);

  useEffect(() => {
    load();
  }, [load]);

  function patchRow(id: string, patch: Partial<Row>) {
    setDay((d) => d && { ...d, plan_exercises: d.plan_exercises.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { exercises, ...db } = patch as Row;
      supabase().from("plan_exercises").update(db).eq("id", id).then();
    }, 450);
  }

  async function addSelected() {
    if (!day) return;
    const start = day.plan_exercises.length;
    const rows = [...selected.values()].map((e, i) => ({ plan_day_id: day.id, exercise_id: e.id, position: start + i, sets: 3, reps: e.muscle_group === "Abdômen" ? "15" : "8-12", rest_seconds: 90 }));
    await supabase().from("plan_exercises").insert(rows);
    setSelected(new Map());
    setPicking(false);
    load();
  }

  async function remove(id: string) {
    setDay((d) => d && { ...d, plan_exercises: d.plan_exercises.filter((r) => r.id !== id) });
    await supabase().from("plan_exercises").delete().eq("id", id);
  }

  async function move(idx: number, dir: -1 | 1) {
    if (!day) return;
    const list = [...day.plan_exercises];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    const withPos = list.map((r, i) => ({ ...r, position: i }));
    setDay({ ...day, plan_exercises: withPos });
    await Promise.all([withPos[idx], withPos[j]].map((r) => supabase().from("plan_exercises").update({ position: r.position }).eq("id", r.id)));
  }

  async function saveDay(patch: { title?: string; weekday?: number }) {
    if (!day) return;
    setDay({ ...day, ...patch });
    await supabase().from("plan_days").update(patch).eq("id", day.id);
  }

  async function deleteDay() {
    if (!day) return;
    await supabase().from("plan_days").delete().eq("id", day.id);
    router.replace("/treinos");
  }

  if (!day) return <Spinner />;

  return (
    <>
      <Header
        title={day.title}
        eyebrow={WEEKDAYS[day.weekday].toUpperCase()}
        back={{ href: "/treinos", label: "Semana" }}
        right={
          <button onClick={() => setSettings(true)} aria-label="Editar treino" className="press flex h-9 w-9 items-center justify-center rounded-full bg-card text-accent-ink">
            <Icon name="edit" size={18} />
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-5 pt-3">
        <AnimatePresence initial={false}>
          {day.plan_exercises.map((r, i) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className="rounded-2xl bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="tabular mt-0.5 w-5 text-[15px] font-semibold text-label-3">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[17px] font-semibold leading-snug">{r.exercises.name}</span>
                  <span className="text-[13px] text-label-2">{r.exercises.muscle_group} · {r.exercises.equipment}</span>
                  <button onClick={() => setGuide(r.exercises)} className="mt-1 flex items-center gap-1 self-start text-[14px] font-semibold text-accent-ink">
                    <Icon name="play" size={12} /> Como fazer
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="press flex h-8 w-8 items-center justify-center rounded-full bg-card-2 text-label-2 disabled:opacity-30">
                    <Icon name="up" size={15} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === day.plan_exercises.length - 1} aria-label="Descer" className="press flex h-8 w-8 rotate-180 items-center justify-center rounded-full bg-card-2 text-label-2 disabled:opacity-30">
                    <Icon name="up" size={15} />
                  </button>
                  <button onClick={() => remove(r.id)} aria-label={`Remover ${r.exercises.name}`} className="press flex h-8 w-8 items-center justify-center rounded-full bg-card-2 text-bad">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <NumBox label="Séries" value={String(r.sets)} onChange={(v) => patchRow(r.id, { sets: Math.max(1, Math.min(10, parseInt(v) || 1)) })} />
                <NumBox label="Reps" value={r.reps} text onChange={(v) => patchRow(r.id, { reps: v.replace(/[^\d\-–]/g, "").slice(0, 5) || "10" })} />
                <NumBox label="Carga kg" value={r.target_weight == null ? "" : String(r.target_weight)} placeholder="–" onChange={(v) => patchRow(r.id, { target_weight: v === "" ? null : Number(v.replace(",", ".")) })} />
                <NumBox label="Descanso" value={String(r.rest_seconds)} suffix="s" onChange={(v) => patchRow(r.id, { rest_seconds: Math.max(15, Math.min(600, parseInt(v) || 60)) })} />
              </div>
              <input
                defaultValue={r.notes ?? ""}
                onChange={(e) => patchRow(r.id, { notes: e.target.value || null })}
                placeholder="Nota: ajuste da máquina, pegada…"
                aria-label="Nota do exercício"
                className="mt-2 h-10 w-full rounded-[10px] bg-card-2 px-3 text-[15px] outline-none placeholder:text-label-3"
              />
            </motion.div>
          ))}
        </AnimatePresence>

        <Button variant="secondary" size="lg" onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} /> Adicionar exercício
        </Button>
        {day.plan_exercises.length > 0 && (
          <LinkButton href={`/treino/${day.id}`}>
            <Icon name="play" size={18} /> Iniciar este treino
          </LinkButton>
        )}
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Adicionar exercícios">
        <ExerciseList
          selectable
          selected={new Set(selected.keys())}
          onToggle={(e) =>
            setSelected((m) => {
              const n = new Map(m);
              if (n.has(e.id)) n.delete(e.id);
              else n.set(e.id, e);
              return n;
            })
          }
          onCreated={(e) => setSelected((m) => new Map(m).set(e.id, e))}
        />
        <div className="sticky bottom-0 -mx-5 mt-3 bg-bg px-5 pt-2">
          <Button size="lg" className="w-full" disabled={!selected.size} onClick={addSelected}>
            Adicionar {selected.size || ""} {selected.size === 1 ? "exercício" : "exercícios"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={settings} onClose={() => setSettings(false)} title="Editar treino">
        <div className="flex flex-col gap-4 pt-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-label-2">Nome</span>
            <input defaultValue={day.title} onBlur={(e) => e.target.value.trim() && saveDay({ title: e.target.value.trim() })} className="h-12 rounded-xl bg-card px-4 text-[17px] outline-none focus:ring-2 focus:ring-accent" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-label-2">Dia da semana</span>
            <div className="grid grid-cols-7 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <button key={wd} onClick={() => saveDay({ weekday: wd })} className={`press h-11 rounded-xl text-[13px] font-semibold ${day.weekday === wd ? "bg-accent text-on-accent" : "bg-card"}`}>
                  {WEEKDAYS_SHORT[wd]}
                </button>
              ))}
            </div>
          </div>
          <Button variant="danger" size="lg" onClick={deleteDay}>
            <Icon name="trash" size={18} /> Apagar este treino
          </Button>
        </div>
      </Sheet>
      <ExerciseGuideSheet exercise={guide} onClose={() => setGuide(null)} />
    </>
  );
}

function NumBox({ label, value, onChange, text, suffix, placeholder }: { label: string; value: string; onChange: (v: string) => void; text?: boolean; suffix?: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex flex-col items-center gap-1 rounded-xl bg-card-2 py-2">
      <span className="text-[11px] font-semibold text-label-2">{label}</span>
      <span className="flex items-baseline">
        <input
          inputMode={text ? "text" : "decimal"}
          value={v}
          placeholder={placeholder}
          onChange={(e) => {
            setV(e.target.value);
            onChange(e.target.value);
          }}
          className="tabular w-14 bg-transparent text-center text-[18px] font-bold outline-none placeholder:text-label-3"
        />
        {suffix && <span className="-ml-3 text-[12px] text-label-2">{suffix}</span>}
      </span>
    </label>
  );
}
