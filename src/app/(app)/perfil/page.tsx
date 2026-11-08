"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Header, Icon, Segmented, Spinner } from "@/components/ui";
import { getProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import type { Profile } from "@/lib/types";
import { vibrate } from "@/lib/util";

const GOALS = ["Perder gordura", "Manter e cuidar", "Ganhar massa", "Recomposição"];

export default function ProfilePage() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(getTheme());
    getProfile().then(setP);
    supabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function save(patch: Partial<Profile>) {
    if (!p) return;
    setP({ ...p, ...patch });
    await supabase().from("profiles").update(patch).eq("id", p.id);
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!p) return <><Header title="Perfil" /><Spinner /></>;

  return (
    <>
      <Header title="Perfil" />
      <div className="flex items-center gap-4 px-5 pt-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-[26px] font-bold text-on-accent">{(p.name ?? "?").slice(0, 1).toUpperCase()}</div>
        <div className="flex min-w-0 flex-col">
          <input defaultValue={p.name ?? ""} onBlur={(e) => e.target.value.trim() && save({ name: e.target.value.trim() })} aria-label="Seu nome" className="bg-transparent text-[22px] font-bold outline-none" />
          <span className="truncate text-[15px] text-label-2">{email}</span>
        </div>
      </div>

      <h2 className="px-5 pb-2 pt-7 text-[13px] font-semibold text-label-2">APARÊNCIA</h2>
      <div className="px-5">
        <Segmented<Theme>
          value={theme}
          onChange={(t) => {
            setThemeState(t);
            setTheme(t);
            vibrate(8);
          }}
          options={[{ value: "system", label: "Automático" }, { value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]}
        />
      </div>

      <h2 className="px-5 pb-2 pt-7 text-[13px] font-semibold text-label-2">TREINO</h2>
      <Card className="mx-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-sep px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[16px] font-medium">Meta semanal</span>
            <span className="text-[13px] text-label-2">Treinos por semana</span>
          </div>
          <div className="flex items-center gap-3">
            <button aria-label="Diminuir meta" onClick={() => save({ weekly_goal: Math.max(1, p.weekly_goal - 1) })} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-[20px] font-semibold text-accent-ink">−</button>
            <span className="tabular w-5 text-center text-[20px] font-bold">{p.weekly_goal}</span>
            <button aria-label="Aumentar meta" onClick={() => save({ weekly_goal: Math.min(7, p.weekly_goal + 1) })} className="press flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-[20px] font-semibold text-accent-ink">+</button>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-[16px] font-medium">Objetivo</span>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} onClick={() => save({ goal: g })} className={`press h-8 rounded-full px-3.5 text-[14px] font-medium ${p.goal === g ? "bg-accent text-on-accent" : "bg-card-2"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mx-5 mt-4 overflow-hidden">
        {[
          { href: "/medidas", icon: "ruler" as const, label: "Peso e medidas" },
          { href: "/exercicios", icon: "dumbbell" as const, label: "Biblioteca de exercícios" },
          { href: "/ia", icon: "spark" as const, label: "Assistente de treino" },
          { href: "/bem-vindo", icon: "refresh" as const, label: "Refazer configuração inicial" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="press flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <Icon name={l.icon} size={18} />
            </span>
            <span className="flex-1 text-[16px]">{l.label}</span>
            <Icon name="chevron" size={17} className="text-label-3" />
          </Link>
        ))}
      </Card>

      <button onClick={logout} className="press mx-5 mt-4 flex h-12 w-[calc(100%-40px)] items-center justify-center gap-2 rounded-2xl bg-card text-[16px] font-semibold text-bad">
        <Icon name="logout" size={18} /> Sair da conta
      </button>
    </>
  );
}
