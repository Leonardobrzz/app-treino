"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ProLock } from "@/components/ProLock";
import { Button, Card, Empty, Header, Icon, SectionTitle, Segmented, Sheet, Spinner } from "@/components/ui";
import { getSubscription, getUserId } from "@/lib/data";
import { shrinkImage } from "@/lib/image";
import { isPro } from "@/lib/pro";
import { supabase } from "@/lib/supabase/client";
import { MEASURE_LABEL, type BodyMeasurement, type MeasureKey, type ProgressPhoto } from "@/lib/types";
import { fmtDate, num, todayISO, vibrate } from "@/lib/util";

type Pose = ProgressPhoto["pose"];
const POSES: { value: Pose; label: string }[] = [
  { value: "frente", label: "Frente" },
  { value: "lado", label: "Lado" },
  { value: "costas", label: "Costas" },
];
const COMPARE: MeasureKey[] = ["cintura", "peito", "braco", "coxa", "quadril"];

/** Registro mais próximo (até 30 dias) de uma data */
function nearest<T extends { measured_on: string }>(list: T[], iso: string): T | undefined {
  const t = new Date(iso).getTime();
  return list
    .map((x) => ({ x, d: Math.abs(new Date(x.measured_on).getTime() - t) }))
    .filter((y) => y.d <= 30 * 864e5)
    .sort((a, b) => a.d - b.d)[0]?.x;
}

export default function PhotosPage() {
  const [pro, setPro] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<{ measured_on: string; weight: number }[]>([]);
  const [measures, setMeasures] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<ProgressPhoto | null>(null);
  const [pose, setPose] = useState<Pose>("frente");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const load = useCallback(async () => {
    const [{ data: ph }, { data: w }, { data: m }] = await Promise.all([
      supabase().from("progress_photos").select("*").order("taken_on").order("created_at"),
      supabase().from("body_weights").select("measured_on,weight").order("measured_on"),
      supabase().from("body_measurements").select("*").order("measured_on"),
    ]);
    const list = (ph ?? []) as ProgressPhoto[];
    setPhotos(list);
    setWeights((w ?? []) as { measured_on: string; weight: number }[]);
    setMeasures((m ?? []) as BodyMeasurement[]);
    if (list.length) {
      const { data: signed } = await supabase().storage.from("progresso").createSignedUrls(list.map((p) => p.path), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => s.signedUrl && (map[list[i].id] = s.signedUrl));
      setUrls(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    getSubscription().then((s) => {
      const p = isPro(s);
      setPro(p);
      if (p) load();
      else setLoading(false);
    });
  }, [load]);

  const ofPose = useMemo(() => photos.filter((p) => p.pose === pose), [photos, pose]);
  const dates = useMemo(() => [...new Set(ofPose.map((p) => p.taken_on))], [ofPose]);
  useEffect(() => {
    setA(dates[0] ?? "");
    setB(dates.at(-1) ?? "");
  }, [dates]);
  const pa = ofPose.find((p) => p.taken_on === a);
  const pb = [...ofPose].reverse().find((p) => p.taken_on === b);

  const byDate = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>();
    [...photos].reverse().forEach((p) => m.set(p.taken_on, [...(m.get(p.taken_on) ?? []), p]));
    return [...m.entries()];
  }, [photos]);

  async function del(p: ProgressPhoto) {
    setView(null);
    await supabase().storage.from("progresso").remove([p.path]);
    await supabase().from("progress_photos").delete().eq("id", p.id);
    load();
  }

  if (pro === false)
    return (
      <>
        <Header title="Fotos" back={{ href: "/medidas", label: "Medidas" }} />
        <div className="pt-3">
          <ProLock locked title="Antes e depois" text="Guarde fotos de frente, lado e costas e compare lado a lado, com o peso e as medidas de cada época.">
            <Card className="mx-5 grid h-[420px] grid-cols-2 gap-1 overflow-hidden p-1">
              <div className="rounded-xl bg-fill" />
              <div className="rounded-xl bg-fill" />
            </Card>
          </ProLock>
        </div>
      </>
    );

  return (
    <>
      <Header
        title="Fotos"
        back={{ href: "/medidas", label: "Medidas" }}
        right={
          <button onClick={() => setAdding(true)} className="press mb-1 flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[15px] font-semibold text-on-accent">
            <Icon name="camera" size={17} /> Nova
          </button>
        }
      />
      {loading ? (
        <Spinner />
      ) : photos.length === 0 ? (
        <div className="pt-3">
          <Empty icon="image" title="Sua primeira foto" text="Tire de frente, de lado e de costas, sempre no mesmo lugar e com a mesma luz. Depois de algumas semanas, compare aqui lado a lado." action={<Button onClick={() => setAdding(true)}>Adicionar foto</Button>} />
          <p className="px-6 pt-3 text-[13px] leading-snug text-label-3">As fotos ficam guardadas só pra você, em armazenamento privado.</p>
        </div>
      ) : (
        <>
          <div className="px-5 pt-2">
            <Segmented value={pose} onChange={setPose} options={POSES} />
          </div>

          {dates.length >= 2 && pa && pb ? (
            <>
              <SectionTitle>Antes e depois</SectionTitle>
              <div className="flex gap-2 px-5 pb-2">
                <select aria-label="Data do antes" value={a} onChange={(e) => setA(e.target.value)} className="h-9 flex-1 rounded-[10px] bg-card px-2 text-[14px] font-semibold">
                  {dates.map((d) => (
                    <option key={d} value={d} disabled={d >= b}>
                      {fmtDate(d, { year: true })}
                    </option>
                  ))}
                </select>
                <select aria-label="Data do depois" value={b} onChange={(e) => setB(e.target.value)} className="h-9 flex-1 rounded-[10px] bg-card px-2 text-[14px] font-semibold">
                  {dates.map((d) => (
                    <option key={d} value={d} disabled={d <= a}>
                      {fmtDate(d, { year: true })}
                    </option>
                  ))}
                </select>
              </div>
              <BeforeAfter before={urls[pa.id]} after={urls[pb.id]} />
              <CompareStats a={a} b={b} weights={weights} measures={measures} />
            </>
          ) : (
            <p className="mx-5 mt-4 rounded-xl bg-card px-4 py-3 text-[14px] leading-snug text-label-2">
              {ofPose.length === 0 ? `Nenhuma foto de ${POSES.find((p) => p.value === pose)!.label.toLowerCase()} ainda.` : "Tire outra foto nessa pose em outro dia pra ver o antes e depois."}
            </p>
          )}

          <SectionTitle>Todas as fotos</SectionTitle>
          <div className="flex flex-col gap-4 px-5">
            {byDate.map(([d, list]) => (
              <div key={d} className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{fmtDate(d, { year: true })}</span>
                <div className="grid grid-cols-3 gap-2">
                  {list.map((p) => (
                    <button key={p.id} onClick={() => setView(p)} className="press relative aspect-[3/4] overflow-hidden rounded-xl bg-card" aria-label={`Foto de ${p.pose} em ${fmtDate(d)}`}>
                      {urls[p.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls[p.id]} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-white">{p.pose}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="px-6 pt-4 text-[13px] leading-snug text-label-3">As fotos ficam guardadas só pra você, em armazenamento privado.</p>
        </>
      )}

      <AddPhoto open={adding} onClose={() => setAdding(false)} onSaved={load} defaultPose={pose} />

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${POSES.find((p) => p.value === view.pose)!.label} · ${fmtDate(view.taken_on, { year: true })}` : ""}>
        {view && (
          <div className="flex flex-col gap-3 pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {urls[view.id] && <img src={urls[view.id]} alt="Foto de progresso" className="max-h-[60dvh] w-full rounded-2xl object-contain" />}
            <Button variant="danger" size="lg" onClick={() => del(view)}>
              <Icon name="trash" size={18} /> Apagar foto
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** Antes e depois com controle deslizante */
function BeforeAfter({ before, after }: { before?: string; after?: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative mx-5 aspect-[3/4] select-none overflow-hidden rounded-[20px] bg-card" data-testid="antes-depois">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {after && <img src={after} alt="Depois" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {before && <img src={before} alt="Antes" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <Icon name="swap" size={16} />
        </span>
      </div>
      <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white">Antes</span>
      <span className="absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white">Depois</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Comparar antes e depois" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}

function CompareStats({ a, b, weights, measures }: { a: string; b: string; weights: { measured_on: string; weight: number }[]; measures: BodyMeasurement[] }) {
  const wa = nearest(weights, a);
  const wb = nearest(weights, b);
  const ma = nearest(measures, a);
  const mb = nearest(measures, b);
  const days = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);
  const rows: { label: string; from: number; to: number; unit: string }[] = [];
  if (wa && wb) rows.push({ label: "Peso", from: Number(wa.weight), to: Number(wb.weight), unit: "kg" });
  if (ma && mb && ma.id !== mb.id) COMPARE.forEach((k) => ma[k] != null && mb[k] != null && rows.push({ label: MEASURE_LABEL[k], from: Number(ma[k]), to: Number(mb[k]), unit: "cm" }));
  return (
    <Card className="mx-5 mt-3 flex flex-col p-4">
      <span className="pb-2 text-[13px] font-semibold text-label-2">{days} dias de diferença</span>
      {rows.length === 0 ? (
        <span className="text-[14px] text-label-2">Registre peso e medidas perto das datas das fotos pra ver os números aqui.</span>
      ) : (
        rows.map((r) => {
          const d = r.to - r.from;
          return (
            <div key={r.label} className="flex items-center justify-between border-t border-sep py-2 text-[15px]">
              <span className="font-medium">{r.label}</span>
              <span className="tabular text-label-2">
                {num(r.from)} → <b className="text-label">{num(r.to)}</b> {r.unit}{" "}
                <span className={d === 0 ? "" : "font-semibold text-accent-ink"}>({d > 0 ? "+" : ""}{num(d)})</span>
              </span>
            </div>
          );
        })
      )}
    </Card>
  );
}

function AddPhoto({ open, onClose, onSaved, defaultPose }: { open: boolean; onClose: () => void; onSaved: () => void; defaultPose: Pose }) {
  const [pose, setPose] = useState<Pose>("frente");
  const [date, setDate] = useState("");
  const [img, setImg] = useState<{ preview: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPose(defaultPose);
    setDate(todayISO());
    setImg(null);
    setError("");
  }, [open, defaultPose]);

  async function pick(f?: File) {
    if (!f) return;
    try {
      const r = await shrinkImage(f, 1440, 0.85);
      setImg({ preview: r.preview, blob: r.blob });
    } catch {
      setError("Não consegui abrir essa foto.");
    }
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setError("");
    const uid = await getUserId();
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const up = await supabase().storage.from("progresso").upload(path, img.blob, { contentType: "image/jpeg" });
    if (up.error) {
      setBusy(false);
      return setError("Não consegui enviar a foto. Tente de novo.");
    }
    const { error: e } = await supabase().from("progress_photos").insert({ path, pose, taken_on: date || todayISO() });
    setBusy(false);
    if (e) return setError("Não consegui salvar a foto.");
    vibrate([10, 40, 10]);
    onSaved();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nova foto">
      <div className="flex flex-col gap-3 pt-1">
        <Segmented value={pose} onChange={setPose} options={POSES} />
        <label className="flex items-center justify-between rounded-xl bg-card px-4 py-2.5">
          <span className="text-[15px] text-label-2">Data</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[16px] font-semibold outline-none" />
        </label>
        <input ref={ref} type="file" accept="image/*" className="hidden" data-testid="foto-progresso" onChange={(e) => pick(e.target.files?.[0])} />
        {img ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-2xl bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.preview} alt="Prévia" className="max-h-[320px] w-full object-contain" />
            <button onClick={() => ref.current?.click()} className="press absolute bottom-2 right-2 flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[14px] font-semibold text-white">
              <Icon name="camera" size={16} /> Trocar
            </button>
          </motion.div>
        ) : (
          <button onClick={() => ref.current?.click()} className="press flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-fill bg-card px-4 py-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
              <Icon name="camera" size={24} />
            </span>
            <span className="text-[16px] font-semibold">Tirar ou escolher foto</span>
            <span className="text-[13px] text-label-2">Mesmo lugar, mesma luz, mesma distância</span>
          </button>
        )}
        <Button size="lg" disabled={!img || busy} onClick={save}>
          {busy ? "Enviando…" : "Salvar foto"}
        </Button>
        {error && <p role="alert" className="text-center text-[14px] font-medium text-bad">{error}</p>}
      </div>
    </Sheet>
  );
}
