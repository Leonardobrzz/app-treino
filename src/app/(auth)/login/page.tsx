"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(error.message.includes("Email not confirmed") ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : "E-mail ou senha incorretos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Bem-vindo de volta</h1>
      <p className="mt-1 text-[17px] text-label-2">Entre para continuar seus treinos.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        <Field label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link href="/esqueci-senha" className="-mt-1 self-end text-[15px] font-medium text-accent-ink">
          Esqueceu a senha?
        </Link>
        {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
        <Button size="lg" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-auto pt-10 text-center text-[15px] text-label-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-accent-ink">
          Criar conta
        </Link>
      </p>
    </>
  );
}
