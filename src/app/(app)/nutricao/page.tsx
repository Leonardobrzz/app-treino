"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProBadge, ProLock } from "@/components/ProLock";
import { Button, Card, Header, Icon, SectionTitle, Segmented, Sheet, Spinner } from "@/components/ui";
import { getProfile, getSubscription } from "@/lib/data";
import { computeTargets, mealForHour, type FoodItem, type Targets } from "@/lib/nutrition";
import { isPro } from "@/lib/pro";
import { supabase } from "@/lib/supabase/client";
import { MEAL_LABEL, MEAL_TYPES, type Meal, type MealType, type Profile, type WaterLog } from "@/lib/types";
import { WEEKDAYS_LETTER, fmtDate, num, todayISO, vibrate } from "@/lib/util";

const MEAL_SHORT: Record<MealType, string> = { cafe: "Café", almoco: "Almoço", lanche: "Lanche", jantar: "Jantar" };
const MEAL_OPTIONS = MEAL_TYPES.map((m) => ({ value: m, label: MEAL_SHORT[m] }));

const parse = (v: string) => {
  const x = parseFloat(v.replace(",", "."));
  return Number.isFinite(x) && x >= 0 ? x : 0;
};
const r0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const shiftDay = (iso: string, d: number) => {
  const x = new Date(iso + "T12:00:00");
  x.setDate(x.getDate() + d);
  return todayISO(x);
};
const sum = (list: Pick<Meal, "kcal" | "protein" | "carbs" | "fat">[]) =>
  list.reduce((a, m) => ({ kcal: a.kcal + Number(m.kcal), protein: a.protein + Number(m.protein), carbs: a.carbs + Number(m.carbs), fat: a.fat + Number(m.fat) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** Reduz a foto no próprio aparelho antes de enviar (mais rápido e barato) */
async function shrink(file: File, max = 1024): Promise<{ data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const preview = c.toDataURL("image/jpeg", 0.82);
    return { data: preview.split(",")[1], preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function NutritionPage() {
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [pro, setPro] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [water, setWater] = useState<WaterLog[]>([]);
  const [week, setWeek] = useState<{ eaten_on: string; kcal: number }[]>([]);
  const [recent, setRecent] = useState<Meal[]>([]);
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const today = useMemo(() => (day ? todayISO() : ""), [day]);

  useEffect(() => {
    setDay(todayISO());
    (async () => {
      const [p, sub, w] = await Promise.all([getProfile(), getSubscription(), supabase().from("body_weights").select("weight").order("measured_on", { ascending: false }).limit(1).maybeSingle()]);
      setProfile(p);
      setPro(isPro(sub));
      setWeight(w.data?.weight ?? null);
    })();
  }, []);

  const loadDay = useCallback(async (d: string) => {
    const from = shiftDay(todayISO(), -6);
    const [m, wa, wk, rc] = await Promise.all([
      supabase().from("meals").select("*").eq("eaten_on", d).order("created_at"),
      supabase().from("water_logs").select("*").eq("logged_on", d).order("created_at"),
      supabase().from("meals").select("eaten_on,kcal").gte("eaten_on", from),
      supabase().from("meals").select("*").order("created_at", { ascending: false }).limit(60),
    ]);
    setMeals((m.data ?? []) as Meal[]);
    setWater((wa.data ?? []) as WaterLog[]);
    setWeek((wk.data ?? []) as { eaten_on: string; kcal: number }[]);
    const seen = new Set<string>();
    setRecent(((rc.data ?? []) as Meal[]).filter((x) => (seen.has(x.name.toLowerCase()) ? false : (seen.add(x.name.toLowerCase()), true))).slice(0, 12));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (day) loadDay(day);
  }, [day, loadDay]);

  const targets = useMemo(() => computeTargets(profile, weight), [profile, weight]);
  const totals = useMemo(() => sum(meals), [meals]);
  const waterMl = water.reduce((a, w) => a + w.ml, 0);

  async function addWater(ml: number) {
    vibrate(10);
    const { data } = await supabase().from("water_logs").insert({ ml, logged_on: day }).select().single();
    if (data) setWater((w) => [...w, data as WaterLog]);
  }
  async function undoWater() {
    const last = water.at(-1);
    if (!last) return;
    setWater((w) => w.slice(0, -1));
    await supabase().from("water_logs").delete().eq("id", last.id);
  }

  const dayLabel = !day ? "" : day === today ? "Hoje" : day === shiftDay(today, -1) ? "Ontem" : fmtDate(day);

  return (
    <>
      <Header
        title="Nutrição"
        eyebrow={dayLabel ? dayLabel.toUpperCase() : " "}
        right={
          <button onClick={() => setGoalsOpen(true)} className="press mb-1 flex h-9 items-center gap-1.5 rounded-full bg-card-2 px-3.5 text-[15px] font-semibold text-accent-ink">
            <Icon name="edit" size={16} /> Metas
          </button>
        }
      />

      <div className="flex items-center justify-between px-5 pb-1 pt-1">
        <button aria-label="Dia anterior" onClick={() => setDay((d) => shiftDay(d, -1))} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card text-accent-ink">
          <Icon name="back" size={20} />
        </button>
        <span className="text-[15px] font-semibold text-label-2">{day ? (day === today ? fmtDate(day) : dayLabel === "Ontem" ? fmtDate(day) : "") || " " : " "}</span>
        <button aria-label="Próximo dia" disabled={!day || day >= today} onClick={() => setDay((d) => shiftDay(d, 1))} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card text-accent-ink disabled:opacity-30">
          <Icon name="chevron" size={20} />
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <SummaryCard totals={totals} targets={targets} />

          <WaterCard ml={waterMl} target={targets.water} onAdd={addWater} onUndo={undoWater} canUndo={water.length > 0} />

          {MEAL_TYPES.map((mt) => {
            const list = meals.filter((m) => m.meal === mt);
            const t = sum(list);
            return (
              <section key={mt}>
                <div className="flex items-baseline justify-between px-5 pb-2 pt-6">
                  <h2 className="text-[20px] font-bold tracking-[-0.3px]">{MEAL_LABEL[mt]}</h2>
                  {list.length > 0 && <span className="tabular text-[15px] font-semibold text-label-2">{r0(t.kcal)} kcal</span>}
                </div>
                <Card className="mx-5 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {list.map((m) => (
                      <motion.button
                        key={m.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => setEditing(m)}
                        className="press flex w-full items-center gap-3 border-b border-sep px-4 py-3 text-left"
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[16px] font-medium">{m.name}</span>
                          <span className="truncate text-[13px] text-label-2">
                            {[m.portion, Number(m.protein) + Number(m.carbs) + Number(m.fat) > 0 ? `P ${r0(m.protein)} · C ${r0(m.carbs)} · G ${r0(m.fat)}` : ""].filter(Boolean).join(" · ") || "Sem macros"}
                          </span>
                        </div>
                        <span className="tabular text-[15px] font-semibold">{r0(m.kcal)}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  <button onClick={() => setAdding(mt)} className="press flex w-full items-center gap-2 px-4 py-3 text-[16px] font-semibold text-accent-ink">
                    <Icon name="plus" size={18} stroke={2.5} /> Adicionar
                  </button>
                </Card>
              </section>
            );
          })}

          <SectionTitle>Últimos 7 dias</SectionTitle>
          <ProLock locked={!pro} title="Sua semana na alimentação" text="Veja as calorias de cada dia contra a sua meta com o Carga Pro.">
            <WeekChart rows={week} target={targets.kcal} today={today} />
          </ProLock>
          <p className="px-6 pt-4 text-[13px] leading-snug text-label-3">Valores estimados, só pra orientar. Para um plano alimentar sob medida, procure um nutricionista.</p>
        </>
      )}

      <AddSheet
        meal={adding}
        onClose={() => setAdding(null)}
        pro={pro}
        recent={recent}
        onSaved={(rows) => {
          setMeals((m) => [...m, ...rows]);
          if (day) loadDay(day);
        }}
        day={day}
      />
      <EditSheet
        meal={editing}
        onClose={() => setEditing(null)}
        onChange={(updated, removed) => {
          setMeals((list) => (removed ? list.filter((x) => x.id !== removed) : list.map((x) => (x.id === updated?.id ? updated : x))));
          if (day) loadDay(day);
        }}
      />
      <GoalsSheet
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        profile={profile}
        targets={targets}
        weight={weight}
        onSaved={(p) => setProfile(p)}
      />
    </>
  );
}

/* ---------- resumo do dia ---------- */

function Ring({ value, max }: { value: number; max: number }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const f = Math.min(1, max ? value / max : 0);
  const over = value > max * 1.05;
  return (
    <svg viewBox="0 0 132 132" className="h-[132px] w-[132px] -rotate-90" aria-hidden="true">
      <circle cx="66" cy="66" r={R} fill="none" stroke="var(--fill)" strokeWidth="12" />
      <motion.circle
        cx="66"
        cy="66"
        r={R}
        fill="none"
        stroke={over ? "var(--bad)" : "var(--accent)"}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - f) }}
        transition={{ type: "spring", stiffness: 70, damping: 18 }}
      />
    </svg>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const f = Math.min(1, target ? value / target : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-label-2">{label}</span>
        <span className="tabular text-[13px] text-label-2">
          <b className="text-[15px] text-label">{r0(value)}</b>/{r0(target)} g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fill">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${f * 100}%` }} transition={{ type: "spring", stiffness: 110, damping: 20 }} />
      </div>
    </div>
  );
}

function SummaryCard({ totals, targets }: { totals: ReturnType<typeof sum>; targets: Targets }) {
  const left = targets.kcal - totals.kcal;
  return (
    <Card className="mx-5 mt-3 flex items-center gap-5 rounded-[20px] p-5">
      <div className="relative shrink-0">
        <Ring value={totals.kcal} max={targets.kcal} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-[26px] font-bold leading-none tracking-[-0.5px]">{r0(Math.abs(left))}</span>
          <span className="mt-1 text-[12px] font-semibold text-label-2">{left >= 0 ? "kcal restantes" : "kcal acima"}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="tabular text-[13px] text-label-2">
          <b className="text-[17px] text-label">{r0(totals.kcal)}</b> de {r0(targets.kcal)} kcal
        </span>
        <MacroBar label="Proteína" value={totals.protein} target={targets.protein} color="var(--accent)" />
        <MacroBar label="Carboidrato" value={totals.carbs} target={targets.carbs} color="#34C759" />
        <MacroBar label="Gordura" value={totals.fat} target={targets.fat} color="#5AC8FA" />
      </div>
    </Card>
  );
}

function WaterCard({ ml, target, onAdd, onUndo, canUndo }: { ml: number; target: number; onAdd: (ml: number) => void; onUndo: () => void; canUndo: boolean }) {
  const cups = Math.max(1, Math.round(target / 250));
  const filled = Math.floor(ml / 250);
  return (
    <Card className="mx-5 mt-3 flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[color-mix(in_srgb,#0A84FF_16%,transparent)] text-[#0A84FF]">
            <Icon name="drop" size={18} />
          </span>
          Água
        </span>
        <span className="tabular text-[15px] text-label-2">
          <b className="text-label">{num(ml / 1000, 2)}</b> / {num(target / 1000, 2)} L
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label={`${filled} de ${cups} copos`}>
        {Array.from({ length: Math.max(cups, filled) }, (_, i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ scale: i < filled ? 1 : 0.9 }}
            className={`h-6 w-4 rounded-b-[6px] rounded-t-[3px] ${i < filled ? "bg-[#0A84FF]" : "bg-fill"}`}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onAdd(250)}>+ 250 ml</Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onAdd(500)}>+ 500 ml</Button>
        <Button variant="secondary" size="sm" aria-label="Desfazer último registro de água" disabled={!canUndo} onClick={onUndo}>
          <Icon name="undo" size={17} />
        </Button>
      </div>
    </Card>
  );
}

function WeekChart({ rows, target, today }: { rows: { eaten_on: string; kcal: number }[]; target: number; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today || todayISO(), i - 6));
  const vals = days.map((d) => rows.filter((r) => r.eaten_on === d).reduce((a, r) => a + Number(r.kcal), 0));
  const max = Math.max(target * 1.25, ...vals, 1);
  const H = 120;
  const logged = vals.filter((v) => v > 0);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  return (
    <Card className="mx-5 flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-label-2">Média dos dias registrados</span>
        <span className="tabular text-[17px] font-bold">
          {r0(avg)} <span className="text-[13px] font-medium text-label-2">kcal</span>
        </span>
      </div>
      <div className="relative" style={{ height: H + 22 }}>
        <div className="absolute inset-x-0 border-t border-dashed border-label-3" style={{ top: H - (target / max) * H }} />
        <div className="absolute inset-x-0 top-0 flex h-full items-start justify-between">
          {days.map((d, i) => {
            const h = (vals[i] / max) * H;
            const over = vals[i] > target * 1.05;
            return (
              <div key={d} className="flex w-8 flex-col items-center gap-1.5">
                <div className="flex w-full items-end" style={{ height: H }}>
                  <motion.div
                    className={`w-full rounded-t-[6px] rounded-b-[3px] ${vals[i] === 0 ? "bg-fill" : over ? "bg-[var(--bad)]" : "bg-accent"}`}
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(vals[i] ? h : 4, 4) }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 140, damping: 20 }}
                  />
                </div>
                <span className={`text-[12px] font-semibold ${d === today ? "text-accent-ink" : "text-label-3"}`}>{WEEKDAYS_LETTER[new Date(d + "T12:00:00").getDay()]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <span className="text-[12px] text-label-3">Linha tracejada: sua meta de {r0(target)} kcal</span>
    </Card>
  );
}

/* ---------- adicionar ---------- */

type Draft = FoodItem & { key: string };
const emptyDraft = (): Draft => ({ key: crypto.randomUUID(), name: "", portion: "", kcal: 0, protein: 0, carbs: 0, fat: 0 });

function NumIn({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit: string }) {
  const [txt, setTxt] = useState(value ? String(value).replace(".", ",") : "");
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12px] font-semibold text-label-2">{label}</span>
      <div className="flex h-10 items-center rounded-[10px] bg-card px-2.5 ring-accent focus-within:ring-2">
        <input
          inputMode="decimal"
          value={txt}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.,]/g, "");
            setTxt(v);
            onChange(parse(v));
          }}
          placeholder="0"
          className="tabular w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-label-3"
          aria-label={`${label} (${unit})`}
        />
        <span className="text-[12px] text-label-3">{unit}</span>
      </div>
    </label>
  );
}

function ItemEditor({ item, onChange, onRemove }: { item: Draft; onChange: (d: Draft) => void; onRemove?: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card-2 p-3">
      <div className="flex gap-2">
        <input
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          placeholder="Alimento (ex.: Arroz branco)"
          aria-label="Alimento"
          className="h-10 min-w-0 flex-1 rounded-[10px] bg-card px-3 text-[16px] font-medium outline-none ring-accent placeholder:font-normal placeholder:text-label-3 focus:ring-2"
        />
        {onRemove && (
          <button onClick={onRemove} aria-label={`Remover ${item.name || "item"}`} className="press flex h-10 w-10 items-center justify-center rounded-[10px] bg-card text-bad">
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
      <input
        value={item.portion}
        onChange={(e) => onChange({ ...item, portion: e.target.value })}
        placeholder="Porção (ex.: 4 colheres, 100 g)"
        aria-label="Porção"
        className="h-10 rounded-[10px] bg-card px-3 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2"
      />
      <div className="flex gap-1.5">
        <NumIn label="Kcal" unit="" value={item.kcal} onChange={(v) => onChange({ ...item, kcal: v })} />
        <NumIn label="Prot." unit="g" value={item.protein} onChange={(v) => onChange({ ...item, protein: v })} />
        <NumIn label="Carb." unit="g" value={item.carbs} onChange={(v) => onChange({ ...item, carbs: v })} />
        <NumIn label="Gord." unit="g" value={item.fat} onChange={(v) => onChange({ ...item, fat: v })} />
      </div>
    </div>
  );
}

function AddSheet({ meal, onClose, pro, recent, onSaved, day }: { meal: MealType | null; onClose: () => void; pro: boolean; recent: Meal[]; onSaved: (rows: Meal[]) => void; day: string }) {
  const [mt, setMt] = useState<MealType>("almoco");
  const [tab, setTab] = useState<"ia" | "manual" | "recentes">("ia");
  const [photo, setPhoto] = useState<{ data: string; preview: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Draft[]>([]);
  const [manual, setManual] = useState<Draft>(emptyDraft);
  const [added, setAdded] = useState<string[]>([]);
  const [source, setSource] = useState<"foto" | "texto">("foto");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!meal) return;
    setMt(meal);
    setTab(pro ? "ia" : recent.length ? "recentes" : "manual");
    setPhoto(null);
    setText("");
    setItems([]);
    setError("");
    setNote("");
    setManual(emptyDraft());
    setAdded([]);
  }, [meal, pro, recent.length]);

  async function pick(f?: File) {
    if (!f) return;
    setError("");
    try {
      setPhoto(await shrink(f));
      setItems([]);
    } catch {
      setError("Não consegui abrir essa foto. Tente outra.");
    }
  }

  async function analyze() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/nutricao/analisar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: photo?.data, mime: "image/jpeg", text }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não deu certo agora. Tente de novo.");
      if (!d.items?.length) throw new Error(d.note || "Não consegui identificar comida aqui.");
      setSource(photo ? "foto" : "texto");
      setItems((d.items as FoodItem[]).map((it) => ({ ...it, key: crypto.randomUUID() })));
      setNote(d.note ?? "");
      vibrate([10, 30, 10]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(list: Draft[], src: Meal["source"]) {
    const rows = list.filter((i) => i.name.trim()).map((i) => ({ eaten_on: day, meal: mt, name: i.name.trim().slice(0, 120), portion: i.portion.trim().slice(0, 80) || null, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, source: src }));
    if (!rows.length) return setError("Dê um nome ao alimento.");
    setBusy(true);
    const { data, error: err } = await supabase().from("meals").insert(rows).select();
    setBusy(false);
    if (err) return setError("Não consegui salvar. Confira os valores e tente de novo.");
    vibrate([10, 40, 10]);
    onSaved((data ?? []) as Meal[]);
    onClose();
  }

  async function quickAdd(m: Meal) {
    const { data, error: err } = await supabase()
      .from("meals")
      .insert({ eaten_on: day, meal: mt, name: m.name, portion: m.portion, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, source: "recente" })
      .select()
      .single();
    if (err || !data) return setError("Não consegui adicionar.");
    vibrate(12);
    setAdded((a) => [...a, m.id]);
    onSaved([data as Meal]);
  }

  const tot = sum(items);

  return (
    <Sheet open={!!meal} onClose={onClose} title="Adicionar alimento">
      <div className="flex flex-col gap-3">
        <Segmented value={mt} options={MEAL_OPTIONS} onChange={setMt} />
        <div className="flex gap-1.5">
          {(
            [
              ["ia", "Com IA"],
              ["recentes", "Recentes"],
              ["manual", "Manual"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={`press flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold ${tab === v ? "bg-accent text-on-accent" : "bg-card text-label-2"}`}>
              {v === "ia" && <Icon name="spark" size={14} />}
              {l}
            </button>
          ))}
        </div>

        {tab === "ia" &&
          (!pro ? (
            <Card className="flex flex-col items-center gap-2 p-5 text-center">
              <ProBadge />
              <span className="text-[17px] font-semibold">Foto do prato → calorias</span>
              <span className="text-[14px] leading-snug text-label-2">Tire uma foto ou descreva o que comeu e a IA separa cada alimento com porção, calorias e macros.</span>
              <Link href="/pro" className="press mt-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent">
                <Icon name="lock" size={16} /> Desbloquear com o Pro
              </Link>
            </Card>
          ) : items.length === 0 ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="foto-input" />
              {photo ? (
                <div className="relative overflow-hidden rounded-2xl bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.preview} alt="Foto da refeição" className="max-h-[260px] w-full object-cover" />
                  <button onClick={() => fileRef.current?.click()} className="press absolute bottom-2 right-2 flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[14px] font-semibold text-white backdrop-blur">
                    <Icon name="camera" size={16} /> Trocar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="press flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-fill bg-card px-4 py-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                    <Icon name="camera" size={24} />
                  </span>
                  <span className="text-[16px] font-semibold">Tirar ou escolher foto</span>
                  <span className="text-[13px] text-label-2">Enquadre o prato inteiro, de cima</span>
                </button>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder={photo ? "Detalhes opcionais (ex.: frango frito, 2 conchas de feijão)" : "Ou descreva: 2 ovos mexidos, 1 pão francês com manteiga e café com leite"}
                className="resize-none rounded-xl bg-card px-4 py-3 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2"
              />
              <Button size="lg" disabled={busy || (!photo && !text.trim())} onClick={analyze}>
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" /> Analisando…
                  </>
                ) : (
                  <>
                    <Icon name="spark" size={18} /> Analisar
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {note && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px] leading-snug text-accent-ink">{note}</p>}
              <span className="text-[13px] text-label-2">Confira e ajuste se precisar — são estimativas.</span>
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div key={it.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                    <ItemEditor item={it} onChange={(d) => setItems((l) => l.map((x) => (x.key === it.key ? d : x)))} onRemove={() => setItems((l) => l.filter((x) => x.key !== it.key))} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <button onClick={() => setItems((l) => [...l, emptyDraft()])} className="press flex h-10 items-center justify-center gap-1.5 text-[15px] font-semibold text-accent-ink">
                <Icon name="plus" size={16} stroke={2.5} /> Incluir outro alimento
              </button>
              <div className="tabular flex items-baseline justify-between rounded-xl bg-card px-4 py-3 text-[14px] text-label-2">
                <span>
                  <b className="text-[18px] text-label">{r0(tot.kcal)}</b> kcal
                </span>
                <span>
                  P {r0(tot.protein)} · C {r0(tot.carbs)} · G {r0(tot.fat)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="lg" onClick={() => setItems([])}>Refazer</Button>
                <Button size="lg" className="flex-1" disabled={busy || !items.length} onClick={() => save(items, source)}>
                  Salvar no {MEAL_SHORT[mt].toLowerCase()}
                </Button>
              </div>
            </>
          ))}

        {tab === "recentes" &&
          (recent.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-label-2">Os alimentos que você registrar aparecem aqui pra adicionar com um toque.</p>
          ) : (
            <Card className="overflow-hidden">
              {recent.map((m) => {
                const ok = added.includes(m.id);
                return (
                  <button key={m.id} disabled={ok} onClick={() => quickAdd(m)} className="press flex w-full items-center gap-3 border-b border-sep px-4 py-3 text-left last:border-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[16px] font-medium">{m.name}</span>
                      <span className="truncate text-[13px] text-label-2">
                        {m.portion ? `${m.portion} · ` : ""}
                        {r0(m.kcal)} kcal
                      </span>
                    </div>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${ok ? "bg-good-soft text-good" : "bg-accent-soft text-accent-ink"}`}>
                      <Icon name={ok ? "check" : "plus"} size={16} stroke={2.5} />
                    </span>
                  </button>
                );
              })}
            </Card>
          ))}

        {tab === "manual" && (
          <>
            <ItemEditor item={manual} onChange={setManual} />
            <Button size="lg" disabled={busy || !manual.name.trim()} onClick={() => save([manual], "manual")}>
              Salvar no {MEAL_SHORT[mt].toLowerCase()}
            </Button>
          </>
        )}

        {error && <p role="alert" className="text-center text-[14px] font-medium text-bad">{error}</p>}
      </div>
    </Sheet>
  );
}

/* ---------- editar ---------- */

function EditSheet({ meal, onClose, onChange }: { meal: Meal | null; onClose: () => void; onChange: (updated: Meal | null, removedId?: string) => void }) {
  const [d, setD] = useState<Draft>(emptyDraft);
  const [mt, setMt] = useState<MealType>("almoco");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meal) return;
    setD({ key: meal.id, name: meal.name, portion: meal.portion ?? "", kcal: Number(meal.kcal), protein: Number(meal.protein), carbs: Number(meal.carbs), fat: Number(meal.fat) });
    setMt(meal.meal);
  }, [meal]);

  async function save() {
    if (!meal || !d.name.trim()) return;
    setBusy(true);
    const { data } = await supabase()
      .from("meals")
      .update({ name: d.name.trim().slice(0, 120), portion: d.portion.trim() || null, kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, meal: mt })
      .eq("id", meal.id)
      .select()
      .single();
    setBusy(false);
    if (data) onChange(data as Meal);
    onClose();
  }
  async function remove() {
    if (!meal) return;
    setBusy(true);
    await supabase().from("meals").delete().eq("id", meal.id);
    setBusy(false);
    vibrate(15);
    onChange(null, meal.id);
    onClose();
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title="Editar alimento">
      {meal && (
        <div className="flex flex-col gap-3">
          <Segmented value={mt} options={MEAL_OPTIONS} onChange={setMt} />
          <ItemEditor key={meal.id} item={d} onChange={setD} />
          <div className="flex gap-2">
            <Button variant="danger" size="lg" disabled={busy} onClick={remove}>
              <Icon name="trash" size={18} /> Apagar
            </Button>
            <Button size="lg" className="flex-1" disabled={busy || !d.name.trim()} onClick={save}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- metas ---------- */

function GoalsSheet({ open, onClose, profile, targets, weight, onSaved }: { open: boolean; onClose: () => void; profile: Profile | null; targets: Targets; weight: number | null; onSaved: (p: Profile) => void }) {
  const [auto, setAuto] = useState(true);
  const [v, setV] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0);

  useEffect(() => {
    if (!open) return;
    setAuto(targets.auto);
    setV({ kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat, water: targets.water });
    setK((x) => x + 1);
  }, [open, targets]);

  const autoT = computeTargets(profile ? { ...profile, kcal_target: null, protein_target: null, carbs_target: null, fat_target: null, water_target_ml: null } : null, weight);
  const shown = auto ? autoT : v;
  const fromMacros = Math.round(v.protein * 4 + v.carbs * 4 + v.fat * 9);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const clamp = (x: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, x)));
    const patch = auto
      ? { kcal_target: null, protein_target: null, carbs_target: null, fat_target: null, water_target_ml: null }
      : { kcal_target: clamp(v.kcal, 800, 6000), protein_target: clamp(v.protein, 0, 500), carbs_target: clamp(v.carbs, 0, 1000), fat_target: clamp(v.fat, 0, 400), water_target_ml: clamp(v.water, 500, 8000) };
    const { data } = await supabase().from("profiles").update(patch).eq("id", profile.id).select().single();
    setBusy(false);
    if (data) onSaved(data as Profile);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Metas do dia">
      <div className="flex flex-col gap-3">
        <Segmented
          value={auto ? "auto" : "manual"}
          options={[
            { value: "auto", label: "Automático" },
            { value: "manual", label: "Personalizar" },
          ]}
          onChange={(x) => setAuto(x === "auto")}
        />
        {auto ? (
          <>
            <Card className="tabular grid grid-cols-2 gap-y-3 p-4 text-[15px]">
              {(
                [
                  ["Calorias", `${r0(shown.kcal)} kcal`],
                  ["Proteína", `${r0(shown.protein)} g`],
                  ["Carboidrato", `${r0(shown.carbs)} g`],
                  ["Gordura", `${r0(shown.fat)} g`],
                  ["Água", `${num(shown.water / 1000, 2)} L`],
                ] as const
              ).map(([l, val]) => (
                <div key={l} className="flex flex-col">
                  <span className="text-[13px] font-semibold text-label-2">{l}</span>
                  <span className="text-[18px] font-bold">{val}</span>
                </div>
              ))}
            </Card>
            <p className="text-[13px] leading-snug text-label-2">
              Calculado com seu peso{weight ? ` (${num(weight)} kg)` : ""}, altura, idade, dias de treino e objetivo{profile?.goal ? ` (${profile.goal.toLowerCase()})` : ""}. Atualiza sozinho quando você registra um peso novo.
            </p>
          </>
        ) : (
          <>
            <div key={k} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <NumIn label="Calorias" unit="kcal" value={v.kcal} onChange={(x) => setV((o) => ({ ...o, kcal: x }))} />
                <NumIn label="Água" unit="ml" value={v.water} onChange={(x) => setV((o) => ({ ...o, water: x }))} />
              </div>
              <div className="flex gap-2">
                <NumIn label="Proteína" unit="g" value={v.protein} onChange={(x) => setV((o) => ({ ...o, protein: x }))} />
                <NumIn label="Carboidrato" unit="g" value={v.carbs} onChange={(x) => setV((o) => ({ ...o, carbs: x }))} />
                <NumIn label="Gordura" unit="g" value={v.fat} onChange={(x) => setV((o) => ({ ...o, fat: x }))} />
              </div>
            </div>
            {Math.abs(fromMacros - v.kcal) > 100 && (
              <p className="text-[13px] leading-snug text-label-2">
                Os macros somam {r0(fromMacros)} kcal.{" "}
                <button className="font-semibold text-accent-ink" onClick={() => { setV((o) => ({ ...o, kcal: fromMacros })); setK((x) => x + 1); }}>
                  Usar {r0(fromMacros)} kcal
                </button>
              </p>
            )}
          </>
        )}
        <Button size="lg" disabled={busy} onClick={save}>
          Salvar metas
        </Button>
      </div>
    </Sheet>
  );
}
