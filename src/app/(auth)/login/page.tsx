"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CargaLogo, type Perfil, PerfilChip, RolePick, savePerfil, savedPerfil } from "@/components/RolePick";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = params.get("perfil");
    setPerfil(q === "aluno" || q === "personal" ? q : savedPerfil());
    setReady(true);
  }, [params]);

  function pick(p: Perfil | null) {
    if (p) savePerfil(p);
    setPerfil(p);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const sb = supabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(error.message.includes("Email not confirmed") ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : "E-mail ou senha incorretos.");
      return;
    }
    if (perfil) savePerfil(perfil);
    let dest = "/";
    if (perfil === "personal") {
      const { data: p } = await sb.from("profiles").select("is_trainer").eq("id", data.user.id).maybeSingle();
      dest = p?.is_trainer ? "/personal" : "/personal/comecar";
    }
    router.replace(dest);
    router.refresh();
  }

  if (!ready) return null;

  if (!perfil)
    return (
      <RolePick
        onPick={pick}
        footer={
          <p className="pt-4 text-center text-[15px] text-label-2">
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-semibold text-accent-ink">
              Criar conta
            </Link>
          </p>
        }
      />
    );

  return (
    <>
      <div className="mt-10 mb-8 flex justify-center">
        <CargaLogo />
      </div>
      <PerfilChip perfil={perfil} onChange={() => pick(null)} />
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Bem-vindo de volta</h1>
      <p className="mt-1 text-[17px] text-label-2">{perfil === "personal" ? "Entre para ver seus alunos." : "Entre para continuar seus treinos."}</p>
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
        <Link href={`/cadastro?perfil=${perfil}`} className="font-semibold text-accent-ink">
          Criar conta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
