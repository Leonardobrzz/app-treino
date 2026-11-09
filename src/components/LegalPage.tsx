"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

export const CONTACT_EMAIL = "cargaapp0@gmail.com";
export const OWNER = "Leonardo Alves Braz (MEI), CNPJ 66.739.302/0001-94";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <main className="safe-top mx-auto w-full max-w-[640px] px-5 pb-16">
      <button
        onClick={() => (history.length > 1 ? router.back() : router.replace("/"))}
        className="press -ml-1 mt-3 flex h-9 items-center gap-0.5 text-[17px] text-accent-ink"
      >
        <Icon name="back" size={22} /> Voltar
      </button>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[32px] font-bold leading-tight tracking-[-0.5px]">{title}</h1>
      <p className="mt-1 text-[14px] text-label-2">Última atualização: {updated}</p>
      <div className="legal mt-6 flex flex-col gap-6 text-[16px] leading-relaxed text-label-2">{children}</div>
      <p className="mt-10 text-center text-[14px] text-label-3">
        <Link href="/termos" className="text-accent-ink">Termos de uso</Link> · <Link href="/privacidade" className="text-accent-ink">Política de privacidade</Link>
      </p>
    </main>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[19px] font-semibold text-label">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent-ink">
      {CONTACT_EMAIL}
    </a>
  );
}
