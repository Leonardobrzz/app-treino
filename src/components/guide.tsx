"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";

function seen(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function mark(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* sem storage */
  }
}

/** Dica curta que aparece só na primeira vez que a pessoa abre a tela */
export function Tip({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!seen(`dica:${id}`)), [id]);
  function close() {
    mark(`dica:${id}`);
    setShow(false);
  }
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className={`overflow-hidden ${className}`}>
          <div role="note" className="mx-5 mb-3 flex items-start gap-2.5 rounded-2xl border border-accent/25 bg-accent-soft/60 py-3 pl-3.5 pr-2">
            <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <Icon name="help" size={14} stroke={2.4} />
            </span>
            <span className="flex-1 text-[14px] leading-snug">{children}</span>
            <button onClick={close} className="press -my-1 h-8 shrink-0 rounded-full px-2.5 text-[14px] font-semibold text-accent-ink">
              Entendi
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type Step = { label: string; sub: string; done: boolean; href: string };

/** Primeiros passos: some sozinho quando tudo estiver feito (ou quando a pessoa oculta) */
export function Checklist({ id, title, steps }: { id: string; title: string; steps: Step[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(seen(`passos:${id}`)), [id]);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (hidden || !next) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} aria-label={title} className="mx-5 mt-3 overflow-hidden rounded-[20px] bg-card">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-accent-ink">Primeiros passos</span>
          <span className="text-[18px] font-bold leading-tight">{title}</span>
        </div>
        <span className="tabular text-[14px] font-semibold text-label-2">
          {done} de {steps.length}
        </span>
      </div>
      <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-fill">
        <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(done / steps.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
      <ol className="mt-2 flex flex-col">
        {steps.map((s, i) => {
          const isNext = s === next;
          return (
            <li key={s.label}>
              <Link href={s.href} aria-disabled={s.done} className={`press flex items-center gap-3 px-4 py-2.5 ${s.done ? "pointer-events-none" : ""}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${s.done ? "bg-good text-white" : isNext ? "bg-accent text-on-accent" : "bg-fill text-label-2"}`}>{s.done ? <Icon name="check" size={15} stroke={3} /> : i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${s.done ? "text-label-3 line-through" : ""}`}>{s.label}</span>
                  {isNext && <span className="text-[13px] leading-snug text-label-2">{s.sub}</span>}
                </span>
                {!s.done && <Icon name="chevron" size={16} className={isNext ? "text-accent-ink" : "text-label-3"} />}
              </Link>
            </li>
          );
        })}
      </ol>
      <button
        onClick={() => {
          mark(`passos:${id}`);
          setHidden(true);
        }}
        className="press w-full border-t border-sep py-2.5 text-[14px] font-medium text-label-2"
      >
        Ocultar
      </button>
    </motion.section>
  );
}

type Action = { label: string; href: string; external?: boolean };

/** Card de destaque com a coisa mais importante a fazer agora */
export function NextStep({ icon, eyebrow, title, text, action, tone = "accent" }: { icon: IconName; eyebrow: string; title: string; text?: string; action?: Action; tone?: "accent" | "good" }) {
  const btn = "press flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/95 px-4 text-[15px] font-semibold text-black";
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`mx-5 mt-3 flex flex-col gap-3 rounded-[20px] p-4 ${tone === "accent" ? "bg-accent text-on-accent" : "bg-good text-white"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Icon name={icon} size={21} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[12px] font-bold uppercase tracking-wide opacity-80">{eyebrow}</span>
          <span className="text-[18px] font-bold leading-tight">{title}</span>
          {text && <span className="pt-0.5 text-[14px] leading-snug opacity-90">{text}</span>}
        </div>
      </div>
      {action &&
        (action.external ? (
          <a href={action.href} target="_blank" rel="noreferrer" className={btn}>
            {action.label}
          </a>
        ) : (
          <Link href={action.href} className={btn}>
            {action.label}
          </Link>
        ))}
    </motion.section>
  );
}
