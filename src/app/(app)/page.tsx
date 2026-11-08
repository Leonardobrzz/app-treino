"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Card, Empty, Icon, LinkButton, SectionTitle, Spinner } from "@/components/ui";
import { checkInToday, getActivePlan, getProfile, lastSetsByExercise, type ActivePlan } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import type { Profile, SessionSet } from "@/lib/types";
import { computeTargets } from "@/lib/nutrition";
import { WEEKDAYS, WEEKDAYS_LETTER, longToday, num, suggest, todayISO, vibrate, weekStart, weekStreak } from "@/lib/util";

export default function TodayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [last, setLast] = useState<Record<string, SessionSet[]>>({});
  const [dateLabel, setDateLabel] = useState("");
  const [food, setFood] = useState<{ kcal: number; water: number; weight: number | null }>({ kcal: 0, water: 0, weight: null });

  useEffect(() => {
    setDateLabel(longToday());
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7 * 60);
      const [p, pl, ses, ci, ml, wa, bw] = await Promise.all([
        getProfile(),
        getActivePlan(),
        supabase().from("sessions").select("started_at").not("finished_at", "is", null).gte("started_at", since.toISOString()),
        supabase().from("checkins").select("checked_on").gte("checked_on", todayISO(weekStart(new Date()))),
        supabase().from("meals").select("kcal").eq("eaten_on", todayISO()),
        supabase().from("water_logs").select("ml").eq("logged_on", todayISO()),
        supabase().from("body_weights").select("weight").order("measured_on", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (p && !p.onboarded_at) {
        router.replace("/bem-vindo");
        return;
      }
      setProfile(p);
      setPlan(pl);
      setSessionDates((ses.data ?? []).map((s: { started_at: string }) => s.started_at));
      setCheckins((ci.data ?? []).map((c: { checked_on: string }) => c.checked_on));
      setFood({
        kcal: (ml.data ?? []).reduce((a: number, m: { kcal: number }) => a + Number(m.kcal), 0),
        water: (wa.data ?? []).reduce((a: number, w: { ml: number }) => a + w.ml, 0),
        weight: bw.data?.weight ?? null,
      });
      const today = pl?.plan_days.find((d) => d.weekday === new Date().getDay());
      if (today) setLast(await lastSetsByExercise(today.plan_exercises.map((e) => e.exercise_id)));
      setLoading(false);
    })();
  }, []);

  const goal = profile?.weekly_goal ?? 4;
  const weekDays = useMemo(() => {
    const start = weekStart(new Date());
    const trained = new Set(sessionDates.map((d) => todayISO(new Date(d))));
    checkins.forEach((c) => trained.add(c));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = todayISO(d);
      return { i, date: d.getDate(), done: trained.has(iso), today: iso === todayISO(), planned: !!plan?.plan_days.some((p) => p.weekday === i) };
    });
  }, [sessionDates, checkins, plan]);

  const doneThisWeek = weekDays.filter((d) => d.done).length;
  const streak = weekStreak([...sessionDates, ...checkins.map((c) => c + "T12:00:00")], goal);
  const todayDay = plan?.plan_days.find((d) => d.weekday === new Date().getDay());
  const nextDay = plan?.plan_days.find((d) => d.weekday > new Date().getDay()) ?? plan?.plan_days[0];
  const checkedToday = checkins.includes(todayISO());
  const nt = computeTargets(profile, food.weight);

  const suggestions = (todayDay?.plan_exercises ?? [])
    .map((pe) => ({ pe, s: suggest(last[pe.exercise_id] ?? [], pe.reps, pe.sets, pe.exercises.equipment) }))
    .filter((x) => x.s?.up);

  async function doCheckIn() {
    vibrate([10, 40, 10]);
    setCheckins((c) => [...c, todayISO()]);
    await checkInToday();
  }

  return (
    <>
      <header className="safe-top flex items-end justify-between px-5 pb-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold tracking-wide text-label-2">{dateLabel || "\u00a0"}</span>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">{profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Hoje"}</h1>
        </div>
        <Link href="/perfil" aria-label="Perfil" className="press flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-[16px] font-semibold text-accent-ink">
          {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-5 pt-3">
            <Card className="flex flex-col gap-1.5 px-4 py-3.5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink">
                <Icon name="flame" size={18} />
                Sequência
              </span>
              <span className="tabular text-[28px] font-bold tracking-[-0.4px]">
                {streak} <span className="text-[15px] font-medium text-label-2">{streak === 1 ? "semana" : "semanas"}</span>
              </span>
            </Card>
            <Card className="flex flex-col gap-1.5 px-4 py-3.5">
              <span className="text-[13px] font-semibold text-label-2">Meta da semana</span>
              <span className="tabular text-[28px] font-bold tracking-[-0.4px]">
                {doneThisWeek}
                <span className="text-[15px] font-medium text-label-2"> de {goal}</span>
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (doneThisWeek / goal) * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 }} />
              </div>
            </Card>
          </div>

          <Card className="mx-5 mt-3 flex justify-between px-3 py-3.5">
            {weekDays.map((d) => (
              <div key={d.i} className="flex w-10 flex-col items-center gap-2">
                <span className="text-[12px] font-medium text-label-2">{WEEKDAYS_LETTER[d.i]}</span>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: d.i * 0.04, type: "spring", stiffness: 500, damping: 25 }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold ${d.done ? "bg-accent text-on-accent" : d.today ? "text-accent-ink ring-2 ring-accent" : "bg-card-2 text-label-3"}`}
                >
                  {d.done ? <Icon name="check" size={16} stroke={3} /> : d.date}
                </motion.div>
              </div>
            ))}
          </Card>

          <SectionTitle action={<Link href="/treinos" className="text-[15px] text-accent-ink">Minha semana</Link>}>Treino de hoje</SectionTitle>

          {!plan || plan.plan_days.length === 0 ? (
            <Empty
              icon="calendar"
              title="Monte sua semana"
              text="Escolha os dias e os exercícios, ou peça para a IA montar em segundos."
              action={
                <div className="flex gap-2">
                  <LinkButton href="/treinos" className="!h-11 !text-[16px]">Montar</LinkButton>
                  <Link href="/ia" className="press inline-flex h-11 items-center gap-1.5 rounded-[14px] bg-card-2 px-4 text-[16px] font-semibold text-accent-ink">
                    <Icon name="spark" size={18} /> Pedir à IA
                  </Link>
                </div>
              }
            />
          ) : todayDay ? (
            <Card className="mx-5 flex flex-col gap-4 rounded-[20px] p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-accent-ink">{WEEKDAYS[todayDay.weekday]}</span>
                  <span className="text-[28px] font-bold leading-tight tracking-[-0.4px]">{todayDay.title}</span>
                  <span className="text-[15px] text-label-2">
                    {todayDay.plan_exercises.length} exercícios · cerca de {Math.max(20, Math.round(todayDay.plan_exercises.reduce((s, e) => s + e.sets * (40 + e.rest_seconds), 0) / 60))} min
                  </span>
                </div>
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-soft text-accent-ink">
                  <Icon name="dumbbell" size={26} />
                </div>
              </div>
              <ul className="flex flex-col">
                {todayDay.plan_exercises.slice(0, 5).map((pe, i) => {
                  const s = suggest(last[pe.exercise_id] ?? [], pe.reps, pe.sets, pe.exercises.equipment);
                  return (
                    <li key={pe.id} className="flex items-center gap-3 border-t border-sep py-2.5">
                      <span className="tabular w-5 text-[15px] font-semibold text-label-3">{i + 1}</span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[16px] font-medium">{pe.exercises.name}</span>
                        <span className="text-[13px] text-label-2">
                          {pe.sets} × {pe.reps}
                          {s ? ` · ${num(s.weight)} kg` : pe.target_weight ? ` · ${num(pe.target_weight)} kg` : ""}
                        </span>
                      </div>
                      {s?.up && <span className="rounded-lg bg-good-soft px-2 py-1 text-[13px] font-semibold text-good">+{num(s.weight - Math.max(...(last[pe.exercise_id] ?? []).map((x) => x.weight)))} kg</span>}
                    </li>
                  );
                })}
                {todayDay.plan_exercises.length > 5 && <li className="border-t border-sep pt-2.5 text-[15px] text-label-2">+ {todayDay.plan_exercises.length - 5} exercícios</li>}
              </ul>
              <LinkButton href={`/treino/${todayDay.id}`}>
                <Icon name="play" size={18} /> Iniciar treino
              </LinkButton>
            </Card>
          ) : (
            <Card className="mx-5 flex flex-col gap-1 rounded-[20px] p-5">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-label-2">Dia de descanso</span>
              <span className="text-[22px] font-bold">Recuperar também é treino</span>
              {nextDay && (
                <span className="text-[15px] text-label-2">
                  Próximo: <b className="text-label">{nextDay.title}</b> na {WEEKDAYS[nextDay.weekday].toLowerCase()}.
                </span>
              )}
              {nextDay && (
                <Link href={`/treino/${nextDay.id}`} className="mt-2 text-[15px] font-semibold text-accent-ink">
                  Treinar {nextDay.title} hoje mesmo
                </Link>
              )}
            </Card>
          )}

          {suggestions.length > 0 && (
            <Card className="mx-5 mt-4 flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-good-soft text-good">
                <Icon name="chart" size={20} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">Hora de subir a carga</span>
                {suggestions.slice(0, 2).map(({ pe, s }) => (
                  <span key={pe.id} className="text-[15px] leading-snug text-label-2">
                    {pe.exercises.name}: {s!.reason} Sugestão: <b className="text-label">{num(s!.weight)} kg</b>.
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Link href="/nutricao" className="press mx-5 mt-4 flex items-center gap-4 rounded-2xl bg-card p-4">
            <div className="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden="true">
                <circle cx="28" cy="28" r="23" fill="none" stroke="var(--fill)" strokeWidth="6" />
                <motion.circle cx="28" cy="28" r="23" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 23} initial={{ strokeDashoffset: 2 * Math.PI * 23 }} animate={{ strokeDashoffset: 2 * Math.PI * 23 * (1 - Math.min(1, food.kcal / nt.kcal)) }} transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.2 }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-accent-ink">
                <Icon name="apple" size={22} />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Nutrição</span>
              <span className="tabular text-[14px] text-label-2">
                <b className="text-label">{Math.round(food.kcal).toLocaleString("pt-BR")}</b> de {nt.kcal.toLocaleString("pt-BR")} kcal · água {num(food.water / 1000, 2)} de {num(nt.water / 1000, 2)} L
              </span>
            </div>
            <Icon name="chevron" size={18} className="text-label-3" />
          </Link>

          <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
            <button onClick={doCheckIn} disabled={checkedToday} className="press flex flex-col items-start gap-2 rounded-2xl bg-card p-4 text-left disabled:opacity-100">
              <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${checkedToday ? "bg-good-soft text-good" : "bg-accent-soft text-accent-ink"}`}>
                <Icon name={checkedToday ? "check" : "pin"} size={20} stroke={checkedToday ? 3 : 2} />
              </div>
              <span className="text-[15px] font-semibold">{checkedToday ? "Check-in feito" : "Fazer check-in"}</span>
              <span className="text-[13px] text-label-2">{checkedToday ? "Presença registrada hoje" : "Marque que foi à academia"}</span>
            </button>
            <Link href="/ia" className="press flex flex-col items-start gap-2 rounded-2xl bg-card p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
                <Icon name="spark" size={20} />
              </div>
              <span className="text-[15px] font-semibold">Perguntar à IA</span>
              <span className="text-[13px] text-label-2">Dúvidas e ajustes no treino</span>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
