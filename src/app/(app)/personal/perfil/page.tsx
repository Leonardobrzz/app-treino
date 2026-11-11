"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button, Card, Icon, SectionTitle, Spinner } from "@/components/ui";
import { Field2, PHeader, PersonalNav, inputCls, useTrainer } from "@/components/personal/common";
import { supabase } from "@/lib/supabase/client";
import { vibrate } from "@/lib/util";

export default function TrainerProfile() {
  const me = useTrainer();
  const [f, setF] = useState({ cref: "", trainer_city: "", whatsapp: "", trainer_bio: "", pix_key: "", pix_name: "" });
  const [pub, setPub] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!me) return;
    setF({ cref: me.cref ?? "", trainer_city: me.trainer_city ?? "", whatsapp: me.whatsapp ?? "", trainer_bio: me.trainer_bio ?? "", pix_key: me.pix_key ?? "", pix_name: me.pix_name ?? me.name ?? "" });
    setPub(!!me.showcase_public);
  }, [me]);

  if (!me) return <Spinner />;
  const origin = typeof window !== "undefined" ? location.origin : "";
  const invite = `${origin}/convite-personal/${me.trainer_code}`;
  const vitrine = `${origin}/p/${me.trainer_code}`;

  async function save() {
    await supabase()
      .from("profiles")
      .update({ cref: f.cref.trim() || null, trainer_city: f.trainer_city.trim() || null, whatsapp: f.whatsapp.replace(/\D/g, "") || null, trainer_bio: f.trainer_bio.trim() || null, pix_key: f.pix_key.trim() || null, pix_name: f.pix_name.trim() || null, showcase_public: pub })
      .eq("id", me!.id);
    vibrate(10);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  async function copy(t: string, k: string) {
    await navigator.clipboard?.writeText(t).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(""), 1600);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PHeader title="Seu perfil" />
      <PersonalNav />

      <SectionTitle>Links</SectionTitle>
      <Card className="mx-5 overflow-hidden">
        {[
          ["Convite pra alunos", invite, "c"],
          ["Sua vitrine pública", vitrine, "v"],
        ].map(([l, u, k]) => (
          <div key={k} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{l}</span>
              <span className="truncate text-[13px] text-label-2">{u.replace(/^https?:\/\//, "")}</span>
            </div>
            <button onClick={() => copy(u, k)} className="press h-9 rounded-full bg-card-2 px-3.5 text-[14px] font-semibold text-accent-ink">{copied === k ? "Copiado" : "Copiar"}</button>
          </div>
        ))}
      </Card>

      <SectionTitle>Recebimento por Pix</SectionTitle>
      <Card className="mx-5 flex flex-col gap-3 p-4">
        <Field2 label="Chave Pix (CPF, e-mail, celular ou aleatória)">
          <input value={f.pix_key} onChange={set("pix_key")} className={`${inputCls} !bg-card-2`} />
        </Field2>
        <Field2 label="Nome do titular da conta">
          <input value={f.pix_name} onChange={set("pix_name")} className={`${inputCls} !bg-card-2`} />
        </Field2>
        <p className="text-[12px] leading-snug text-label-3">O app monta o Pix copia e cola com o valor certo. O dinheiro cai direto na sua conta, sem taxa do Carga.</p>
      </Card>

      <SectionTitle>Seus dados</SectionTitle>
      <div className="mx-5 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field2 label="CREF">
            <input value={f.cref} onChange={set("cref")} className={inputCls} />
          </Field2>
          <Field2 label="Cidade">
            <input value={f.trainer_city} onChange={set("trainer_city")} className={inputCls} />
          </Field2>
        </div>
        <Field2 label="WhatsApp">
          <input value={f.whatsapp} onChange={set("whatsapp")} inputMode="tel" className={inputCls} />
        </Field2>
        <Field2 label="Sobre você (aparece na vitrine)">
          <textarea value={f.trainer_bio} onChange={(e) => setF({ ...f, trainer_bio: e.target.value.slice(0, 400) })} rows={3} className="w-full resize-none rounded-xl bg-card px-3.5 py-2.5 text-[16px] outline-none ring-accent focus:ring-2" />
        </Field2>
      </div>

      <SectionTitle>Vitrine</SectionTitle>
      <label className="mx-5 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Vitrine pública ligada</span>
          <span className="text-[13px] leading-snug text-label-2">Página com seu perfil e os antes e depois que os alunos autorizaram.</span>
        </span>
        <button role="switch" aria-checked={pub} onClick={() => setPub(!pub)} className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${pub ? "bg-good" : "bg-fill"}`}>
          <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow ${pub ? "right-1" : "left-1"}`} />
        </button>
      </label>
      {pub && (
        <Link href={`/p/${me.trainer_code}`} className="mx-5 mt-2 flex items-center gap-1 text-[15px] font-semibold text-accent-ink">
          Ver minha vitrine <Icon name="chevron" size={16} />
        </Link>
      )}

      <div className="sticky bottom-24 z-20 mx-5 mt-6">
        <Button size="lg" className="w-full shadow-xl" onClick={save}>{saved ? "Salvo ✓" : "Salvar"}</Button>
      </div>
    </>
  );
}
