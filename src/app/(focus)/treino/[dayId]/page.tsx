"use client";

import { Tip } from "@/components/guide";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, Icon, Sheet, Spinner } from "@/components/ui";
import { checkInToday, lastSetsByExercise, type DayWithExercises } from "@/lib/data";
import { loadExercises } from "@/components/ExercisePicker";
import { ExerciseGuideSheet, type GuideExercise } from "@/components/ExerciseGuide";
import { alternativesFor } from "@/lib/plan-generator";
import { MODE_TEXT, PAIN_AREAS, dayMode, lighter, painFor, type PainArea, type Readiness } from "@/lib/readiness";
import { drawWorkoutCard, shareImage } from "@/lib/share-card";
import { Confetti, CountUp } from "@/components/motion";
import { METHODS, methodLabel } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import type { Exercise, SessionSet } from "@/lib/types";
import { epley, fmtDate, mmss, num, repRange, suggest, todayISO, vibrate } from "@/lib/util";

type SetRow = { id?: string; set_number: number; weight: string; reps: string; done: boolean };
type Block = { peId: string; exerciseId: string; name: string; equipment: string; group: string; reps: string; rest: number; notes: string | null; method?: string | null; prev: SessionSet[]; sug: ReturnType<typeof suggest>; sets: SetRow[]; plannedSets: number; pain: PainArea | null; later?: boolean };

type SessionMeta = { readiness: Readiness | null; swaps: Record<string, string>; skipped: string[]; later?: string[] };
const w2s = (w: number) => (w ? String(w).replace(".", ",") : "");

/** Aplica o "como você está hoje" nas séries que ainda não foram feitas */
function applyReadiness(blocks: Block[], r: Readiness | null): Block[] {
  const mode = dayMode(r);
  return blocks.map((b) => {
    const pain = painFor(r, b);
    if (mode !== "leve") return { ...b, pain };
    const target = Math.max(2, b.plannedSets - 1);
    let sets = [...b.sets];
    while (sets.length > target && !sets.at(-1)!.done && !sets.at(-1)!.id) sets = sets.slice(0, -1);
    sets = sets.map((x) => (x.done || x.id ? x : { ...x, weight: w2s(lighter(Number(x.weight.replace(",", ".")) || 0, b.equipment)) }));
    return { ...b, pain, sets, sug: b.sug ? { ...b.sug, up: false } : null };
  });
}

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
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [askReady, setAskReady] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [guide, setGuide] = useState<GuideExercise | null>(null);
  const creating = useRef(false);
  const meta = useRef<SessionMeta>({ readiness: null, swaps: {}, skipped: [] });

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
    const saved = (open?.readiness ?? {}) as SessionMeta;
    if (sid) {
      setStartedAt(new Date(open!.started_at).getTime());
      const { data: ss } = await supabase().from("session_sets").select("*").eq("session_id", sid);
      existing = (ss ?? []) as SessionSet[];
    } else {
      const { data: created } = await supabase().from("sessions").insert({ plan_day_id: dayId, title: d.title }).select().single();
      sid = created?.id;
      checkInToday();
      setAskReady(true);
    }
    setSessionId(sid ?? null);
    meta.current = { readiness: saved.readiness ?? null, swaps: saved.swaps ?? {}, skipped: saved.skipped ?? [], later: saved.later ?? [] };

    // exercícios trocados nesta sessão ("máquina ocupada")
    const swapIds = Object.values(meta.current.swaps);
    const swapped = new Map<string, Exercise>();
    if (swapIds.length) {
      const { data: exs } = await supabase().from("exercises").select("*").in("id", swapIds);
      (exs ?? []).forEach((e: Exercise) => swapped.set(e.id, e));
    }
    const pes = d.plan_exercises.filter((pe) => !meta.current.skipped.includes(pe.id));
    const exOf = (pe: (typeof pes)[number]) => swapped.get(meta.current.swaps[pe.id]) ?? pe.exercises;
    const last = await lastSetsByExercise(pes.map((pe) => exOf(pe).id));
    const built: Block[] = pes.map((pe) => {
      const ex = exOf(pe);
      const prev = last[ex.id] ?? [];
      const sug = suggest(prev, pe.reps, pe.sets, ex.equipment);
      const mine = existing.filter((s) => s.exercise_id === ex.id).sort((a, b) => a.set_number - b.set_number);
      const baseW = sug?.weight ?? (ex.id === pe.exercise_id ? pe.target_weight : null) ?? prev.at(-1)?.weight ?? 0;
      const baseR = sug?.reps ?? repRange(pe.reps)[0];
      const count = Math.max(pe.sets, mine.length);
      const sets: SetRow[] = Array.from({ length: count }, (_, i) => {
        const m = mine.find((x) => x.set_number === i + 1);
        return m ? { id: m.id, set_number: i + 1, weight: w2s(Number(m.weight)) || "0", reps: String(m.reps), done: m.done } : { set_number: i + 1, weight: w2s(baseW), reps: String(baseR || ""), done: false };
      });
      return { peId: pe.id, exerciseId: ex.id, name: ex.name, equipment: ex.equipment, group: ex.muscle_group, reps: pe.reps, rest: pe.rest_seconds, notes: pe.notes, method: pe.method ?? null, prev, sug, sets, plannedSets: pe.sets, pain: null };
    });
    // exercícios deixados "pra depois" (máquina ocupada) vão pro fim, na ordem em que foram adiados
    const later = meta.current.later ?? [];
    const ordered = [
      ...built.filter((b) => !later.includes(b.peId)),
      ...later.map((id) => built.find((b) => b.peId === id)).filter((b): b is Block => !!b).map((b) => ({ ...b, later: true })),
    ];
    setReadiness(meta.current.readiness);
    setBlocks(applyReadiness(ordered, meta.current.readiness));
  }, [dayId, router]);

  async function saveMeta(patch: Partial<SessionMeta>) {
    meta.current = { ...meta.current, ...patch };
    if (sessionId) await supabase().from("sessions").update({ readiness: meta.current }).eq("id", sessionId);
  }

  function startWith(r: Readiness | null) {
    setAskReady(false);
    setReadiness(r);
    setBlocks((bs) => applyReadiness(bs, r));
    saveMeta({ readiness: r });
    if (r) vibrate(12);
  }

  async function swapTo(bi: number, ex: Exercise, alsoPlan: boolean) {
    const b = blocks[bi];
    setSwapIdx(null);
    const last = await lastSetsByExercise([ex.id]);
    const prev = last[ex.id] ?? [];
    const sug0 = suggest(prev, b.reps, b.plannedSets, ex.equipment);
    const leve = dayMode(readiness) === "leve";
    const baseW0 = sug0?.weight ?? prev.at(-1)?.weight ?? 0;
    const baseW = leve ? lighter(baseW0, ex.equipment) : baseW0;
    const ids = b.sets.filter((x) => x.id).map((x) => x.id!);
    if (ids.length) await supabase().from("session_sets").update({ exercise_id: ex.id, weight: baseW }).in("id", ids);
    if (alsoPlan) await supabase().from("plan_exercises").update({ exercise_id: ex.id, target_weight: null }).eq("id", b.peId);
    setBlocks((bs) =>
      bs.map((x, i) =>
        i !== bi
          ? x
          : {
              ...x,
              exerciseId: ex.id,
              name: ex.name,
              equipment: ex.equipment,
              group: ex.muscle_group,
              prev,
              sug: sug0 && leve ? { ...sug0, up: false } : sug0,
              pain: painFor(readiness, { name: ex.name, group: ex.muscle_group }),
              sets: x.sets.map((r) => ({ ...r, weight: w2s(baseW) })),
            },
      ),
    );
    if (!alsoPlan) saveMeta({ swaps: { ...meta.current.swaps, [b.peId]: ex.id } });
    vibrate(12);
  }

  // máquina ocupada: manda o exercício pro fim do treino e faz quando liberar
  function doLater(bi: number) {
    const b = blocks[bi];
    if (!b) return;
    setSwapIdx(null);
    setBlocks((bs) => [...bs.filter((_, i) => i !== bi), { ...bs[bi], later: true }]);
    saveMeta({ later: [...(meta.current.later ?? []).filter((id) => id !== b.peId), b.peId] });
    vibrate(12);
  }

  async function skip(bi: number) {
    const b = blocks[bi];
    setSwapIdx(null);
    const ids = b.sets.filter((x) => x.id).map((x) => x.id!);
    if (ids.length) await supabase().from("session_sets").delete().in("id", ids);
    setBlocks((bs) => bs.filter((_, i) => i !== bi));
    saveMeta({ skipped: [...meta.current.skipped, b.peId] });
  }

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

  async function shareCard() {
    if (!summary || !day) return;
    setSharing(true);
    try {
      const exercises = blocks
        .map((b) => {
          const done = b.sets.filter((x) => x.done);
          if (!done.length) return null;
          const best = done.reduce((a, x) => (epley(Number(x.weight.replace(",", ".")) || 0, parseInt(x.reps) || 0) > epley(Number(a.weight.replace(",", ".")) || 0, parseInt(a.reps) || 0) ? x : a));
          return { name: b.name, best: `${done.length}× · ${best.weight || 0} kg × ${best.reps}` };
        })
        .filter((x) => x !== null);
      const blob = await drawWorkoutCard({ title: day.title, dateLabel: fmtDate(todayISO()), volumeKg: summary.volume, sets: summary.sets, minutes: summary.minutes, prs: summary.prs, exercises });
      await shareImage(blob, `carga-${todayISO()}.png`, summary.prs.length ? `Recorde no ${summary.prs[0]}! 🏆` : `Treino de hoje: ${day.title} ✅`);
    } finally {
      setSharing(false);
    }
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

      <Tip id="treino" className="pt-3 -mb-2">Ajuste a carga se precisar e toque no ✓ de cada série quando terminar. No fim, toque em Finalizar pra salvar.</Tip>
      <div className="flex flex-col gap-3 px-4 pt-4">
        {readiness && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-3 rounded-[18px] p-4 ${dayMode(readiness) === "leve" ? "bg-card" : dayMode(readiness) === "forte" ? "bg-good-soft" : "bg-card"}`} data-testid="modo-dia">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${dayMode(readiness) === "forte" ? "bg-good text-white" : "bg-accent-soft text-accent-ink"}`}>
              <Icon name={dayMode(readiness) === "leve" ? "heart" : dayMode(readiness) === "forte" ? "flame" : "check"} size={19} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{MODE_TEXT[dayMode(readiness)].title}</span>
              <span className="text-[14px] leading-snug text-label-2">{MODE_TEXT[dayMode(readiness)].text}</span>
            </div>
          </motion.div>
        )}
        {blocks.map((b, bi) => (
          <motion.section key={b.peId} layout className={`rounded-[20px] bg-card p-4 transition-shadow ${bi === currentIdx ? "ring-2 ring-accent/60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-label-2">
                  {b.group}
                  {b.later && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-accent-ink">Deixado pra depois</span>}
                </span>
                <h2 className="text-[20px] font-bold leading-tight">{b.name}</h2>
                {methodLabel(b.method) && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-label-2">
                    <span className="rounded-full bg-accent px-2 py-0.5 font-bold text-on-accent">{methodLabel(b.method)}</span>
                    {METHODS.find((m) => m.value === b.method)?.hint}
                  </span>
                )}
                <span className="text-[14px] text-label-2">Meta: {b.sets.length} × {b.reps}</span>
                <button onClick={() => setGuide({ name: b.name, muscle_group: b.group, equipment: b.equipment })} className="mt-1 flex items-center gap-1 self-start text-[14px] font-semibold text-accent-ink">
                  <Icon name="play" size={12} /> Como fazer
                </button>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {b.equipment === "Barra" && (
                  <button onClick={() => setPlates(Number(b.sets.find((s) => !s.done)?.weight.replace(",", ".") || b.sets[0].weight.replace(",", ".")) || 20)} className="press h-8 shrink-0 rounded-full bg-card-2 px-3 text-[13px] font-semibold text-accent-ink">
                    Anilhas
                  </button>
                )}
                {!b.sets.some((x) => x.done) && (
                  <button onClick={() => setSwapIdx(bi)} aria-label={`Trocar ${b.name}`} className="press flex h-8 shrink-0 items-center gap-1 rounded-full bg-card-2 px-3 text-[13px] font-semibold text-accent-ink">
                    <Icon name="swap" size={14} /> Trocar
                  </button>
                )}
              </div>
            </div>

            {b.pain && (
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] px-3 py-2.5 text-[14px] leading-snug">
                <Icon name="help" size={18} className="mt-px shrink-0 text-bad" />
                <span>
                  Você marcou dor em <b>{b.pain.toLowerCase()}</b>. Se incomodar, use menos carga,{" "}
                  {!b.sets.some((x) => x.done) ? (
                    <button onClick={() => setSwapIdx(bi)} className="font-semibold text-accent-ink underline">
                      troque ou pule
                    </button>
                  ) : (
                    "ou pule"
                  )}
                  . Dor forte ou que não passa: procure um profissional.
                </span>
              </div>
            )}

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

      <ReadinessSheet open={askReady} onDone={startWith} />
      <ExerciseGuideSheet exercise={guide} onClose={() => setGuide(null)} />

      <SwapSheet
        block={swapIdx != null ? blocks[swapIdx] : null}
        exclude={blocks.map((x) => x.exerciseId)}
        onClose={() => setSwapIdx(null)}
        onPick={(ex, alsoPlan) => swapIdx != null && swapTo(swapIdx, ex, alsoPlan)}
        onSkip={() => swapIdx != null && skip(swapIdx)}
        onLater={() => swapIdx != null && doLater(swapIdx)}
      />

      <Confetti active={!!summary} count={summary?.prs.length ? 110 : 70} />
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
                {(
                  [
                    ["Volume", summary.volume / 1000, (v: number) => `${num(v, 1)} t`],
                    ["Séries", summary.sets, (v: number) => String(Math.round(v))],
                    ["Tempo", summary.minutes, (v: number) => `${Math.round(v)} min`],
                  ] as const
                ).map(([l, v, f], i) => (
                  <motion.div key={l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 380, damping: 26 }} className="rounded-xl bg-card-2 py-3">
                    <div className="text-[12px] font-semibold text-label-2">{l}</div>
                    <CountUp value={v} format={f} duration={1.1} className="text-[20px] font-bold" />
                  </motion.div>
                ))}
              </div>
              {summary.prs.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: [0.8, 1.06, 1] }} transition={{ delay: 0.6, duration: 0.5 }} className="mt-4 rounded-xl bg-good-soft p-3 text-left text-[14px] text-good">
                  <b>Novo recorde!</b> {summary.prs.join(", ")}
                </motion.div>
              )}
              <Button size="lg" className="mt-5 w-full" onClick={() => router.replace(`/feed/novo?sessao=${sessionId}${summary.prs.length ? `&prs=${encodeURIComponent(summary.prs.join("|"))}` : ""}`)}>
                <Icon name="feed" size={18} /> Postar no feed
              </Button>
              <Button size="lg" variant="secondary" className="mt-2 w-full" disabled={sharing} onClick={shareCard}>
                <Icon name="send" size={18} /> {sharing ? "Gerando imagem…" : "Postar no story"}
              </Button>
              <Button size="lg" variant="plain" className="mt-1 w-full" onClick={() => router.replace("/")}>
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-semibold">{label}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`press h-11 rounded-xl text-[15px] font-semibold ${value === o.value ? "bg-accent text-on-accent" : "bg-card text-label"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadinessSheet({ open, onDone }: { open: boolean; onDone: (r: Readiness | null) => void }) {
  const [sono, setSono] = useState<0 | 1 | 2 | null>(null);
  const [energia, setEnergia] = useState<0 | 1 | 2 | null>(null);
  const [dor, setDor] = useState<PainArea[] | null>(null);
  const ready = sono != null && energia != null && dor != null;
  return (
    <Sheet open={open} onClose={() => onDone(null)} title="Como você está hoje?">
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-[14px] leading-snug text-label-2">Três toques e eu ajusto o treino de hoje pra você.</p>
        <Choice label="Sono" value={sono} onChange={setSono} options={[{ value: 0, label: "Dormi mal" }, { value: 1, label: "Ok" }, { value: 2, label: "Dormi bem" }]} />
        <Choice label="Energia" value={energia} onChange={setEnergia} options={[{ value: 0, label: "Baixa" }, { value: 1, label: "Normal" }, { value: 2, label: "Alta" }]} />
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Alguma dor ou desconforto?</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setDor([])} aria-pressed={dor?.length === 0} className={`press h-9 rounded-full px-3.5 text-[14px] font-semibold ${dor?.length === 0 ? "bg-accent text-on-accent" : "bg-card"}`}>
              Nenhuma
            </button>
            {PAIN_AREAS.map((a) => {
              const on = !!dor?.includes(a);
              return (
                <button key={a} aria-pressed={on} onClick={() => setDor((d) => (on ? (d ?? []).filter((x) => x !== a) : [...(d ?? []), a]))} className={`press h-9 rounded-full px-3.5 text-[14px] font-semibold ${on ? "bg-accent text-on-accent" : "bg-card"}`}>
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <Button size="lg" disabled={!ready} onClick={() => ready && onDone({ sono: sono!, energia: energia!, dor: dor! })}>
          Começar treino
        </Button>
        <Button variant="plain" onClick={() => onDone(null)}>Pular</Button>
      </div>
    </Sheet>
  );
}

function SwapSheet({ block, exclude, onClose, onPick, onSkip, onLater }: { block: Block | null; exclude: string[]; onClose: () => void; onPick: (ex: Exercise, alsoPlan: boolean) => void; onSkip: () => void; onLater: () => void }) {
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [alsoPlan, setAlsoPlan] = useState(false);
  useEffect(() => {
    if (!block) return;
    setAlsoPlan(false);
    loadExercises().then((l) => setCatalog(l as Exercise[]));
  }, [block]);
  const options = block && catalog ? alternativesFor({ id: block.exerciseId, muscle_group: block.group }, catalog, exclude).slice(0, 12) : [];
  return (
    <Sheet open={!!block} onClose={onClose} title="Máquina ocupada?">
      {block && (
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[14px] leading-snug text-label-2">
            Troque <b className="text-label">{block.name}</b> por outro de {block.group.toLowerCase()}. A carga sugerida vem do seu histórico no exercício novo.
          </p>
          {!catalog ? (
            <Spinner />
          ) : options.length === 0 ? (
            <p className="py-4 text-center text-[15px] text-label-2">Nenhum exercício equivalente na biblioteca.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-card">
              {options.map((ex) => (
                <button key={ex.id} onClick={() => onPick(ex, alsoPlan)} className="press flex w-full items-center gap-3 border-b border-sep px-4 py-3 text-left last:border-0">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-medium">{ex.name}</span>
                    <span className="text-[13px] text-label-2">{ex.equipment}</span>
                  </div>
                  <Icon name="swap" size={17} className="text-accent-ink" />
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
            <span className="text-[15px]">Trocar também na minha semana</span>
            <input type="checkbox" checked={alsoPlan} onChange={(e) => setAlsoPlan(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          </label>
          <Button variant="secondary" size="lg" onClick={onLater}>
            Fazer depois: vai pro fim do treino
          </Button>
          <Button variant="danger" size="lg" onClick={onSkip}>
            Pular este exercício hoje
          </Button>
        </div>
      )}
    </Sheet>
  );
}
