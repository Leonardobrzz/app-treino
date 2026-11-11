"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function TrainerInvite() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const c = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    try {
      if (c) localStorage.setItem("convite_personal", c);
    } catch {
      /* sem storage */
    }
    supabase()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace(`/meu-personal?entrar=${c}`);
        else setChecking(false);
      });
  }, [code, router]);

  if (checking) return <div className="mx-auto my-10 h-6 w-6 animate-spin rounded-full border-2 border-fill border-t-accent" aria-label="Carregando" />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.4px]">Seu personal te chamou pro Carga</h1>
      <p className="text-[17px] leading-snug text-label-2">Receba os treinos dele no app, registre cada série e acompanhe sua evolução com ele. Crie sua conta grátis pra começar.</p>
      <Link href="/cadastro" className="press mt-2 inline-flex h-[52px] items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-on-accent">
        Criar conta grátis
      </Link>
      <Link href="/login" className="press inline-flex h-[52px] items-center justify-center rounded-[14px] bg-card text-[17px] font-semibold text-accent-ink">
        Já tenho conta
      </Link>
    </div>
  );
}
