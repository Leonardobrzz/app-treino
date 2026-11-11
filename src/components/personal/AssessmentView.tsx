"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Card, Icon } from "@/components/ui";
import { CIRC_LABEL, CIRCS, SKINFOLD_LABEL, fatClass, signed, sitesFor, type Assessment } from "@/lib/personal";
import { fmtDate, num } from "@/lib/util";

const POSES = ["frente", "lado", "costas"] as const;

function D({ v, good }: { v: number | null; good: "down" | "up" }) {
  if (v == null || Math.abs(v) < 0.05) return null;
  return (
    <span className={`ml-1 text-[12px] font-bold ${(good === "down" ? v < 0 : v > 0) ? "text-good" : "text-accent-ink"}`}>
      {v > 0 ? "+" : ""}
      {num(v)}
    </span>
  );
}

/** Foto com grade e linha de prumo por cima (avaliação postural) */
export function PostureFrame({ url, label }: { url: string; label: string }) {
  return (
    <figure className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "3 / 4" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Postura: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 30 40" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 5} x2={(i + 1) * 5} y1={0} y2={40} stroke="white" strokeOpacity={i === 2 ? 0 : 0.35} strokeWidth={0.12} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1={0} x2={30} y1={(i + 1) * 5} y2={(i + 1) * 5} stroke="white" strokeOpacity={0.35} strokeWidth={0.12} />
        ))}
        <line x1={15} x2={15} y1={0} y2={40} stroke="#FF7A1A" strokeWidth={0.25} strokeDasharray="0.8 0.5" />
      </svg>
      <figcaption className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-white">{label}</figcaption>
    </figure>
  );
}

export function AssessmentView({ a, prev }: { a: Assessment; prev?: Assessment | null }) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const ps = Object.values(a.posture?.photos ?? {}).filter(Boolean) as string[];
    if (ps.length) signed("avaliacoes", ps).then(setUrls);
  }, [a]);

  const bmi = a.weight && a.height ? a.weight / (a.height / 100) ** 2 : null;
  const rcq = a.circumferences.cintura && a.circumferences.quadril ? a.circumferences.cintura / a.circumferences.quadril : null;
  const cls = a.body_fat != null ? fatClass(Number(a.body_fat), a.sex) : null;
  const delta = (k: "body_fat" | "weight" | "lean_mass" | "fat_mass") => (prev && prev[k] != null && a[k] != null ? Number(a[k]) - Number(prev[k]) : null);

  return (
    <div className="flex flex-col gap-3">
      {a.body_fat != null && (
        <Card className="flex items-center gap-4 p-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
              <circle cx="40" cy="40" r="33" fill="none" stroke="var(--fill)" strokeWidth="9" />
              <motion.circle cx="40" cy="40" r="33" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 33} initial={{ strokeDashoffset: 2 * Math.PI * 33 }} animate={{ strokeDashoffset: 2 * Math.PI * 33 * (1 - Math.min(1, Number(a.body_fat) / 50)) }} transition={{ type: "spring", stiffness: 60, damping: 16 }} />
            </svg>
            <span className="tabular absolute inset-0 flex items-center justify-center text-[19px] font-bold">{num(Number(a.body_fat))}%</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-label-2">Gordura corporal <D v={delta("body_fat")} good="down" /></span>
            {cls && <span className={`text-[17px] font-bold ${cls.tone === "good" ? "text-good" : cls.tone === "bad" ? "text-bad" : "text-accent-ink"}`}>{cls.label}</span>}
            <span className="text-[12px] text-label-3">{a.protocol === "pollock7" ? "Pollock 7 dobras" : "Pollock 3 dobras"} · Siri</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {[
          ["Peso", a.weight != null ? `${num(Number(a.weight))} kg` : "–", <D key="w" v={delta("weight")} good="down" />],
          ["IMC", bmi ? num(bmi) : "–", null],
          ["Massa magra", a.lean_mass != null ? `${num(Number(a.lean_mass))} kg` : "–", <D key="l" v={delta("lean_mass")} good="up" />],
          ["Massa gorda", a.fat_mass != null ? `${num(Number(a.fat_mass))} kg` : "–", <D key="f" v={delta("fat_mass")} good="down" />],
          ...(rcq ? [["Cintura/quadril", num(rcq, 2), null] as const] : []),
          ...(a.height ? [["Altura", `${num(Number(a.height))} cm`, null] as const] : []),
        ].map(([l, v, d]) => (
          <Card key={l as string} className="flex flex-col px-3.5 py-3">
            <span className="text-[12px] font-semibold text-label-2">{l as string}</span>
            <span className="tabular text-[18px] font-bold">
              {v as string}
              {d}
            </span>
          </Card>
        ))}
      </div>

      {sitesFor(a.protocol, a.sex).length > 0 && (
        <Card className="p-4">
          <span className="text-[13px] font-semibold text-label-2">Dobras cutâneas (mm)</span>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {sitesFor(a.protocol, a.sex).map((k) => (
              <div key={k} className="flex justify-between text-[14px]">
                <span className="text-label-2">{SKINFOLD_LABEL[k]}</span>
                <span className="tabular font-semibold">{a.skinfolds[k] != null ? num(Number(a.skinfolds[k])) : "–"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.keys(a.circumferences ?? {}).length > 0 && (
        <Card className="p-4">
          <span className="text-[13px] font-semibold text-label-2">Perimetria (cm)</span>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {CIRCS.filter((k) => a.circumferences[k] != null).map((k) => {
              const d = prev?.circumferences?.[k] != null ? Number(a.circumferences[k]) - Number(prev.circumferences[k]) : null;
              return (
                <div key={k} className="flex justify-between text-[14px]">
                  <span className="text-label-2">{CIRC_LABEL[k]}</span>
                  <span className="tabular font-semibold">
                    {num(Number(a.circumferences[k]))}
                    {d != null && Math.abs(d) >= 0.1 && <span className={`ml-1 text-[11px] ${d > 0 ? "text-accent-ink" : "text-good"}`}>{d > 0 ? "+" : ""}{num(d)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(Object.keys(a.posture?.photos ?? {}).length > 0 || (a.posture?.findings ?? []).length > 0) && (
        <Card className="p-4">
          <span className="text-[13px] font-semibold text-label-2">Avaliação postural</span>
          {Object.keys(a.posture?.photos ?? {}).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {POSES.filter((p) => a.posture.photos?.[p]).map((p) => {
                const u = urls.get(a.posture.photos![p]!);
                return u ? <PostureFrame key={p} url={u} label={p} /> : <div key={p} className="rounded-xl bg-fill" style={{ aspectRatio: "3 / 4" }} />;
              })}
            </div>
          )}
          {(a.posture?.findings ?? []).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.posture.findings!.map((f) => (
                <span key={f} className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent-ink">{f}</span>
              ))}
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-good"><Icon name="check" size={16} stroke={3} /> Nenhum desvio marcado</p>
          )}
        </Card>
      )}

      {a.notes && (
        <Card className="p-4">
          <span className="text-[13px] font-semibold text-label-2">Observações</span>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-snug">{a.notes}</p>
        </Card>
      )}
      <p className="text-[12px] text-label-3">Avaliação de {fmtDate(a.assessed_on, { year: true })}</p>
    </div>
  );
}
