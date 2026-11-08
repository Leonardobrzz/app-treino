"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, Icon, Sheet, Spinner } from "@/components/ui";
import { checkInToday, lastSetsByExercise, type DayWithExercises } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import type { SessionSet } from "@/lib/types";
import { epley, mmss, num, repRange, suggest, todayISO, vibrate } from "@/lib/util";

type SetRow = { id?: string; set_number: number; weight: string; reps: string; done: boolean };
type Block = { peId: string; exerciseId: string; name: string; equipment: string; group: string; reps: string; rest: number; notes: string | null; prev: SessionSet[]; sug: ReturnType<typeof suggest>; sets: SetRow[] };

export default function LiveWorkout() {
  const { dayId } = useParams<{ dayId: string }>();
  const router = useRouter();
  const [day, setDay] = useState<DayWithExercises | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [plates, setPlates] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ volume: number; sets: number; minutes: number; prs: string[] } | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const creating = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const init = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    const { data } = await supabase().from("plan_days").select("*, plan_exercises(*, exercises(*))").eq("id", dayId).maybeSingle();
    if (!data) return router.replace("/");
    const d = data as DayWithExercises;
    d.plan_exercises.sort((a, b) => a.position - b.position);
    setDay(d);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: open } = await supabase().from("sessions").select("*").eq("plan_day_id", dayId).is("finished_at", null).gte("started_at", since.toISOString()).order("started_at", { ascending: false }).limit(1).maybeSingle();
    let sid = open?.id as string | undefined;
    let existing: SessionSet[] = [];
    if (sid) {
      setStartedAt(new Date(open!.started_at).getTime());
      const { data: ss } = await supabase().from("session_sets").select("*").eq("session_id", sid);
      existing = (ss ?? []) as SessionSet[];
    } else {
      const { data: created } = await supabase().from("sessions").insert({ plan_day_id: dayId, title: d.title }).select().single();
      sid = created?.id;
      checkInToday();
    }
    setSessionId(sid ?? null);

    const last = await lastSetsByExercise(d.plan_exercises.map((p) => p.exercise_id));
    setBlocks(
      d.plan_exercises.map((pe) => {
        const prev = last[pe.exercise_id] ?? [];
        const sug = suggest(prev, pe.reps, pe.sets, pe.exercises.equipment);
        const mine = existing.filter((s) => s.exercise_id === pe.exercise_id).sort((a, b) => a.set_number - b.set_number);
        const baseW = sug?.weight ?? pe.target_weight ?? prev.at(-1)?.weight ?? 0;
        const baseR = sug?.reps ?? repRange(pe.reps)[0];
        const count = Math.max(pe.sets, mine.length);
        const sets: SetRow[] = Array.from({ length: count }, (_, i) => {
          const m = mine.find((s) => s.set_number === i + 1);
          return m
            ? { id: m.id, set_number: i + 1, weight: String(m.weight).replace(".", ","), reps: String(m.reps), done: m.done }
            : { set_number: i + 1, weight: baseW ? String(baseW).replace(".", ",") : "", reps: String(baseR || ""), done: false };
        });
        return { peId: pe.id, exerciseId: pe.exercise_id, name: pe.exercises.name, equipment: pe.exercises.equipment, group: pe.exercises.muscle_group, reps: pe.reps, rest: pe.rest_seconds, notes: pe.notes, prev, sug, sets };
      }),
    );
  }, [dayId, router]);

  useEffect(() => {
    init();
  }, [init]);

  const restLeft = rest ? Math.max(0, (rest.end - now) / 1000) : 0;
  const restDone = useRef(false);
  useEffect(() => {
    if (rest && restLeft <= 0 && !restDone.current) {
      restDone.current = true;
      vibrate([200, 100, 200]);
      const t = setTimeout(() => setRest(null), 1200);
      return () => clearTimeout(t);
    }
  }, [rest, restLeft]);

  async function persist(bi: number, si: number, row: SetRow) {
    if (!sessionId) return;
    const b = blocks[bi];
    const payload = { session_id: sessionId, exercise_id: b.exerciseId, set_number: row.set_number, weight: Number(row.weight.replace(",", ".")) || 0, reps: parseInt(row.reps) || 0, done: row.done };
    if (row.id) await supabase().from("session_sets").update(payload).eq("id", row.id);
    else {
      const { data } = await supabase().from("session_sets").insert(payload).select("id").single();
      if (data) setBlocks((bs) => bs.map((x, i) => (i !== bi ? x : { ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, id: data.id } : s)) })));
    }
  }

  function update(bi: number, si: number, patch: Partial<SetRow>) {
    setBlocks((bs) => bs.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));
  }

  function toggle(bi: number, si: number) {
    const row = { ...blocks[bi].sets[si] };
    row.done = !row.done;
    update(bi, si, { done: row.done });
    persist(bi, si, row);
    if (row.done) {
      vibrate(15);
      restDone.current = false;
      setRest({ end: Date.now() + blocks[bi].rest * 1000, total: blocks[bi].rest });
    }
  }

  function addSet(bi: number) {
    setBlocks((bs) =>
      bs.map((b, i) => {
        if (i !== bi) return b;
        const lastRow = b.sets.at(-1);
        return { ...b, sets: [...b.sets, { set_number: b.sets.length + 1, weight: lastRow?.weight ?? "", reps: lastRow?.reps ?? "", done: false }] };
      }),
    );
  }

  const totalSets = blocks.reduce((s, b) => s + b.sets.length, 0);
  const doneSets = blocks.reduce((s, b) => s + b.sets.filter((x) => x.done).length, 0);
  const currentIdx = blocks.findIndex((b) => b.sets.some((s) => !s.done));

  async function finish() {
    if (!sessionId) return;
    let volume = 0;
    const prs: string[] = [];
    const exIds = blocks.map((b) => b.exerciseId);
    const { data: hist } = await supabase().from("session_sets").select("exercise_id, weight, reps, session_id").in("exercise_id", exIds).eq("done", true).neq("session_id", sessionId).limit(2000);
    for (const b of blocks) {
      const done = b.sets.filter((s) => s.done);
      let best = 0;
      for (const s of done) {
        const w = Number(s.weight.replace(",", ".")) || 0;
        const r = parseInt(s.reps) || 0;
        volume += w * r;
        best = Math.max(best, epley(w, r));
      }
      const prevBest = Math.max(0, ...(hist ?? []).filter((h) => h.exercise_id === b.exerciseId).map((h) => epley(Number(h.weight), h.reps)));
      if (best > 0 && prevBest > 0 && best > prevBest) prs.push(b.name);
    }
    await supabase().from("sessions").update({ finished_at: new Date().toISOString() }).eq("id", sessionId);
    vibrate([30, 60, 30, 60, 80]);
    setSummary({ volume, sets: doneSets, minutes: Math.round((Date.now() - startedAt) / 60000), prs });
  }

  async function discard() {
    if (sessionId) await supabase().from("sessions").delete().eq("id", sessionId);
    await supabase().from("checkins").delete().eq("checked_on", todayISO());
    router.replace("/");
  }

  const plateList = useMemo(() => {
    if (plates == null) return [];
    let side = (plates - 20) / 2;
    const out: number[] = [];
    for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) {
      while (side >= p - 1e-9) {
        out.push(p);
        side -= p;
      }
    }
    return out;
  }, [plates]);

  if (!day || !blocks.length)
    return day && !day.plan_exercises.length ? (
      <div className="safe-top px-5 pt-10 text-center">
        <p className="text-[17px]">Esse treino ainda não tem exercícios.</p>
        <Link href={`/treinos/${day.id}`} className="mt-3 inline-block text-[17px] font-semibold text-accent-ink">Adicionar exercícios</Link>
      </div>
    ) : (
      <Spinner />
    );

  return (
    <>
      <div className="safe-top sticky top-0 z-30 border-b border-sep bg-[var(--tabbar)] px-5 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button onClick={() => setConfirmQuit(true)} className="press h-11 text-[17px] text-accent-ink">Sair</button>
          <div className="flex flex-col items-center">
            <span className="text-[17px] font-semibold">{day.title}</span>
            <span className="tabular text-[13px] text-label-2">{mmss((now - startedAt) / 1000)}</span>
          </div>
          <button onClick={finish} className="press h-9 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent">Finalizar</button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuenow={doneSets} aria-valuemax={totalSets} aria-label="Séries concluídas">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {blocks.map((b, bi) => (
          <motion.section key={b.peId} layout className={`rounded-[20px] bg-card p-4 transition-shadow ${bi === currentIdx ? "ring-2 ring-accent/60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{b.group}</span>
                <h2 className="text-[20px] font-bold leading-tight">{b.name}</h2>
                <span className="text-[14px] text-label-2">Meta: {b.sets.length} × {b.reps}</span>
              </div>
              {b.equipment === "Barra" && (
                <button onClick={() => setPlates(Number(b.sets.find((s) => !s.done)?.weight.replace(",", ".") || b.sets[0].weight.replace(",", ".")) || 20)} className="press h-8 shrink-0 rounded-full bg-card-2 px-3 text-[13px] font-semibold text-accent-ink">
                  Anilhas
                </button>
              )}
            </div>

            {b.notes && (
              <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-card-2 px-3 py-2 text-[14px] text-label-2">
                <Icon name="edit" size={14} /> {b.notes}
              </div>
            )}
            {b.sug?.up && (
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-good-soft px-3 py-2.5 text-[14px] leading-snug text-good">
                <Icon name="chart" size={18} className="mt-px shrink-0" />
                <span>
                  <b>Sugestão: {num(b.sug.weight)} kg.</b> {b.sug.reason}
                </span>
              </div>
            )}

            <div className="mt-3 grid grid-cols-[36px_minmax(0,1fr)_72px_60px_48px] gap-2 px-0.5 text-[11px] font-semibold uppercase text-label-2">
              <span className="text-center">Série</span>
              <span>Anterior</span>
              <span className="text-center">kg</span>
              <span className="text-center">Reps</span>
              <span />
            </div>
            <div className="flex flex-col gap-1">
              {b.sets.map((s, si) => {
                const p = b.prev[si];
                return (
                  <motion.div key={si} layout className={`grid grid-cols-[36px_minmax(0,1fr)_72px_60px_48px] items-center gap-2 rounded-xl py-1 transition-colors ${s.done ? "bg-accent-soft" : ""}`}>
                    <span className="text-center text-[15px] font-bold">{s.set_number}</span>
                    <span className="tabular truncate text-[14px] text-label-2">{p ? `${num(p.weight)} × ${p.reps}` : "–"}</span>
                    <input inputMode="decimal" aria-label={`Carga da série ${s.set_number}`} value={s.weight} onChange={(e) => update(bi, si, { weight: e.target.value })} onBlur={() => s.id && persist(bi, si, b.sets[si])} className={`tabular h-10 rounded-[10px] text-center text-[17px] font-semibold outline-none focus:ring-2 focus:ring-accent ${s.done ? "bg-transparent" : "bg-card-2"}`} />
                    <input inputMode="numeric" aria-label={`Repetições da série ${s.set_number}`} value={s.reps} onChange={(e) => update(bi, si, { reps: e.target.value })} onBlur={() => s.id && persist(bi, si, b.sets[si])} className={`tabular h-10 rounded-[10px] text-center text-[17px] font-semibold outline-none focus:ring-2 focus:ring-accent ${s.done ? "bg-transparent" : "bg-card-2"}`} />
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggle(bi, si)} aria-label={s.done ? `Desmarcar série ${s.set_number}` : `Concluir série ${s.set_number}`} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${s.done ? "bg-accent text-on-accent" : "bg-fill text-label-3"}`}>
                      <Icon name="check" size={18} stroke={3} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
            <button onClick={() => addSet(bi)} className="press mt-2 h-10 w-full rounded-[10px] bg-card-2 text-[15px] font-semibold text-accent-ink">
              + Série
            </button>
          </motion.section>
        ))}
      </div>

      <AnimatePresence>
        {rest && (
          <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4">
            <div className="mx-auto flex max-w-[500px] items-center gap-4 rounded-[22px] bg-[#1c1c1e] p-4 text-white shadow-2xl">
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#3a3a3c" strokeWidth="6" />
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - restLeft / rest.total)} style={{ transition: "stroke-dashoffset 500ms linear" }} />
                </svg>
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[12px] font-semibold text-[#aeaeb2]">{restLeft > 0 ? "DESCANSO" : "BORA!"}</span>
                <span className="tabular text-[32px] font-bold leading-none">{mmss(restLeft)}</span>
              </div>
              <button onClick={() => setRest((r) => r && { ...r, end: r.end - 15000 })} aria-label="Menos 15 segundos" className="press h-11 w-12 rounded-xl bg-[#3a3a3c] text-[14px] font-semibold">−15</button>
              <button onClick={() => setRest((r) => r && { end: r.end + 15000, total: r.total + 15 })} aria-label="Mais 15 segundos" className="press h-11 w-12 rounded-xl bg-[#3a3a3c] text-[14px] font-semibold">+15</button>
              <button onClick={() => setRest(null)} aria-label="Pular descanso" className="press flex h-11 w-11 items-center justify-center rounded-xl bg-[#3a3a3c]">
                <Icon name="close" size={16} stroke={2.5} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={plates != null} onClose={() => setPlates(null)} title="Calculadora de anilhas">
        <div className="flex flex-col gap-4 pt-2">
          <label className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
            <span className="text-[15px] text-label-2">Carga total</span>
            <input inputMode="decimal" value={plates == null ? "" : String(plates).replace(".", ",")} onChange={(e) => setPlates(Number(e.target.value.replace(",", ".")) || 0)} className="tabular w-24 bg-transparent text-right text-[22px] font-bold outline-none" aria-label="Carga total em kg" />
          </label>
          <p className="text-[15px] text-label-2">Barra olímpica de 20 kg. Em cada lado:</p>
          <div className="flex min-h-[120px] items-center justify-center gap-1 rounded-2xl bg-card p-4">
            <div className="h-3 w-10 rounded-l bg-label-3" />
            {plateList.map((p, i) => (
              <motion.div key={i} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 500, damping: 24 }} className="flex items-center justify-center rounded-md bg-accent text-[10px] font-bold text-on-accent" style={{ height: 30 + p * 3.2, width: p >= 10 ? 18 : 14 }}>
                <span className="-rotate-90">{num(p, 2)}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-[17px] font-semibold">{plateList.length ? plateList.map((p) => num(p, 2)).join(" + ") + " kg por lado" : "Só a barra"}</p>
        </div>
      </Sheet>

      <Sheet open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Sair do treino?">
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-[15px] text-label-2">O que já foi marcado fica salvo e você pode continuar depois, hoje mesmo.</p>
          <Button size="lg" onClick={() => router.push("/")}>Continuar depois</Button>
          <Button size="lg" variant="danger" onClick={discard}>Descartar treino</Button>
        </div>
      </Sheet>

      <AnimatePresence>
        {summary && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div initial={{ scale: 0.8, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="w-full max-w-[380px] rounded-[28px] bg-card p-6 text-center">
              <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 14 }} className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-on-accent">
                <Icon name="trophy" size={34} />
              </motion.div>
              <h2 className="text-[26px] font-bold">Treino concluído</h2>
              <p className="text-[15px] text-label-2">{day.title}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["Volume", `${num(summary.volume / 1000, 1)} t`],
                  ["Séries", String(summary.sets)],
                  ["Tempo", `${summary.minutes} min`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-card-2 py-3">
                    <div className="text-[12px] font-semibold text-label-2">{l}</div>
                    <div className="tabular text-[20px] font-bold">{v}</div>
                  </div>
                ))}
              </div>
              {summary.prs.length > 0 && (
                <div className="mt-4 rounded-xl bg-good-soft p-3 text-left text-[14px] text-good">
                  <b>Novo recorde!</b> {summary.prs.join(", ")}
                </div>
              )}
              <Button size="lg" className="mt-5 w-full" onClick={() => router.replace("/")}>
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
