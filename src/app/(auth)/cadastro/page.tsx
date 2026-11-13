"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CargaLogo, type Perfil, PerfilChip, RolePick, savePerfil, savedPerfil } from "@/components/RolePick";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

function SignUp() {
  const router = useRouter();
  const params = useSearchParams();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
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
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    setLoading(true);
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: `${location.origin}/auth/confirm?next=${perfil === "personal" ? "/personal/comecar" : "/"}` },
    });
    setLoading(false);
    if (error) return setError(error.message.includes("registered") ? "Esse e-mail já tem conta. Tente entrar." : "Não foi possível criar a conta. Tente de novo.");
    if (perfil) savePerfil(perfil);
    if (data.session) {
      router.replace(perfil === "personal" ? "/personal/comecar" : "/");
      router.refresh();
    } else setSent(true);
  }

  if (sent)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Confira seu e-mail</h1>
        <p className="text-[17px] leading-snug text-label-2">
          Enviamos um link de confirmação para <b className="text-label">{email}</b>. Toque nele para ativar sua conta.
        </p>
        <Link href={`/login?perfil=${perfil}`} className="mt-6 text-[17px] font-semibold text-accent-ink">
          Voltar para o login
        </Link>
      </div>
    );

  if (!ready) return null;

  if (!perfil)
    return (
      <RolePick
        onPick={pick}
        footer={
          <p className="pt-4 text-center text-[15px] text-label-2">
            Já tem conta?{" "}
            <Link href="/login" className="font-semibold text-accent-ink">
              Entrar
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
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Criar conta</h1>
      <p className="mt-1 text-[17px] text-label-2">{perfil === "personal" ? "Seus alunos, treinos e cobranças num lugar só." : "Seus treinos, sua carga, sua evolução."}</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Nome" autoComplete="given-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Leonardo" />
        <Field label="E-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        <Field label="Senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 8 caracteres" />
        {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
        <Button size="lg" type="submit" disabled={loading}>
          {loading ? "Criando…" : "Criar conta"}
        </Button>
        <p className="text-center text-[13px] leading-snug text-label-2">
          Ao criar sua conta, você concorda com os{" "}
          <Link href="/termos" className="font-semibold text-accent-ink">Termos de uso</Link> e a{" "}
          <Link href="/privacidade" className="font-semibold text-accent-ink">Política de privacidade</Link>.
        </p>
      </form>
      <p className="mt-auto pt-10 text-center text-[15px] text-label-2">
        Já tem conta?{" "}
        <Link href={`/login?perfil=${perfil}`} className="font-semibold text-accent-ink">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}
