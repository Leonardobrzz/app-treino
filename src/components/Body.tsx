"use client";

import { motion } from "motion/react";
import type { MeasureKey } from "@/lib/types";

type Muscle = { id: string; key: MeasureKey | null; base?: boolean; outline?: boolean; mirror: boolean; pts?: number[][]; ellipse?: number[] };

// Vista frontal, lado direito do corpo (espelhado para o esquerdo). viewBox 0 0 200 420.
const MUSCLES: Muscle[] = [
  { id: "silhueta-tronco", key: null, base: true, outline: true, mirror: false, pts: [[100, 54], [114, 55], [130, 59], [140, 64], [137, 100], [134, 132], [132, 160], [135, 194], [133, 208], [120, 214], [100, 218], [80, 214], [67, 208], [65, 194], [68, 160], [66, 132], [63, 100], [60, 64], [70, 59], [86, 55]] },
  { id: "silhueta-braco", key: null, base: true, outline: true, mirror: true, pts: [[138, 62], [147, 70], [150, 90], [153, 112], [154, 136], [156, 150], [160, 174], [161, 200], [158, 212], [146, 214], [141, 196], [137, 168], [135, 150], [131, 130], [131, 108], [134, 92]] },
  { id: "silhueta-perna", key: null, base: true, outline: true, mirror: true, pts: [[100, 214], [118, 205], [134, 204], [139, 222], [140, 252], [136, 282], [129, 298], [129, 314], [137, 340], [136, 366], [126, 390], [110, 392], [110, 366], [102, 334], [104, 310], [102, 290], [100, 262]] },
  { id: "cabeca", key: null, base: true, mirror: false, ellipse: [100, 24, 15, 19] },
  { id: "pescoco", key: "pescoco", mirror: false, pts: [[92, 41], [108, 41], [113, 54], [100, 59], [87, 54]] },
  { id: "trapezio", key: null, mirror: true, pts: [[109, 46], [114, 54], [132, 61], [128, 65], [112, 62], [106, 58]] },
  { id: "deltoide", key: null, mirror: true, pts: [[127, 62], [138, 64], [145, 74], [146, 90], [141, 102], [136, 96], [131, 82], [124, 70]] },
  { id: "peitoral", key: "peito", mirror: true, pts: [[101, 64], [112, 62], [126, 66], [132, 78], [135, 92], [126, 100], [112, 103], [101, 100]] },
  { id: "biceps", key: "braco", mirror: true, pts: [[135, 98], [141, 101], [146, 114], [146, 134], [142, 146], [137, 146], [133, 132], [132, 112]] },
  { id: "triceps", key: "braco", mirror: true, pts: [[146, 104], [151, 116], [152, 134], [148, 145], [146, 130], [146, 112]] },
  { id: "antebraco-ext", key: "antebraco", mirror: true, pts: [[146, 148], [152, 154], [157, 172], [158, 196], [155, 210], [151, 206], [150, 182], [146, 164]] },
  { id: "antebraco-int", key: "antebraco", mirror: true, pts: [[138, 150], [145, 148], [146, 164], [150, 182], [151, 206], [147, 212], [142, 196], [138, 170]] },
  { id: "mao", key: null, base: true, mirror: true, pts: [[146, 213], [154, 212], [159, 224], [158, 240], [152, 248], [146, 242], [144, 226]] },
  { id: "abdomen-1", key: "cintura", mirror: true, pts: [[102, 105], [111, 105], [113, 108], [113, 118], [111, 121], [102, 121]] },
  { id: "abdomen-2", key: "cintura", mirror: true, pts: [[102, 124], [111, 124], [113, 127], [113, 137], [111, 140], [102, 140]] },
  { id: "abdomen-3", key: "cintura", mirror: true, pts: [[102, 143], [111, 143], [113, 146], [113, 156], [111, 159], [102, 159]] },
  { id: "abdomen-4", key: "cintura", mirror: true, pts: [[102, 162], [111, 162], [113, 166], [110, 184], [105, 192], [102, 192]] },
  { id: "obliquo", key: "cintura", mirror: true, pts: [[115, 104], [126, 102], [131, 114], [132, 134], [128, 156], [122, 172], [115, 178], [115, 156], [115, 130]] },
  { id: "quadril", key: "quadril", mirror: true, pts: [[117, 182], [124, 176], [132, 180], [134, 194], [130, 206], [122, 201], [115, 193]] },
  { id: "pelve", key: null, base: true, mirror: false, pts: [[100, 196], [106, 194], [113, 197], [114, 204], [106, 212], [100, 216], [94, 212], [86, 204], [87, 197], [94, 194]] },
  { id: "vasto-lateral", key: "coxa", mirror: true, pts: [[127, 208], [133, 210], [137, 226], [138, 250], [135, 276], [129, 292], [125, 288], [126, 262], [125, 232]] },
  { id: "reto-femoral", key: "coxa", mirror: true, pts: [[113, 208], [124, 208], [125, 232], [125, 262], [121, 284], [115, 286], [112, 262], [111, 232]] },
  { id: "vasto-medial", key: "coxa", mirror: true, pts: [[106, 258], [111, 262], [114, 286], [111, 296], [105, 292], [103, 276]] },
  { id: "adutor", key: "coxa", mirror: true, pts: [[101, 220], [108, 214], [110, 220], [109, 240], [105, 254], [102, 258], [101, 240]] },
  { id: "joelho", key: null, base: true, mirror: true, pts: [[108, 298], [118, 293], [126, 297], [127, 308], [117, 313], [108, 307]] },
  { id: "gastrocnemio-ext", key: "panturrilha", mirror: true, pts: [[127, 314], [133, 324], [136, 342], [134, 362], [128, 372], [126, 350], [125, 330]] },
  { id: "gastrocnemio-int", key: "panturrilha", mirror: true, pts: [[105, 314], [109, 320], [110, 340], [108, 360], [104, 354], [103, 332]] },
  { id: "tibial", key: "panturrilha", mirror: true, pts: [[112, 316], [123, 316], [124, 334], [121, 362], [118, 388], [114, 388], [112, 360], [110, 332]] },
  { id: "pe", key: null, base: true, mirror: true, pts: [[110, 391], [122, 391], [126, 402], [128, 411], [112, 414], [106, 407]] },
];

// Quanto cada cm de diferença aumenta a largura do músculo
const RATE: Record<MeasureKey, number> = { pescoco: 0.04, peito: 0.025, cintura: 0.022, quadril: 0.03, braco: 0.04, antebraco: 0.05, coxa: 0.03, panturrilha: 0.05 };

const smooth = (pts: number[][]) => {
  const N = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
};
const ell = ([cx, cy, rx, ry]: number[]) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

export type BodyLabel = { key: MeasureKey; side: "L" | "R"; y: number; target: [number, number]; text: string; value: string };

export const DEFAULT_LABELS: Omit<BodyLabel, "text" | "value">[] = [
  { key: "peito", side: "L", y: 72, target: [86, 84] },
  { key: "braco", side: "L", y: 122, target: [60, 122] },
  { key: "coxa", side: "L", y: 236, target: [82, 248] },
  { key: "panturrilha", side: "L", y: 330, target: [70, 342] },
  { key: "pescoco", side: "R", y: 34, target: [108, 50] },
  { key: "cintura", side: "R", y: 124, target: [107, 132] },
  { key: "antebraco", side: "R", y: 172, target: [152, 182] },
  { key: "quadril", side: "R", y: 222, target: [128, 192] },
];

/**
 * delta: variação (cm) de cada medida em relação ao ponto de partida.
 * intensity: 0..1 de quanto pintar cada medida. Negativo = diminuiu (verde).
 */
export function Body({
  delta,
  intensity,
  selected,
  labels,
  onSelect,
  className = "",
}: {
  delta: Partial<Record<MeasureKey, number>>;
  intensity: Partial<Record<MeasureKey, number>>;
  selected?: MeasureKey | null;
  labels?: BodyLabel[];
  onSelect?: (k: MeasureKey | null) => void;
  className?: string;
}) {
  const shapes: { id: string; d: string; fill: string; key: MeasureKey | null; outline?: boolean; sel: boolean }[] = [];
  for (const m of MUSCLES) {
    for (const s of m.mirror ? [1, -1] : [1]) {
      let d: string;
      if (m.ellipse) d = ell(m.ellipse);
      else {
        let pts = m.pts!.map((p) => [s === 1 ? p[0] : 200 - p[0], p[1]]);
        if (m.key && delta[m.key] != null) {
          const sx = 1 + (delta[m.key] ?? 0) * RATE[m.key];
          const sy = 1 + (sx - 1) * 0.35;
          const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
          const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
          pts = pts.map((p) => [cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy]);
        }
        d = smooth(pts);
      }
      let fill = m.base ? "var(--skin)" : "var(--muscle)";
      if (m.key) {
        const v = intensity[m.key] ?? 0;
        if (Math.abs(v) > 0.03) {
          const pct = Math.round(30 + 70 * Math.min(1, Math.abs(v)));
          fill = `color-mix(in srgb, ${v < 0 ? "var(--good-fill)" : "var(--accent)"} ${pct}%, var(--muscle))`;
        }
      }
      const sel = !!m.key && selected === m.key;
      if (selected && !sel && !m.base) fill = `color-mix(in srgb, ${fill} 35%, var(--skin))`;
      shapes.push({ id: `${m.id}-${s}`, d, fill, key: m.key, outline: m.outline, sel });
    }
  }

  return (
    <svg viewBox={labels ? "-84 0 368 430" : "40 0 120 420"} className={className} role="img" aria-label="Mapa muscular frontal colorido pela variação das medidas">
      <ellipse cx="100" cy="420" rx="54" ry="5" fill="var(--card-2)" />
      {shapes.map((s) => (
        <motion.path
          key={s.id}
          initial={false}
          animate={{ d: s.d }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
          stroke={s.outline ? "none" : s.sel ? "var(--accent-ink)" : "var(--card)"}
          strokeWidth={s.outline ? 0 : s.sel ? 2 : 1.4}
          strokeLinejoin="round"
          onClick={s.key && onSelect ? () => onSelect(selected === s.key ? null : s.key) : undefined}
          style={{ fill: s.fill, transition: "fill 450ms ease", cursor: s.key && onSelect ? "pointer" : undefined }}
        />
      ))}
      {labels?.map((g) => {
        const L = g.side === "L";
        const x = L ? -80 : 280;
        const lx = L ? -14 : 214;
        return (
          <g key={g.key} onClick={onSelect ? () => onSelect(selected === g.key ? null : g.key) : undefined} style={{ cursor: onSelect ? "pointer" : undefined }}>
            <path d={`M${lx} ${g.y + 8} L${g.target[0]} ${g.target[1]}`} fill="none" stroke="var(--label-3)" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2.5 2.5" />
            <circle cx={g.target[0]} cy={g.target[1]} r="3.2" fill="var(--accent-ink)" stroke="var(--card)" strokeWidth="1.5" />
            <text x={x} y={g.y} textAnchor={L ? "start" : "end"} fontSize="12.5" fontWeight="600" fill="var(--label-2)">{g.text}</text>
            <text x={x} y={g.y + 17} textAnchor={L ? "start" : "end"} fontSize="15" fontWeight="700" fill="var(--label)">{g.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
