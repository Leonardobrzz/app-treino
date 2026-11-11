"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Icon, SectionTitle, Spinner } from "@/components/ui";
import { signed, uploadTo, type StudentDetail } from "@/lib/personal";
import { shrinkImage } from "@/lib/image";
import { todayISO } from "@/lib/util";
import { supabase } from "@/lib/supabase/client";
import { fmtDate, vibrate } from "@/lib/util";

type Item = { id: string; before_path: string; after_path: string; caption: string | null };
const pub = (p: string) => supabase().storage.from("vitrine").getPublicUrl(p).data.publicUrl;

const POSES = ["frente", "lado", "costas"] as const;
type Pose = (typeof POSES)[number];

export function PhotosTab({ d, onSaved }: { d: StudentDetail; onSaved: () => void }) {
  const [shoot, setShoot] = useState(false);
  const [day, setDay] = useState(todayISO());
  const [shots, setShots] = useState<Partial<Record<Pose, { blob: Blob; url: string }>>>({});
  const [saving, setSaving] = useState(false);
  const inputs = useRef<Partial<Record<Pose, HTMLInputElement | null>>>({});

  async function pickShot(p: Pose, f?: File) {
    if (!f) return;
    const { blob, preview } = await shrinkImage(f, 1400, 0.85);
    setShots((x) => ({ ...x, [p]: { blob, url: preview } }));
  }
  async function saveShots() {
    setSaving(true);
    try {
      for (const p of POSES) {
        const s = shots[p];
        if (!s) continue;
        const path = await uploadTo("progresso", d.profile.id, s.blob);
        const { error } = await supabase().from("progress_photos").insert({ user_id: d.profile.id, taken_on: day, pose: p, path });
        if (error) throw error;
      }
      vibrate([10, 40, 10]);
      setShots({});
      setShoot(false);
      onSaved();
    } catch {
      setMsg("Não consegui salvar as fotos. Tenta de novo.");
    } finally {
      setSaving(false);
    }
  }
  const [urls, setUrls] = useState<Map<string, string> | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const consent = d.link.showcase_consent;

  useEffect(() => {
    signed("progresso", d.photos.map((p) => p.path)).then(setUrls);
    supabase().from("showcase_items").select("id,before_path,after_path,caption").eq("student_id", d.profile.id).then(({ data }) => setItems((data ?? []) as Item[]));
  }, [d]);

  const byDate = useMemo(() => {
    const m = new Map<string, typeof d.photos>();
    for (const p of [...d.photos].reverse()) (m.get(p.taken_on) ?? m.set(p.taken_on, []).get(p.taken_on)!).push(p);
    return [...m.entries()];
  }, [d]);

  function toggle(path: string) {
    if (!consent) return;
    setPick((x) => (x.includes(path) ? x.filter((y) => y !== path) : [...x, path].slice(-2)));
  }

  async function publish() {
    if (pick.length !== 2 || !urls) return;
    setBusy(true);
    setMsg("");
    try {
      const ordered = [...pick].sort((a, b) => (d.photos.find((p) => p.path === a)!.taken_on < d.photos.find((p) => p.path === b)!.taken_on ? -1 : 1));
      const blobs = await Promise.all(ordered.map(async (p) => (await fetch(urls.get(p)!)).blob()));
      const [b, a] = await Promise.all(blobs.map((bl) => uploadTo("vitrine", d.link.trainer_id, bl, 1080)));
      const { data, error } = await supabase().from("showcase_items").insert({ student_id: d.profile.id, before_path: b, after_path: a, caption: caption.trim() || null }).select("id,before_path,after_path,caption").single();
      if (error) throw error;
      setItems((x) => [data as Item, ...x]);
      setPick([]);
      setCaption("");
      vibrate([10, 40, 10]);
      setMsg("Publicado na sua vitrine!");
    } catch {
      setMsg("Não consegui publicar. Tenta de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(it: Item) {
    setItems((x) => x.filter((y) => y.id !== it.id));
    await supabase().from("showcase_items").delete().eq("id", it.id);
    await supabase().storage.from("vitrine").remove([it.before_path, it.after_path]);
  }

  if (!urls) return <Spinner />;

  return (
    <div className="pt-3">
      {!shoot ? (
        <div className="mx-5 mb-3">
          <Button size="lg" className="w-full" onClick={() => setShoot(true)}>
            <Icon name="camera" size={18} /> Tirar fotos de progresso
          </Button>
        </div>
      ) : (
        <Card className="mx-5 mb-3 flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Fotos de progresso</span>
            <input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} className="h-9 rounded-lg bg-card-2 px-2 text-[14px] outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {POSES.map((p) => (
              <div key={p}>
                <input ref={(el) => { inputs.current[p] = el; }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickShot(p, e.target.files?.[0])} data-testid={`progresso-${p}`} />
                <button onClick={() => inputs.current[p]?.click()} className="press relative flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-card-2 text-label-2" style={{ aspectRatio: "3 / 4" }}>
                  {shots[p] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shots[p]!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <Icon name="camera" size={22} />
                  )}
                  <span className={`relative text-[12px] font-semibold capitalize ${shots[p] ? "mt-auto mb-1 rounded bg-black/60 px-1.5 text-white" : ""}`}>{p}</span>
                </button>
              </div>
            ))}
          </div>
          <span className="text-[12px] leading-snug text-label-3">Corpo inteiro, mesma distância e luz de sempre. As fotos ficam no app do aluno e só vão pra vitrine se ele autorizar.</span>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving || !Object.keys(shots).length} onClick={saveShots}>{saving ? "Salvando…" : "Salvar fotos"}</Button>
            <Button variant="plain" onClick={() => (setShoot(false), setShots({}))}>Cancelar</Button>
          </div>
        </Card>
      )}
      <div className={`mx-5 flex gap-3 rounded-2xl p-3.5 text-[14px] leading-snug ${consent ? "bg-good-soft text-good" : "bg-card text-label-2"}`}>
        <Icon name={consent ? "check" : "lock"} size={18} className="shrink-0" />
        {consent ? "O aluno autorizou aparecer na sua vitrine. Toque em duas fotos (antes e depois) pra publicar." : "O aluno não autorizou aparecer na sua vitrine. Ele pode liberar em “Meu personal” no app dele."}
      </div>

      {byDate.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nenhuma foto de progresso ainda. Tire as primeiras no botão acima: frente, lado e costas, sempre no mesmo lugar e com a mesma luz.</p>
      ) : (
        byDate.map(([date, list]) => (
          <div key={date}>
            <SectionTitle>{fmtDate(date, { year: true })}</SectionTitle>
            <div className="mx-5 grid grid-cols-3 gap-2">
              {list.map((p) => {
                const on = pick.indexOf(p.path);
                return (
                  <motion.button key={p.id} whileTap={{ scale: 0.95 }} onClick={() => toggle(p.path)} className={`relative overflow-hidden rounded-xl bg-fill ${on >= 0 ? "ring-4 ring-accent" : ""}`} style={{ aspectRatio: "3 / 4" }} aria-label={`Foto ${p.pose} de ${fmtDate(date)}`}>
                    {urls.get(p.path) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls.get(p.path)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-white">{p.pose}</span>
                    <AnimatePresence>{on >= 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">{pick.length === 2 ? (on === 0 ? "1" : "2") : "✓"}</motion.span>}</AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <AnimatePresence>
        {pick.length === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="sticky bottom-24 z-20 mx-5 mt-4">
            <Card className="flex flex-col gap-2 p-3 shadow-xl">
              <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 160))} placeholder="Legenda (ex.: 4 meses de treino)" className="h-11 rounded-xl bg-card-2 px-3.5 text-[15px] outline-none" />
              <Button disabled={busy} onClick={publish}>{busy ? "Publicando…" : "Publicar antes e depois na vitrine"}</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {msg && <p className="mx-5 mt-3 text-center text-[14px] font-medium text-good">{msg}</p>}

      {items.length > 0 && (
        <>
          <SectionTitle>Na sua vitrine</SectionTitle>
          <div className="mx-5 flex flex-col gap-3">
            {items.map((it) => (
              <Card key={it.id} className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {[it.before_path, it.after_path].map((p, i) => (
                    <div key={p} className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "3 / 4" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pub(p)} alt={i ? "Depois" : "Antes"} className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{i ? "DEPOIS" : "ANTES"}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] text-label-2">{it.caption ?? "Sem legenda"}</span>
                  <button onClick={() => remove(it)} className="press text-[14px] font-semibold text-bad">Tirar</button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
