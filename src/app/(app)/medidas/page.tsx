"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Body, DEFAULT_LABELS } from "@/components/Body";
import { LineChart } from "@/components/LineChart";
import { ProBadge } from "@/components/ProLock";
import Link from "next/link";
import { getSubscription } from "@/lib/data";
import { FREE_HISTORY_DAYS, freeCutoff, isPro } from "@/lib/pro";
import { Button, Card, Empty, Header, Icon, SectionTitle, Segmented, Sheet, Spinner, Stat } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { MEASURES, MEASURE_LABEL, type BodyMeasurement, type BodyWeight, type MeasureKey } from "@/lib/types";
import { MONTHS_LONG, fmtDate, num, todayISO, vibrate } from "@/lib/util";

type Tab = "medidas" | "peso";

export default function MeasuresPage() {
  const [tab, setTab] = useState<Tab>("medidas");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BodyMeasurement[]>([]);
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<MeasureKey | null>(null);
  const [sheet, setSheet] = useState<Tab | null>(null);
  const [pro, setPro] = useState(true);

  const load = useCallback(async () => {
    const [m, w] = await Promise.all([
      supabase().from("body_measurements").select("*").order("measured_on"),
      supabase().from("body_weights").select("*").order("measured_on"),
    ]);
    const recs = (m.data ?? []) as BodyMeasurement[];
    setRecords(recs);
    setWeights((w.data ?? []) as BodyWeight[]);
    setIdx(Math.max(0, recs.length - 1));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    getSubscription().then((s) => setPro(isPro(s)));
  }, [load]);

  // valor de cada medida em cada registro, carregando o último conhecido
  const filled = useMemo(() => {
    const last: Partial<Record<MeasureKey, number>> = {};
    return records.map((r) => {
      const o: Partial<Record<MeasureKey, number>> = {};
      for (const k of MEASURES) {
        if (r[k] != null) last[k] = Number(r[k]);
        if (last[k] != null) o[k] = last[k];
      }
      return o;
    });
  }, [records]);

  const first = useMemo(() => {
    const o: Partial<Record<MeasureKey, number>> = {};
    for (const k of MEASURES) {
      const f = filled.find((r) => r[k] != null);
      if (f) o[k] = f[k];
    }
    return o;
  }, [filled]);

  const cur = filled[idx] ?? {};
  const delta: Partial<Record<MeasureKey, number>> = {};
  const intensity: Partial<Record<MeasureKey, number>> = {};
  for (const k of MEASURES) {
    if (cur[k] == null || first[k] == null) continue;
    delta[k] = cur[k]! - first[k]!;
    const maxAbs = Math.max(0.5, ...filled.map((r) => Math.abs((r[k] ?? first[k]!) - first[k]!)));
    intensity[k] = delta[k]! / maxAbs;
  }

  const labels = DEFAULT_LABELS.filter((l) => cur[l.key] != null).map((l) => ({ ...l, text: MEASURE_LABEL[l.key], value: `${num(cur[l.key]!)} cm` }));
  const firstDate = records[0]?.measured_on;

  return (
    <>
      <Header
        title="Peso e medidas"
        back={{ href: "/evolucao", label: "Evolução" }}
        right={
          <Link href="/fotos" className="press mb-1 flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[15px] font-semibold text-accent-ink">
            <Icon name="image" size={17} /> Fotos
          </Link>
        }
      />
      <div className="px-5 pt-2">
        <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: "medidas", label: "Medidas" }, { value: "peso", label: "Peso" }]} />
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <AnimatePresence mode="wait">
          {tab === "medidas" ? (
            <motion.div key="m" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              {records.length === 0 ? (
                <div className="pt-5">
                  <Empty icon="ruler" title="Registre suas medidas" text="Com a fita métrica, anote peitoral, cintura, braço, coxa… Depois é só ir registrando de tempos em tempos para ver o corpo mudar." action={<Button onClick={() => setSheet("medidas")}>Primeiro registro</Button>} />
                </div>
              ) : (
                <>
                  <Card className="mx-5 mt-4 flex flex-col items-center gap-2 rounded-3xl px-2 pb-4 pt-5">
                    <div className="flex w-full items-center justify-between px-3">
                      <span className="text-[17px] font-semibold">{fmtDate(records[idx].measured_on, { year: true })}</span>
                      <div className="flex gap-3 text-[12px] text-label-2">
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-accent" />Cresceu</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-good-fill" />Diminuiu</span>
                      </div>
                    </div>
                    <Body delta={delta} intensity={intensity} selected={sel} labels={labels} onSelect={(k) => { vibrate(8); setSel(k); }} className="w-full max-w-[360px]" />
                    {records.length > 1 && !pro && (
                      <Link href="/pro" className="press mx-3 flex w-[calc(100%-24px)] items-center justify-center gap-2 rounded-xl bg-card-2 py-3 text-[14px] font-semibold text-accent-ink">
                        <ProBadge /> Ver a linha do tempo do corpo
                      </Link>
                    )}
                    {records.length > 1 && pro && (
                      <div className="w-full px-3">
                        <input type="range" min={0} max={records.length - 1} step={1} value={idx} onChange={(e) => { setIdx(Number(e.target.value)); vibrate(5); }} aria-label="Escolher registro" className="w-full accent-[var(--accent)]" />
                        <div className="flex justify-between text-[12px] text-label-2">
                          <span>{fmtDate(records[0].measured_on)}</span>
                          <span>{fmtDate(records.at(-1)!.measured_on)}</span>
                        </div>
                      </div>
                    )}
                  </Card>

                  <SectionTitle action={<button onClick={() => setSheet("medidas")} className="text-[15px] font-semibold text-accent-ink">Novo registro</button>}>Medidas</SectionTitle>
                  <div className="grid grid-cols-2 gap-2.5 px-5">
                    {MEASURES.map((k) => {
                      const d = delta[k];
                      const good = d != null && (k === "cintura" ? d < 0 : d > 0);
                      return (
                        <button key={k} onClick={() => setSel(sel === k ? null : k)} aria-pressed={sel === k} className={`press flex flex-col gap-0.5 rounded-2xl bg-card px-3.5 py-3 text-left ${sel === k ? "ring-2 ring-accent-ink" : ""}`}>
                          <span className="text-[13px] font-semibold text-label-2">{MEASURE_LABEL[k]}</span>
                          <span className="tabular text-[20px] font-bold">{cur[k] != null ? num(cur[k]!) : "–"}<span className="text-[13px] font-medium text-label-2"> cm</span></span>
                          <span className={`text-[12px] font-semibold ${d == null || Math.abs(d) < 0.05 || idx === 0 ? "text-label-2" : good ? "text-good" : "text-bad"}`}>
                            {d == null || idx === 0 ? "Ponto de partida" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${num(Math.abs(d))} cm desde ${fmtDate(firstDate!)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <SectionTitle>Histórico</SectionTitle>
                  <ul className="mx-5 overflow-hidden rounded-2xl bg-card">
                    {[...records].reverse().map((r) => (
                      <li key={r.id} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
                        <div className="flex flex-1 flex-col">
                          <span className="text-[16px] font-medium">{fmtDate(r.measured_on, { year: true })}</span>
                          <span className="text-[13px] text-label-2">{MEASURES.filter((k) => r[k] != null).map((k) => `${MEASURE_LABEL[k]} ${num(Number(r[k]))}`).slice(0, 3).join(" · ")}</span>
                        </div>
                        <button aria-label={`Apagar registro de ${fmtDate(r.measured_on)}`} onClick={async () => { await supabase().from("body_measurements").delete().eq("id", r.id); load(); }} className="press flex h-9 w-9 items-center justify-center rounded-full text-label-3">
                          <Icon name="trash" size={17} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="p" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
              <WeightTab weights={pro ? weights : weights.filter((w) => new Date(w.measured_on + "T12:00:00").getTime() >= freeCutoff())} hidden={pro ? 0 : weights.filter((w) => new Date(w.measured_on + "T12:00:00").getTime() < freeCutoff()).length} onAdd={() => setSheet("peso")} reload={load} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <MeasureSheet open={sheet === "medidas"} last={filled.at(-1) ?? {}} onClose={() => setSheet(null)} onSaved={load} />
      <WeightSheet open={sheet === "peso"} last={weights.at(-1)} onClose={() => setSheet(null)} onSaved={load} />
    </>
  );
}

function WeightTab({ weights, hidden = 0, onAdd, reload }: { weights: BodyWeight[]; hidden?: number; onAdd: () => void; reload: () => void }) {
  const more = hidden > 0 && (
    <Link href="/pro" className="press mx-5 mt-3 flex items-center justify-center gap-2 rounded-xl bg-card py-3 text-[14px] font-semibold text-accent-ink">
      <Icon name="lock" size={15} /> {hidden} {hidden === 1 ? "registro mais antigo" : "registros mais antigos"} no Pro
    </Link>
  );
  if (!weights.length && hidden)
    return (
      <div className="pt-5">
        <Empty icon="scale" title="Registre seu peso de hoje" text={`No grátis você vê os últimos ${FREE_HISTORY_DAYS} dias.`} action={<Button onClick={onAdd}>Registrar peso</Button>} />
        {more}
      </div>
    );
  if (!weights.length)
    return (
      <div className="pt-5">
        <Empty icon="scale" title="Registre seu peso" text="Pode ser de hoje ou de meses atrás: escolha a data e o app monta sua linha do tempo." action={<Button onClick={onAdd}>Registrar peso</Button>} />
      </div>
    );
  const last = weights.at(-1)!;
  const firstW = weights[0];
  const diff = Number(last.weight) - Number(firstW.weight);
  const withFat = weights.filter((w) => w.body_fat != null);
  // por mês: último registro de cada mês
  const byMonth = new Map<string, BodyWeight>();
  weights.forEach((w) => byMonth.set(w.measured_on.slice(0, 7), w));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <Stat label="Peso atual" value={num(Number(last.weight))} unit="kg" foot={weights.length > 1 ? `${diff >= 0 ? "+" : "−"}${num(Math.abs(diff))} kg desde ${fmtDate(firstW.measured_on)}` : fmtDate(last.measured_on)} />
        <Stat label="Gordura corporal" value={withFat.length ? num(Number(withFat.at(-1)!.body_fat)) : "–"} unit="%" foot={withFat.length > 1 ? `${Number(withFat.at(-1)!.body_fat) - Number(withFat[0].body_fat) <= 0 ? "−" : "+"}${num(Math.abs(Number(withFat.at(-1)!.body_fat) - Number(withFat[0].body_fat)))} pontos` : "Opcional"} footTone="good" />
      </div>
      {weights.length > 1 && (
        <Card className="mx-5 mt-3 p-4">
          <span className="text-[13px] font-semibold text-label-2">EVOLUÇÃO DO PESO</span>
          <LineChart label="Gráfico do peso ao longo do tempo" points={weights.map((w) => ({ x: fmtDate(w.measured_on), y: Number(w.weight) }))} format={(v) => `${num(v)} kg`} />
        </Card>
      )}
      <SectionTitle action={<button onClick={onAdd} className="text-[15px] font-semibold text-accent-ink">Registrar</button>}>Mês a mês</SectionTitle>
      <ul className="mx-5 overflow-hidden rounded-2xl bg-card">
        {[...byMonth.entries()].reverse().map(([ym, w], i, arr) => {
          const prev = arr[i + 1]?.[1];
          const d = prev ? Number(w.weight) - Number(prev.weight) : null;
          const [y, m] = ym.split("-").map(Number);
          return (
            <li key={w.id} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
              <div className="flex flex-1 flex-col">
                <span className="text-[16px] font-medium">{MONTHS_LONG[m - 1]} de {y}</span>
                <span className="text-[13px] text-label-2">Registrado em {fmtDate(w.measured_on)}{w.body_fat != null ? ` · ${num(Number(w.body_fat))}% gordura` : ""}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="tabular text-[17px] font-bold">{num(Number(w.weight))} kg</span>
                {d != null && <span className="text-[12px] font-semibold text-label-2">{d >= 0 ? "+" : "−"}{num(Math.abs(d))} kg</span>}
              </div>
              <button aria-label={`Apagar peso de ${fmtDate(w.measured_on)}`} onClick={async () => { await supabase().from("body_weights").delete().eq("id", w.id); reload(); }} className="press flex h-9 w-9 items-center justify-center rounded-full text-label-3">
                <Icon name="trash" size={17} />
              </button>
            </li>
          );
        })}
      </ul>
      {more}
    </>
  );
}

function MeasureSheet({ open, last, onClose, onSaved }: { open: boolean; last: Partial<Record<MeasureKey, number>>; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setVals({});
      setError("");
    }
  }, [open]);
  async function save() {
    const row: Record<string, unknown> = { measured_on: date };
    let any = false;
    for (const k of MEASURES) {
      const v = vals[k]?.replace(",", ".");
      if (v) {
        row[k] = Number(v);
        any = true;
      }
    }
    if (!any) return setError("Preencha pelo menos uma medida.");
    const { error } = await supabase().from("body_measurements").upsert(row, { onConflict: "user_id,measured_on" });
    if (error) return setError("Não foi possível salvar. Tente de novo.");
    vibrate([10, 30, 10]);
    onClose();
    onSaved();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Novo registro de medidas">
      <div className="flex flex-col gap-3 pt-2">
        <label className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-[15px] font-medium">Data</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[16px] text-accent-ink outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MEASURES.map((k) => (
            <label key={k} className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2.5">
              <span className="text-[12px] font-semibold text-label-2">{MEASURE_LABEL[k]} (cm)</span>
              <input inputMode="decimal" value={vals[k] ?? ""} placeholder={last[k] != null ? num(last[k]!) : "–"} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} className="tabular bg-transparent text-[20px] font-bold outline-none placeholder:font-medium placeholder:text-label-3" />
            </label>
          ))}
        </div>
        <p className="text-[13px] text-label-2">Os números em cinza são do último registro. Deixe em branco o que não mediu.</p>
        {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
        <Button size="lg" onClick={save}>Salvar medidas</Button>
      </div>
    </Sheet>
  );
}

function WeightSheet({ open, last, onClose, onSaved }: { open: boolean; last?: BodyWeight; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [w, setW] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setW("");
      setFat("");
      setError("");
    }
  }, [open]);
  async function save() {
    const weight = Number(w.replace(",", "."));
    if (!weight || weight < 25 || weight > 350) return setError("Digite um peso válido em kg.");
    const { error } = await supabase()
      .from("body_weights")
      .upsert({ measured_on: date, weight, body_fat: fat ? Number(fat.replace(",", ".")) : null }, { onConflict: "user_id,measured_on" });
    if (error) return setError("Não foi possível salvar. Tente de novo.");
    vibrate([10, 30, 10]);
    onClose();
    onSaved();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Registrar peso">
      <div className="flex flex-col gap-3 pt-2">
        <label className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-[15px] font-medium">Data</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[16px] text-accent-ink outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2.5">
            <span className="text-[12px] font-semibold text-label-2">Peso (kg)</span>
            <input inputMode="decimal" autoFocus value={w} placeholder={last ? num(Number(last.weight)) : "75,0"} onChange={(e) => setW(e.target.value)} className="tabular bg-transparent text-[24px] font-bold outline-none placeholder:font-medium placeholder:text-label-3" />
          </label>
          <label className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2.5">
            <span className="text-[12px] font-semibold text-label-2">Gordura (%) · opcional</span>
            <input inputMode="decimal" value={fat} placeholder={last?.body_fat != null ? num(Number(last.body_fat)) : "–"} onChange={(e) => setFat(e.target.value)} className="tabular bg-transparent text-[24px] font-bold outline-none placeholder:font-medium placeholder:text-label-3" />
          </label>
        </div>
        <p className="text-[13px] text-label-2">Quer registrar um mês antigo? É só mudar a data.</p>
        {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
        <Button size="lg" onClick={save}>Salvar</Button>
      </div>
    </Sheet>
  );
}
