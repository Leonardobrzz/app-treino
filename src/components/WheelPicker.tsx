"use client";

import { useEffect, useRef } from "react";
import { vibrate } from "@/lib/util";

const ITEM = 48;

/** Seletor em rolagem no estilo do iOS (scroll-snap). */
export function WheelPicker({ min, max, step = 1, value, onChange, unit, decimals = 0, label }: { min: number; max: number; step?: number; value: number; onChange: (v: number) => void; unit: string; decimals?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = Math.round((max - min) / step) + 1;
  const idx = Math.round((value - min) / step);
  const last = useRef(idx);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  useEffect(() => {
    ref.current?.scrollTo({ top: idx * ITEM });
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ITEM)));
    if (i !== last.current) {
      last.current = i;
      vibrate(4);
      onChange(Math.round((min + i * step) * 100) / 100);
    }
  }

  function nudge(d: number) {
    const i = Math.max(0, Math.min(count - 1, idx + d));
    ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col items-center">
      <div className="tabular flex items-baseline gap-2" aria-live="polite">
        <span className="text-[64px] font-bold leading-none tracking-[-2px]">{fmt(value)}</span>
        <span className="text-[22px] font-semibold text-label-2">{unit}</span>
      </div>
      <div className="relative mt-4 h-[240px] w-48">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-xl bg-card" />
        <div
          ref={ref}
          onScroll={onScroll}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${fmt(value)} ${unit}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") (e.preventDefault(), nudge(-1));
            if (e.key === "ArrowDown") (e.preventDefault(), nudge(1));
          }}
          className="relative h-full snap-y snap-mandatory overflow-y-scroll outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: "linear-gradient(transparent, #000 30%, #000 70%, transparent)", WebkitMaskImage: "linear-gradient(transparent, #000 30%, #000 70%, transparent)" }}
        >
          <div style={{ height: 96 }} />
          {Array.from({ length: count }, (_, i) => {
            const v = min + i * step;
            const d = Math.abs(i - idx);
            return (
              <div key={i} onClick={() => ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" })} className="tabular flex h-12 snap-center items-center justify-center transition-all duration-150" style={{ fontSize: d === 0 ? 30 : d === 1 ? 24 : 20, fontWeight: d === 0 ? 700 : 500, opacity: d === 0 ? 1 : d === 1 ? 0.5 : 0.25 }}>
                {fmt(v)}
              </div>
            );
          })}
          <div style={{ height: 96 }} />
        </div>
      </div>
    </div>
  );
}
