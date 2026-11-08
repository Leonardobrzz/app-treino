"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./ui";

/** Mostra o conteúdo borrado com um convite pro Pro por cima */
export function ProLock({ locked, title, text, children }: { locked: boolean; title: string; text: string; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-60 blur-[6px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex max-w-[280px] flex-col items-center gap-2 rounded-2xl bg-card/95 p-5 text-center shadow-lg backdrop-blur">
          <ProBadge />
          <span className="text-[17px] font-semibold">{title}</span>
          <span className="text-[14px] leading-snug text-label-2">{text}</span>
          <Link href="/pro" className="press mt-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent">
            <Icon name="lock" size={16} /> Desbloquear
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProBadge({ className = "" }: { className?: string }) {
  return <span className={`rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-on-accent ${className}`}>PRO</span>;
}
