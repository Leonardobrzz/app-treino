"use client";

import { motion } from "motion/react";

export type Perfil = "aluno" | "personal";
const KEY = "perfil";

export function savedPerfil(): Perfil | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "aluno" || v === "personal" ? v : null;
  } catch {
    return null;
  }
}

export function savePerfil(p: Perfil) {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* sem storage */
  }
}

export function CargaLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className={`flex items-center ${lg ? "flex-col gap-4" : "gap-3"}`}>
      <div className={`flex items-center justify-center bg-accent text-on-accent ${lg ? "h-24 w-24 rounded-[28px] shadow-[0_18px_50px_-12px_var(--accent)]" : "h-12 w-12 rounded-[14px]"}`}>
        <svg width={lg ? 52 : 26} height={lg ? 52 : 26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
        </svg>
      </div>
      <span className={`font-bold tracking-tight ${lg ? "text-[44px] leading-none" : "text-[22px]"}`}>Carga</span>
    </div>
  );
}

// Tela de entrada: logo grande no centro e a escolha "Sou aluno" / "Sou personal".
export function RolePick({ onPick, footer }: { onPick: (p: Perfil) => void; footer?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col">
      <div className="pointer-events-none fixed inset-x-0 top-[18%] -z-10 mx-auto h-[420px] w-[420px] rounded-full bg-accent opacity-[0.12] blur-[90px]" />
      <div className="flex flex-1 flex-col items-center justify-center pt-10">
        <CargaLogo size="lg" />
        <p className="mt-4 text-center text-[17px] text-label-2">Seu treino, sua carga, sua evolução.</p>
      </div>
      <div className="flex flex-col gap-3 pb-2">
        <button onClick={() => onPick("aluno")} className="press flex h-[58px] items-center justify-center rounded-2xl bg-accent text-[18px] font-semibold text-on-accent">
          Sou aluno
        </button>
        <button onClick={() => onPick("personal")} className="press flex h-[58px] items-center justify-center rounded-2xl bg-label text-[18px] font-semibold text-bg">
          Sou personal trainer
        </button>
        {footer}
      </div>
    </motion.div>
  );
}

export function PerfilChip({ perfil, onChange }: { perfil: Perfil; onChange: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
      <span className="text-[15px] text-label-2">
        {perfil === "personal" ? "Área do personal trainer" : "Área do aluno"}
      </span>
      <button type="button" onClick={onChange} className="press text-[15px] font-semibold text-accent-ink">
        Trocar
      </button>
    </div>
  );
}
