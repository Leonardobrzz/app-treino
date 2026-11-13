"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui";
import { vibrate } from "@/lib/util";

/** Compartilha (ou copia) o link de cadastro do personal */
export function useInvite(code?: string | null) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" && code ? `${location.origin}/convite-personal/${code}` : "";
  async function share() {
    if (!link) return;
    vibrate(8);
    const text = "Bora treinar comigo no Carga! Entra pelo meu link pra receber seus treinos 💪";
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        return await nav.share({ title: "Carga", text, url: link });
      } catch {
        /* cancelou: copia abaixo */
      }
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return { link, share, copied };
}

/** Primeira vez: ainda sem alunos */
export function WelcomeHero({ name, onInvite, copied }: { name?: string; onInvite: () => void; copied: boolean }) {
  const reduce = useReducedMotion();
  const perks: { icon: IconName; text: string }[] = [
    { icon: "spark", text: "Treino montado com IA" },
    { icon: "body", text: "Avaliação física completa" },
    { icon: "pix", text: "Cobrança por Pix" },
  ];
  return (
    <section className="relative mx-5 mt-3 overflow-hidden rounded-[28px] bg-card px-5 pb-5 pt-7 text-center">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent opacity-25 blur-[70px]" />
      <div className="relative mx-auto flex h-[104px] w-[104px] items-center justify-center">
        {!reduce &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border-2 border-accent"
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 1.45, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
            />
          ))}
        <motion.span
          className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_16px_40px_-12px_var(--accent)]"
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="users" size={40} stroke={2.2} />
        </motion.span>
      </div>
      <h2 className="relative mt-5 text-[26px] font-bold leading-tight tracking-[-0.4px]">{name ? `Bem-vindo, ${name}!` : "Bem-vindo!"}</h2>
      <p className="relative mx-auto mt-2 max-w-[300px] text-[16px] leading-snug text-label-2">Bora dar o primeiro passo e cadastrar seu primeiro aluno?</p>
      <div className="relative mt-5 flex flex-col gap-2.5">
        <Link href="/personal/alunos?novo=1" className="press flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-on-accent">
          <Icon name="plus" size={19} stroke={2.6} /> Cadastrar aluno
        </Link>
        <button onClick={onInvite} className="press flex h-[54px] items-center justify-center gap-2 rounded-2xl border-2 border-accent text-[17px] font-semibold text-accent-ink">
          <Icon name={copied ? "check" : "link"} size={19} /> {copied ? "Link copiado" : "Link de cadastro"}
        </button>
      </div>
      <ul className="relative mt-5 flex justify-center gap-4 border-t border-sep pt-4">
        {perks.map((p, i) => (
          <motion.li key={p.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08 }} className="flex w-[30%] flex-col items-center gap-1.5 text-[12px] font-semibold leading-tight text-label-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Icon name={p.icon} size={18} />
            </span>
            {p.text}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** Atalhos redondos do dia a dia */
export function QuickActions({ onInvite, copied }: { onInvite: () => void; copied: boolean }) {
  const items: { label: string; icon: IconName; href?: string; onClick?: () => void }[] = [
    { label: "Novo aluno", icon: "plus", href: "/personal/alunos?novo=1" },
    { label: copied ? "Copiado" : "Convidar", icon: copied ? "check" : "send", onClick: onInvite },
    { label: "Nova aula", icon: "calendar", href: "/personal/agenda" },
    { label: "Cobrar", icon: "pix", href: "/personal/cobrancas" },
  ];
  return (
    <div className="mx-5 mt-3 grid grid-cols-4 gap-2 rounded-[22px] bg-card px-2 py-3.5">
      {items.map((it, i) => {
        const body = (
          <>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.05 + i * 0.05 }}
              whileTap={{ scale: 0.88 }}
              className={`flex h-[52px] w-[52px] items-center justify-center rounded-full ${i === 0 ? "bg-accent text-on-accent" : "bg-accent-soft text-accent-ink"}`}
            >
              <Icon name={it.icon} size={22} stroke={i === 0 ? 2.6 : 2.1} />
            </motion.span>
            <span className="text-[12px] font-semibold text-label-2">{it.label}</span>
          </>
        );
        const cls = "press flex flex-col items-center gap-1.5";
        return it.href ? (
          <Link key={it.label} href={it.href} className={cls}>
            {body}
          </Link>
        ) : (
          <button key={it.label} onClick={it.onClick} className={cls}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

const TOOLS: { href: string; label: string; sub: string; icon: IconName }[] = [
  { href: "/personal/relatorios", label: "Relatórios", sub: "PDF do mês de cada aluno", icon: "download" },
  { href: "/personal/desafios", label: "Desafios", sub: "Ranking entre seus alunos", icon: "trophy" },
  { href: "/exercicios", label: "Exercícios", sub: "Biblioteca com como fazer", icon: "dumbbell" },
  { href: "/personal/perfil", label: "Marca e vitrine", sub: "Sua cor, logo e página", icon: "image" },
  { href: "/avisos", label: "Avisos", sub: "Anamneses, pagamentos e mais", icon: "bell" },
  { href: "/ajuda?p=personal", label: "Como usar", sub: "Passo a passo da área", icon: "help" },
];

/** Grade de ferramentas da área do personal */
export function ToolsGrid() {
  return (
    <div className="mx-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {TOOLS.map((t, i) => (
        <motion.div key={t.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.1 + i * 0.04 }} whileTap={{ scale: 0.97 }}>
          <Link href={t.href} className="group flex h-full flex-col gap-3 rounded-[22px] bg-card p-4 transition-colors hover:bg-card-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink transition-transform group-hover:scale-105">
              <Icon name={t.icon} size={21} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-semibold leading-tight">{t.label}</span>
              <span className="text-[12.5px] leading-snug text-label-2">{t.sub}</span>
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
