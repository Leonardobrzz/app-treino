"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Card, Icon, Segmented, Spinner } from "@/components/ui";
import { type StudentDetail } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { MEAL_LABEL, type MealType } from "@/lib/types";
import { fmtDate, num, todayISO } from "@/lib/util";

type Meal = { eaten_on: string; meal: MealType; name: string; portion: string | null; kcal: number; protein: number; carbs: number; fat: number; source: string | null };
type Data = { targets: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; water: number | null }; meals: Meal[]; water: { day: string; ml: number }[] };

export function MealsTab({ d }: { d: StudentDetail }) {
  const [range, setRange] = useState<"7" | "14" | "30">("7");
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    const from = new Date();
    from.setDate(from.getDate() - Number(range) + 1);
    supabase().rpc("trainer_student_meals", { p_student: d.profile.id, p_from: todayISO(from), p_to: todayISO() }).then(({ data: x }) => setData(x as Data));
  }, [d, range]);

  const days = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Meal[]>();
    data.meals.forEach((m) => (map.get(m.eaten_on) ?? map.set(m.eaten_on, []).get(m.eaten_on)!).push(m));
    const water = new Map(data.water.map((w) => [w.day, Number(w.ml)]));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, ms]) => ({
      day,
      ms,
      kcal: ms.reduce((a, m) => a + Number(m.kcal), 0),
      protein: ms.reduce((a, m) => a + Number(m.protein), 0),
      water: water.get(day) ?? 0,
    }));
  }, [data]);

  const t = data?.targets;
  const avg = days.length ? { kcal: days.reduce((a, x) => a + x.kcal, 0) / days.length, protein: days.reduce((a, x) => a + x.protein, 0) / days.length } : null;

  return (
    <div className="pt-3">
      <div className="mx-5">
        <Segmented value={range} onChange={setRange} options={[{ value: "7", label: "7 dias" }, { value: "14", label: "14 dias" }, { value: "30", label: "30 dias" }]} />
      </div>
      {!data ? (
        <Spinner />
      ) : days.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] leading-snug text-label-2">O aluno não registrou refeições nesse período. Ele registra em Nutrição (por foto do prato ou texto).</p>
      ) : (
        <>
          <div className="mx-5 mt-3 grid grid-cols-2 gap-2.5">
            <Card className="flex flex-col px-3.5 py-3">
              <span className="text-[12px] font-semibold text-label-2">Média de calorias</span>
              <span className="tabular text-[20px] font-bold">{num(avg!.kcal, 0)} <span className="text-[12px] font-medium text-label-2">{t?.kcal ? `de ${t.kcal}` : "kcal"}</span></span>
            </Card>
            <Card className="flex flex-col px-3.5 py-3">
              <span className="text-[12px] font-semibold text-label-2">Média de proteína</span>
              <span className="tabular text-[20px] font-bold">{num(avg!.protein, 0)} g <span className="text-[12px] font-medium text-label-2">{t?.protein ? `de ${t.protein}` : ""}</span></span>
            </Card>
          </div>
          <p className="mx-5 mt-2 text-[12px] text-label-3">{days.length} de {range} dias com registro.</p>
          <div className="mx-5 mt-3 flex flex-col gap-2">
            {days.map((x, i) => {
              const pk = t?.kcal ? Math.min(1.3, x.kcal / t.kcal) : null;
              return (
                <motion.div key={x.day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                  <Card className="overflow-hidden">
                    <button onClick={() => setOpen((o) => (o === x.day ? null : x.day))} aria-expanded={open === x.day} className="press flex w-full flex-col gap-2 p-3.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold">{fmtDate(x.day)}</span>
                        <span className="tabular text-[14px] font-semibold">
                          {num(x.kcal, 0)} kcal · {num(x.protein, 0)} g prot{x.water ? ` · ${num(x.water / 1000, 1)} L` : ""}
                        </span>
                      </div>
                      {pk != null && (
                        <div className="h-2 overflow-hidden rounded-full bg-fill">
                          <motion.div className={`h-full rounded-full ${pk > 1.1 ? "bg-bad-fill" : pk >= 0.85 ? "bg-good-fill" : "bg-accent"}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pk * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                        </div>
                      )}
                    </button>
                    <AnimatePresence>
                      {open === x.day && (
                        <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          {x.ms.map((m, j) => (
                            <li key={j} className="flex items-center justify-between gap-3 border-t border-sep px-3.5 py-2 text-[13px]">
                              <span className="min-w-0">
                                <span className="text-label-2">{MEAL_LABEL[m.meal] ?? m.meal} · </span>
                                <span className="font-medium">{m.name}</span>
                                {m.portion ? <span className="text-label-3"> ({m.portion})</span> : null}
                                {m.source === "foto" && <Icon name="camera" size={12} className="ml-1 inline text-label-3" />}
                              </span>
                              <span className="tabular shrink-0 text-label-2">{num(Number(m.kcal), 0)} kcal</span>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          {t?.kcal && <p className="mx-5 mt-2 text-[12px] text-label-3">Barra: verde perto da meta, laranja abaixo, vermelho bem acima.</p>}
        </>
      )}
    </div>
  );
}
