"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { LineChart } from "@/components/LineChart";
import { ProLock } from "@/components/ProLock";
import { getSubscription } from "@/lib/data";
import { isPro } from "@/lib/pro";
import { Card, Empty, Header, Icon, LinkButton, SectionTitle, Segmented, Spinner, Stat } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { epley, fmtDate, num } from "@/lib/util";

type Row = { weight: number; reps: number; exercise_id: string; session_id: string; exercises: { name: string; muscle_group: string } };
type Ses = { id: string; title: string; started_at: string; finished_at: string };
type Period = "semana" | "mes" | "ano";
const DAYS: Record<Period, number> = { semana: 7, mes: 30, ano: 365 };

export default function EvolutionPage() {
  const [period, setPeriod] = useState<Period>("semana");
  const [sessions, setSessions] = useState<Ses[]>([]);
  const [sets, setSets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<string>("");
  const [pro, setPro] = useState(true);

  useEffect(() => {
    getSubscription().then((s) => setPro(isPro(s)));
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 730);
      const { data: ses } = await supabase().from("sessions").select("id,title,started_at,finished_at").not("finished_at", "is", null).gte("started_at", since.toISOString()).order("started_at");
      const list = (ses ?? []) as Ses[];
      setSessions(list);
      if (list.length) {
        const { data } = await supabase().from("session_sets").select("weight,reps,exercise_id,session_id,exercises(name,muscle_group)").eq("done", true).in("session_id", list.map((s) => s.id)).limit(10000);
        setSets((data ?? []) as unknown as Row[]);
      }
      setLoading(false);
    })();
  }, []);

  const sesDate = useMemo(() => new Map(sessions.map((s) => [s.id, s.started_at])), [sessions]);

  const stats = useMemo(() => {
    const now = Date.now();
    const span = DAYS[period] * 864e5;
    const inP = (iso: string, k = 0) => {
      const t = new Date(iso).getTime();
      return t > now - span * (k + 1) && t <= now - span * k;
    };
    const ses = sessions.filter((s) => inP(s.started_at));
    const prevSes = sessions.filter((s) => inP(s.started_at, 1));
    const vol = (ids: Set<string>) => sets.filter((r) => ids.has(r.session_id)).reduce((a, r) => a + Number(r.weight) * r.reps, 0);
    const v = vol(new Set(ses.map((s) => s.id)));
    const pv = vol(new Set(prevSes.map((s) => s.id)));
    const minutes = ses.length ? Math.round(ses.reduce((a, s) => a + (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()), 0) / ses.length / 60000) : 0;
    // recordes no período: melhor 1RM estimado do exercício superou tudo antes do período
    const start = now - span;
    const byEx = new Map<string, { before: number; during: number; name: string; when: string; w: number; r: number }>();
    for (const r of sets) {
      const t = new Date(sesDate.get(r.session_id) ?? 0).getTime();
      const e = epley(Number(r.weight), r.reps);
      const cur = byEx.get(r.exercise_id) ?? { before: 0, during: 0, name: r.exercises.name, when: "", w: 0, r: 0 };
      if (t < start) cur.before = Math.max(cur.before, e);
      else if (e > cur.during) Object.assign(cur, { during: e, when: sesDate.get(r.session_id)!, w: Number(r.weight), r: r.reps });
      byEx.set(r.exercise_id, cur);
    }
    const prs = [...byEx.values()].filter((x) => x.during > x.before && x.before > 0).sort((a, b) => b.when.localeCompare(a.when));
    return { count: ses.length, prevCount: prevSes.length, volume: v, volDelta: pv ? Math.round(((v - pv) / pv) * 100) : null, minutes, prs };
  }, [period, sessions, sets, sesDate]);

  const exerciseOptions = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    sets.forEach((r) => m.set(r.exercise_id, { name: r.exercises.name, n: (m.get(r.exercise_id)?.n ?? 0) + 1 }));
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [sets]);
  const exId = exercise || exerciseOptions[0]?.[0] || "";

  const series = useMemo(() => {
    const best = new Map<string, number>();
    sets.filter((r) => r.exercise_id === exId).forEach((r) => best.set(r.session_id, Math.max(best.get(r.session_id) ?? 0, epley(Number(r.weight), r.reps))));
    return [...best.entries()].map(([sid, v]) => ({ date: sesDate.get(sid)!, v })).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ x: fmtDate(p.date), y: Math.round(p.v * 10) / 10 }));
  }, [sets, exId, sesDate]);

  const muscles = useMemo(() => {
    const since = Date.now() - 7 * 864e5;
    const m = new Map<string, number>();
    sets.filter((r) => new Date(sesDate.get(r.session_id) ?? 0).getTime() > since).forEach((r) => m.set(r.exercises.muscle_group, (m.get(r.exercises.muscle_group) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [sets, sesDate]);

  return (
    <>
      <Header title="Evolução" />
      <div className="px-5 pt-2">
        <Segmented<Period> value={period} onChange={setPeriod} options={[{ value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }, { value: "ano", label: "Ano" }]} />
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <ProLock locked={!pro && period === "ano"} title="Evolução do ano inteiro" text="Veja volume, treinos e recordes dos últimos 12 meses com o Pro.">
          <motion.div key={period} initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="grid grid-cols-2 gap-3 px-5 pt-4">
            <Stat label="Volume" value={stats.volume >= 10000 ? num(stats.volume / 1000, 1) : num(stats.volume, 0)} unit={stats.volume >= 10000 ? "t" : "kg"} foot={stats.volDelta == null ? "Peso × repetições" : `${stats.volDelta >= 0 ? "+" : "−"}${Math.abs(stats.volDelta)}% vs. anterior`} footTone={stats.volDelta != null && stats.volDelta >= 0 ? "good" : "muted"} />
            <Stat label="Treinos" value={String(stats.count)} foot={`${stats.prevCount} no período anterior`} />
            <Stat label="Recordes" value={String(stats.prs.length)} foot="Novos neste período" footTone={stats.prs.length ? "good" : "muted"} />
            <Stat label="Tempo médio" value={stats.minutes ? String(stats.minutes) : "–"} unit="min" foot="Por treino" />
          </motion.div>
          </ProLock>

          <Link href="/medidas" className="press mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon name="ruler" size={22} />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold">Peso e medidas</span>
              <span className="text-[13px] text-label-2">Corpo, medidas e peso mês a mês</span>
            </div>
            <Icon name="chevron" size={18} className="text-label-3" />
          </Link>

          {sessions.length === 0 ? (
            <div className="pt-6">
              <Empty icon="chart" title="Sua evolução começa no primeiro treino" text="Conclua um treino e aqui aparecem volume, recordes e a curva de força de cada exercício." action={<LinkButton href="/" className="!h-11 !text-[16px]">Ir para hoje</LinkButton>} />
            </div>
          ) : (
            <>
              <div className="mx-5 mt-3">
              <ProLock locked={!pro} title="Gráfico de força" text="Acompanhe o 1RM estimado de cada exercício ao longo do tempo.">
              <Card className="flex flex-col gap-2 rounded-[20px] p-4">
                <span className="text-[13px] font-semibold text-label-2">1RM ESTIMADO</span>
                <select value={exId} onChange={(e) => setExercise(e.target.value)} aria-label="Exercício" className="-ml-1 bg-transparent text-[17px] font-semibold outline-none">
                  {exerciseOptions.map(([id, o]) => <option key={id} value={id}>{o.name}</option>)}
                </select>
                {series.length > 1 ? (
                  <LineChart key={exId} label="Evolução do 1RM estimado" points={series} format={(v) => `${num(v)} kg`} />
                ) : (
                  <p className="py-6 text-center text-[15px] text-label-2">Faça esse exercício mais uma vez para ver a curva.</p>
                )}
              </Card>
              </ProLock>
              </div>

              <SectionTitle>Recordes</SectionTitle>
              {stats.prs.length ? (
                <ul className="mx-5 overflow-hidden rounded-2xl bg-card">
                  {stats.prs.slice(0, 6).map((p) => (
                    <li key={p.name} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                        <Icon name="trophy" size={18} />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <span className="text-[16px] font-medium">{p.name}</span>
                        <span className="text-[13px] text-label-2">{fmtDate(p.when)}</span>
                      </div>
                      <span className="tabular text-[16px] font-semibold">{num(p.w)} kg × {p.r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 text-[15px] text-label-2">Nenhum recorde novo neste período. Bora!</p>
              )}

              <SectionTitle>Séries por músculo</SectionTitle>
              <Card className="mx-5 flex flex-col gap-3.5 p-4">
                <span className="-mt-1 text-[13px] text-label-2">Últimos 7 dias · faixa ideal de 10 a 20</span>
                {muscles.length === 0 && <span className="text-[15px] text-label-2">Nenhuma série nos últimos 7 dias.</span>}
                {muscles.map(([g, n], i) => (
                  <div key={g} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[14px]">
                      <span className="font-medium">{g}</span>
                      <span className={`tabular ${n < 10 ? "font-semibold text-bad" : "text-label-2"}`}>{n} séries{n < 10 ? " · abaixo do ideal" : ""}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-card-2">
                      <motion.div className={`h-full rounded-full ${n < 10 ? "bg-bad-fill" : "bg-accent"}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (n / 20) * 100)}%` }} transition={{ delay: i * 0.05, type: "spring", stiffness: 120, damping: 20 }} />
                    </div>
                  </div>
                ))}
              </Card>

              <SectionTitle>Últimos treinos</SectionTitle>
              <ul className="mx-5 overflow-hidden rounded-2xl bg-card">
                {[...sessions].reverse().slice(0, 8).map((s) => {
                  const ss = sets.filter((r) => r.session_id === s.id);
                  const vol = ss.reduce((a, r) => a + Number(r.weight) * r.reps, 0);
                  return (
                    <li key={s.id} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
                      <div className="flex flex-1 flex-col">
                        <span className="text-[16px] font-medium">{s.title}</span>
                        <span className="text-[13px] text-label-2">{fmtDate(s.started_at)} · {ss.length} séries · {Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min</span>
                      </div>
                      <span className="tabular text-[15px] font-semibold text-label-2">{num(vol, 0)} kg</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
