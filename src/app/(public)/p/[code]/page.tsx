"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Icon, Spinner } from "@/components/ui";
import { waLink } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";

type Show = { name: string; cref: string | null; bio: string | null; city: string | null; whatsapp: string | null; code: string; students: number; items: { before: string; after: string; caption: string | null }[] };
const pub = (p: string) => supabase().storage.from("vitrine").getPublicUrl(p).data.publicUrl;

/** Antes e depois com divisória que arrasta */
function Compare({ before, after, caption }: { before: string; after: string; caption: string | null }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  function move(x: number) {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  }
  return (
    <figure className="overflow-hidden rounded-[22px] bg-card">
      <div
        ref={box}
        className="relative w-full touch-none select-none"
        style={{ aspectRatio: "3 / 4" }}
        onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), move(e.clientX))}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
        role="slider"
        aria-label="Comparar antes e depois"
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => (e.key === "ArrowLeft" ? setPos((p) => Math.max(0, p - 5)) : e.key === "ArrowRight" ? setPos((p) => Math.min(100, p + 5)) : null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="Depois" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Antes" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
            <Icon name="swap" size={18} />
          </span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white">ANTES</span>
        <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-on-accent">DEPOIS</span>
      </div>
      {caption && <figcaption className="px-4 py-3 text-[15px] font-medium">{caption}</figcaption>}
    </figure>
  );
}

export default function Vitrine() {
  const { code } = useParams<{ code: string }>();
  const [s, setS] = useState<Show | null | undefined>(undefined);

  useEffect(() => {
    supabase().rpc("showcase", { p_code: code }).then(({ data }) => setS((data as Show) ?? null));
  }, [code]);

  if (s === undefined) return <div className="pt-40"><Spinner /></div>;
  if (!s)
    return (
      <div className="flex flex-col items-center gap-3 px-8 pt-40 text-center">
        <p className="text-[18px] font-semibold">Essa vitrine não existe ou está desligada.</p>
        <Link href="/" className="text-[16px] font-semibold text-accent-ink">Conhecer o Carga</Link>
      </div>
    );

  return (
    <main className="safe-top mx-auto w-full max-w-[520px] px-5 pb-16">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2 pt-10 text-center">
        <Avatar id={s.code} name={s.name} size={88} />
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[32px] font-bold leading-tight tracking-[-0.5px]">{s.name}</h1>
        <span className="text-[15px] text-label-2">
          Personal trainer{s.cref ? ` · CREF ${s.cref}` : ""}
          {s.city ? ` · ${s.city}` : ""}
        </span>
        {s.students > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-bold text-accent-ink">{s.students} {s.students === 1 ? "aluno ativo" : "alunos ativos"} no Carga</span>}
        {s.bio && <p className="mt-2 whitespace-pre-line text-[16px] leading-snug">{s.bio}</p>}
      </motion.header>

      <div className="mt-6 flex flex-col gap-2">
        {s.whatsapp && (
          <a href={waLink(s.whatsapp, `Oi ${s.name.split(" ")[0]}! Vi sua vitrine no Carga e quero saber sobre o acompanhamento.`)} target="_blank" rel="noreferrer" className="press flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#25D366] text-[17px] font-semibold text-white">
            <Icon name="chat" size={20} /> Chamar no WhatsApp
          </a>
        )}
        <Link href={`/convite-personal/${s.code}`} className="press flex h-[52px] items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-on-accent">
          Treinar com {s.name.split(" ")[0]}
        </Link>
      </div>

      {s.items.length > 0 && (
        <>
          <h2 className="mt-10 text-[22px] font-bold">Resultados dos alunos</h2>
          <p className="text-[13px] text-label-2">Arraste pra comparar. Publicado com autorização dos alunos.</p>
          <div className="mt-3 flex flex-col gap-4">
            {s.items.map((it, i) => (
              <motion.div key={it.before} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <Compare before={pub(it.before)} after={pub(it.after)} caption={it.caption} />
              </motion.div>
            ))}
          </div>
        </>
      )}
      <p className="mt-12 text-center text-[13px] text-label-3">Feito com o Carga · carga.app.br</p>
    </main>
  );
}
