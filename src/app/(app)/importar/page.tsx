"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProBadge } from "@/components/ProLock";
import { Button, Card, Header, Icon } from "@/components/ui";
import { getActivePlan } from "@/lib/data";
import { shrinkImage } from "@/lib/image";
import { WEEKDAYS, WEEKDAYS_SHORT, num, vibrate } from "@/lib/util";

type Ex = { nome: string; grupo: string; series: number; repeticoes: string; carga_kg: number | null; descanso_s: number | null; nota: string | null; novo: boolean };
type Day = { dia_semana: number; titulo: string; exercicios: Ex[] };
type Plan = { nome: string; dias: Day[] };
type Usage = { used: number; limit: number; left: number; pro: boolean };

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ImportPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<{ data: string; preview: string }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [aviso, setAviso] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/importar")
      .then((r) => r.json())
      .then((d) => d.usage && setUsage(d.usage))
      .catch(() => {});
    getActivePlan().then((p) => setHasPlan(!!p?.plan_days.length));
  }, []);

  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    const list = [...files].slice(0, 4 - photos.length);
    try {
      const out = await Promise.all(list.map((f) => shrinkImage(f, 1600, 0.85)));
      setPhotos((p) => [...p, ...out.map(({ data, preview }) => ({ data, preview }))].slice(0, 4));
    } catch {
      setError("Não consegui abrir uma das fotos.");
    }
  }

  async function read() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/importar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ images: photos.map((p) => p.data), text }) });
      const d = await res.json().catch(() => ({}));
      if (d.usage) setUsage(d.usage);
      if (!res.ok) throw new Error(d.error || "Não deu certo agora.");
      setPlan(d.plan);
      setAviso(d.aviso ?? "");
      vibrate([10, 30, 10]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!plan) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/importar", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
    setBusy(false);
    if (!res.ok) return setError("Não consegui salvar. Tente de novo.");
    vibrate([10, 40, 10]);
    router.push("/treinos?importado=1");
  }

  const setDay = (i: number, patch: Partial<Day>) => setPlan((p) => p && { ...p, dias: p.dias.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const usedDays = new Set(plan?.dias.map((d) => d.dia_semana));
  const blocked = usage && usage.left <= 0;

  return (
    <>
      <Header title="Importar ficha" back={{ href: "/treinos", label: "Semana" }} />

      {!plan ? (
        <div className="flex flex-col gap-3 px-5 pt-2">
          <p className="text-[15px] leading-snug text-label-2">
            Tire foto da ficha de papel, do quadro ou um print do app da sua academia. A IA transcreve tudo e monta a sua semana aqui, com sugestão de carga e evolução.
          </p>

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" data-testid="ficha-input" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <div className="grid grid-cols-2 gap-2.5">
            <AnimatePresence>
              {photos.map((p, i) => (
                <motion.div key={p.preview.slice(-40) + i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={`Foto ${i + 1} da ficha`} className="h-full w-full object-cover" />
                  <button onClick={() => setPhotos((l) => l.filter((_, j) => j !== i))} aria-label={`Remover foto ${i + 1}`} className="press absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                    <Icon name="close" size={14} stroke={2.5} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {photos.length < 4 && (
              <button onClick={() => fileRef.current?.click()} className={`press flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-fill bg-card p-4 text-center ${photos.length ? "aspect-[3/4]" : "col-span-2 py-8"}`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                  <Icon name="camera" size={24} />
                </span>
                <span className="text-[15px] font-semibold">{photos.length ? "Mais uma foto" : "Fotografar a ficha"}</span>
                {!photos.length && <span className="text-[13px] text-label-2">Até 4 fotos (uma por treino, se precisar)</span>}
              </button>
            )}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={6000}
            placeholder={"Ou cole o texto da ficha:\nTreino A — Supino reto 4x10, Crucifixo 3x12…"}
            className="resize-none rounded-xl bg-card px-4 py-3 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2"
          />

          {usage && !usage.pro && (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-label-2">
              <span>{usage.left > 0 ? `${usage.left} de ${usage.limit} importações grátis neste mês.` : "Você já usou as importações grátis deste mês."}</span>
              <Link href="/pro" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-accent-ink">
                <ProBadge /> ilimitado
              </Link>
            </p>
          )}

          <Button size="lg" disabled={busy || blocked || (!photos.length && !text.trim())} onClick={read}>
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" /> Lendo a ficha…
              </>
            ) : (
              <>
                <Icon name="spark" size={18} /> Ler ficha
              </>
            )}
          </Button>
          {error && <p role="alert" className="text-center text-[14px] font-medium text-bad">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 pt-2">
          <p className="text-[15px] leading-snug text-label-2">Confira os dias e os exercícios. Dá pra trocar o dia da semana e tirar o que não quiser.</p>
          {aviso && <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px] leading-snug text-accent-ink">{aviso}</p>}

          {plan.dias.map((d, i) => (
            <Card key={i} className="flex flex-col gap-2 p-4">
              <input value={d.titulo} onChange={(e) => setDay(i, { titulo: e.target.value })} aria-label={`Nome do treino ${i + 1}`} className="bg-transparent text-[19px] font-bold outline-none" />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Dia do treino ${i + 1}`}>
                {ORDER.map((wd) => {
                  const on = d.dia_semana === wd;
                  const taken = !on && usedDays.has(wd);
                  return (
                    <button key={wd} role="radio" aria-checked={on} aria-label={WEEKDAYS[wd]} disabled={taken} onClick={() => setDay(i, { dia_semana: wd })} className={`press h-8 w-11 rounded-full text-[13px] font-semibold disabled:opacity-30 ${on ? "bg-accent text-on-accent" : "bg-card-2 text-label-2"}`}>
                      {WEEKDAYS_SHORT[wd]}
                    </button>
                  );
                })}
              </div>
              <ul className="mt-1 flex flex-col">
                {d.exercicios.map((e, j) => (
                  <li key={j} className="flex items-center gap-3 border-t border-sep py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5 text-[16px] font-medium">
                        <span className="truncate">{e.nome}</span>
                        {e.novo && <span className="shrink-0 rounded-md bg-fill px-1.5 py-0.5 text-[11px] font-semibold text-label-2">novo</span>}
                      </span>
                      <span className="truncate text-[13px] text-label-2">
                        {e.series} × {e.repeticoes}
                        {e.carga_kg ? ` · ${num(e.carga_kg)} kg` : ""}
                        {e.nota ? ` · ${e.nota}` : ""}
                      </span>
                    </div>
                    <button onClick={() => setDay(i, { exercicios: d.exercicios.filter((_, k) => k !== j) })} aria-label={`Tirar ${e.nome}`} className="press flex h-8 w-8 items-center justify-center rounded-full bg-card-2 text-label-2">
                      <Icon name="close" size={14} stroke={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setPlan((p) => p && { ...p, dias: p.dias.filter((_, j) => j !== i) })} className="self-start text-[14px] font-semibold text-bad">
                Remover este treino
              </button>
            </Card>
          ))}

          {hasPlan && <p className="text-[13px] leading-snug text-label-2">Isso substitui a sua semana atual. O histórico de treinos continua salvo.</p>}
          <Button size="lg" disabled={busy || !plan.dias.some((d) => d.exercicios.length)} onClick={save}>
            Salvar como minha semana
          </Button>
          <Button variant="plain" onClick={() => setPlan(null)}>Voltar e refazer</Button>
          {error && <p role="alert" className="text-center text-[14px] font-medium text-bad">{error}</p>}
        </div>
      )}
    </>
  );
}
