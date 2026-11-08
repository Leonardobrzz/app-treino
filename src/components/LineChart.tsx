"use client";

import { motion } from "motion/react";
import { useId } from "react";

export function LineChart({ points, height = 150, format = (v: number) => String(v), label }: { points: { x: string; y: number }[]; height?: number; format?: (v: number) => string; label: string }) {
  const id = useId();
  const W = 340;
  const H = height;
  if (points.length === 0) return null;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 1) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;
  const px = (i: number) => (points.length === 1 ? W / 2 : 8 + (i * (W - 16)) / (points.length - 1));
  const py = (v: number) => 10 + (1 - (v - min) / (max - min)) * (H - 30);
  const line = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${px(points.length - 1).toFixed(1)} ${H - 18} L${px(0).toFixed(1)} ${H - 18} Z`;
  const last = points.at(-1)!;
  const ticks = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={10 + f * (H - 30)} y2={10 + f * (H - 30)} stroke="var(--sep)" strokeWidth="1" />
      ))}
      <motion.path d={area} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} />
      <motion.path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
      <motion.circle cx={px(points.length - 1)} cy={py(last.y)} r="5.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="3" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.85, type: "spring", stiffness: 500, damping: 18 }} />
      {ticks.map((i) => (
        <text key={i} x={px(i)} y={H - 3} fontSize="11" fill="var(--label-2)" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
          {points[i].x}
        </text>
      ))}
      <text x={W - 2} y={py(last.y) - 10} fontSize="12" fontWeight="700" fill="var(--label)" textAnchor="end">
        {format(last.y)}
      </text>
    </svg>
  );
}
