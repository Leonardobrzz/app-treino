"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Button, Card, Icon, Sheet, Spinner } from "@/components/ui";
import { Field2, PHeader, Pill, PersonalNav, inputCls, useTrainer } from "@/components/personal/common";
import { trainerDashboard, type Appointment, type DashRow } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { WEEKDAYS, todayISO, vibrate, weekStart } from "@/lib/util";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Agenda() {
  const me = useTrainer();
  const [w0, setW0] = useState(() => weekStart(new Date()));
  const [list, setList] = useState<Appointment[] | null>(null);
  const [students, setStudents] = useState<DashRow[]>([]);
  const [form, setForm] = useState<null | { id?: string; student: string; date: string; time: string; minutes: string; note: string }>(null);
  const [act, setAct] = useState<Appointment | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!me) return;
    const end = new Date(w0);
    end.setDate(end.getDate() + 7);
    const { data } = await supabase().from("appointments").select("*").eq("trainer_id", me.id).gte("starts_at", w0.toISOString()).lt("starts_at", end.toISOString()).order("starts_at");
    setList((data ?? []) as Appointment[]);
  }, [me, w0]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (me) trainerDashboard().then(setStudents).catch(() => {});
  }, [me]);

  const names = useMemo(() => new Map(students.map((s) => [s.student_id, s.name])), [students]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(w0);
    d.setDate(d.getDate() + i);
    return d;
  });

  function openNew(date?: Date) {
    setError("");
    setForm({ student: students[0]?.student_id ?? "", date: todayISO(date ?? new Date()), time: "07:00", minutes: "60", note: "" });
  }

  async function save() {
    if (!form?.student) return setError("Escolha o aluno.");
    const starts = new Date(`${form.date}T${form.time}:00`);
    const row = { student_id: form.student, starts_at: starts.toISOString(), minutes: Math.max(15, Math.min(240, Number(form.minutes) || 60)), note: form.note.trim() || null };
    const { error: e } = form.id ? await supabase().from("appointments").update(row).eq("id", form.id) : await supabase().from("appointments").insert(row);
    if (e) return setError("Não consegui salvar.");
    pushNow();
    vibrate(10);
    setForm(null);
    load();
  }

  async function setStatus(a: Appointment, status: Appointment["status"]) {
    setAct(null);
    setList((l) => l?.map((x) => (x.id === a.id ? { ...x, status } : x)) ?? null);
    await supabase().from("appointments").update({ status }).eq("id", a.id);
    if (status === "cancelada") pushNow();
  }

  const shift = (n: number) => setW0((d) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n * 7);
    return x;
  });
  const label = `${days[0].getDate()}/${days[0].getMonth() + 1} a ${days[6].getDate()}/${days[6].getMonth() + 1}`;

  return (
    <>
      <PHeader
        title="Agenda"
        right={
          <button onClick={() => openNew()} aria-label="Marcar aula" className="press mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="plus" size={22} stroke={2.5} />
          </button>
        }
      />
      <PersonalNav />
      <div className="mx-5 mt-2 flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label="Semana anterior" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <Icon name="back" size={20} />
        </button>
        <span className="text-[16px] font-semibold">{label}</span>
        <button onClick={() => shift(1)} aria-label="Próxima semana" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <Icon name="chevron" size={20} />
        </button>
      </div>

      {!list ? (
        <Spinner />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={w0.toISOString()} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="mt-3 flex flex-col gap-3">
            {days.map((d) => {
              const iso = todayISO(d);
              const items = list.filter((a) => todayISO(new Date(a.starts_at)) === iso);
              const isToday = iso === todayISO();
              return (
                <div key={iso} className="mx-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-[14px] font-bold ${isToday ? "text-accent-ink" : "text-label-2"}`}>
                      {WEEKDAYS[d.getDay()]}, {d.getDate()}/{d.getMonth() + 1}
                      {isToday ? " · hoje" : ""}
                    </span>
                    <button onClick={() => openNew(d)} className="text-[13px] font-semibold text-accent-ink">+ aula</button>
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-sep px-4 py-2.5 text-[13px] text-label-3">Livre</div>
                  ) : (
                    <Card className="overflow-hidden">
                      {items.map((a) => (
                        <button key={a.id} onClick={() => setAct(a)} className={`press flex w-full items-center gap-3 border-b border-sep px-4 py-3 text-left last:border-b-0 ${a.status === "cancelada" ? "opacity-50" : ""}`}>
                          <span className="tabular w-12 text-[15px] font-bold">{hhmm(a.starts_at)}</span>
                          <Avatar id={a.student_id} name={names.get(a.student_id) ?? "?"} size={32} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className={`truncate text-[15px] font-semibold ${a.status === "cancelada" ? "line-through" : ""}`}>{names.get(a.student_id) ?? "Aluno"}</span>
                            <span className="truncate text-[12px] text-label-2">{a.minutes} min{a.note ? ` · ${a.note}` : ""}</span>
                          </span>
                          {a.status !== "marcada" && <Pill tone={a.status === "feita" ? "good" : "muted"}>{a.status}</Pill>}
                        </button>
                      ))}
                    </Card>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? "Remarcar aula" : "Marcar aula"}>
        {form && (
          <div className="flex flex-col gap-3 pt-1">
            <Field2 label="Aluno">
              <select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} className={inputCls} disabled={!!form.id}>
                {students.length === 0 && <option value="">Nenhum aluno ainda</option>}
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>{s.name}</option>
                ))}
              </select>
            </Field2>
            <div className="grid grid-cols-3 gap-2">
              <Field2 label="Dia">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </Field2>
              <Field2 label="Hora">
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={inputCls} />
              </Field2>
              <Field2 label="Minutos">
                <input inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, "") })} className={inputCls} />
              </Field2>
            </div>
            <Field2 label="Observação">
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 200) })} placeholder="Ex.: treino de pernas, trazer tênis" className={inputCls} />
            </Field2>
            {error && <p className="text-[14px] text-bad">{error}</p>}
            <Button size="lg" onClick={save}>{form.id ? "Salvar e avisar o aluno" : "Marcar e avisar o aluno"}</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!act} onClose={() => setAct(null)} title={act ? `${names.get(act.student_id) ?? "Aula"} · ${hhmm(act.starts_at)}` : ""}>
        {act && (
          <div className="flex flex-col gap-2 pt-1">
            {act.status !== "feita" && <Button size="lg" onClick={() => setStatus(act, "feita")}><Icon name="check" size={17} stroke={3} /> Aula feita</Button>}
            <Button size="lg" variant="secondary" className="!bg-card" onClick={() => {
              const d = new Date(act.starts_at);
              setAct(null);
              setForm({ id: act.id, student: act.student_id, date: todayISO(d), time: hhmm(act.starts_at), minutes: String(act.minutes), note: act.note ?? "" });
            }}>Remarcar</Button>
            {act.status !== "cancelada" && <Button size="lg" variant="danger" className="!bg-card" onClick={() => setStatus(act, "cancelada")}>Cancelar aula</Button>}
          </div>
        )}
      </Sheet>
    </>
  );
}
