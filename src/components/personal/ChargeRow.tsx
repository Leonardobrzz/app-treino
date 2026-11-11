"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Pill } from "./common";
import { brl, dateBR, signed, type Charge } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { todayISO, vibrate } from "@/lib/util";

export function chargeTone(c: Charge) {
  if (c.status === "paga") return { label: "paga", tone: "good" as const };
  if (c.status === "cancelada") return { label: "cancelada", tone: "muted" as const };
  if (c.receipt_path) return { label: "comprovante enviado", tone: "accent" as const };
  if (c.due_on < todayISO()) return { label: "atrasada", tone: "bad" as const };
  return { label: "aberta", tone: "muted" as const };
}

/** Linha de cobrança do lado do personal (marcar paga, ver comprovante, cancelar) */
export function ChargeRow({ c, name, onChange }: { c: Charge; name?: string; onChange: (c: Charge) => void }) {
  const [open, setOpen] = useState(false);
  const t = chargeTone(c);

  async function set(status: Charge["status"]) {
    const patch = { status, paid_at: status === "paga" ? new Date().toISOString() : null };
    onChange({ ...c, ...patch });
    setOpen(false);
    await supabase().from("charges").update(patch).eq("id", c.id);
    if (status === "paga") {
      vibrate([10, 40, 10]);
      pushNow();
    }
  }
  async function receipt() {
    const m = await signed("comprovantes", [c.receipt_path!], 600);
    const u = m.get(c.receipt_path!);
    if (u) window.open(u, "_blank");
  }

  return (
    <div className="border-b border-sep last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{name ?? c.description ?? "Cobrança"}</span>
          <span className="text-[13px] text-label-2">
            {name && c.description ? `${c.description} · ` : ""}vence {dateBR(c.due_on)}
            {c.paid_at ? ` · paga ${dateBR(c.paid_at)}` : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="tabular text-[16px] font-bold">{brl(Number(c.amount))}</span>
          <Pill tone={t.tone}>{t.label}</Pill>
        </div>
      </button>
      {open && c.status !== "cancelada" && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-2 px-4 pb-3">
          {c.receipt_path && (
            <Button size="sm" variant="secondary" onClick={receipt}>
              <Icon name="image" size={15} /> Ver comprovante
            </Button>
          )}
          {c.status === "aberta" ? (
            <>
              <Button size="sm" onClick={() => set("paga")}>
                <Icon name="check" size={15} stroke={3} /> Marcar como paga
              </Button>
              <Button size="sm" variant="danger" onClick={() => set("cancelada")}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => set("aberta")}>
              Desfazer pagamento
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
