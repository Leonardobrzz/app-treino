"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Body } from "@/components/Body";
import { BODY_TYPES, BodySilhouette } from "@/components/BodySilhouette";
import { loadExercises } from "@/components/ExercisePicker";
import { LineChart } from "@/components/LineChart";
import { Icon, type IconName } from "@/components/ui";
import { WheelPicker } from "@/components/WheelPicker";
import { getProfile } from "@/lib/data";
import { PRIORITY_OPTIONS, generatePlan, type GenPlan, type Goal, type Level, type Location } from "@/lib/plan-generator";
import { supabase } from "@/lib/supabase/client";
import type { MeasureKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAYS_SHORT, num, todayISO, vibrate } from "@/lib/util";

type Answers = {
  name?: string;
  goal?: Goal;
  sex?: "masculino" | "feminino" | "outro";
  bodyType?: number | null;
  birth?: string;
  height?: number;
  weight?: number;
  target?: number;
  pace?: "lento" | "moderado" | "rapido";
  level?: Level;
  priorities?: string[];
  days?: number[];
  location?: Location;
  minutes?: number;
};

type StepId = keyof Answers;

const GOALS: { value: Goal; label: string; icon: IconName; db: string }[] = [
  { value: "perder", label: "Perder gordura", icon: "trendDown", db: "Perder gordura" },
  { value: "manter", label: "Manter e cuidar de mim", icon: "heart", db: "Manter e cuidar" },
  { value: "ganhar", label: "Ganhar massa", icon: "dumbbell", db: "Ganhar massa" },
  { value: "recompor", label: "Recomposição", icon: "swap", db: "Recomposição" },
  { value: "nao-sei", label: "Ainda não sei", icon: "help", db: "Ainda não sei" },
];

const RATES = { perder: { lento: 0.25, moderado: 0.5, rapido: 0.75 }, ganhar: { lento: 0.15, moderado: 0.25, rapido: 0.4 } };
const PACE_LABEL = { lento: "Tranquilo", moderado: "Moderado", rapido: "Acelerado" };
const LEVELS: { value: Level; label: string; desc: string; icon: IconName }[] = [
  { value: "iniciante", label: "Iniciante", desc: "Treino há menos de 6 meses", icon: "sprout" },
  { value: "intermediario", label: "Intermediário", desc: "Entre 6 meses e 2 anos", icon: "dumbbell" },
  { value: "avancado", label: "Avançado", desc: "Mais de 2 anos treinando firme", icon: "crown" },
];
const LOCATIONS: { value: Location; label: string; desc: string; icon: IconName }[] = [
  { value: "academia", label: "Academia completa", desc: "Máquinas, polias, barras e halteres", icon: "building" },
  { value: "casa", label: "Em casa com halteres", desc: "Halteres, elástico ou kettlebell", icon: "home" },
  { value: "corpo", label: "Só com o peso do corpo", desc: "Sem equipamento nenhum", icon: "user" },
];
const PRIORITY_TO_BODY: Record<string, MeasureKey[]> = { Peito: ["peito"], Braços: ["braco", "antebraco"], Abdômen: ["cintura"], Pernas: ["coxa"], Glúteos: ["quadril"], Panturrilha: ["panturrilha"], Ombros: [], Costas: [] };

const goalWeightRelevant = (a: Answers) => a.goal === "perder" || a.goal === "ganhar" || a.goal === "recompor";
const direction = (a: Answers) => (a.target != null && a.weight != null ? (a.target < a.weight - 0.4 ? "perder" : a.target > a.weight + 0.4 ? "ganhar" : null) : null);
const bmi = (w: number, h: number) => w / (h / 100) ** 2;
const bmiCat = (v: number) => (v < 18.5 ? { label: "Abaixo do peso", tone: "#f5c451" } : v < 25 ? { label: "Faixa adequada", tone: "#34c759" } : v < 30 ? { label: "Sobrepeso", tone: "#ff9f0a" } : { label: "Obesidade", tone: "#ff6b5e" });
const age = (iso: string) => {
  const b = new Date(iso + "T12:00:00");
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};

type Step = { id: StepId; when?: (a: Answers) => boolean; q: (a: Answers) => string; answer: (a: Answers) => string };

const STEPS: Step[] = [
  { id: "name", q: () => "Oi! Vou montar seu treino em poucos minutos. Como você quer ser chamado?", answer: (a) => a.name ?? "" },
  { id: "goal", q: (a) => `Prazer, ${a.name}! O que você quer conquistar?`, answer: (a) => GOALS.find((g) => g.value === a.goal)?.label ?? "" },
  { id: "sex", q: () => "Pra ajustar as contas e o desenho do corpo: qual é o seu sexo?", answer: (a) => ({ masculino: "Masculino", feminino: "Feminino", outro: "Prefiro não dizer" })[a.sex!] },
  { id: "bodyType", q: () => "Como você se vê hoje?", answer: (a) => (a.bodyType ? BODY_TYPES.find((b) => b.id === a.bodyType)!.label : "Prefiro pular") },
  { id: "birth", q: () => "Quando você nasceu?", answer: (a) => a.birth!.split("-").reverse().join("/") },
  { id: "height", q: () => "Qual é a sua altura?", answer: (a) => `${a.height} cm` },
  { id: "weight", q: () => "E quanto você está pesando hoje?", answer: (a) => `${num(a.weight!)} kg` },
  { id: "target", when: goalWeightRelevant, q: () => "Qual peso você quer alcançar?", answer: (a) => (direction(a) ? `${num(a.target!)} kg` : "Manter o peso atual") },
  { id: "pace", when: (a) => goalWeightRelevant(a) && !!direction(a), q: (a) => `Em que ritmo você quer ${direction(a) === "perder" ? "perder" : "ganhar"} peso?`, answer: (a) => `${PACE_LABEL[a.pace!]} · ${num(RATES[direction(a)!][a.pace!], 2)} kg/sem` },
  { id: "level", q: () => "Qual é o seu nível de treino?", answer: (a) => LEVELS.find((l) => l.value === a.level)!.label },
  { id: "priorities", q: () => "Quer dar atenção extra a algum músculo? Escolha até 3.", answer: (a) => (a.priorities!.length ? a.priorities!.join(" + ") : "Sem preferência") },
  { id: "days", q: () => "Quais dias você quer treinar?", answer: (a) => [1, 2, 3, 4, 5, 6, 0].filter((d) => a.days!.includes(d)).map((d) => WEEKDAYS[d]).join(", ") },
  { id: "location", q: () => "Onde você vai treinar?", answer: (a) => LOCATIONS.find((l) => l.value === a.location)!.label },
  { id: "minutes", q: () => "Quanto tempo você tem pra cada treino?", answer: (a) => (a.minutes! >= 75 ? "75 min ou mais" : `${a.minutes} min`) },
];

export default function Onboarding() {
  const router = useRouter();
  const [a, setA] = useState<Answers>({});
  const [done, setDone] = useState<StepId[]>([]);
  const [phase, setPhase] = useState<"chat" | "building" | "plan">("chat");
  const [plan, setPlan] = useState<GenPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProfile().then((p) => p?.name && setA((x) => ({ ...x, name: x.name ?? p.name ?? undefined })));
  }, []);

  const active = STEPS.filter((s) => !s.when || s.when(a));
  const current = active.find((s) => !done.includes(s.id));
  const progress = done.length / active.length;

  useEffect(() => {
    const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 120);
    return () => clearTimeout(t);
  }, [done.length, phase]);

  function answer(patch: Partial<Answers>, id: StepId) {
    vibrate(8);
    setA((x) => ({ ...x, ...patch }));
    setDone((d) => [...d.filter((s) => s !== id), id]);
  }

  function back() {
    if (phase !== "chat") {
      setPhase("chat");
      setDone((d) => d.slice(0, -1));
      return;
    }
    setDone((d) => d.slice(0, -1));
  }

  useEffect(() => {
    if (current || phase !== "chat" || !done.length) return;
    setPhase("building");
    (async () => {
      const catalog = await loadExercises();
      const p = generatePlan({ goal: a.goal!, level: a.level!, location: a.location!, days: a.days!, minutes: a.minutes!, priorities: a.priorities ?? [] }, catalog);
      await new Promise((r) => setTimeout(r, 2600));
      setPlan(p);
      setPhase("plan");
      vibrate([10, 40, 10]);
    })();
  }, [current, phase, done.length, a]);

  async function finish(usePlan: boolean) {
    if (saving) return;
    setSaving(true);
    const sb = supabase();
    const { data: u } = await sb.auth.getUser();
    const uid = u.user!.id;
    await sb
      .from("profiles")
      .update({
        name: a.name,
        goal: GOALS.find((g) => g.value === a.goal)?.db,
        weekly_goal: Math.max(1, Math.min(7, a.days?.length ?? 4)),
        sex: a.sex,
        body_type: a.bodyType ?? null,
        birth_date: a.birth,
        height_cm: a.height,
        target_weight: direction(a) ? a.target : null,
        pace: direction(a) ? a.pace : null,
        level: a.level,
        priority_muscles: a.priorities ?? [],
        training_days: a.days ?? [],
        location: a.location,
        session_minutes: a.minutes,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", uid);
    if (a.weight) await sb.from("body_weights").upsert({ measured_on: todayISO(), weight: a.weight }, { onConflict: "user_id,measured_on" });
    if (usePlan && plan) {
      await sb.from("plans").update({ active: false }).eq("active", true);
      const { data: p } = await sb.from("plans").insert({ name: plan.name }).select("id").single();
      for (const d of plan.days) {
        const { data: day } = await sb.from("plan_days").insert({ plan_id: p!.id, weekday: d.weekday, title: d.title }).select("id").single();
        if (day) await sb.from("plan_exercises").insert(d.exercises.map((e, i) => ({ plan_day_id: day.id, exercise_id: e.exercise.id, position: i, sets: e.sets, reps: e.reps, rest_seconds: Math.max(15, e.rest) })));
      }
    }
    router.replace(usePlan ? "/treinos" : "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="safe-top sticky top-0 z-20 bg-bg/90 px-5 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={back} disabled={!done.length} aria-label="Voltar uma pergunta" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card text-label disabled:opacity-0">
            <Icon name="back" size={20} />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da configuração">
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${phase === "chat" ? progress * 100 : 100}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden="true">
            <Icon name="dumbbell" size={20} stroke={2.4} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-16 pt-3">
        {active
          .filter((s) => done.includes(s.id))
          .map((s) => (
            <div key={s.id} className="flex flex-col gap-4">
              <Bot>{s.q(a)}</Bot>
              <Me>{s.answer(a)}</Me>
              <Insight id={s.id} a={a} />
            </div>
          ))}

        <AnimatePresence mode="wait">
          {phase === "chat" && current && (
            <motion.div key={current.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="flex flex-col gap-4">
              <Bot>{current.q(a)}</Bot>
              <Input key={current.id === "name" ? `name-${a.name ?? ""}` : current.id} step={current.id} a={a} onAnswer={answer} />
            </motion.div>
          )}
          {phase === "building" && <Building key="b" />}
          {phase === "plan" && plan && <PlanPreview key="p" plan={plan} a={a} saving={saving} onUse={() => finish(true)} onSkip={() => finish(false)} />}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Bot({ children }: { children: ReactNode }) {
  return <p className="max-w-[92%] text-[20px] font-medium leading-snug">{children}</p>;
}

function Me({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="max-w-[85%] self-end rounded-[22px] rounded-br-md bg-label px-5 py-3 text-[17px] font-semibold text-bg">
      {children}
    </motion.div>
  );
}

function Option({ icon, label, desc, onClick, selected }: { icon?: IconName; label: string; desc?: string; onClick: () => void; selected?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} className={`flex min-h-[60px] w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-colors ${selected ? "bg-accent text-on-accent" : "bg-card"}`}>
      {icon && <Icon name={icon} size={24} />}
      <span className="flex flex-col">
        <span className="text-[17px] font-semibold">{label}</span>
        {desc && <span className={`text-[14px] ${selected ? "text-on-accent/80" : "text-label-2"}`}>{desc}</span>}
      </span>
    </motion.button>
  );
}

function Continue({ disabled, onClick, children = "Continuar" }: { disabled?: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} disabled={disabled} onClick={onClick} className="mt-2 h-[54px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-on-accent transition-opacity disabled:opacity-30">
      {children}
    </motion.button>
  );
}

function Input({ step, a, onAnswer }: { step: StepId; a: Answers; onAnswer: (p: Partial<Answers>, id: StepId) => void }) {
  const [text, setText] = useState(step === "name" ? a.name ?? "" : "");
  const [height, setHeight] = useState(a.height ?? (a.sex === "feminino" ? 163 : 175));
  const [weight, setWeight] = useState(a.weight ?? (a.sex === "feminino" ? 62 : 75));
  const [target, setTarget] = useState(a.target ?? (a.weight ? Math.round((a.goal === "perder" ? a.weight - 5 : a.goal === "ganhar" ? a.weight + 4 : a.weight) * 2) / 2 : 70));
  const [multi, setMulti] = useState<string[]>(a.priorities ?? []);
  const [days, setDays] = useState<number[]>(a.days ?? []);
  const [error, setError] = useState("");

  if (step === "name")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length < 2) return setError("Digite seu nome.");
          onAnswer({ name: text.trim().split(" ")[0].replace(/^./, (c) => c.toUpperCase()) }, "name");
        }}
        className="flex flex-col gap-2"
      >
        <input autoFocus value={text} onChange={(e) => (setText(e.target.value), setError(""))} placeholder="Seu nome" aria-label="Seu nome" autoComplete="given-name" className="h-14 rounded-2xl bg-card px-5 text-[18px] outline-none focus:ring-2 focus:ring-accent" />
        {error && <p role="alert" className="text-[14px] text-bad">{error}</p>}
        <Continue onClick={() => {}} />
      </form>
    );

  if (step === "goal") return <div className="flex flex-col gap-2.5">{GOALS.map((g) => <Option key={g.value} icon={g.icon} label={g.label} onClick={() => onAnswer({ goal: g.value }, "goal")} />)}</div>;

  if (step === "sex")
    return (
      <div className="flex flex-col gap-2.5">
        <Option label="Masculino" onClick={() => onAnswer({ sex: "masculino" }, "sex")} />
        <Option label="Feminino" onClick={() => onAnswer({ sex: "feminino" }, "sex")} />
        <Option label="Prefiro não dizer" onClick={() => onAnswer({ sex: "outro" }, "sex")} />
      </div>
    );

  if (step === "bodyType")
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {BODY_TYPES.map((b) => (
            <motion.button key={b.id} whileTap={{ scale: 0.96 }} onClick={() => onAnswer({ bodyType: b.id }, "bodyType")} className="flex flex-col items-center gap-1 rounded-[22px] bg-card px-3 pb-3 pt-4">
              <BodySilhouette type={b.id} sex={a.sex} className="h-44" />
              <span className="text-[15px] font-semibold">{b.label}</span>
              <span className="text-center text-[12px] leading-tight text-label-2">{b.desc}</span>
            </motion.button>
          ))}
        </div>
        <button onClick={() => onAnswer({ bodyType: null }, "bodyType")} className="press h-11 text-[16px] font-medium text-label-2">
          Prefiro pular
        </button>
      </div>
    );

  if (step === "birth") {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    const masked = digits.replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
    const submit = () => {
      if (digits.length !== 8) return setError("Use o formato DD/MM/AAAA.");
      const [d, m, y] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].map(Number);
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dt = new Date(iso + "T12:00:00");
      if (isNaN(dt.getTime()) || dt.getDate() !== d || age(iso) < 12 || age(iso) > 100) return setError("Confira a data.");
      onAnswer({ birth: iso }, "birth");
    };
    return (
      <form onSubmit={(e) => (e.preventDefault(), submit())} className="flex flex-col gap-2">
        <input autoFocus inputMode="numeric" value={masked} onChange={(e) => (setText(e.target.value), setError(""))} placeholder="DD/MM/AAAA" aria-label="Data de nascimento" className="tabular h-14 rounded-2xl bg-card px-5 text-[20px] tracking-wide outline-none focus:ring-2 focus:ring-accent" />
        {error && <p role="alert" className="text-[14px] text-bad">{error}</p>}
        <Continue onClick={() => {}} disabled={digits.length !== 8} />
      </form>
    );
  }

  if (step === "height")
    return (
      <div className="flex flex-col">
        <WheelPicker label="Altura" min={130} max={220} value={height} onChange={setHeight} unit="cm" />
        <Continue onClick={() => onAnswer({ height }, "height")}>Confirmar</Continue>
      </div>
    );

  if (step === "weight")
    return (
      <div className="flex flex-col">
        <WheelPicker label="Peso" min={35} max={200} step={0.5} decimals={1} value={weight} onChange={setWeight} unit="kg" />
        <Continue onClick={() => onAnswer({ weight }, "weight")}>Confirmar</Continue>
      </div>
    );

  if (step === "target") {
    const lowBmi = a.height ? bmi(target, a.height) < 18.5 : false;
    return (
      <div className="flex flex-col">
        <WheelPicker label="Peso desejado" min={35} max={200} step={0.5} decimals={1} value={target} onChange={setTarget} unit="kg" />
        {lowBmi && <p className="mt-3 rounded-xl bg-card p-3 text-[14px] leading-snug text-label-2">Esse peso fica abaixo da faixa adequada de IMC pra sua altura. Se for isso mesmo, vale conversar com um profissional de saúde antes.</p>}
        <Continue onClick={() => onAnswer({ target }, "target")}>Confirmar</Continue>
        <button onClick={() => onAnswer({ target: a.weight }, "target")} className="press mt-2 h-11 text-[16px] font-medium text-label-2">
          Quero manter o peso atual
        </button>
      </div>
    );
  }

  if (step === "pace") {
    const dir = direction(a)!;
    return (
      <div className="flex flex-col gap-2.5">
        {(["lento", "moderado", "rapido"] as const).map((p) => (
          <Option key={p} icon={p === "lento" ? "sprout" : p === "moderado" ? "chart" : "flame"} label={`${PACE_LABEL[p]} · ${num(RATES[dir][p], 2)} kg por semana`} desc={p === "lento" ? "Mais fácil de manter" : p === "moderado" ? "O equilíbrio recomendado" : "Exige mais disciplina"} onClick={() => onAnswer({ pace: p }, "pace")} />
        ))}
      </div>
    );
  }

  if (step === "level") return <div className="flex flex-col gap-2.5">{LEVELS.map((l) => <Option key={l.value} icon={l.icon} label={l.label} desc={l.desc} onClick={() => onAnswer({ level: l.value }, "level")} />)}</div>;

  if (step === "priorities") {
    const intensity: Partial<Record<MeasureKey, number>> = {};
    multi.forEach((m) => PRIORITY_TO_BODY[m].forEach((k) => (intensity[k] = 1)));
    return (
      <div className="flex flex-col gap-3">
        <div className="mx-auto w-40">
          <Body delta={{}} intensity={intensity} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {PRIORITY_OPTIONS.map((m) => {
            const on = multi.includes(m);
            return (
              <motion.button
                key={m}
                whileTap={{ scale: 0.92 }}
                aria-pressed={on}
                onClick={() => {
                  vibrate(6);
                  setMulti((x) => (on ? x.filter((y) => y !== m) : x.length >= 3 ? x : [...x, m]));
                }}
                className={`h-10 rounded-full px-4 text-[15px] font-semibold transition-colors ${on ? "bg-accent text-on-accent" : "bg-card"}`}
              >
                {m}
              </motion.button>
            );
          })}
        </div>
        <p className="text-center text-[13px] text-label-2">{multi.length}/3 escolhidos</p>
        <Continue disabled={!multi.length} onClick={() => onAnswer({ priorities: multi }, "priorities")} />
        <button onClick={() => onAnswer({ priorities: [] }, "priorities")} className="press h-11 text-[16px] font-medium text-label-2">
          Sem preferência
        </button>
      </div>
    );
  }

  if (step === "days")
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = days.includes(d);
            return (
              <button key={d} onClick={() => (vibrate(6), setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d])))} aria-pressed={on} aria-label={WEEKDAYS[d]} className="flex flex-col items-center gap-2">
                <span className={`text-[13px] font-semibold ${on ? "text-accent-ink" : "text-label-2"}`}>{WEEKDAYS_SHORT[d]}</span>
                <motion.span animate={on ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: 0.25 }} className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${on ? "border-accent bg-accent text-on-accent shadow-[0_0_18px_var(--accent)]" : "border-fill"}`}>
                  {on && <Icon name="check" size={18} stroke={3} />}
                </motion.span>
              </button>
            );
          })}
        </div>
        {days.length === 7 && <p className="text-[14px] text-label-2">Vou deixar pelo menos um dia de descanso: o músculo cresce na recuperação.</p>}
        <Continue disabled={!days.length} onClick={() => onAnswer({ days: days.length === 7 ? days.filter((d) => d !== 0) : days }, "days")} />
      </div>
    );

  if (step === "location") return <div className="flex flex-col gap-2.5">{LOCATIONS.map((l) => <Option key={l.value} icon={l.icon} label={l.label} desc={l.desc} onClick={() => onAnswer({ location: l.value }, "location")} />)}</div>;

  if (step === "minutes")
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[30, 45, 60, 75].map((m) => (
          <Option key={m} icon="clock" label={m === 75 ? "75 min ou mais" : `${m} min`} onClick={() => onAnswer({ minutes: m }, "minutes")} />
        ))}
      </div>
    );

  return null;
}

function Insight({ id, a }: { id: StepId; a: Answers }) {
  if (id === "weight" && a.weight && a.height) {
    const v = bmi(a.weight, a.height);
    const cat = bmiCat(v);
    const pos = Math.max(0, Math.min(1, (v - 15) / (40 - 15)));
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-[22px] bg-card p-5">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-[44px] font-bold leading-none" style={{ color: cat.tone }}>{num(v)}</span>
          <span className="text-[15px] font-semibold text-label-2">IMC</span>
          <span className="ml-auto rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: `color-mix(in srgb, ${cat.tone} 18%, transparent)`, color: cat.tone }}>{cat.label}</span>
        </div>
        <div className="relative pt-2">
          <div className="flex h-2 gap-1">
            <span className="flex-[3.5] rounded-full bg-[#f5c451]/60" />
            <span className="flex-[6.5] rounded-full bg-[#34c759]/60" />
            <span className="flex-[5] rounded-full bg-[#ff9f0a]/60" />
            <span className="flex-[10] rounded-full bg-[#ff6b5e]/60" />
          </div>
          <motion.span initial={{ left: "0%" }} animate={{ left: `${pos * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.2 }} className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-card" style={{ background: cat.tone }} />
          <div className="tabular mt-2 flex justify-between text-[12px] text-label-2">
            <span>15</span><span>18,5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </div>
        <p className="text-[15px] leading-snug text-label-2">
          Com {num(a.height / 100, 2)} m e {num(a.weight)} kg, seu IMC é {num(v)}. Pela classificação da OMS para adultos, isso fica em <b className="text-label">{cat.label.toLowerCase()}</b>. É só uma referência: o IMC não diferencia músculo de gordura.
        </p>
        {v < 18.5 && a.goal === "perder" && <p className="text-[14px] leading-snug text-label-2">Como seu IMC já está abaixo da faixa adequada, vale conversar com um profissional de saúde antes de buscar perder peso.</p>}
      </motion.div>
    );
  }

  if (id === "pace" && a.weight && a.target && a.pace) {
    const dir = direction(a)!;
    const rate = RATES[dir][a.pace];
    const diff = Math.abs(a.target - a.weight);
    const weeks = Math.max(1, Math.ceil(diff / rate));
    const pts = Array.from({ length: Math.min(weeks, 40) + 1 }, (_, i) => {
      const w = Math.min(i, weeks);
      const d = new Date();
      d.setDate(d.getDate() + Math.round((w * weeks * 7) / Math.min(weeks, 40)));
      const k = Math.round((w * weeks) / Math.min(weeks, 40));
      return { x: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, y: Math.round((a.weight! + (dir === "perder" ? -1 : 1) * Math.min(diff, k * rate)) * 10) / 10 };
    });
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 rounded-[22px] bg-card p-5">
        <span className="text-[13px] font-semibold text-label-2">PROJEÇÃO</span>
        <span className="text-[26px] font-bold leading-tight">
          <span className="text-accent-ink">{dir === "perder" ? "−" : "+"}{num(diff)} kg</span> em cerca de {weeks} {weeks === 1 ? "semana" : "semanas"}
        </span>
        <LineChart label="Projeção de peso semana a semana" points={pts} format={(v) => `${num(v)} kg`} />
        <p className="text-[14px] leading-snug text-label-2">É uma estimativa no ritmo {PACE_LABEL[a.pace].toLowerCase()}. O corpo não muda em linha reta e a balança não separa músculo de gordura, então acompanhe também as medidas.</p>
      </motion.div>
    );
  }

  if (id === "level" && a.level) {
    const tip = {
      iniciante: "Vou começar com treinos de corpo inteiro e exercícios mais fáceis de aprender, pra você pegar a técnica com segurança.",
      intermediario: "Com sua experiência, o plano divide os grupos musculares e começa cada treino pelos exercícios mais pesados.",
      avancado: "Plano com mais volume e as séries mais pesadas logo no começo, enquanto você está descansado.",
    }[a.level];
    return <Bot>{tip}</Bot>;
  }

  if (id === "days" && a.days?.length) {
    const n = a.days.length;
    return (
      <Bot>
        {n} {n === 1 ? "treino" : "treinos"} por semana, {n * 4} nas próximas 4 semanas, com {7 - n} {7 - n === 1 ? "dia" : "dias"} de descanso. Vou montar o plano pra esses dias.
      </Bot>
    );
  }
  return null;
}

function Building() {
  const steps = ["Escolhendo a melhor divisão", "Selecionando os exercícios", "Ajustando séries e descanso", "Encaixando no seu tempo"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(steps.length, x + 1)), 600);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 py-10">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }} className="h-16 w-16 rounded-full border-4 border-fill border-t-accent" />
      <span className="text-[22px] font-bold">Montando seu plano…</span>
      <ul className="flex w-full max-w-[300px] flex-col gap-3">
        {steps.map((s, k) => (
          <motion.li key={s} initial={{ opacity: 0.3 }} animate={{ opacity: k < i ? 1 : 0.3 }} className="flex items-center gap-3 text-[16px]">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${k < i ? "bg-accent text-on-accent" : "bg-fill"}`}>{k < i && <Icon name="check" size={14} stroke={3} />}</span>
            {s}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

const DAY_COLORS = ["#ff9f0a", "#0a84ff", "#30d158", "#bf5af2", "#ff375f", "#64d2ff"];

function PlanPreview({ plan, a, saving, onUse, onSkip }: { plan: GenPlan; a: Answers; saving: boolean; onUse: () => void; onSkip: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const total = useMemo(() => plan.days.reduce((s, d) => s + d.exercises.length, 0), [plan]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
      <Bot>Pronto, {a.name}! Seu plano está montado.</Bot>
      <div className="grid grid-cols-3 gap-2">
        {[
          [String(plan.days.length), "treinos/sem"],
          [String(total), "exercícios"],
          [`~${Math.round(plan.days.reduce((s, d) => s + d.minutes, 0) / plan.days.length)}`, "min por treino"],
        ].map(([v, l], i) => (
          <motion.div key={l} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 400, damping: 20 }} className="flex flex-col items-center rounded-2xl bg-card py-3">
            <span className="tabular text-[24px] font-bold text-accent-ink">{v}</span>
            <span className="text-[12px] text-label-2">{l}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-[14px] font-semibold text-label-2">{plan.name}</p>
      <div className="relative flex flex-col gap-3 pl-6">
        <div className="absolute bottom-4 left-[7px] top-4 w-0.5 rounded-full bg-fill" />
        {plan.days.map((d, i) => {
          const color = DAY_COLORS[i % DAY_COLORS.length];
          const isOpen = open === i;
          return (
            <motion.div key={d.weekday} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08 }} className="relative">
              <span className="absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full border-2 border-bg" style={{ background: color }} />
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="press w-full rounded-2xl border bg-card p-4 text-left" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{WEEKDAYS[d.weekday]}</span>
                    <span className="text-[18px] font-bold">{d.title}</span>
                    <span className="text-[14px]" style={{ color }}>
                      {d.exercises.length} exercícios · {d.minutes} min
                    </span>
                  </div>
                  <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="text-label-3">
                    <Icon name="chevron" size={18} />
                  </motion.span>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      {d.exercises.map((e) => (
                        <li key={e.exercise.id} className="flex justify-between gap-2 border-t border-sep py-2 text-[14px] first:mt-3">
                          <span>{e.exercise.name}</span>
                          <span className="tabular shrink-0 text-label-2">{e.sets} × {e.reps}</span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          );
        })}
      </div>
      <Continue onClick={onUse} disabled={saving}>{saving ? "Salvando…" : "Usar este plano"}</Continue>
      <button onClick={onSkip} disabled={saving} className="press h-11 text-[16px] font-medium text-label-2">
        Prefiro montar do zero
      </button>
      <p className="text-center text-[13px] text-label-2">Dá pra trocar exercícios, séries e cargas depois em Minha semana.</p>
    </motion.div>
  );
}
