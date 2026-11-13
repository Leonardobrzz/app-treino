"use client";

import { introSeen, isStandalone } from "@/lib/install";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card, Empty, Icon, LinkButton, SectionTitle, Spinner } from "@/components/ui";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { Checklist } from "@/components/guide";
import { useBrand } from "@/components/BrandTheme";
import { myTrainers } from "@/lib/personal";
import { refreshPush } from "@/lib/push";
import { checkInToday, getActivePlan, getProfile, lastSetsByExercise, type ActivePlan } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import type { Profile, SessionSet } from "@/lib/types";
import { computeTargets } from "@/lib/nutrition";
import { WEEKDAYS, WEEKDAYS_LETTER, longToday, num, suggest, todayISO, vibrate, weekStart, weekStreak } from "@/lib/util";

export default function TodayPage() {
  const router = useRouter();
  const brand = useBrand();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unread, setUnread] = useState(0);
  const [coach, setCoach] = useState<{ name: string; todo: number } | null>(null);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [last, setLast] = useState<Record<string, SessionSet[]>>({});
  const [dateLabel, setDateLabel] = useState("");
  const [installed, setInstalled] = useState(true);
  const [food, setFood] = useState<{ kcal: number; water: number; weight: number | null }>({ kcal: 0, water: 0, weight: null });

  useEffect(() => {
    setDateLabel(longToday());
    setInstalled(isStandalone());
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
      // Modo personal: o app abre na área dele. Pra treinar, ele troca pra "Usar como aluno" no perfil.
      try {
        if (p?.is_trainer && localStorage.getItem("perfil") === "personal") {
          router.replace("/personal");
          return;
        }
      } catch {
        /* sem storage */
      }
      if (p && !p.onboarded_at) {
        router.replace("/bem-vindo");
        return;
      }
      // Primeira vez abrindo pelo app instalado: mostra o tour uma vez.
      if (isStandalone() && !introSeen()) {
        router.replace("/comecar?next=/");
        return;
      }
      try {
        if (localStorage.getItem("convite_personal")) {
          router.replace("/meu-personal");
          return;
        }
        if (localStorage.getItem("convite")) {
          router.replace("/amigos");
          return;
        }
      } catch {
        /* sem storage */
      }
      setProfile(p);
      refreshPush();
      supabase().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).then(({ count }) => setUnread(count ?? 0));
      myTrainers().then(async (t) => {
        if (!t.length) return;
        const [c, a] = await Promise.all([
          supabase().from("charges").select("id", { count: "exact", head: true }).eq("status", "aberta").eq("student_id", p!.id),
          supabase().from("anamneses").select("id", { count: "exact", head: true }).is("answered_at", null).eq("student_id", p!.id),
        ]);
        setCoach({ name: t[0].name, todo: (c.count ?? 0) + (a.count ?? 0) });
      });
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
  const showReport = !!dateLabel && new Date().getDay() <= 2 && sessionDates.length > 0;

  const suggestions = (todayDay?.plan_exercises ?? [])
    .map((pe) => ({ pe, s: suggest(last[pe.exercise_id] ?? [], pe.reps, pe.sets, pe.exercises.equipment) }))
    .filter((x) => x.s?.up);


  const coachCard = (coach: { name: string; todo: number }) => (
    <Link href="/meu-personal" className={`press mx-5 mt-3 flex items-center gap-3 rounded-2xl p-3.5 ${coach.todo ? "bg-accent-soft" : "bg-card"}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                <Icon name="users" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">Personal: {coach.name}</span>
                <span className="text-[13px] text-label-2">{coach.todo ? `${coach.todo} ${coach.todo === 1 ? "pendência" : "pendências"} (pagamento ou anamnese)` : "Avaliações, pagamentos e desafios"}</span>
              </span>
              {coach.todo > 0 && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              <Icon name="chevron" size={17} className="text-label-3" />
            </Link>
  );

  async function doCheckIn() {
    vibrate([10, 40, 10]);
    setCheckins((c) => [...c, todayISO()]);
    await checkInToday();
  }

  return (
    <>
      <header className="safe-top flex items-end justify-between px-5 pb-2">
        <div className="flex flex-col gap-0.5">
          {brand && !brand.mine ? (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-label-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {brand.logo && <img src={brand.logo} alt="" className="h-5 w-auto max-w-[60px] object-contain" />}
              {brand.name} · {dateLabel || "\u00a0"}
            </span>
          ) : (
            <span className="text-[13px] font-semibold tracking-wide text-label-2">{dateLabel || "\u00a0"}</span>
          )}
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">{profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Hoje"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/avisos" aria-label={unread ? `Avisos, ${unread} novos` : "Avisos"} className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent-ink">
            <Icon name="bell" size={20} />
            <AnimatePresence>
              {unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 15 }} className="tabular absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <Link href="/perfil" aria-label="Perfil" className="press flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-[16px] font-semibold text-accent-ink">
            {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </header>

      {loading ? (
        <Spinner />
      ) : (
        <Stagger delay={0.06}>
          <StaggerItem>
            <Checklist
              id="aluno"
              title="Comece a usar o Carga"
              steps={[
                { label: "Monte sua semana", sub: "Escolha os dias e os exercícios, ou peça pra IA montar.", done: !!plan?.plan_days.length, href: "/treinos" },
                { label: "Faça o primeiro treino", sub: "Abra o treino do dia e marque as séries com a carga que usou.", done: sessionDates.length > 0, href: todayDay ? `/treino/${todayDay.id}` : "/treinos" },
                { label: "Registre seu peso", sub: "Assim o app calcula suas metas de comida e mostra sua evolução.", done: food.weight != null, href: "/medidas" },
                { label: "Instale o app no celular", sub: "Fica na tela de início e abre como um app normal.", done: installed, href: "/instalar" },
              ]}
            />
          </StaggerItem>

          {coach && coach.todo > 0 && <StaggerItem>{coachCard(coach)}</StaggerItem>}

          <StaggerItem>
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
                {todayDay.plan_exercises.length > 5 && <li className="border-t border-sep pt-2.5 text-[15px] text-label-2">+ {todayDay.plan_exercises.length - 5} {todayDay.plan_exercises.length - 5 === 1 ? "exercício" : "exercícios"}</li>}
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
          </StaggerItem>

          <StaggerItem>
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

          {showReport && (
            <Link href="/resumo" className="press mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
                <Icon name="chart" size={21} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-[16px] font-semibold">Seu resumo da semana chegou</span>
                <span className="text-[14px] text-label-2">Treinos, recordes, músculos e o que ajustar</span>
              </div>
              <Icon name="chevron" size={18} className="text-label-3" />
            </Link>
          )}

          </StaggerItem>

          <StaggerItem>
          <Card className="mx-5 mt-4 flex flex-col gap-3 px-4 pb-3.5 pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-label-2">Meta da semana</span>
                <span className="tabular text-[22px] font-bold tracking-[-0.3px]">
                  <CountUp value={doneThisWeek} />
                  <span className="text-[15px] font-medium text-label-2"> de {goal} treinos</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-semibold text-accent-ink">
                <Icon name="flame" size={17} />
                <CountUp value={streak} /> {streak === 1 ? "semana" : "semanas"}
              </span>
            </div>
            <div className="flex justify-between">
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
            </div>
          </Card>
          {coach && !coach.todo && coachCard(coach)}
          </StaggerItem>

          <StaggerItem>
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
                <CountUp value={food.kcal} className="font-bold text-label" /> de {nt.kcal.toLocaleString("pt-BR")} kcal · água {num(food.water / 1000, 2)} de {num(nt.water / 1000, 2)} L
              </span>
            </div>
            <Icon name="chevron" size={18} className="text-label-3" />
          </Link>

          </StaggerItem>

          <StaggerItem className="mx-5 mt-3 grid grid-cols-2 gap-3">
            <button onClick={doCheckIn} disabled={checkedToday} className="press flex flex-col items-start gap-2 rounded-2xl bg-card p-4 text-left disabled:opacity-100">
              <motion.div key={String(checkedToday)} initial={checkedToday ? { scale: 0.4, rotate: -30 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 12 }} className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${checkedToday ? "bg-good-soft text-good" : "bg-accent-soft text-accent-ink"}`}>
                <Icon name={checkedToday ? "check" : "pin"} size={20} stroke={checkedToday ? 3 : 2} />
              </motion.div>
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
          </StaggerItem>
        </Stagger>
      )}
    </>
  );
}
