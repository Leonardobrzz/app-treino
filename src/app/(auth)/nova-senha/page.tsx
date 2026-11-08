"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setLoading(true);
    const { error } = await supabase().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError("O link expirou. Peça um novo em “Esqueceu a senha?”.");
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.5px]">Nova senha</h1>
      <p className="mt-1 text-[17px] text-label-2">Escolha uma senha nova para sua conta.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 8 caracteres" />
        <Field label="Confirmar senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p role="alert" className="text-[15px] text-bad">{error}</p>}
        <Button size="lg" type="submit" disabled={loading}>
          {loading ? "Salvando…" : "Salvar senha"}
        </Button>
      </form>
    </>
  );
}
