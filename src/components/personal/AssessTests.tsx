"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Card, Icon } from "@/components/ui";
import { CARDIO_PROTOCOLS, FMS_SCORE_LABEL, FMS_TESTS, fmsTestScore, fmsTone, vo2Class, type CardioData, type CardioId, type FmsScore, type FunctionalData, type Sex, type Stage } from "@/lib/assess-tests";
import { num } from "@/lib/util";

const box = "h-11 w-full rounded-xl bg-card px-3 text-[16px] font-semibold outline-none ring-accent focus:ring-2";
const cell = "h-10 w-full min-w-0 rounded-lg bg-card px-2 text-center text-[15px] font-semibold outline-none ring-accent focus:ring-2";
const toneCls = (t: string) => (t === "good" ? "text-good" : t === "bad" ? "text-bad" : t === "accent" ? "text-accent-ink" : "text-label-2");

/** Explicação do protocolo, recolhível */
function HowTo({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-semibold text-accent-ink">
        <Icon name="help" size={16} /> Como aplicar este protocolo
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="ml-auto text-label-3">
          <Icon name="chevron" size={15} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex list-decimal flex-col gap-1.5 overflow-hidden pb-3 pl-9 pr-4 text-[14px] leading-snug text-label-2">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- cardio
export function CardioForm({ value, onChange, sex, age, result }: { value: CardioData; onChange: (v: CardioData) => void; sex: Sex; age: number | null; result: CardioData }) {
  const proto = CARDIO_PROTOCOLS.find((p) => p.id === value.protocol)!;
  const hrMax = result.hrMax;
  const pick = (id: CardioId) => {
    const p = CARDIO_PROTOCOLS.find((x) => x.id === id)!;
    onChange({ protocol: id, inputs: {}, stages: p.stages ? p.defaultStages!.map((s) => ({ ...s })) : undefined });
  };
  const setStage = (i: number, k: keyof Stage, v: string) => onChange({ ...value, stages: value.stages!.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const cls = result.vo2 != null ? vo2Class(result.vo2, sex, age) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {CARDIO_PROTOCOLS.map((p) => (
          <button key={p.id} onClick={() => pick(p.id)} aria-pressed={p.id === value.protocol} className={`press flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2.5 text-left ${p.id === value.protocol ? "bg-accent text-on-accent" : "bg-card"}`}>
            <span className="text-[14px] font-semibold">{p.name}</span>
            <span className={`text-[12px] ${p.id === value.protocol ? "opacity-80" : "text-label-2"}`}>{p.where}</span>
          </button>
        ))}
      </div>
      <HowTo lines={proto.how} />
      {proto.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {proto.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
              {f.label}
              {f.unit ? ` (${f.unit})` : ""}
              <input inputMode="decimal" value={value.inputs[f.key] ?? ""} onChange={(e) => onChange({ ...value, inputs: { ...value.inputs, [f.key]: e.target.value } })} className={box} />
            </label>
          ))}
        </div>
      )}
      {proto.stages && value.stages && (
        <Card className="overflow-hidden p-3">
          <div className="grid grid-cols-[34px_1fr_1fr_1fr_1fr_1fr] gap-1.5 pb-1.5 text-center text-[11px] font-semibold text-label-2">
            <span>#</span>
            <span>Até (min)</span>
            <span>km/h</span>
            <span>Incl. %</span>
            <span>FC</span>
            <span>Borg</span>
          </div>
          {value.stages.map((s, i) => {
            const pct = hrMax && s.hr ? Math.round((Number(s.hr) / hrMax) * 100) : null;
            return (
              <div key={i} className="grid grid-cols-[34px_1fr_1fr_1fr_1fr_1fr] items-center gap-1.5 py-0.5">
                <span className="text-center text-[13px] font-bold text-label-2">{i + 1}</span>
                {(["min", "speed", "grade"] as const).map((k) => (
                  <input key={k} inputMode="decimal" aria-label={`Estágio ${i + 1} ${k}`} value={s[k]} onChange={(e) => setStage(i, k, e.target.value)} className={cell} />
                ))}
                <div className="relative">
                  <input inputMode="numeric" aria-label={`Estágio ${i + 1} FC`} value={s.hr} onChange={(e) => setStage(i, "hr", e.target.value.replace(/\D/g, "").slice(0, 3))} className={cell} />
                  {pct != null && <span className={`absolute -bottom-0.5 right-1 text-[9px] font-bold ${pct >= 90 ? "text-bad" : "text-label-3"}`}>{pct}%</span>}
                </div>
                <input inputMode="numeric" aria-label={`Estágio ${i + 1} esforço`} value={s.rpe} onChange={(e) => setStage(i, "rpe", e.target.value.replace(/\D/g, "").slice(0, 2))} className={cell} />
              </div>
            );
          })}
          <div className="mt-2 flex items-center justify-between">
            <button onClick={() => onChange({ ...value, stages: [...value.stages!, { min: "", speed: "", grade: value.stages!.at(-1)?.grade ?? "", hr: "", rpe: "" }] })} className="press flex h-9 items-center gap-1 rounded-full bg-card-2 px-3 text-[13px] font-semibold text-accent-ink">
              <Icon name="plus" size={14} /> Estágio
            </button>
            {value.stages.length > 1 && (
              <button onClick={() => onChange({ ...value, stages: value.stages!.slice(0, -1) })} className="press h-9 px-2 text-[13px] font-semibold text-label-2">
                Tirar o último
              </button>
            )}
          </div>
          <p className="pt-2 text-[12px] leading-snug text-label-2">{hrMax ? `FC máxima prevista: ${hrMax} bpm (Tanaka). ` : ""}Borg: 6 a 20 (12–13 moderado, 15–16 intenso, 19–20 máximo).</p>
        </Card>
      )}
      <Card className={`flex items-center gap-3 p-4 ${result.vo2 != null || result.pctPredicted != null ? "" : "opacity-60"}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name="heart" size={22} />
        </span>
        {result.vo2 != null ? (
          <div className="flex flex-col">
            <span className="text-[13px] text-label-2">VO2máx estimado</span>
            <span className="text-[24px] font-bold leading-tight">
              {num(result.vo2)} <span className="text-[14px] font-semibold text-label-2">ml/kg/min</span> {cls && <span className={`text-[14px] ${toneCls(cls.tone)}`}>{cls.label}</span>}
            </span>
          </div>
        ) : result.pctPredicted != null ? (
          <div className="flex flex-col">
            <span className="text-[13px] text-label-2">Distância vs. prevista</span>
            <span className="text-[24px] font-bold leading-tight">
              {result.pctPredicted}% <span className="text-[14px] text-accent-ink">{result.classLabel}</span>
            </span>
          </div>
        ) : (
          <span className="text-[14px] text-label-2">Preencha {proto.stages ? "a FC ou o Borg de pelo menos um estágio" : "os campos"}{value.protocol === "rockport" || value.protocol === "tc6" || value.protocol === "queens" ? ", o sexo, a idade e o peso" : ""} pra calcular.</span>
        )}
      </Card>
    </div>
  );
}

export function CardioView({ c }: { c: CardioData }) {
  const proto = CARDIO_PROTOCOLS.find((p) => p.id === c.protocol);
  const done = (c.stages ?? []).filter((s) => s.hr || s.rpe);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name="heart" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] text-label-2">{proto?.name ?? "Cardiorrespiratória"}</span>
          <span className="text-[20px] font-bold leading-tight">{c.vo2 != null ? <>{num(c.vo2)} <span className="text-[13px] font-semibold text-label-2">ml/kg/min</span></> : c.pctPredicted != null ? `${c.pctPredicted}% do previsto` : "—"}</span>
        </div>
        {c.classLabel && <span className="rounded-full bg-fill px-2.5 py-1 text-[12px] font-bold">{c.classLabel}</span>}
      </div>
      {done.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-card-2">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[11px] font-semibold text-label-2">
            <span>Até</span>
            <span>km/h</span>
            <span>Incl.</span>
            <span>FC</span>
            <span>Borg</span>
          </div>
          {done.map((s, i) => (
            <div key={i} className="tabular grid grid-cols-5 border-t border-sep px-3 py-1.5 text-[13px] font-semibold">
              <span>{s.min || "–"} min</span>
              <span>{s.speed || "–"}</span>
              <span>{s.grade || "0"}%</span>
              <span>{s.hr || "–"}</span>
              <span>{s.rpe || "–"}</span>
            </div>
          ))}
        </div>
      )}
      {Object.entries(c.inputs ?? {}).filter(([, v]) => v).length > 0 && (
        <p className="text-[13px] text-label-2">
          {proto?.fields
            .filter((f) => c.inputs[f.key])
            .map((f) => `${f.label}: ${c.inputs[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- funcional
export function FmsForm({ value, onChange, result }: { value: FunctionalData; onChange: (v: FunctionalData) => void; result: FunctionalData }) {
  const set = (id: string, patch: Partial<FmsScore>) => onChange({ ...value, scores: { ...value.scores, [id]: { ...value.scores[id], ...patch } } });
  return (
    <div className="flex flex-col gap-3">
      <HowTo
        lines={[
          "Functional Movement Screen (FMS): 7 testes de movimento, nota de 0 a 3 em cada.",
          "3 = faz sem compensação · 2 = faz com compensação · 1 = não completa · 0 = sentiu dor.",
          "Nos testes de um lado só, vale a menor nota entre direito e esquerdo. Notas diferentes indicam assimetria.",
          "Total de 21. Abaixo de 14 indica risco maior de lesão; qualquer dor deve ser encaminhada.",
        ]}
      />
      {FMS_TESTS.map((t, i) => {
        const s = value.scores[t.id] ?? {};
        const score = fmsTestScore(t, s);
        return (
          <Card key={t.id} className="flex flex-col gap-2.5 p-4">
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-[13px] font-bold">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-semibold">{t.name}</span>
                <span className="text-[13px] leading-snug text-label-2">{t.how}</span>
              </div>
              {score != null && <span className={`text-[20px] font-bold ${score === 3 ? "text-good" : score === 0 ? "text-bad" : score === 1 ? "text-bad" : "text-accent-ink"}`}>{score}</span>}
            </div>
            <details className="text-[12px] leading-snug text-label-2">
              <summary className="cursor-pointer font-semibold text-accent-ink">Critérios das notas</summary>
              <p className="pt-1"><b>3:</b> {t.three}</p>
              <p><b>2:</b> {t.two}</p>
              <p><b>1:</b> {t.one}</p>
              {t.clearing && <p className="pt-1"><b>Teste de dor:</b> {t.clearing}</p>}
            </details>
            {t.bilateral ? (
              <>
                <ScoreRow name={t.name} side="Direito" k="r" s={s} onSet={(p) => set(t.id, p)} />
                <ScoreRow name={t.name} side="Esquerdo" k="l" s={s} onSet={(p) => set(t.id, p)} />
              </>
            ) : (
              <ScoreRow name={t.name} k="s" s={s} onSet={(p) => set(t.id, p)} />
            )}
            <label className="flex items-center gap-2 text-[13px] font-semibold text-label-2">
              <input type="checkbox" checked={!!s.pain} onChange={(e) => set(t.id, { pain: e.target.checked })} className="h-4 w-4 accent-[var(--bad-fill)]" />
              Sentiu dor (nota 0)
            </label>
          </Card>
        );
      })}
      <FmsSummary f={result} />
    </div>
  );
}

function ScoreRow({ name, side, k, s, onSet }: { name: string; side?: string; k: "l" | "r" | "s"; s: FmsScore; onSet: (p: Partial<FmsScore>) => void }) {
  return (
    <div className="flex items-center gap-2">
      {side && <span className="w-16 text-[12px] font-semibold text-label-2">{side}</span>}
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {[1, 2, 3].map((v) => (
          <button key={v} disabled={s.pain} onClick={() => onSet({ [k]: v })} aria-pressed={s[k] === v} aria-label={`${name}${side ? ` ${side}` : ""}: nota ${v}`} className={`press h-10 rounded-lg text-[15px] font-bold disabled:opacity-40 ${s[k] === v ? "bg-accent text-on-accent" : "bg-card-2"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function FmsSummary({ f }: { f: FunctionalData }) {
  const tone = fmsTone(f.classLabel);
  return (
    <Card className={`flex flex-col gap-2 p-4 ${f.total == null ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name="body" size={22} />
        </span>
        {f.total != null ? (
          <div className="flex flex-col">
            <span className="text-[13px] text-label-2">Pontuação total</span>
            <span className="text-[24px] font-bold leading-tight">
              {f.total}/21 <span className={`text-[14px] ${toneCls(tone)}`}>{f.classLabel}</span>
            </span>
          </div>
        ) : (
          <span className="text-[14px] text-label-2">Dê nota aos 7 testes pra ver o total.</span>
        )}
      </div>
      {f.total != null && (
        <div className="h-2 overflow-hidden rounded-full bg-fill">
          <motion.div className={`h-full rounded-full ${tone === "good" ? "bg-good-fill" : tone === "bad" ? "bg-bad-fill" : "bg-accent"}`} initial={{ width: 0 }} animate={{ width: `${(f.total / 21) * 100}%` }} />
        </div>
      )}
      {!!f.asym?.length && <p className="text-[13px] leading-snug text-bad">Assimetria em: {f.asym.join(", ").toLowerCase()}.</p>}
    </Card>
  );
}

export function FmsView({ f }: { f: FunctionalData }) {
  return (
    <div className="flex flex-col gap-2">
      <FmsSummary f={f} />
      <Card className="overflow-hidden">
        {FMS_TESTS.map((t) => {
          const s = f.scores[t.id];
          const v = fmsTestScore(t, s);
          return (
            <div key={t.id} className="flex items-center gap-3 border-b border-sep px-4 py-2.5 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">{t.name}</span>
                <span className="text-[12px] text-label-2">{v == null ? "Não avaliado" : FMS_SCORE_LABEL[v]}{t.bilateral && s?.l != null && s?.r != null && !s.pain ? ` · D ${s.r} / E ${s.l}` : ""}</span>
              </div>
              <span className={`tabular text-[17px] font-bold ${v === 3 ? "text-good" : v == null ? "text-label-3" : v <= 1 ? "text-bad" : "text-accent-ink"}`}>{v ?? "–"}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
