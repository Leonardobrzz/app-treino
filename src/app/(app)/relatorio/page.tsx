"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProBadge } from "@/components/ProLock";
import { PAGE_H, PAGE_W, ReportPages } from "@/components/ReportPages";
import { Header, Icon, Segmented, Spinner } from "@/components/ui";
import { getSubscription } from "@/lib/data";
import { isPro } from "@/lib/pro";
import { loadReport, type ReportData } from "@/lib/report";
import { todayISO, vibrate } from "@/lib/util";

type Preset = "30" | "90" | "180" | "365" | "custom";
const minus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return todayISO(d);
};

export default function Relatorio() {
  const [preset, setPreset] = useState<Preset>("90");
  const [from, setFrom] = useState(minus(90));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pro, setPro] = useState(true);
  const [busy, setBusy] = useState<"" | "gerando">("");
  const [msg, setMsg] = useState("");
  const [scale, setScale] = useState(0.4);
  const wrap = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSubscription().then((s) => setPro(isPro(s)));
  }, []);

  useEffect(() => {
    if (preset !== "custom") {
      setFrom(minus(Number(preset)));
      setTo(todayISO());
    }
  }, [preset]);

  useEffect(() => {
    if (!from || !to || from > to) return;
    setLoading(true);
    loadReport(from, to).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [from, to]);

  useEffect(() => {
    const fit = () => wrap.current && setScale(Math.min(1, wrap.current.clientWidth / PAGE_W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const generate = useCallback(async () => {
    if (!pages.current || !data) return;
    setBusy("gerando");
    setMsg("");
    vibrate(10);
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const nodes = [...pages.current.querySelectorAll<HTMLElement>("[data-report-page]")];
      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      for (let i = 0; i < nodes.length; i++) {
        const img = await toJpeg(nodes[i], { pixelRatio: 2, quality: 0.9, backgroundColor: "#ffffff", width: PAGE_W, height: PAGE_H, style: { transform: "none" } });
        if (i) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      }
      const name = `carga-relatorio-${from}-a-${to}.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Meu relatório do Carga" });
        } catch {
          /* fechou o compartilhar */
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        setMsg("PDF baixado.");
      }
    } catch {
      setMsg("Não consegui gerar o PDF. Tenta de novo.");
    } finally {
      setBusy("");
    }
  }, [data, from, to]);

  return (
    <>
      <Header title="Relatório em PDF" back={{ href: "/evolucao", label: "Evolução" }} />
      <p className="px-5 text-[15px] leading-snug text-label-2">Medidas, corpo, peso, força e alimentação do período, num PDF pra guardar ou mandar pro seu personal ou nutri.</p>

      <div className="mt-4 flex flex-col gap-3 px-5">
        <Segmented<Preset>
          value={preset}
          onChange={setPreset}
          options={[{ value: "30", label: "30 dias" }, { value: "90", label: "3 meses" }, { value: "180", label: "6 meses" }, { value: "365", label: "1 ano" }, { value: "custom", label: "Outro" }]}
        />
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-label-2">De</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl bg-card px-3 text-[16px] outline-none ring-accent focus:ring-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-label-2">Até</span>
              <input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl bg-card px-3 text-[16px] outline-none ring-accent focus:ring-2" />
            </label>
          </div>
        )}
        {pro ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={generate}
            disabled={!!busy || loading || !data}
            className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-bold text-on-accent disabled:opacity-60"
          >
            {busy ? <>Gerando PDF…</> : <><Icon name="download" size={20} stroke={2.6} /> Gerar PDF</>}
          </motion.button>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-5 text-center">
            <ProBadge />
            <span className="text-[17px] font-semibold">O relatório em PDF é do Pro</span>
            <span className="text-[14px] leading-snug text-label-2">Veja a prévia abaixo. Com o Pro você gera o PDF quando quiser e manda pro seu personal ou nutri.</span>
            <Link href="/pro" className="press mt-1 inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-5 text-[16px] font-semibold text-on-accent">
              <Icon name="lock" size={16} /> Desbloquear com o Pro
            </Link>
          </div>
        )}
        {msg && <p className="text-center text-[14px] text-label-2">{msg}</p>}
      </div>

      <p className="mt-6 px-5 text-[13px] font-semibold tracking-wide text-label-2">PRÉVIA</p>
      <div ref={wrap} className="mx-5 mt-2">
        {loading || !data ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div aria-hidden={!pro} className={pro ? "" : "pointer-events-none select-none blur-[3px]"}>
            <div style={{ height: PAGE_H * 3 * scale + 24 }}>
              <div ref={pages} className="flex flex-col gap-[24px]" style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <ReportPages d={data} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
