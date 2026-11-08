"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon, Sheet, Spinner } from "./ui";

type Guide = Record<string, { img: string | null; tips: string[] }>;
let guidePromise: Promise<Guide> | null = null;

/** Imagens e dicas de execução (public/exercicios/guia.json), carregadas uma vez só */
export function loadGuide() {
  guidePromise ??= fetch("/exercicios/guia.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => {
      guidePromise = null;
      return {};
    });
  return guidePromise;
}

export type GuideExercise = { name: string; muscle_group: string; equipment?: string; secondary?: string[] };

/** Duas fotos (início e fim) alternando, como um GIF */
function Frames({ slug, name }: { slug: string; name: string }) {
  const [frame, setFrame] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (loaded < 2) return;
    const t = setInterval(() => setFrame((f) => 1 - f), reduce ? 2200 : 1100);
    return () => clearInterval(t);
  }, [loaded, reduce]);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white" data-testid="guia-frames">
      {[0, 1].map((k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={k}
          src={`/exercicios/${slug}/${k}.webp`}
          alt={k === 0 ? `${name}: posição inicial` : `${name}: posição final`}
          onLoad={() => setLoaded((n) => n + 1)}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
          style={{ opacity: frame === k ? 1 : 0 }}
        />
      ))}
      {loaded < 2 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex gap-1 rounded-full bg-black/55 p-1">
        {["Início", "Fim"].map((l, k) => (
          <button key={l} onClick={() => setFrame(k)} className={`h-6 rounded-full px-2.5 text-[12px] font-semibold transition-colors ${frame === k ? "bg-white text-black" : "text-white"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseGuideSheet({ exercise, onClose }: { exercise: GuideExercise | null; onClose: () => void }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  useEffect(() => {
    if (exercise && !guide) loadGuide().then(setGuide);
  }, [exercise, guide]);
  const g = exercise && guide ? guide[exercise.name] : undefined;

  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise?.name ?? ""}>
      {exercise && (
        <div className="flex flex-col gap-4 pt-1">
          {!guide ? (
            <Spinner />
          ) : (
            <>
              {g?.img ? (
                <Frames key={g.img} slug={g.img} name={exercise.name} />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-4 py-6 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                    <Icon name="image" size={22} />
                  </span>
                  <span className="text-[14px] text-label-2">{g ? "Ainda sem imagem pra esse exercício." : "Exercício criado por você — ainda sem guia."}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-accent px-3 py-1 text-[13px] font-semibold text-on-accent">{exercise.muscle_group}</span>
                {(exercise.secondary ?? []).map((s) => (
                  <span key={s} className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink">
                    {s}
                  </span>
                ))}
                {exercise.equipment && <span className="rounded-full bg-card px-3 py-1 text-[13px] font-medium text-label-2">{exercise.equipment}</span>}
              </div>

              {g && g.tips.length > 0 && (
                <ol className="flex flex-col gap-2.5">
                  <AnimatePresence>
                    {g.tips.map((t, i) => (
                      <motion.li key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="flex gap-3 text-[16px] leading-snug">
                        <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-ink">{i + 1}</span>
                        <span>{t}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              )}

              <p className="text-[12px] leading-snug text-label-3">
                Dor ou desconforto fora do normal? Pare e procure um profissional. {g?.img && "Imagens: free-exercise-db (domínio público)."}
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
