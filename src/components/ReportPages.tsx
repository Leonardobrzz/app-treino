"use client";

import type { ReactNode } from "react";
import { Body, DEFAULT_LABELS } from "@/components/Body";
import { LineChart } from "@/components/LineChart";
import type { ReportData } from "@/lib/report";
import { MEASURES, MEASURE_LABEL, type MeasureKey } from "@/lib/types";
import { fmtDate, num } from "@/lib/util";

export const PAGE_W = 794; // A4 a 96 dpi
export const PAGE_H = 1123;
const ORANGE = "#FF9500";
const INK = "#C93400";
const GREEN = "#1E7A34";

const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), d)}`;

function Page({ n, total, children }: { n: number; total: number; children: ReactNode }) {
  return (
    <section data-report-page className="report-light relative flex flex-col overflow-hidden bg-white text-black" style={{ width: PAGE_W, height: PAGE_H, padding: "48px 56px 70px", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      {children}
      <footer className="absolute bottom-[26px] left-[56px] right-[56px] flex items-center justify-between border-t border-[#e5e5ea] pt-3 text-[11px] text-[#6e6e73]">
        <span className="flex items-center gap-1.5">
          <Logo size={16} /> Gerado pelo Carga · carga.app.br
        </span>
        <span>
          Página {n} de {total}
        </span>
      </footer>
    </section>
  );
}

function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center" style={{ width: size, height: size, borderRadius: size * 0.28, background: ORANGE }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
      </svg>
    </span>
  );
}

function H2({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-6 flex items-baseline justify-between">
      <h2 className="text-[20px] font-bold tracking-[-0.3px]">{children}</h2>
      {sub && <span className="text-[12px] text-[#6e6e73]">{sub}</span>}
    </div>
  );
}

function Box({ label, value, unit, foot, tone }: { label: string; value: string; unit?: string; foot?: string; tone?: "good" | "accent" }) {
  return (
    <div className="flex flex-col gap-1 rounded-[16px] bg-[#f2f2f7] px-4 py-3.5">
      <span className="text-[12px] font-semibold text-[#6e6e73]">{label}</span>
      <span className="text-[26px] font-bold leading-none tracking-[-0.5px]">
        {value}
        {unit && <span className="text-[13px] font-medium text-[#6e6e73]"> {unit}</span>}
      </span>
      {foot && <span className="text-[12px] font-semibold" style={{ color: tone === "good" ? GREEN : tone === "accent" ? INK : "#6e6e73" }}>{foot}</span>}
    </div>
  );
}

function Chip({ v, unit = "cm", invert = false }: { v: number; unit?: string; invert?: boolean }) {
  // cor pelo sentido da mudança: cresceu = laranja, diminuiu = verde (igual ao mapa do corpo)
  const up = v > 0.04, down = v < -0.04;
  const bg = up ? "#FFF1DE" : down ? "#E3F5E8" : "#f2f2f7";
  const fg = up ? INK : down ? GREEN : "#6e6e73";
  return (
    <span className="inline-flex min-w-[78px] justify-center rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: invert ? bg : bg, color: fg }}>
      {up || down ? `${signed(v)} ${unit}` : "igual"}
    </span>
  );
}

export function reportHighlights(d: ReportData) {
  const out: string[] = [];
  if (d.measureStart && d.measureEnd) {
    const ch = MEASURES.map((k) => ({ k, v: (d.measureEnd!.values[k] ?? NaN) - (d.measureStart!.values[k] ?? NaN) })).filter((x) => !Number.isNaN(x.v) && Math.abs(x.v) >= 0.5).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    ch.slice(0, 2).forEach((x) => out.push(`${MEASURE_LABEL[x.k]} ${x.v > 0 ? "cresceu" : "diminuiu"} ${num(Math.abs(x.v))} cm`));
  }
  const best = [...d.exercises].sort((a, b) => b.pct - a.pct)[0];
  if (best && best.pct >= 1) out.push(`${best.name}: força ${Math.round(best.pct)}% maior`);
  if (d.weights.length >= 2) {
    const dw = d.weights.at(-1)!.weight - d.weights[0].weight;
    if (Math.abs(dw) >= 0.2) out.push(`Peso ${dw > 0 ? "subiu" : "desceu"} ${num(Math.abs(dw))} kg`);
  }
  if (d.prs.length) out.push(`${d.prs.length} ${d.prs.length === 1 ? "recorde batido" : "recordes batidos"}`);
  if (d.weeklyGoal && d.workouts) out.push(`${num(d.perWeek)} treinos por semana (meta: ${d.weeklyGoal})`);
  return out.slice(0, 5);
}

export function ReportPages({ d, trainer }: { d: ReportData; trainer?: { name: string; cref: string | null } | null }) {
  const total = 3;
  const period = `${fmtDate(d.from, { year: true })} a ${fmtDate(d.to, { year: true })}`;
  const name = d.profile?.name?.trim() || "Você";
  const highlights = reportHighlights(d);

  // corpo: variação do início ao fim do período
  const start = d.measureStart?.values ?? {};
  const end = d.measureEnd?.values ?? {};
  const delta: Partial<Record<MeasureKey, number>> = {};
  const intensity: Partial<Record<MeasureKey, number>> = {};
  for (const k of MEASURES) {
    if (start[k] == null || end[k] == null) continue;
    delta[k] = end[k]! - start[k]!;
    intensity[k] = Math.max(-1, Math.min(1, delta[k]! / 3));
  }
  const labels = DEFAULT_LABELS.filter((l) => end[l.key] != null).map((l) => ({ ...l, text: MEASURE_LABEL[l.key], value: `${num(end[l.key]!)} cm` }));
  const wFirst = d.weights[0], wLast = d.weights.at(-1);
  const maxSets = Math.max(1, ...d.muscles.map((m) => m.sets));

  return (
    <>
      {/* 1. capa e resumo */}
      <Page n={1} total={total}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.4px]">
            <Logo size={38} /> Carga
          </span>
          <span className="rounded-full bg-[#FFF1DE] px-3 py-1 text-[12px] font-bold tracking-wide" style={{ color: INK }}>
            RELATÓRIO DE EVOLUÇÃO
          </span>
        </div>
        <div className="mt-9">
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-1.2px]">{name}</h1>
          <p className="mt-2 text-[16px] text-[#6e6e73]">
            {period} · gerado em {fmtDate(new Date().toISOString(), { year: true })}
          </p>
          {trainer && (
            <p className="mt-1 text-[15px] font-semibold" style={{ color: INK }}>
              Acompanhamento: {trainer.name}
              {trainer.cref ? ` · CREF ${trainer.cref}` : ""}
            </p>
          )}
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <Box label="Treinos" value={String(d.workouts)} foot={`${num(d.perWeek)} por semana`} tone={d.weeklyGoal && d.perWeek >= d.weeklyGoal ? "good" : undefined} />
          <Box label="Volume total" value={d.volume >= 10000 ? num(d.volume / 1000) : num(d.volume, 0)} unit={d.volume >= 10000 ? "t" : "kg"} foot="Peso × repetições" />
          <Box label="Séries feitas" value={String(d.sets)} foot={d.minutes ? `${d.minutes} min por treino` : undefined} />
          <Box label="Recordes" value={String(d.prs.length)} foot="Novos no período" tone={d.prs.length ? "good" : undefined} />
          <Box label="Peso" value={wLast ? num(wLast.weight) : "–"} unit={wLast ? "kg" : undefined} foot={wFirst && wLast && wFirst !== wLast ? `${signed(wLast.weight - wFirst.weight)} kg no período` : "Sem registros"} tone="accent" />
          <Box label="Cintura" value={end.cintura != null ? num(end.cintura) : "–"} unit={end.cintura != null ? "cm" : undefined} foot={delta.cintura != null ? `${signed(delta.cintura)} cm no período` : "Sem registros"} tone={delta.cintura != null && delta.cintura < 0 ? "good" : "accent"} />
        </div>

        {highlights.length > 0 && (
          <>
            <H2>Destaques do período</H2>
            <ul className="flex flex-col gap-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 rounded-[14px] border border-[#e5e5ea] px-4 py-2.5 text-[15px] font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: ORANGE }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </>
        )}

        <H2 sub={wFirst && wLast ? `${num(wFirst.weight)} → ${num(wLast.weight)} kg` : undefined}>Peso corporal</H2>
        {d.weights.length >= 2 ? (
          <div className="rounded-[16px] border border-[#e5e5ea] px-4 pb-2 pt-3">
            <LineChart points={d.weights.map((w) => ({ x: fmtDate(w.date), y: w.weight }))} height={100} format={(v) => `${num(v)} kg`} label="Peso no período" />
          </div>
        ) : (
          <p className="rounded-[16px] bg-[#f2f2f7] px-4 py-4 text-[14px] text-[#6e6e73]">Registre o peso pelo menos duas vezes no período pra ver o gráfico.</p>
        )}
      </Page>

      {/* 2. corpo */}
      <Page n={2} total={total}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[26px] font-bold tracking-[-0.5px]">Medidas do corpo</h2>
          <span className="flex gap-3 text-[12px] text-[#6e6e73]">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: ORANGE }} />Cresceu</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#34C759]" />Diminuiu</span>
          </span>
        </div>
        <p className="mt-1 text-[13px] text-[#6e6e73]">
          {d.measureEnd ? (d.measureStart ? `De ${fmtDate(d.measureStart.date, { year: true })} até ${fmtDate(d.measureEnd.date, { year: true })}` : `Registro de ${fmtDate(d.measureEnd.date, { year: true })}`) : "Sem medidas registradas no período"}
        </p>
        {d.measureEnd ? (
          <div className="mt-2 flex gap-5">
            <div className="w-[370px] shrink-0">
              <Body delta={delta} intensity={intensity} labels={labels} className="w-full" />
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <div className="grid grid-cols-[1fr_54px_54px_86px] items-center gap-y-2.5 text-[13px]">
                <span className="text-[11px] font-bold tracking-wide text-[#6e6e73]">MEDIDA</span>
                <span className="text-right text-[11px] font-bold tracking-wide text-[#6e6e73]">INÍCIO</span>
                <span className="text-right text-[11px] font-bold tracking-wide text-[#6e6e73]">FIM</span>
                <span />
                {MEASURES.filter((k) => end[k] != null).map((k) => (
                  <Row key={k} label={MEASURE_LABEL[k]} a={start[k]} b={end[k]!} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-[16px] bg-[#f2f2f7] px-4 py-4 text-[14px] text-[#6e6e73]">Registre suas medidas em Evolução → Peso e medidas pra aparecerem aqui.</p>
        )}

        <H2 sub={d.photos.start ? "Foto de frente" : undefined}>Antes e depois</H2>
        {d.photos.start ? (
          <div className="flex gap-4">
            {[d.photos.start, d.photos.end].filter(Boolean).map((p) => (
              <figure key={p!.date} className="flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p!.url} alt="" className="h-[300px] w-full rounded-[16px] object-cover" />
                <figcaption className="mt-1.5 text-center text-[12px] font-semibold text-[#6e6e73]">{fmtDate(p!.date, { year: true })}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="rounded-[16px] bg-[#f2f2f7] px-4 py-4 text-[14px] text-[#6e6e73]">Tire fotos de progresso no app (Evolução → Fotos de progresso) que elas aparecem aqui, lado a lado.</p>
        )}
      </Page>

      {/* 3. força e rotina */}
      <Page n={3} total={total}>
        <h2 className="text-[26px] font-bold tracking-[-0.5px]">Força e treinos</h2>
        <p className="mt-1 text-[13px] text-[#6e6e73]">Força pelo 1RM estimado (carga × repetições, fórmula de Epley): primeira e última vez no período.</p>
        {d.exercises.length ? (
          <div className="mt-4 overflow-hidden rounded-[16px] border border-[#e5e5ea]">
            <div className="grid grid-cols-[1fr_70px_70px_80px] bg-[#f2f2f7] px-4 py-2 text-[11px] font-bold tracking-wide text-[#6e6e73]">
              <span>EXERCÍCIO</span><span className="text-right">INÍCIO</span><span className="text-right">FIM</span><span className="text-right">MUDANÇA</span>
            </div>
            {d.exercises.map((e) => (
              <div key={e.name} className="grid grid-cols-[1fr_70px_70px_80px] items-center border-t border-[#e5e5ea] px-4 py-2 text-[13px]">
                <span className="truncate font-semibold">{e.name}</span>
                <span className="text-right">{num(e.start)} kg</span>
                <span className="text-right font-semibold">{num(e.end)} kg</span>
                <span className="text-right font-bold" style={{ color: e.pct > 0.5 ? GREEN : e.pct < -0.5 ? "#B42318" : "#6e6e73" }}>{e.pct > 0.5 || e.pct < -0.5 ? `${e.pct > 0 ? "+" : "−"}${Math.round(Math.abs(e.pct))}%` : "igual"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-[16px] bg-[#f2f2f7] px-4 py-4 text-[14px] text-[#6e6e73]">Faça cada exercício pelo menos duas vezes no período pra comparar a força.</p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-5">
          <div>
            <H2>Recordes</H2>
            {d.prs.length ? (
              <ul className="flex flex-col gap-1.5">
                {d.prs.map((p) => (
                  <li key={p.name + p.date} className="flex items-center justify-between rounded-[12px] bg-[#f2f2f7] px-3 py-2 text-[12px]">
                    <span className="min-w-0 truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 pl-2 text-[#6e6e73]">{num(p.weight)} kg × {p.reps} · {fmtDate(p.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#6e6e73]">Nenhum recorde novo neste período.</p>
            )}
          </div>
          <div>
            <H2>Séries por músculo</H2>
            {d.muscles.length ? (
              <div className="flex flex-col gap-2">
                {d.muscles.map((m) => (
                  <div key={m.group} className="flex items-center gap-2 text-[12px]">
                    <span className="w-[86px] shrink-0 truncate font-semibold">{m.group}</span>
                    <span className="h-3 rounded-full" style={{ width: `${(m.sets / maxSets) * 100}%`, maxWidth: 170, background: ORANGE }} />
                    <span className="text-[#6e6e73]">{m.sets}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#6e6e73]">Sem treinos no período.</p>
            )}
          </div>
        </div>

        <H2 sub={d.nutrition ? `${d.nutrition.days} dias registrados` : undefined}>Alimentação (média por dia)</H2>
        {d.nutrition ? (
          <div className="grid grid-cols-4 gap-3">
            <Box label="Calorias" value={num(d.nutrition.kcal, 0)} unit="kcal" foot={d.profile?.kcal_target ? `Meta: ${d.profile.kcal_target}` : undefined} />
            <Box label="Proteína" value={num(d.nutrition.protein, 0)} unit="g" foot={d.profile?.protein_target ? `Meta: ${d.profile.protein_target} g` : undefined} />
            <Box label="Carboidrato" value={num(d.nutrition.carbs, 0)} unit="g" foot={d.profile?.carbs_target ? `Meta: ${d.profile.carbs_target} g` : undefined} />
            <Box label="Gordura" value={num(d.nutrition.fat, 0)} unit="g" foot={d.profile?.fat_target ? `Meta: ${d.profile.fat_target} g` : undefined} />
          </div>
        ) : (
          <p className="rounded-[16px] bg-[#f2f2f7] px-4 py-4 text-[14px] text-[#6e6e73]">Sem refeições registradas no período.</p>
        )}
        <p className="mt-auto pt-4 text-[11px] leading-snug text-[#8e8e93]">
          Relatório informativo, feito a partir dos registros no app. Não substitui a avaliação de um educador físico, nutricionista ou médico.
        </p>
      </Page>
    </>
  );
}

function Row({ label, a, b }: { label: string; a?: number; b: number }) {
  return (
    <>
      <span className="font-semibold">{label}</span>
      <span className="text-right text-[#6e6e73]">{a != null ? num(a) : "–"}</span>
      <span className="text-right font-semibold">{num(b)}</span>
      <span className="text-right">{a != null ? <Chip v={b - a} /> : null}</span>
    </>
  );
}
