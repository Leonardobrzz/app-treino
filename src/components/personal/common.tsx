"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/PostCard";
import { Icon, Sheet, type IconName } from "@/components/ui";
import { getProfile } from "@/lib/data";
import { useBrand } from "@/components/BrandTheme";
import { savePerfil } from "@/components/RolePick";
import { TEMPLATES, waLink } from "@/lib/personal";
import type { Profile } from "@/lib/types";

const SIDE: { href: string; label: string; icon: IconName }[] = [
  { href: "/personal", label: "Início", icon: "house" },
  { href: "/personal/alunos", label: "Alunos", icon: "users" },
  { href: "/personal/agenda", label: "Agenda", icon: "calendar" },
  { href: "/personal/cobrancas", label: "Financeiro", icon: "pix" },
  { href: "/personal/relatorios", label: "Relatórios", icon: "download" },
  { href: "/personal/desafios", label: "Desafios", icon: "trophy" },
];

/** No computador: menu lateral enxuto da área do personal */
export function PersonalSidebar() {
  const path = usePathname();
  if (!path.startsWith("/personal") || path === "/personal/comecar") return null;
  const on = (h: string) => (h === "/personal" ? path === h : path.startsWith(h) || (h === "/personal/alunos" && path.startsWith("/personal/aluno/")));
  const item = (t: { href: string; label: string; icon: IconName }) => (
    <Link key={t.href} href={t.href} aria-current={on(t.href) ? "page" : undefined} className={`press relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold ${on(t.href) ? "text-on-accent" : "text-label-2 hover:bg-card"}`}>
      {on(t.href) && <motion.span layoutId="pside" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
      <span className="relative flex items-center gap-3">
        <Icon name={t.icon} size={19} />
        {t.label}
      </span>
    </Link>
  );
  return (
    <aside aria-label="Menu da área do personal" className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col gap-1 border-r border-sep bg-bg px-3 py-6 lg:flex">
      <Link href="/personal" className="mb-5 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[17px] font-bold">Carga</span>
          <span className="text-[11px] font-semibold tracking-wide text-accent-ink">PERSONAL</span>
        </span>
      </Link>
      {SIDE.map(item)}
      <div className="mt-auto flex flex-col gap-1 border-t border-sep pt-3">
        {item({ href: "/personal/perfil", label: "Meu perfil", icon: "user" })}
        <Link href="/ajuda?p=personal" className="press flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-label-2 hover:bg-card">
          <Icon name="help" size={18} /> Como usar
        </Link>
        <Link href="/" onClick={() => savePerfil("aluno")} className="press flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-label-2 hover:bg-card">
          <Icon name="swap" size={18} /> Usar como aluno
        </Link>
      </div>
    </aside>
  );
}

/** Carrega o perfil e manda pro cadastro de personal se ainda não for */
export function useTrainer() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  useEffect(() => {
    getProfile().then((p) => {
      if (!p?.is_trainer) router.replace("/personal/comecar");
      else setMe(p);
    });
  }, [router]);
  return me;
}

export function PHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const brand = useBrand();
  return (
    <header className="safe-top flex items-end justify-between gap-3 px-5 pb-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-accent-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand?.logo && <img src={brand.logo} alt="" className="h-5 w-auto max-w-[60px] object-contain" />}
          ÁREA DO PERSONAL
        </span>
        <h1 className="truncate font-[family-name:var(--font-display)] text-[32px] font-bold leading-tight tracking-[-0.5px]">{title}</h1>
        {sub && <span className="text-[14px] text-label-2">{sub}</span>}
      </div>
      {right}
    </header>
  );
}

export function StudentLine({ id, name, sub, right, href }: { id: string; name: string; sub?: ReactNode; right?: ReactNode; href?: string }) {
  const body = (
    <>
      <Avatar id={id} name={name} size={40} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-semibold">{name}</span>
        {sub && <span className="truncate text-[13px] text-label-2">{sub}</span>}
      </div>
      {right}
    </>
  );
  return href ? (
    <Link href={href} className="press flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">{body}</div>
  );
}

type Tpl = keyof typeof TEMPLATES;
const TPL_LABEL: Record<Tpl, string> = { sumido: "Sentimos sua falta", recorde: "Parabéns pelo recorde", cobranca: "Lembrete da mensalidade", renovacao: "Renovação do plano", avaliacao: "Marcar reavaliação" };

/** Botão que abre mensagens prontas no WhatsApp */
export function QuickMessage({ name, phone, suggest, extra, className = "" }: { name: string; phone: string | null; suggest?: Tpl; extra?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const keys = (Object.keys(TEMPLATES) as Tpl[]).sort((a, b) => (a === suggest ? -1 : b === suggest ? 1 : 0));
  return (
    <>
      <button onClick={(e) => (e.preventDefault(), e.stopPropagation(), setOpen(true))} aria-label={`Mandar mensagem pra ${name}`} className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-good-soft text-good ${className}`}>
        <Icon name="chat" size={18} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Mensagem pra ${name.split(" ")[0]}`}>
        <div className="flex flex-col gap-2 pt-1">
          {!phone && <p className="pb-1 text-[13px] text-label-2">Sem WhatsApp cadastrado: o WhatsApp vai abrir pra você escolher o contato. Cadastre o número na aba Financeiro do aluno.</p>}
          {keys.map((k) => {
            const text = k === "cobranca" ? TEMPLATES.cobranca(name, extra) : TEMPLATES[k](name);
            return (
              <a key={k} href={waLink(phone, text)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="press flex flex-col gap-1 rounded-2xl bg-card p-3.5">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  {TPL_LABEL[k]}
                  {k === suggest && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-ink">SUGERIDA</span>}
                </span>
                <span className="text-[13px] leading-snug text-label-2">{text}</span>
              </a>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "bad" | "accent" }) {
  const cls = { muted: "bg-fill text-label-2", good: "bg-good-soft text-good", bad: "bg-bad/15 text-bad", accent: "bg-accent-soft text-accent-ink" }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-bold ${cls}`}>{children}</span>;
}

export function Field2({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-label-2">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "h-11 w-full rounded-xl bg-card px-3.5 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2";
