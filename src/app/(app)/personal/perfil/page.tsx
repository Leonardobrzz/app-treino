"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { savePerfil } from "@/components/RolePick";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Icon, SectionTitle, Spinner } from "@/components/ui";
import { Field2, PHeader, inputCls, useTrainer } from "@/components/personal/common";
import { supabase } from "@/lib/supabase/client";
import { BRAND_COLORS, applyBrand, logoUrl, onColor, prepareLogo } from "@/lib/brand";
import { vibrate } from "@/lib/util";

export default function TrainerProfile() {
  const me = useTrainer();
  const router = useRouter();
  const [f, setF] = useState({ cref: "", trainer_city: "", whatsapp: "", trainer_bio: "", pix_key: "", pix_name: "" });
  const [pub, setPub] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!me) return;
    setF({ cref: me.cref ?? "", trainer_city: me.trainer_city ?? "", whatsapp: me.whatsapp ?? "", trainer_bio: me.trainer_bio ?? "", pix_key: me.pix_key ?? "", pix_name: me.pix_name ?? me.name ?? "" });
    setPub(!!me.showcase_public);
    setColor(me.brand_color ?? null);
    setLogo(me.brand_logo ?? null);
  }, [me]);

  if (!me) return <Spinner />;
  const origin = typeof window !== "undefined" ? location.origin : "";
  const invite = `${origin}/convite-personal/${me.trainer_code}`;
  const vitrine = `${origin}/p/${me.trainer_code}`;

  async function save() {
    await supabase()
      .from("profiles")
      .update({ cref: f.cref.trim() || null, trainer_city: f.trainer_city.trim() || null, whatsapp: f.whatsapp.replace(/\D/g, "") || null, trainer_bio: f.trainer_bio.trim() || null, pix_key: f.pix_key.trim() || null, pix_name: f.pix_name.trim() || null, showcase_public: pub, brand_color: color, brand_logo: logo })
      .eq("id", me!.id);
    applyBrand(color || logo ? { name: me!.name ?? "Personal", color, logo: logoUrl(logo), mine: true } : null);
    window.dispatchEvent(new Event("marca"));
    vibrate(10);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  async function pickLogo(file?: File) {
    if (!file) return;
    setLogoBusy(true);
    try {
      const blob = await prepareLogo(file);
      const path = `${me!.id}/logo-${Date.now().toString(36)}.png`;
      const { error } = await supabase().storage.from("vitrine").upload(path, blob, { contentType: "image/png" });
      if (!error) {
        if (logo) await supabase().storage.from("vitrine").remove([logo]);
        setLogo(path);
      }
    } finally {
      setLogoBusy(false);
    }
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

      <SectionTitle>Sua marca</SectionTitle>
      <p className="mx-5 -mt-1 mb-3 text-[13px] leading-snug text-label-2">Sua cor e sua logo no app dos seus alunos (e no seu), nos PDFs de treino, dieta e avaliação.</p>
      <Card className="mx-5 flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-label-2">Cor</span>
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setColor(null)} aria-pressed={!color} aria-label="Cor padrão do Carga" className={`press flex h-9 items-center rounded-full px-3 text-[13px] font-semibold ${!color ? "bg-label text-bg" : "bg-card-2"}`}>
              Padrão
            </button>
            {BRAND_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Cor ${c}`} className="press h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--card)]" style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--card), 0 0 0 5px ${c}` : undefined }} />
            ))}
            <label className="press relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-card-2 text-label-2" aria-label="Escolher outra cor">
              <Icon name="plus" size={16} />
              <input type="color" value={color ?? "#ff9500"} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0" />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="logo-input" onChange={(e) => pickLogo(e.target.files?.[0])} />
          <button onClick={() => logoInput.current?.click()} className="press flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card-2 text-label-2" aria-label="Enviar logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logoUrl(logo)!} alt="Sua logo" className="h-full w-full object-contain p-1" /> : <Icon name="image" size={24} />}
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold">{logoBusy ? "Enviando…" : logo ? "Sua logo" : "Enviar sua logo"}</span>
            <span className="text-[13px] leading-snug text-label-2">PNG com fundo transparente fica melhor.</span>
          </div>
          {logo && (
            <button onClick={() => setLogo(null)} className="press h-9 px-2 text-[14px] font-semibold text-bad">
              Tirar
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: color ? `color-mix(in srgb, ${color} 14%, transparent)` : "var(--accent-soft)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logoUrl(logo)!} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <span className="h-9 w-9 rounded-lg" style={{ background: color ?? "var(--accent)" }} />}
          <span className="flex-1 text-[14px] font-semibold">Prévia no app do aluno</span>
          <span className="rounded-full px-3 py-1.5 text-[13px] font-bold" style={{ background: color ?? "var(--accent)", color: color ? onColor(color) : "var(--on-accent)" }}>Iniciar treino</span>
        </div>
      </Card>

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

      <SectionTitle>Conta</SectionTitle>
      <Card className="mx-5 overflow-hidden">
        {[
          { href: "/", icon: "swap" as const, label: "Usar como aluno", sub: "Pra registrar os seus próprios treinos", go: () => savePerfil("aluno") },
          { href: "/ajuda?p=personal", icon: "help" as const, label: "Como usar a área do personal", sub: "Passo a passo e dúvidas comuns" },
          { href: "/avisos", icon: "bell" as const, label: "Avisos e notificações" },
        ].map((l) => (
          <Link key={l.href} href={l.href} onClick={l.go} className="press flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
              <Icon name={l.icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[16px]">{l.label}</span>
              {l.sub && <span className="truncate text-[13px] text-label-2">{l.sub}</span>}
            </span>
            <Icon name="chevron" size={17} className="text-label-3" />
          </Link>
        ))}
      </Card>
      <button
        onClick={async () => {
          await supabase().auth.signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="press mx-5 mt-3 flex h-12 w-[calc(100%-40px)] items-center justify-center gap-2 rounded-2xl bg-card text-[16px] font-semibold text-bad"
      >
        <Icon name="logout" size={18} /> Sair da conta
      </button>

      <div className="sticky bottom-24 z-20 mx-5 mt-6">
        <Button size="lg" className="w-full shadow-xl" onClick={save}>{saved ? "Salvo ✓" : "Salvar"}</Button>
      </div>
    </>
  );
}
