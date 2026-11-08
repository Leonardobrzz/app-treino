"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ProLock } from "@/components/ProLock";
import { Button, Card, Header, Icon, SectionTitle, Spinner, Stat } from "@/components/ui";
import { getSubscription } from "@/lib/data";
import { isPro } from "@/lib/pro";
import { supabase } from "@/lib/supabase/client";
import { MONTHS, num, todayISO, weekStart } from "@/lib/util";
import { weekSummary, type WeekSummary } from "@/lib/week-summary";

function rangeLabel(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return start.getMonth() === end.getMonth() ? `${start.getDate()} a ${end.getDate()} de ${MONTHS[end.getMonth()]}` : `${start.getDate()} de ${MONTHS[start.getMonth()]} a ${end.getDate()} de ${MONTHS[end.getMonth()]}`;
}

/** Semana padrão: a última completa */
function lastFullWeek() {
  const s = weekStart(new Date());
  s.setDate(s.getDate() - 7);
  return s;
}

export default function WeekReportPage() {
  const [start, setStart] = useState<Date | null>(null);
  const [data, setData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pro, setPro] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("semana");
    const d = q ? weekStart(new Date(q + "T12:00:00")) : lastFullWeek();
    setStart(d);
    getSubscription().then((s) => setPro(isPro(s)));
  }, []);

  const from = start ? todayISO(start) : "";
  const to = useMemo(() => {
    if (!start) return "";
    const e = new Date(start);
    e.setDate(e.getDate() + 6);
    return todayISO(e);
  }, [start]);
  const current = start ? start.getTime() === weekStart(new Date()).getTime() : false;

  useEffect(() => {
    if (!start) return;
    history.replaceState(null, "", `/resumo?semana=${todayISO(start)}`);
    let alive = true;
    setLoading(true);
    setReport(null);
    setError("");
    (async () => {
      const [s, r] = await Promise.all([weekSummary(supabase(), start.toISOString(), from, to), fetch(`/api/resumo?from=${from}`).then((x) => x.json()).catch(() => ({}))]);
      if (!alive) return;
      setData(s);
      setReport(r.report?.text ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [start, from, to]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/resumo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start: start!.toISOString(), from, to }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não deu certo agora.");
      setReport(d.report.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const move = (k: number) =>
    setStart((s) => {
      const d = new Date(s!);
      d.setDate(d.getDate() + 7 * k);
      return d;
    });

  const pct = data && data.prevVolume ? Math.round(((data.volume - data.prevVolume) / data.prevVolume) * 100) : null;
  const hit = data ? data.workouts >= data.goal : false;

  return (
    <>
      <Header title="Resumo da semana" back={{ href: "/", label: "Hoje" }} />
      <div className="flex items-center justify-between px-5 pb-1 pt-1">
        <button aria-label="Semana anterior" onClick={() => move(-1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card text-accent-ink">
          <Icon name="back" size={20} />
        </button>
        <span className="text-[15px] font-semibold text-label-2">{start ? `${rangeLabel(start)}${current ? " · em andamento" : ""}` : " "}</span>
        <button aria-label="Próxima semana" disabled={!start || current} onClick={() => move(1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card text-accent-ink disabled:opacity-30">
          <Icon name="chevron" size={20} />
        </button>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <Card className="mx-5 mt-3 flex flex-col gap-3 rounded-[20px] p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-label-2">Treinos</span>
                <span className="tabular text-[34px] font-bold leading-tight tracking-[-0.5px]">
                  {data.workouts} <span className="text-[17px] font-medium text-label-2">de {data.goal}</span>
                </span>
              </div>
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${hit ? "bg-accent text-on-accent" : "bg-accent-soft text-accent-ink"}`}>
                <Icon name={hit ? "trophy" : "calendar"} size={28} />
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: Math.max(data.goal, data.workouts) }, (_, i) => (
                <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.05 }} className={`h-2 flex-1 origin-left rounded-full ${i < data.workouts ? "bg-accent" : "bg-fill"}`} />
              ))}
            </div>
            <span className="text-[15px] leading-snug text-label-2">
              {hit ? "Meta batida! Constância é o que mais dá resultado." : data.workouts === 0 ? "Nenhum treino registrado nessa semana." : data.goal - data.workouts === 1 ? "Faltou 1 treino pra meta." : `Faltaram ${data.goal - data.workouts} treinos pra meta.`}
            </span>
          </Card>

          <div className="grid grid-cols-3 gap-2.5 px-5 pt-3">
            <Stat label="Volume" value={data.volume >= 1000 ? num(data.volume / 1000) : String(data.volume)} unit={data.volume >= 1000 ? "t" : "kg"} foot={pct == null ? undefined : `${pct >= 0 ? "+" : ""}${pct}%`} footTone={pct != null && pct >= 0 ? "good" : "muted"} />
            <Stat label="Séries" value={String(data.sets)} />
            <Stat label="Duração" value={String(data.minutesAvg)} unit="min" />
          </div>

          {data.prs.length > 0 && (
            <>
              <SectionTitle>Recordes</SectionTitle>
              <Card className="mx-5 overflow-hidden">
                {data.prs.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-0">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-good-soft text-good">
                      <Icon name="trophy" size={17} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{p.name}</span>
                    <span className="tabular text-[15px] font-semibold">
                      {num(p.weight)} kg × {p.reps}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {data.groups.length > 0 && (
            <>
              <SectionTitle>Séries por músculo</SectionTitle>
              <Card className="mx-5 flex flex-col gap-3 p-4">
                {data.groups.map((g, i) => (
                  <div key={g.group} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[14px]">
                      <span className="font-medium">{g.group}</span>
                      <span className="tabular text-label-2">{g.sets}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (g.sets / 20) * 100)}%` }} transition={{ delay: i * 0.04, type: "spring", stiffness: 120, damping: 20 }} />
                    </div>
                  </div>
                ))}
                {data.lowGroups.length > 0 && <p className="text-[13px] leading-snug text-label-2">Ficaram abaixo de 10 séries: {data.lowGroups.join(", ")}.</p>}
              </Card>
            </>
          )}

          {(data.nutrition || data.weight) && <SectionTitle>Corpo e alimentação</SectionTitle>}
          <div className="grid grid-cols-2 gap-2.5 px-5">
            {data.nutrition && (
              <>
                <Stat label="Calorias/dia" value={data.nutrition.kcalAvg.toLocaleString("pt-BR")} unit="kcal" foot={`meta ${data.nutrition.kcalTarget.toLocaleString("pt-BR")} · ${data.nutrition.days} ${data.nutrition.days === 1 ? "dia" : "dias"}`} />
                <Stat label="Proteína/dia" value={String(data.nutrition.proteinAvg)} unit="g" foot={`meta ${data.nutrition.proteinTarget} g`} footTone={data.nutrition.proteinAvg >= data.nutrition.proteinTarget * 0.9 ? "good" : "muted"} />
              </>
            )}
            {data.weight && (
              <Stat
                label="Peso"
                value={num(data.weight.last)}
                unit="kg"
                foot={data.weight.last === data.weight.first ? "estável" : `${data.weight.last > data.weight.first ? "+" : ""}${num(data.weight.last - data.weight.first)} kg`}
              />
            )}
          </div>

          <SectionTitle>O que fazer na próxima semana</SectionTitle>
          <ProLock locked={!pro} title="Sugestões da IA" text="A IA lê os números da sua semana e diz o que ajustar no treino e na alimentação.">
            <Card className="mx-5 flex flex-col gap-3 p-4">
              {report ? (
                <ul className="flex flex-col gap-2.5" data-testid="sugestoes">
                  {report
                    .split("\n")
                    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
                    .filter(Boolean)
                    .map((l, i) => (
                      <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-2.5 text-[15px] leading-snug">
                        <Icon name="spark" size={16} className="mt-0.5 shrink-0 text-accent-ink" />
                        <span>{l}</span>
                      </motion.li>
                    ))}
                </ul>
              ) : (
                <>
                  <p className="text-[15px] leading-snug text-label-2">{pro ? "Gere sugestões personalizadas com base nos números acima." : "- Faltaram 2 treinos: tente encaixar um treino curto na quarta.\n- Costas ficou com 6 séries."}</p>
                  <Button disabled={busy || data.workouts === 0} onClick={generate}>
                    <Icon name="spark" size={17} /> {busy ? "Analisando a semana…" : "Gerar sugestões"}
                  </Button>
                  {data.workouts === 0 && <span className="text-[13px] text-label-2">Treine pelo menos uma vez na semana pra gerar sugestões.</span>}
                </>
              )}
              {report && pro && (
                <button onClick={generate} disabled={busy} className="self-start text-[14px] font-semibold text-accent-ink disabled:opacity-40">
                  {busy ? "Gerando…" : "Gerar de novo"}
                </button>
              )}
              {error && <p role="alert" className="text-[14px] font-medium text-bad">{error}</p>}
            </Card>
          </ProLock>
        </>
      )}
    </>
  );
}
