"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { useMemo, useState } from "react";
import { ExerciseList, loadExercises } from "@/components/ExercisePicker";
import { Confetti } from "@/components/motion";
import { Button, Card, Icon, SectionTitle, Sheet } from "@/components/ui";
import { METHODS, methodLabel, sendPlan, type PlanDayT, type PlanEx, type StudentDetail, type StudentPlan } from "@/lib/personal";
import { generatePlan, type Goal, type Level, type Location } from "@/lib/plan-generator";
import type { Exercise } from "@/lib/types";
import { WEEKDAYS, WEEKDAYS_SHORT, vibrate } from "@/lib/util";

const GOAL_OF: Record<string, Goal> = { "Perder gordura": "perder", "Manter e cuidar": "manter", "Ganhar massa": "ganhar", "Recomposição": "recompor" };

let uid = 0;
type Row = PlanEx & { k: number };
type Day = Omit<PlanDayT, "exercises"> & { exercises: Row[] };

const toRows = (p: StudentPlan | null): Day[] => (p?.days ?? []).map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, k: ++uid })) }));

export function PlanEditor({ d, onSent }: { d: StudentDetail; onSent: () => void }) {
  const [name, setName] = useState(d.plan?.trainer_id ? d.plan.name : "Treino do personal");
  const [days, setDays] = useState<Day[]>(() => toRows(d.plan));
  const [sel, setSel] = useState<number | null>(days[0]?.weekday ?? null);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Map<string, Exercise>>(new Map());
  const [edit, setEdit] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [party, setParty] = useState(false);
  const [dirty, setDirty] = useState(false);

  const day = days.find((x) => x.weekday === sel) ?? null;
  const fromTrainer = !!d.plan?.trainer_id;

  function patchDay(wd: number, f: (d: Day) => Day) {
    setDays((ds) => ds.map((x) => (x.weekday === wd ? f(x) : x)));
    setDirty(true);
  }

  function toggleDay(wd: number) {
    if (days.some((x) => x.weekday === wd)) {
      setSel(wd);
      return;
    }
    setDays((ds) => [...ds, { weekday: wd, title: `Treino ${String.fromCharCode(65 + ds.length)}`, exercises: [] }].sort((a, b) => a.weekday - b.weekday));
    setSel(wd);
    setDirty(true);
  }

  function removeDay(wd: number) {
    setDays((ds) => ds.filter((x) => x.weekday !== wd));
    setSel(days.find((x) => x.weekday !== wd)?.weekday ?? null);
    setDirty(true);
  }

  function addChosen() {
    if (sel == null) return;
    const rows: Row[] = [...chosen.values()].map((e) => ({ k: ++uid, exercise_id: e.id, name: e.name, muscle_group: e.muscle_group, equipment: e.equipment, sets: 3, reps: "10-12", target_weight: null, rest_seconds: 90, notes: null, method: null }));
    patchDay(sel, (x) => ({ ...x, exercises: [...x.exercises, ...rows] }));
    setChosen(new Map());
    setPicking(false);
  }

  async function auto() {
    const p = d.profile;
    const catalog = (await loadExercises()).filter((e) => !e.created_by);
    const wds = p.training_days?.length ? p.training_days : [1, 3, 5];
    const plan = generatePlan(
      {
        goal: GOAL_OF[p.goal ?? ""] ?? "nao-sei",
        level: (p.level as Level) ?? "iniciante",
        location: (p.location as Location) ?? "academia",
        days: wds,
        minutes: p.session_minutes ?? 60,
        priorities: p.priority_muscles ?? [],
      },
      catalog,
    );
    const next: Day[] = plan.days.map((g) => ({
      weekday: g.weekday,
      title: g.title,
      exercises: g.exercises.map((e) => ({ k: ++uid, exercise_id: e.exercise.id, name: e.exercise.name, muscle_group: e.exercise.muscle_group, equipment: e.exercise.equipment, sets: e.sets, reps: e.reps, target_weight: null, rest_seconds: e.rest, notes: null, method: null })),
    }));
    setDays(next);
    setSel(next[0]?.weekday ?? null);
    setName(plan.name || "Treino do personal");
    setDirty(true);
    vibrate(10);
    setMsg("Semana montada com o perfil do aluno. Ajuste o que quiser e envie.");
  }

  async function send() {
    setBusy(true);
    setMsg("");
    try {
      await sendPlan(d.profile.id, { name, days: days.map((x) => ({ weekday: x.weekday, title: x.title, exercises: x.exercises.map(({ k: _k, ...e }) => e) })) });
      vibrate([10, 40, 10]);
      setParty(true);
      setTimeout(() => setParty(false), 2600);
      setMsg("Enviado! O aluno recebeu um aviso e o treino já aparece no app dele.");
      setDirty(false);
      onSent();
    } catch {
      setMsg("Não consegui enviar. Tenta de novo.");
    } finally {
      setBusy(false);
    }
  }

  const total = useMemo(() => days.reduce((a, x) => a + x.exercises.length, 0), [days]);

  return (
    <div className="pt-3">
      <Confetti active={party} count={60} />
      <div className="mx-5 rounded-2xl bg-card p-3.5 text-[14px] leading-snug text-label-2">
        {d.plan ? (fromTrainer ? "Este é o treino que você enviou. Edite e envie de novo quando quiser." : "O aluno está usando um treino montado por ele mesmo. Você pode partir dele ou montar um novo.") : "O aluno ainda não tem treino. Monte do zero ou use o automático a partir do perfil dele."}
      </div>

      <div className="mx-5 mt-3 flex gap-2">
        <input value={name} onChange={(e) => (setName(e.target.value.slice(0, 80)), setDirty(true))} aria-label="Nome do treino" className="h-11 min-w-0 flex-1 rounded-xl bg-card px-3.5 text-[16px] font-semibold outline-none ring-accent focus:ring-2" />
        <Button variant="secondary" className="!bg-card" onClick={auto}>
          <Icon name="spark" size={17} /> Automático
        </Button>
      </div>

      <SectionTitle>Dias</SectionTitle>
      <div className="mx-5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS_SHORT.map((w, i) => {
          const has = days.some((x) => x.weekday === i);
          return (
            <motion.button key={w} whileTap={{ scale: 0.9 }} onClick={() => toggleDay(i)} aria-pressed={sel === i} className={`flex h-12 flex-col items-center justify-center rounded-xl text-[13px] font-semibold ${sel === i ? "bg-accent text-on-accent" : has ? "bg-accent-soft text-accent-ink" : "bg-card text-label-3"}`}>
              {w}
              {has && <span className={`mt-0.5 h-1 w-1 rounded-full ${sel === i ? "bg-on-accent" : "bg-accent"}`} />}
            </motion.button>
          );
        })}
      </div>
      <p className="mx-5 mt-1.5 text-[12px] text-label-3">Toque num dia vazio pra criar um treino nele.</p>

      <AnimatePresence mode="wait">
        {day && (
          <motion.div key={day.weekday} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mx-5 mt-4 flex items-center gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-accent-ink">{WEEKDAYS[day.weekday]}</span>
              <input value={day.title} onChange={(e) => patchDay(day.weekday, (x) => ({ ...x, title: e.target.value.slice(0, 80) }))} aria-label="Título do dia" className="h-10 min-w-0 flex-1 rounded-xl bg-card px-3 text-[16px] font-semibold outline-none ring-accent focus:ring-2" />
              <button onClick={() => removeDay(day.weekday)} aria-label="Tirar este dia" className="press flex h-10 w-10 items-center justify-center rounded-xl bg-card text-bad">
                <Icon name="trash" size={18} />
              </button>
            </div>

            <Reorder.Group axis="y" values={day.exercises} onReorder={(v) => patchDay(day.weekday, (x) => ({ ...x, exercises: v }))} className="mx-5 mt-3 flex flex-col gap-2">
              {day.exercises.map((e, i) => (
                <Reorder.Item key={e.k} value={e} className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3" whileDrag={{ scale: 1.03, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
                  <span className="tabular w-5 shrink-0 cursor-grab text-[15px] font-semibold text-label-3" aria-hidden>
                    {i + 1}
                  </span>
                  <button onClick={() => setEdit(e)} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-[15px] font-semibold">{e.name}</span>
                    <span className="truncate text-[13px] text-label-2">
                      {e.sets} × {e.reps}
                      {e.target_weight ? ` · ${e.target_weight} kg` : ""} · {e.rest_seconds}s
                      {e.method ? ` · ${methodLabel(e.method)}` : ""}
                    </span>
                  </button>
                  <button onClick={() => setEdit(e)} aria-label={`Editar ${e.name}`} className="press flex h-8 w-8 items-center justify-center text-label-3">
                    <Icon name="edit" size={17} />
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            {day.exercises.length > 1 && <p className="mx-5 mt-1.5 text-[12px] text-label-3">Arraste pra mudar a ordem.</p>}
            <div className="mx-5 mt-2">
              <Button variant="secondary" className="w-full !bg-card" onClick={() => setPicking(true)}>
                <Icon name="plus" size={18} /> Adicionar exercício
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {msg && <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mt-5 rounded-xl bg-good-soft px-4 py-2.5 text-center text-[14px] font-medium text-good">{msg}</motion.p>}
      <div className="sticky bottom-[84px] z-20 mt-4 bg-bg/95 px-5 pb-3 pt-2 backdrop-blur">
        <Button size="lg" className="w-full shadow-xl" disabled={busy || total === 0 || (!dirty && fromTrainer)} onClick={send}>
          <Icon name="send" size={18} /> {busy ? "Enviando…" : `Enviar pro aluno (${days.length} ${days.length === 1 ? "dia" : "dias"})`}
        </Button>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Adicionar exercícios">
        <ExerciseList
          catalogOnly
          selectable
          selected={new Set(chosen.keys())}
          onToggle={(e) =>
            setChosen((m) => {
              const n = new Map(m);
              if (n.has(e.id)) n.delete(e.id);
              else n.set(e.id, e);
              return n;
            })
          }
        />
        <div className="sticky bottom-0 bg-bg pt-3">
          <Button size="lg" className="w-full" disabled={!chosen.size} onClick={addChosen}>
            Adicionar {chosen.size || ""}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""}>
        {edit && day && (
          <ExerciseForm
            value={edit}
            onChange={(v) => {
              setEdit(v);
              patchDay(day.weekday, (x) => ({ ...x, exercises: x.exercises.map((r) => (r.k === v.k ? v : r)) }));
            }}
            onRemove={() => {
              patchDay(day.weekday, (x) => ({ ...x, exercises: x.exercises.filter((r) => r.k !== edit.k) }));
              setEdit(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ExerciseForm({ value: v, onChange, onRemove }: { value: Row; onChange: (r: Row) => void; onRemove: () => void }) {
  const num = (s: string) => (s === "" ? null : Number(s.replace(",", ".")));
  const box = "h-11 w-full rounded-xl bg-card px-3 text-center text-[17px] font-semibold outline-none ring-accent focus:ring-2";
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="grid grid-cols-4 gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-label-2">
          Séries
          <input inputMode="numeric" value={v.sets} onChange={(e) => onChange({ ...v, sets: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-label-2">
          Repetições
          <input value={v.reps} onChange={(e) => onChange({ ...v, reps: e.target.value.slice(0, 8) })} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-label-2">
          Carga (kg)
          <input inputMode="decimal" value={v.target_weight ?? ""} placeholder="–" onChange={(e) => onChange({ ...v, target_weight: num(e.target.value) })} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-label-2">
          Descanso
          <input inputMode="numeric" value={v.rest_seconds} onChange={(e) => onChange({ ...v, rest_seconds: Math.max(15, Math.min(600, Number(e.target.value) || 60)) })} className={box} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-label-2">Método</span>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onChange({ ...v, method: null })} className={`press h-9 rounded-full px-3.5 text-[14px] font-medium ${!v.method ? "bg-accent text-on-accent" : "bg-card"}`}>
            Normal
          </button>
          {METHODS.map((m) => (
            <button key={m.value} onClick={() => onChange({ ...v, method: m.value })} className={`press h-9 rounded-full px-3.5 text-[14px] font-medium ${v.method === m.value ? "bg-accent text-on-accent" : "bg-card"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {v.method && <span className="text-[13px] text-label-2">{METHODS.find((m) => m.value === v.method)?.hint}</span>}
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-label-2">
        Observação pro aluno
        <textarea value={v.notes ?? ""} onChange={(e) => onChange({ ...v, notes: e.target.value.slice(0, 200) || null })} rows={2} placeholder="Ex.: segura 2 s em cima, cotovelo colado" className="w-full resize-none rounded-xl bg-card px-3.5 py-2.5 text-[15px] font-normal text-label outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
      </label>
      <Button variant="danger" className="!bg-card" onClick={onRemove}>
        <Icon name="trash" size={17} /> Tirar do treino
      </Button>
    </div>
  );
}
