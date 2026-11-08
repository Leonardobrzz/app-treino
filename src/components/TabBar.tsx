"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon, type IconName } from "./ui";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Hoje", icon: "home" },
  { href: "/treinos", label: "Treinos", icon: "dumbbell" },
  { href: "/ia", label: "IA", icon: "spark" },
  { href: "/evolucao", label: "Evolução", icon: "chart" },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

export function TabBar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/evolucao" && path.startsWith("/medidas")) || (href === "/treinos" && path.startsWith("/exercicios")));
  return (
    <nav aria-label="Navegação principal" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-sep bg-[var(--tabbar)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-[520px] grid-cols-5 px-2 pt-1.5">
        {TABS.map((t) => {
          const on = active(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`press relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-semibold text-accent-ink" : "font-medium text-label-3"}`}>
              {on && <motion.span layoutId="tab-dot" className="absolute -top-1.5 h-[3px] w-6 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
              <Icon name={t.icon} size={25} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
