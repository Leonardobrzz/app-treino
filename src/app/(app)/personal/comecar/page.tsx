"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Header, Icon } from "@/components/ui";
import { Field2, inputCls } from "@/components/personal/common";
import { getProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { vibrate } from "@/lib/util";

const PERKS = [
  ["users", "Seus alunos num lugar só", "Treinos, frequência, cargas, medidas e fotos de cada um."],
  ["clipboard", "Anamnese e avaliação física", "Questionário com PAR-Q, dobras com Pollock 3 e 7, perimetria e postural por fotos."],
  ["dumbbell", "Monte e envie o treino", "Com métodos (bi-set, drop, pirâmide…). O aluno recebe na hora no app."],
  ["pix", "Cobrança por Pix", "O Pix cai direto na sua conta. O app lembra o aluno e avisa você do atraso."],
  ["bell", "Radar e avisos", "Quem sumiu, quem estagnou, quem bateu recorde, plano vencendo."],
  ["trophy", "Desafios e vitrine", "Ranking entre seus alunos e uma página pública com antes e depois."],
] as const;

export default function BecomeTrainer() {
  const router = useRouter();
  const [cref, setCref] = useState("");
  const [city, setCity] = useState("");
  const [whats, setWhats] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProfile().then((p) => {
      if (p?.is_trainer) router.replace("/personal");
    });
  }, [router]);

  async function go() {
    setBusy(true);
    setError("");
    const { error: e } = await supabase().rpc("become_trainer", { p_cref: cref, p_bio: bio, p_city: city, p_whatsapp: whats });
    if (e) {
      setBusy(false);
      return setError("Não consegui ativar agora. Tenta de novo.");
    }
    vibrate([10, 40, 10]);
    router.replace("/personal");
  }

  return (
    <>
      <Header title="Área do personal" back={{ href: "/perfil", label: "Perfil" }} />
      <p className="px-5 text-[15px] leading-snug text-label-2">Acompanhe seus alunos no mesmo app que eles já usam pra treinar. Grátis por enquanto.</p>
      <div className="mx-5 mt-4 grid gap-2.5">
        {PERKS.map(([icon, t, d], i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-2xl bg-card p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon name={icon} size={19} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{t}</span>
              <span className="text-[13px] leading-snug text-label-2">{d}</span>
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mx-5 mt-6 flex flex-col gap-3">
        <Field2 label="CREF (opcional)">
          <input value={cref} onChange={(e) => setCref(e.target.value)} placeholder="000000-G/CE" className={inputCls} />
        </Field2>
        <Field2 label="Cidade">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Fortaleza" className={inputCls} />
        </Field2>
        <Field2 label="WhatsApp (pros alunos te chamarem)">
          <input value={whats} onChange={(e) => setWhats(e.target.value)} inputMode="tel" placeholder="(85) 99999-9999" className={inputCls} />
        </Field2>
        <Field2 label="Sobre você">
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 400))} rows={3} placeholder="Especialidades, como você trabalha…" className="w-full resize-none rounded-xl bg-card px-3.5 py-2.5 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
        </Field2>
        {error && <p role="alert" className="text-[14px] text-bad">{error}</p>}
        <button onClick={go} disabled={busy} className="press mt-1 h-[52px] rounded-[14px] bg-accent text-[17px] font-semibold text-on-accent disabled:opacity-50">
          {busy ? "Ativando…" : "Ativar área do personal"}
        </button>
        <p className="text-center text-[12px] text-label-3">Você continua usando o app normalmente pros seus treinos.</p>
      </div>
    </>
  );
}
