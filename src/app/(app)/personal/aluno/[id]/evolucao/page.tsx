"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Card, Header, Spinner } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { BarChart, Donut } from "@/components/charts";
import { BrandMark, H2, Page } from "@/components/ReportPages";
import { PdfButton } from "@/components/personal/PdfButton";
import { useTrainer } from "@/components/personal/common";
import { CIRC_LABEL, CIRCS, studentDetail, type Assessment, type StudentDetail } from "@/lib/personal";
import { slug } from "@/lib/pdf";
import { supabase } from "@/lib/supabase/client";
import { fmtDate, num } from "@/lib/util";

const signedN = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), d)}`;

/** Relatório de evolução entre 2 ou mais avaliações do aluno, com gráficos */
export default function AssessmentEvolution() {
  const { id } = useParams<{ id: string }>();
  const me = useTrainer();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [list, setList] = useState<Assessment[] | null>(null);

  useEffect(() => {
    if (!me) return;
    const ids = (new URLSearchParams(location.search).get("ids") ?? "").split(",").filter(Boolean);
    studentDetail(id).then(setD);
    let q = supabase().from("assessments").select("*").eq("student_id", id).eq("trainer_id", me.id);
    if (ids.length) q = q.in("id", ids);
    q.order("assessed_on").order("created_at").then(({ data }) => setList((data ?? []) as Assessment[]));
  }, [me, id]);

  if (!d || !list) return <Spinner />;
  const name = d.profile.name ?? "Aluno";
  const brand = { name: me?.name ?? "Personal", cref: me?.cref ?? null };

  if (list.length < 2)
    return (
      <>
        <Header title="Evolução" back={{ href: `/personal/aluno/${id}?aba=avaliacao`, label: "Aluno" }} />
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] text-label-2">Escolha pelo menos 2 avaliações pra ver a evolução.</p>
      </>
    );

  const sections = buildSections(list);
  const pdfSections = buildSections(list, true);
  const first = list[0];
  const last = list.at(-1)!;

  return (
    <>
      <Header title="Evolução" eyebrow={name.toUpperCase()} back={{ href: `/personal/aluno/${id}?aba=avaliacao`, label: "Aluno" }} />
      <p className="px-5 text-[14px] text-label-2">
        {list.length} avaliações · {fmtDate(first.assessed_on, { year: true })} a {fmtDate(last.assessed_on, { year: true })}
      </p>
      <div className="mx-5 mt-3">
        <PdfButton
          variant="primary"
          className="w-full"
          label="Baixar PDF da evolução"
          filename={`evolucao-${slug(name)}-${last.assessed_on}.pdf`}
          title={`Evolução de ${name}`}
          render={() => (
            <>
              <Page n={1} total={pdfSections.length > 5 ? 2 : 1}>
                <PdfHead name={name} brand={brand} from={first.assessed_on} to={last.assessed_on} count={list.length} />
                <PdfGrid sections={pdfSections.slice(0, 1)} cols={1} />
                <PdfGrid sections={pdfSections.slice(1, 5)} cols={2} />
              </Page>
              {pdfSections.length > 5 && (
                <Page n={2} total={2}>
                  <PdfGrid sections={pdfSections.slice(5)} cols={2} />
                </Page>
              )}
            </>
          )}
        />
      </div>
      <div className="mx-5 mt-2 grid gap-3 pb-4 lg:grid-cols-2">
        {sections.map((s) => (
          <section key={s.key} className="flex flex-col gap-1.5">
            <h2 className="pt-3 text-[13px] font-semibold uppercase tracking-wide text-label-2">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </>
  );
}

function PdfGrid({ sections, cols }: { sections: Section[]; cols: 1 | 2 }) {
  return (
    <div className={`grid gap-x-5 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {sections.map((s) => (
        <div key={s.key} className="min-w-0">
          <H2>{s.title}</H2>
          {s.body}
        </div>
      ))}
    </div>
  );
}

function PdfHead({ name, brand, from, to, count }: { name: string; brand: { name: string; cref: string | null }; from: string; to: string; count: number }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e5e5ea] pb-4">
      <BrandMark size={34} text={18} />
      <div className="flex items-end gap-3">
      <div className="flex flex-1 flex-col">
        <span className="text-[24px] font-bold leading-tight">Evolução de {name}</span>
        <span className="text-[12px] text-[#6e6e73]">
          {count} avaliações · {fmtDate(from, { year: true })} a {fmtDate(to, { year: true })}
        </span>
      </div>
      <div className="flex flex-col items-end text-right">
        <span className="text-[13px] font-semibold">{brand.name}</span>
        {brand.cref && <span className="text-[11px] text-[#6e6e73]">CREF {brand.cref}</span>}
      </div>
      </div>
    </div>
  );
}

type Section = { key: string; title: string; body: ReactNode };

function buildSections(list: Assessment[], pdf = false): Section[] {
  const v = (a: Assessment, k: "weight" | "body_fat" | "lean_mass" | "fat_mass") => (a[k] != null ? Number(a[k]) : null);
  const label = (a: Assessment) => fmtDate(a.assessed_on);
  const out: Section[] = [];

  // resumo: primeira x última
  // cada medida compara a primeira e a última avaliação que têm aquele dado
  const ends = (get: (a: Assessment) => number | null | undefined): [number | null, number | null] => {
    const vals = list.map(get).filter((x): x is number => x != null && Number.isFinite(Number(x))).map(Number);
    return vals.length >= 2 ? [vals[0], vals.at(-1)!] : [null, vals[0] ?? null];
  };
  const rows: [string, number | null, number | null, string, "down" | "up" | null][] = [
    ["Peso", ...ends((a) => v(a, "weight")), "kg", null],
    ["Gordura", ...ends((a) => v(a, "body_fat")), "%", "down"],
    ["Massa magra", ...ends((a) => v(a, "lean_mass")), "kg", "up"],
    ["Massa gorda", ...ends((a) => v(a, "fat_mass")), "kg", "down"],
    ["VO2máx", ...ends((a) => a.cardio?.vo2), "", "up"],
    ["FMS", ...ends((a) => a.functional?.total), "/21", "up"],
  ];
  out.push({
    key: "resumo",
    title: "Primeira x última",
    body: (
      <Card className="overflow-hidden">
        {rows
          .filter(([, a, b]) => a != null || b != null)
          .map(([l, a, b, u, good]) => {
            const diff = a != null && b != null ? b - a : null;
            const better = diff == null || diff === 0 || !good ? null : (good === "down") === diff < 0;
            return (
              <div key={l} className="flex items-center gap-3 border-b border-sep px-4 py-2.5 last:border-b-0">
                <span className="flex-1 text-[14px] text-label-2">{l}</span>
                <span className="tabular w-20 text-right text-[14px] text-label-2">{a != null ? `${num(a)}${u === "%" ? "%" : u ? ` ${u}` : ""}` : "–"}</span>
                <span className="tabular w-20 text-right text-[15px] font-bold">{b != null ? `${num(b)}${u === "%" ? "%" : u ? ` ${u}` : ""}` : "–"}</span>
                <span className={`tabular w-14 text-right text-[13px] font-bold ${better == null ? "text-label-2" : better ? "text-good" : "text-bad"}`}>{diff != null ? signedN(diff) : ""}</span>
              </div>
            );
          })}
      </Card>
    ),
  });

  // composição atual (pizza) e massa magra x gorda por avaliação
  const lastComp = [...list].reverse().find((a) => a.lean_mass != null && a.fat_mass != null);
  if (lastComp) {
    out.push({
      key: "pizza",
      title: `Composição corporal (${label(lastComp)})`,
      body: (
        <Card className="p-4">
          <Donut
            still={pdf}
            label="Composição corporal atual"
            center={`${num(Number(lastComp.body_fat))}%`}
            sub="gordura"
            parts={[
              { label: `Massa magra · ${num(Number(lastComp.lean_mass))} kg`, value: Math.round(Number(lastComp.lean_mass) * 10) / 10, color: "#34C759" },
              { label: `Massa gorda · ${num(Number(lastComp.fat_mass))} kg`, value: Math.round(Number(lastComp.fat_mass) * 10) / 10, color: "#FF9500" },
            ]}
          />
        </Card>
      ),
    });
  }
  const comp = list.filter((a) => a.lean_mass != null && a.fat_mass != null);
  if (comp.length >= 2) {
    out.push({
      key: "barras",
      title: "Massa magra e gorda por avaliação",
      body: (
        <Card className="p-4">
          <div className="flex gap-3 pb-1 text-[12px] text-label-2">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#34C759]" /> Magra</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#FF9500]" /> Gorda</span>
          </div>
          <BarChart still={pdf} label="Massa magra e massa gorda em cada avaliação" bars={comp.map((a) => ({ label: label(a), values: [Number(a.lean_mass), Number(a.fat_mass)] }))} colors={["#34C759", "#FF9500"]} format={(x) => `${num(x, 0)}`} highlightLast={false} />
        </Card>
      ),
    });
  }

  // linhas de evolução
  const line = (key: string, title: string, pts: { x: string; y: number }[], unit: string) => {
    if (pts.length >= 2) out.push({ key, title, body: <Card className="p-4"><LineChart still={pdf} label={title} points={pts} format={(x) => `${num(x)}${unit}`} /></Card> });
  };
  line("bf", "Gordura corporal (%)", list.filter((a) => a.body_fat != null).map((a) => ({ x: label(a), y: Number(a.body_fat) })), "%");
  line("peso", "Peso (kg)", list.filter((a) => a.weight != null).map((a) => ({ x: label(a), y: Number(a.weight) })), " kg");
  line("vo2", "VO2máx (ml/kg/min)", list.filter((a) => a.cardio?.vo2 != null).map((a) => ({ x: label(a), y: Number(a.cardio!.vo2) })), "");
  line("fms", "Funcional (FMS, de 21)", list.filter((a) => a.functional?.total != null).map((a) => ({ x: label(a), y: Number(a.functional!.total) })), "");

  // perimetria: primeira x última
  const withC = list.filter((a) => Object.keys(a.circumferences ?? {}).length > 0);
  const cA = withC[0];
  const cB = withC.at(-1);
  const circs = withC.length >= 2 ? CIRCS.filter((k) => cA.circumferences?.[k] != null && cB!.circumferences?.[k] != null) : [];
  if (circs.length && cB) {
    const first = cA;
    const last = cB;
    const max = Math.max(...circs.flatMap((k) => [Number(first.circumferences[k]), Number(last.circumferences[k])]));
    out.push({
      key: "peri",
      title: "Perimetria (cm)",
      body: (
        <Card className="flex flex-col gap-2.5 p-4">
          <div className="flex gap-3 text-[12px] text-label-2">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-fill" /> {label(first)}</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-accent" /> {label(last)}</span>
          </div>
          {circs.map((k) => {
            const a = Number(first.circumferences[k]);
            const b = Number(last.circumferences[k]);
            return (
              <div key={k} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium">{CIRC_LABEL[k]}</span>
                  <span className="tabular text-label-2">
                    {num(a)} → <b className="text-label">{num(b)}</b> <span className={b - a > 0 ? "text-accent-ink" : "text-good"}>{signedN(b - a)}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="h-1.5 rounded-full bg-fill" style={{ width: `${(a / max) * 100}%` }} />
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(b / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      ),
    });
  }
  return out;
}
