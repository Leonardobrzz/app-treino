"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Icon } from "@/components/ui";
import { exportPdf } from "@/lib/pdf";
import { vibrate } from "@/lib/util";

/** Monta as páginas fora da tela só na hora de gerar e transforma em PDF */
export function PdfButton({ label, filename, title, render, className = "", variant = "secondary" }: { label: string; filename: string; title: string; render: () => ReactNode; className?: string; variant?: "primary" | "secondary" }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  async function go() {
    setBusy(true);
    setOn(true);
    vibrate(10);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (document.fonts?.ready) await document.fonts.ready;
      if (box.current) await exportPdf(box.current, filename, title);
    } finally {
      setOn(false);
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} className={`${variant === "secondary" ? "!bg-card" : ""} ${className}`} disabled={busy} onClick={go}>
        <Icon name="download" size={17} /> {busy ? "Gerando PDF…" : label}
      </Button>
      {on && (
        <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
          <div ref={box} className="flex flex-col gap-6">
            {render()}
          </div>
        </div>
      )}
    </>
  );
}
