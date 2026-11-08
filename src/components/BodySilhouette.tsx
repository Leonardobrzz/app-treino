"use client";

import { motion } from "motion/react";

/** Silhuetas simples para "Como você se vê hoje?". Medidas em meia-largura (viewBox 200×420). */
export const BODY_TYPES = [
  { id: 1, label: "Magro", desc: "Pouca massa e pouca gordura", p: { sh: 38, ch: 34, w: 29, b: 30, h: 34, a: 9, t: 15, c: 10 } },
  { id: 2, label: "Magro com barriga", desc: "Braços finos, abdômen mais cheio", p: { sh: 39, ch: 36, w: 36, b: 42, h: 37, a: 10, t: 16, c: 10 } },
  { id: 3, label: "Atlético", desc: "Ombros largos, cintura fina", p: { sh: 47, ch: 43, w: 32, b: 32, h: 36, a: 14, t: 19, c: 12 } },
  { id: 4, label: "Robusto", desc: "Forte, com mais gordura", p: { sh: 47, ch: 47, w: 46, b: 55, h: 48, a: 15, t: 22, c: 13 } },
] as const;

type P = { sh: number; ch: number; w: number; b: number; h: number; a: number; t: number; c: number };

const smooth = (pts: number[][]) => {
  const N = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
};
const mirror = (pts: number[][]) => pts.map(([x, y]) => [200 - x, y]);

function paths(p: P) {
  const C = 100;
  const right = [[C + 8, 54], [C + p.sh * 0.6, 58], [C + p.sh - 3, 65], [C + p.sh, 78], [C + p.ch, 104], [C + (p.ch + p.w) / 2, 124], [C + p.w, 146], [C + p.b, 170], [C + p.h, 196], [C + p.h - 7, 214], [C + 12, 222]];
  const torso = smooth([[C, 51], ...right, [C, 224], ...mirror(right).reverse()]);
  const outer = Math.max(p.ch, p.w, p.b);
  const arm = (s: 1 | -1) => {
    // linha central do braço: ombro → cotovelo → punho, afastada do tronco
    const line = [
      [C + s * (p.sh - 3), 74, p.a],
      [C + s * (outer + p.a * 0.5 + 4), 118, p.a],
      [C + s * (outer + p.a * 0.5 + 7), 158, p.a * 0.75],
      [C + s * (outer + p.a * 0.45 + 10), 192, p.a * 0.85],
      [C + s * (outer + p.a * 0.35 + 13), 226, p.a * 0.5],
    ];
    const out = line.map(([x, y, w]) => [x + s * w, y]);
    const inn = line.map(([x, y, w]) => [x - s * w * 0.9, y]).reverse();
    const [hx, hy] = line[line.length - 1];
    return smooth([[line[0][0] - s * p.a * 0.4, 66], ...out, [hx + s * 2, hy + 14], ...inn]);
  };
  const leg = (s: 1 | -1) => {
    const cx = C + s * (p.t * 0.9 + 2 + (p.h - 36) * 0.2);
    const pts = [[cx, 198], [cx + s * p.t, 214], [cx + s * p.t * 0.92, 254], [cx + s * p.t * 0.55, 302], [cx + s * p.c, 338], [cx + s * p.c * 0.5, 392], [cx + s * 2, 406], [cx - s * p.c * 0.5, 392], [cx - s * p.c * 0.85, 338], [cx - s * p.t * 0.5, 302], [cx - s * Math.min(p.t * 0.9, Math.abs(cx - C) - 1.5), 250], [cx - s * Math.min(p.t * 0.8, Math.abs(cx - C) - 1.5), 214]];
    return smooth(pts);
  };
  return [torso, arm(1), arm(-1), leg(1), leg(-1)];
}

export function BodySilhouette({ type, sex, selected, className = "" }: { type: number; sex?: string | null; selected?: boolean; className?: string }) {
  const base = BODY_TYPES.find((b) => b.id === type)?.p ?? BODY_TYPES[0].p;
  const p: P = sex === "feminino" ? { ...base, sh: base.sh - 6, ch: base.ch - 3, w: base.w - 3, b: base.b - 2, h: base.h + 6, a: base.a - 2, t: base.t + 1, c: base.c } : { ...base };
  const fill = selected ? "var(--accent)" : "var(--muscle)";
  return (
    <svg viewBox="30 0 140 420" className={className} aria-hidden="true">
      <ellipse cx="100" cy="410" rx="44" ry="4" fill="var(--card-2)" />
      <circle cx="100" cy="26" r="17" fill={fill} style={{ transition: "fill 300ms ease" }} />
      {paths(p).map((d, i) => (
        <motion.path key={i} initial={false} animate={{ d }} transition={{ type: "spring", stiffness: 160, damping: 16 }} style={{ fill, transition: "fill 300ms ease" }} />
      ))}
    </svg>
  );
}
