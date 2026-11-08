"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/confirm?next=/nova-senha`,
    });
    setLoading(false);
    if (error) return setError("Não foi possível enviar agora. Espere um pouco e tente de novo.");
    setSent(true);
  }

  return (
    <>
      <Link href="/login" className="mb-4 text-[17px] text-accent-ink">
        ‹ Voltar
      </Link>
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Esqueceu a senha?</h1>
      {sent ? (
        <p className="mt-2 text-[17px] leading-snug text-label-2">
          Se existir uma conta com <b className="text-label">{email}</b>, você vai receber um link para criar uma senha nova.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[17px] text-label-2">Digite seu e-mail e enviamos um link para redefinir.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label="E-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
            <Button size="lg" type="submit" disabled={loading}>
              {loading ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        </>
      )}
    </>
  );
}
