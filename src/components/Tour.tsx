"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui";

type Slide = { img: string; icon: IconName; kicker: string; title: string; points: string[]; pro?: boolean };

export const TOUR: Slide[] = [
  {
    img: "/tour/hoje.webp",
    icon: "home",
    kicker: "Hoje",
    title: "Tudo do dia numa tela",
    points: ["O treino de hoje, pronto pra começar.", "Sua sequência de dias treinados na semana.", "Calorias, água e peso do dia num resumo."],
  },
  {
    img: "/tour/treino.webp",
    icon: "dumbbell",
    kicker: "Treinar",
    title: "Uma série, um toque",
    points: ["Toque no círculo pra concluir a série.", "O descanso começa a contar sozinho.", "Bateu as repetições? O Carga sugere subir a carga no próximo treino."],
  },
  {
    img: "/tour/prontidao.webp",
    icon: "heart",
    kicker: "Treino que se adapta",
    title: "Dormiu mal? O treino entende",
    points: ["Antes de começar, diga como dormiu, sua energia e se algo dói.", "O Carga deixa o treino mais leve ou mais forte.", "Máquina ocupada? Troque o exercício ou pule."],
  },
  {
    img: "/tour/como-fazer.webp",
    icon: "help",
    kicker: "Como fazer",
    title: "Não sabe o exercício? Veja",
    points: ["Imagens do movimento e 3 dicas de execução.", "Mais de 130 exercícios na biblioteca.", "Aparece no treino, na ficha e na biblioteca."],
  },
  {
    img: "/tour/ficha.webp",
    icon: "calendar",
    kicker: "Fichas",
    title: "Sua semana montada",
    points: ["Plano automático de acordo com seu objetivo e seus dias.", "Edite dias, exercícios, séries e descanso.", "Tem ficha da academia? Tire foto e a IA importa."],
  },
  {
    img: "/tour/ia.webp",
    icon: "spark",
    kicker: "Assistente",
    title: "Um personal no bolso",
    points: ["Tire dúvidas sobre treino e alimentação.", "Peça pra trocar exercícios ou montar uma ficha nova.", "Ele conhece seus treinos e sua evolução."],
    pro: true,
  },
  {
    img: "/tour/nutricao.webp",
    icon: "apple",
    kicker: "Nutrição",
    title: "Calorias pela foto do prato",
    points: ["Tire foto ou descreva o que comeu: a IA estima calorias e macros.", "Registre água com um toque.", "Metas calculadas pro seu corpo e objetivo."],
    pro: true,
  },
  {
    img: "/tour/evolucao.webp",
    icon: "chart",
    kicker: "Evolução",
    title: "Veja o resultado aparecer",
    points: ["Volume, recordes e força estimada de cada exercício.", "Peso e medidas do corpo mês a mês.", "Fotos de progresso, antes e depois lado a lado."],
  },
  {
    img: "/tour/amigos.webp",
    icon: "users",
    kicker: "Amigos e resumo",
    title: "Treine junto, mesmo longe",
    points: ["Ranking da semana com os amigos (sem mostrar suas cargas).", "Resumo da semana com o que melhorar.", "No fim do treino, gere um card pro story."],
  },
];

export function Tour({ onDone, doneLabel = "Bora treinar" }: { onDone: () => void; doneLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const last = i === TOUR.length - 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setI(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);

  const go = (n: number) => ref.current?.scrollTo({ left: n * ref.current.clientWidth, behavior: "smooth" });

  return (
    <div className="flex h-dvh flex-col">
      <div className="safe-top flex items-center justify-between px-5 pt-2">
        <span className="text-[14px] font-semibold text-label-2 tabular">
          {i + 1} de {TOUR.length}
        </span>
        {!last && (
          <button onClick={onDone} className="press h-9 px-1 text-[16px] font-semibold text-label-2">
            Pular
          </button>
        )}
      </div>

      <div ref={ref} className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain" aria-roledescription="carrossel">
        {TOUR.map((s, n) => (
          <section key={s.img} className="flex w-full shrink-0 snap-center flex-col px-6 pt-3" aria-label={`${n + 1} de ${TOUR.length}: ${s.title}`}>
            <div className="relative mx-auto h-[min(44dvh,400px)] aspect-[390/560] overflow-hidden rounded-[28px] border-[5px] border-label/90 bg-card shadow-[0_24px_50px_-24px_rgba(0,0,0,.45)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt="" loading={n < 2 ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                <Icon name={s.icon} size={16} />
              </span>
              <span className="text-[13px] font-bold uppercase tracking-wide text-accent-ink">{s.kicker}</span>
              {s.pro && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide text-on-accent">PRO</span>}
            </div>
            <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-[26px] font-bold leading-tight tracking-[-0.4px]">{s.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {s.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-[16px] leading-snug text-label-2">
                  <Icon name="check" size={18} stroke={2.6} className="mt-0.5 shrink-0 text-accent-ink" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Telas do tour">
          {TOUR.map((s, n) => (
            <button key={s.img} role="tab" aria-selected={n === i} aria-label={s.kicker} onClick={() => go(n)} className="flex h-4 items-center">
              <motion.span animate={{ width: n === i ? 22 : 7 }} className={`block h-[7px] rounded-full ${n === i ? "bg-accent" : "bg-fill"}`} />
            </button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => (last ? onDone() : go(i + 1))}
          className="h-[54px] rounded-2xl bg-accent text-[18px] font-bold text-on-accent"
        >
          {last ? doneLabel : "Próximo"}
        </motion.button>
      </div>
    </div>
  );
}
