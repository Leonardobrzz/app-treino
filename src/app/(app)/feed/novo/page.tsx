"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PostCard } from "@/components/PostCard";
import { Button, Header, Icon, SectionTitle, Spinner } from "@/components/ui";
import { createPost, uploadPostPhoto, type Post } from "@/lib/feed";
import { getProfile, getUserId } from "@/lib/data";
import { shrinkImage } from "@/lib/image";
import { supabase } from "@/lib/supabase/client";
import { vibrate } from "@/lib/util";

type Sess = { id: string; title: string; started_at: string; finished_at: string; volume: number; sets: number; exercises: number; posted: boolean };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
}

export default function NewPostPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [prs, setPrs] = useState<string[]>([]);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "eu", name: "Você" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const want = q.get("sessao");
    const p = q.get("prs");
    if (p) setPrs(p.split("|").filter(Boolean).slice(0, 5));
    (async () => {
      const [uid, profile] = await Promise.all([getUserId(), getProfile()]);
      if (uid) setMe({ id: uid, name: profile?.name ?? "Você" });
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data: ss } = await supabase().from("sessions").select("id, title, started_at, finished_at, session_sets(weight, reps, done, exercise_id)").not("finished_at", "is", null).gte("started_at", since).order("started_at", { ascending: false }).limit(10);
      const ids = (ss ?? []).map((s) => s.id);
      const { data: posted } = ids.length ? await supabase().from("posts").select("session_id").in("session_id", ids) : { data: [] };
      const done = new Set((posted ?? []).map((x) => x.session_id));
      const list: Sess[] = (ss ?? []).map((s) => {
        const sets = (s.session_sets as { weight: number; reps: number; done: boolean; exercise_id: string }[]).filter((x) => x.done);
        return { id: s.id, title: s.title, started_at: s.started_at, finished_at: s.finished_at!, volume: sets.reduce((a, x) => a + Number(x.weight) * x.reps, 0), sets: sets.length, exercises: new Set(sets.map((x) => x.exercise_id)).size, posted: done.has(s.id) };
      });
      setSessions(list);
      const first = list.find((s) => s.id === want && !s.posted) ?? list.find((s) => !s.posted);
      setSel(first?.id ?? null);
    })();
  }, []);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    try {
      const { preview: url, blob } = await shrinkImage(f, 1350, 0.84);
      setPreview(url);
      setFile(blob);
    } catch {
      setError("Não consegui abrir essa foto. Tenta outra.");
    }
  }

  const s = sessions?.find((x) => x.id === sel) ?? null;
  const fake: Post = useMemo(
    () => ({
      id: "preview",
      user_id: me.id,
      author: me.name,
      is_mine: true,
      caption: caption.trim() || null,
      photo_path: null,
      photo_url: preview,
      stats: s ? { title: s.title, minutes: Math.max(1, Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)), volume: s.volume, sets: s.sets, exercises: s.exercises, prs: s.id === sel ? prs : [] } : null,
      hidden: false,
      created_at: new Date().toISOString(),
      likes: 0,
      comments: 0,
      liked: false,
    }),
    [me, caption, preview, s, sel, prs],
  );

  const can = !!(s || file || caption.trim());

  async function publish() {
    if (!can || busy) return;
    setBusy(true);
    setError("");
    try {
      const path = file ? await uploadPostPhoto(file) : null;
      await createPost({ sessionId: s?.id ?? null, caption, photoPath: path, prs: s ? prs : [] });
      vibrate([10, 40, 10]);
      router.replace("/feed");
    } catch (e) {
      setBusy(false);
      setError((e as Error).message?.includes("posts_session") || (e as Error).message?.includes("duplicate") ? "Esse treino já foi postado." : "Não consegui postar agora. Tenta de novo.");
    }
  }

  return (
    <>
      <Header title="Novo post" back={{ href: "/feed", label: "Feed" }} />

      <SectionTitle>Treino</SectionTitle>
      {!sessions ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <p className="mx-5 rounded-2xl bg-card p-4 text-[15px] text-label-2">Nenhum treino concluído nos últimos 14 dias. Dá pra postar só a foto e um texto.</p>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1">
          <button onClick={() => setSel(null)} aria-pressed={sel === null} className={`press flex h-[74px] shrink-0 flex-col justify-center rounded-2xl px-4 text-left ${sel === null ? "bg-accent text-on-accent" : "bg-card"}`}>
            <span className="text-[15px] font-semibold">Sem treino</span>
            <span className={`text-[13px] ${sel === null ? "opacity-80" : "text-label-2"}`}>só foto/texto</span>
          </button>
          {sessions.map((x) => (
            <button key={x.id} disabled={x.posted} onClick={() => setSel(x.id)} aria-pressed={sel === x.id} className={`press relative flex h-[74px] min-w-[132px] shrink-0 flex-col justify-center rounded-2xl px-4 text-left disabled:opacity-45 ${sel === x.id ? "bg-accent text-on-accent" : "bg-card"}`}>
              <span className="max-w-[160px] truncate text-[15px] font-semibold">{x.title}</span>
              <span className={`text-[13px] ${sel === x.id ? "opacity-80" : "text-label-2"}`}>{x.posted ? "já postado" : dayLabel(x.started_at)}</span>
            </button>
          ))}
        </div>
      )}

      <SectionTitle>Foto</SectionTitle>
      <div className="flex gap-2 px-5">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="foto-post" />
        <Button variant="secondary" className="flex-1 !bg-card" onClick={() => input.current?.click()}>
          <Icon name="camera" size={18} /> {preview ? "Trocar foto" : "Escolher foto"}
        </Button>
        {preview && (
          <Button
            variant="danger"
            className="!bg-card"
            onClick={() => {
              setPreview(null);
              setFile(null);
              if (input.current) input.current.value = "";
            }}
          >
            Tirar
          </Button>
        )}
      </div>
      <p className="px-6 pt-2 text-[13px] text-label-3">Sem foto, o post vira um card colorido com os números do treino.</p>

      <SectionTitle>Legenda</SectionTitle>
      <div className="px-5">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 500))} rows={3} placeholder="Como foi o treino?" aria-label="Legenda" className="w-full resize-none rounded-2xl bg-card px-4 py-3 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
        <div className="text-right text-[12px] text-label-3">{caption.length}/500</div>
      </div>

      <SectionTitle>Prévia</SectionTitle>
      <AnimatePresence mode="wait">
        {can ? (
          <motion.div key="p" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none">
            <PostCard post={fake} onChange={() => {}} onComments={() => {}} onMenu={() => {}} />
          </motion.div>
        ) : (
          <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-5 rounded-2xl bg-card p-4 text-[15px] text-label-2">
            Escolha um treino, uma foto ou escreva algo.
          </motion.p>
        )}
      </AnimatePresence>

      {error && <p role="alert" className="mx-5 mt-3 rounded-xl bg-card px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}

      <div className="px-5 pt-5">
        <Button size="lg" className="w-full" disabled={!can || busy} onClick={publish}>
          {busy ? "Postando…" : "Postar pros amigos"}
        </Button>
      </div>
    </>
  );
}
