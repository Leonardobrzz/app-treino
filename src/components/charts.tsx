"use client";

import { motion } from "motion/react";

type Bar = { label: string; values: number[] };

/** Barras (empilhadas quando há mais de um valor), com o rótulo do total em cima */
export function BarChart({ bars, colors, height = 150, format = (v: number) => String(v), label, highlightLast = true, still = false }: { bars: Bar[]; colors: string[]; height?: number; format?: (v: number) => string; label: string; highlightLast?: boolean; still?: boolean }) {
  const W = 340;
  const H = height;
  const top = 18;
  const base = H - 20;
  const max = Math.max(1, ...bars.map((b) => b.values.reduce((a, v) => a + v, 0)));
  const slot = (W - 8) / Math.max(1, bars.length);
  const bw = Math.min(30, slot * 0.58);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <line x1="4" x2={W - 4} y1={base} y2={base} stroke="var(--fill)" strokeWidth="1" />
      {bars.map((b, i) => {
        const x = 4 + slot * i + (slot - bw) / 2;
        const total = b.values.reduce((a, v) => a + v, 0);
        let y = base;
        const last = highlightLast && i === bars.length - 1;
        return (
          <g key={b.label + i}>
            {b.values.map((v, k) => {
              const h = (v / max) * (base - top);
              y -= h;
              return h > 0 ? (
                <motion.rect
                  key={k}
                  x={x}
                  width={bw}
                  rx={k === b.values.length - 1 || b.values.slice(k + 1).every((z) => !z) ? 6 : 0}
                  initial={still ? false : { y: base, height: 0 }}
                  animate={{ y, height: h }}
                  transition={{ delay: i * 0.04, type: "spring", stiffness: 140, damping: 20 }}
                  fill={colors[k % colors.length]}
                  opacity={last || !highlightLast ? 1 : 0.75}
                />
              ) : null;
            })}
            {total > 0 && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--label-2)">
                {format(total)}
              </text>
            )}
            <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize="10" fill="var(--label-2)">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rosca (pizza com furo) com legenda ao lado */
export function Donut({ parts, size = 120, center, sub, label, still = false }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: string; sub?: string; label: string; still?: boolean }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4" role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--fill)" strokeWidth="14" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.value / total) * c;
            const off = acc;
            acc += len;
            return p.value > 0 ? (
              <motion.circle
                key={p.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`}
                initial={still ? false : { strokeDashoffset: -off + len }}
                animate={{ strokeDashoffset: -off }}
                transition={{ delay: 0.1 + i * 0.1, type: "spring", stiffness: 90, damping: 18 }}
              />
            ) : null;
          })}
        {center && (
          <text x="50" y={sub ? 50 : 55} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--label)" transform="rotate(90 50 50)">
            {center}
          </text>
        )}
        {sub && (
          <text x="50" y="64" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--label-2)" transform="rotate(90 50 50)">
            {sub}
          </text>
        )}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-label-2">{p.label}</span>
            <span className="tabular font-semibold">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
