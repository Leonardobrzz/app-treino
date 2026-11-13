"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { savedPerfil } from "./RolePick";
import { Icon, type IconName } from "./ui";

type Tab = { href: string; label: string; icon: IconName; also?: string[] };

const ALUNO: Tab[] = [
  { href: "/", label: "Hoje", icon: "home" },
  { href: "/treinos", label: "Treinos", icon: "dumbbell", also: ["/exercicios", "/importar"] },
  { href: "/feed", label: "Feed", icon: "feed", also: ["/amigos"] },
  { href: "/evolucao", label: "Evolução", icon: "chart", also: ["/medidas", "/fotos", "/relatorio"] },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

const PERSONAL: Tab[] = [
  { href: "/personal", label: "Início", icon: "house", also: ["/personal/relatorios", "/personal/desafios", "/avisos"] },
  { href: "/personal/alunos", label: "Alunos", icon: "users", also: ["/personal/aluno/"] },
  { href: "/personal/agenda", label: "Agenda", icon: "calendar" },
  { href: "/personal/cobrancas", label: "Financeiro", icon: "pix" },
  { href: "/personal/perfil", label: "Perfil", icon: "user", also: ["/ajuda"] },
];

// Telas que o personal também abre (avisos, ajuda, exercícios) seguem com a barra dele.
const SHARED = ["/avisos", "/ajuda", "/exercicios"];

export function TabBar() {
  const path = usePathname();
  const [modo, setModo] = useState<"aluno" | "personal" | null>(null);
  useEffect(() => setModo(savedPerfil()), [path]);

  const inPersonal = path.startsWith("/personal") && path !== "/personal/comecar";
  const personal = inPersonal || (modo === "personal" && SHARED.some((s) => path.startsWith(s)));
  const tabs = personal ? PERSONAL : ALUNO;
  const active = (t: Tab) => {
    if (t.href === "/" ? path === "/" : t.href === "/personal" ? path === "/personal" : path.startsWith(t.href)) return true;
    return !!t.also?.some((a) => path.startsWith(a));
  };

  return (
    <nav aria-label="Navegação principal" className={`safe-bottom fixed inset-x-0 bottom-0 z-40 ${inPersonal ? "lg:hidden" : ""} border-t border-sep bg-[var(--tabbar)] backdrop-blur-xl`}>
      <div className="mx-auto grid max-w-[520px] grid-cols-5 px-2 pt-1.5">
        {tabs.map((t) => {
          const on = active(t);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`press relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-semibold text-accent-ink" : "font-medium text-label-3"}`}>
              {on && <motion.span layoutId={personal ? "tab-dot-p" : "tab-dot"} className="absolute -top-1.5 h-[3px] w-6 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
              <motion.span key={on ? "on" : "off"} initial={on ? { scale: 0.7, y: 2 } : false} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 14 }} whileTap={{ scale: 0.82 }} className="flex">
                <Icon name={t.icon} size={25} />
              </motion.span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
