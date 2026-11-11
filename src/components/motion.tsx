"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Número que sobe até o valor quando aparece na tela */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("pt-BR"), duration = 0.9, className = "" }: { value: number; format?: (v: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const c = animate(from.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v) });
    from.current = value;
    return () => c.stop();
  }, [seen, value, duration, reduce]);
  return (
    <span ref={ref} className={`tabular ${className}`}>
      {format(shown)}
    </span>
  );
}

/** Lista que entra em sequência */
export function Stagger({ children, className = "", delay = 0.05 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 380, damping: 32 } } }}>
      {children}
    </motion.div>
  );
}

/** "aleatório" fixo por índice (puro, sem Math.random no render) */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const COLORS = ["#FF7A1A", "#FFB800", "#34C759", "#0A84FF", "#FF375F", "#BF5AF2"];

/** Chuva de confete (só CSS/motion, sem biblioteca) */
export function Confetti({ count = 60, active = true }: { count?: number; active?: boolean }) {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: rnd(i, 1) * 100,
        drift: (rnd(i, 2) - 0.5) * 160,
        rot: rnd(i, 3) * 720 - 360,
        delay: rnd(i, 4) * 0.35,
        dur: 1.6 + rnd(i, 5) * 1.2,
        w: 6 + rnd(i, 6) * 6,
        h: 8 + rnd(i, 7) * 8,
        color: COLORS[i % COLORS.length],
        round: rnd(i, 8) > 0.7,
      })),
    [count],
  );
  if (!active || reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-0"
          style={{ left: `${b.x}%`, width: b.w, height: b.round ? b.w : b.h, background: b.color, borderRadius: b.round ? 999 : 2 }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: b.drift, rotate: b.rot, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: b.dur, delay: b.delay, ease: [0.25, 0.4, 0.45, 1] }}
        />
      ))}
    </div>
  );
}

/** Coração grande que pula no meio da foto (curtir com dois toques) */
export function HeartBurst({ show }: { show: boolean }) {
  return show ? (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1] }}>
      <motion.svg width="110" height="110" viewBox="0 0 24 24" initial={{ scale: 0.2, rotate: -12 }} animate={{ scale: [0.2, 1.25, 1, 1.05], rotate: [-12, 6, 0, 0] }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,.35))" }}>
        <path d="M12 21s-7.5-4.8-7.5-10.7A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7C19.5 16.2 12 21 12 21z" fill="#fff" />
      </motion.svg>
    </motion.div>
  ) : null;
}
