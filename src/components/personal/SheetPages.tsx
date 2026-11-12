"use client";

import type { ReactNode } from "react";
import { BrandMark, H2, Logo, PAGE_H, PAGE_W } from "@/components/ReportPages";
import { methodLabel, METHODS, type PlanDayT } from "@/lib/personal";
import { WEEKDAYS, fmtDate, num } from "@/lib/util";

export type DietMeal = { name: string; time: string; items: string[]; notes: string };
export type DietTargets = { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; water?: number | null };
export type Diet = { id?: string; title: string; targets: DietTargets; meals: DietMeal[]; notes: string | null; created_at?: string };

type Who = { student: string; trainer: string; cref: string | null };

function Sheet({ n, total, children }: { n: number; total: number; children: ReactNode }) {
  return (
    <section data-report-page className="report-light relative flex flex-col overflow-hidden bg-white text-black" style={{ width: PAGE_W, height: PAGE_H, padding: "48px 56px 70px", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      {children}
      <footer className="absolute bottom-[26px] left-[56px] right-[56px] flex items-center justify-between border-t border-[#e5e5ea] pt-3 text-[11px] text-[#6e6e73]">
        <span className="flex items-center gap-1.5">
          <Logo size={16} /> Gerado pelo Carga · carga.app.br
        </span>
        <span>Página {n} de {total}</span>
      </footer>
    </section>
  );
}

function Head({ kind, title, who }: { kind: string; title: string; who: Who }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <BrandMark size={34} text={20} />
        <span className="rounded-full bg-[#FFF1DE] px-3 py-1 text-[12px] font-bold tracking-wide text-[#C93400]">{kind}</span>
      </div>
      <h1 className="mt-6 text-[32px] font-extrabold leading-tight tracking-[-0.8px]">{title}</h1>
      <p className="mt-1 text-[15px] text-[#6e6e73]">
        Aluno: <b className="text-black">{who.student}</b> · Personal: <b className="text-black">{who.trainer}</b>
        {who.cref ? ` · CREF ${who.cref}` : ""} · {fmtDate(new Date().toISOString(), { year: true })}
      </p>
    </>
  );
}

/** Divide blocos em páginas por "peso" (linhas) */
function paginate<T>(items: T[], weight: (t: T) => number, first: number, rest: number) {
  const pages: T[][] = [[]];
  let cap = first;
  let used = 0;
  for (const it of items) {
    const w = weight(it);
    if (used + w > cap && pages.at(-1)!.length) {
      pages.push([]);
      cap = rest;
      used = 0;
    }
    pages.at(-1)!.push(it);
    used += w;
  }
  return pages;
}

export function WorkoutSheetPages({ name, days, who }: { name: string; days: PlanDayT[]; who: Who }) {
  const pages = paginate(days, (d) => 3 + d.exercises.length * 1.25 + d.exercises.filter((e) => e.notes || e.method).length * 0.6, 21, 26);
  const usedMethods = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.method).filter(Boolean)))] as string[];
  return (
    <>
      {pages.map((list, pi) => (
        <Sheet key={pi} n={pi + 1} total={pages.length}>
          {pi === 0 && <Head kind="FICHA DE TREINO" title={name} who={who} />}
          {list.map((d) => (
            <div key={d.weekday} className="break-inside-avoid">
              <H2 sub={`${d.exercises.length} exercícios`}>
                {WEEKDAYS[d.weekday]} · {d.title}
              </H2>
              <div className="overflow-hidden rounded-[14px] border border-[#e5e5ea]">
                <div className="grid grid-cols-[28px_1fr_70px_70px_70px_70px] bg-[#f2f2f7] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]">
                  <span>#</span>
                  <span>Exercício</span>
                  <span className="text-center">Séries</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">Carga</span>
                  <span className="text-center">Descanso</span>
                </div>
                {d.exercises.map((e, i) => (
                  <div key={i} className="border-t border-[#e5e5ea] px-3 py-2">
                    <div className="grid grid-cols-[28px_1fr_70px_70px_70px_70px] items-center text-[13px]">
                      <span className="font-bold text-[#8e8e93]">{i + 1}</span>
                      <span className="font-semibold">
                        {e.name}
                        {e.method && <span className="ml-2 rounded-full bg-[#FF9500] px-2 py-0.5 text-[10px] font-bold text-black">{methodLabel(e.method)}</span>}
                      </span>
                      <span className="text-center font-semibold">{e.sets}</span>
                      <span className="text-center font-semibold">{e.reps}</span>
                      <span className="text-center">{e.target_weight ? `${num(Number(e.target_weight))} kg` : "—"}</span>
                      <span className="text-center">{e.rest_seconds}s</span>
                    </div>
                    {e.notes && <div className="pl-[28px] pt-0.5 text-[11.5px] text-[#6e6e73]">{e.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {pi === pages.length - 1 && usedMethods.length > 0 && (
            <div className="mt-6 rounded-[14px] bg-[#f2f2f7] p-4 text-[12px]">
              <b>Métodos:</b>{" "}
              {usedMethods.map((m) => `${methodLabel(m)} — ${METHODS.find((x) => x.value === m)?.hint}`).join(" · ")}
            </div>
          )}
        </Sheet>
      ))}
    </>
  );
}

export function DietSheetPages({ diet, who }: { diet: Diet; who: Who }) {
  const pages = paginate(diet.meals, (m) => 2.5 + m.items.length * 0.8 + (m.notes ? 0.8 : 0), 18, 26);
  const t = diet.targets;
  const boxes = [
    ["Calorias", t.kcal, "kcal"],
    ["Proteína", t.protein, "g"],
    ["Carboidrato", t.carbs, "g"],
    ["Gordura", t.fat, "g"],
    ["Água", t.water ? t.water / 1000 : null, "L"],
  ].filter(([, v]) => v);
  return (
    <>
      {pages.map((list, pi) => (
        <Sheet key={pi} n={pi + 1} total={pages.length}>
          {pi === 0 && (
            <>
              <Head kind="ORIENTAÇÃO ALIMENTAR" title={diet.title} who={who} />
              {boxes.length > 0 && (
                <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${boxes.length}, minmax(0,1fr))` }}>
                  {boxes.map(([l, v, u]) => (
                    <div key={l as string} className="rounded-[14px] bg-[#f2f2f7] px-3 py-3">
                      <div className="text-[11px] font-semibold text-[#6e6e73]">{l as string} por dia</div>
                      <div className="text-[22px] font-bold">
                        {num(Number(v))}
                        <span className="text-[12px] font-medium text-[#6e6e73]"> {u as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {list.map((m, i) => (
            <div key={i}>
              <H2 sub={m.time || undefined}>{m.name}</H2>
              <ul className="overflow-hidden rounded-[14px] border border-[#e5e5ea]">
                {m.items.map((it, j) => (
                  <li key={j} className="flex gap-2 border-t border-[#e5e5ea] px-4 py-2 text-[13.5px] first:border-t-0">
                    <span className="text-[#FF9500]">●</span>
                    {it}
                  </li>
                ))}
              </ul>
              {m.notes && <p className="mt-1.5 text-[12px] text-[#6e6e73]">{m.notes}</p>}
            </div>
          ))}
          {pi === pages.length - 1 && diet.notes && (
            <div className="mt-6 rounded-[14px] bg-[#f2f2f7] p-4 text-[12.5px] leading-snug">
              <b>Observações:</b> {diet.notes}
            </div>
          )}
          {pi === pages.length - 1 && <p className="mt-4 text-[10.5px] text-[#8e8e93]">Orientação do seu personal trainer. Para dietas com fins clínicos, procure um nutricionista.</p>}
        </Sheet>
      ))}
    </>
  );
}
