"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, Card, Header, Icon, SectionTitle, Segmented, Sheet, Spinner } from "@/components/ui";
import { getProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { num, vibrate, weekStart } from "@/lib/util";

type Row = { user_id: string; name: string; is_me: boolean; workouts: number; sets: number; volume: number; last_workout: string | null };
type Metric = "workouts" | "volume" | "sets";

const MEDAL = ["#FFB800", "#A8A8AE", "#C8803D"];

function lastLabel(iso: string | null) {
  if (!iso) return "ainda não treinou";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "treinou hoje" : d === 1 ? "treinou ontem" : `treinou há ${d} dias`;
}

export default function FriendsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [metric, setMetric] = useState<Metric>("workouts");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Row | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase().rpc("friends_leaderboard", { p_since: weekStart(new Date()).toISOString() });
    if (e) setError("Não consegui carregar o ranking.");
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    getProfile().then((p) => setCode(p?.friend_code ?? ""));
    let c = new URLSearchParams(location.search).get("convite");
    try {
      c ||= localStorage.getItem("convite");
    } catch {
      /* sem storage */
    }
    if (c) setPending(c.toUpperCase());
    load();
  }, [load]);

  useEffect(() => {
    if (pending && code && pending === code) {
      try {
        localStorage.removeItem("convite");
      } catch {}
      setPending(null);
    }
  }, [pending, code]);

  const link = typeof window !== "undefined" && code ? `${location.origin}/convite/${code}` : "";

  async function accept() {
    if (!pending) return;
    setBusy(true);
    setError("");
    const { data, error: e } = await supabase().rpc("add_friend", { p_code: pending });
    setBusy(false);
    try {
      localStorage.removeItem("convite");
    } catch {}
    setPending(null);
    history.replaceState(null, "", "/amigos");
    if (e) return setError(e.message.includes("inválido") ? "Esse convite não existe mais." : e.message.includes("próprio") ? "Esse é o seu próprio convite 😄" : "Não consegui aceitar o convite.");
    vibrate([10, 40, 10]);
    setMsg(`Pronto! Você e ${data} agora estão no mesmo ranking.`);
    load();
  }

  function decline() {
    try {
      localStorage.removeItem("convite");
    } catch {}
    setPending(null);
    history.replaceState(null, "", "/amigos");
  }

  async function share() {
    const text = "Bora treinar junto no Carga? Entra pelo meu link e disputa o ranking da semana comigo 💪";
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Carga", text, url: link });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    copy();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não consegui copiar. Segure no link para copiar.");
    }
  }

  async function doRemove() {
    if (!remove) return;
    const me = rows?.find((r) => r.is_me)?.user_id;
    await supabase().from("friendships").delete().or(`and(user_a.eq.${remove.user_id},user_b.eq.${me}),and(user_a.eq.${me},user_b.eq.${remove.user_id})`);
    setRemove(null);
    load();
  }

  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => Number(b[metric]) - Number(a[metric]) || Number(b.volume) - Number(a.volume)), [rows, metric]);
  const friends = (rows?.length ?? 1) - 1;
  const fmt = (r: Row) => (metric === "workouts" ? `${r.workouts} ${r.workouts === 1 ? "treino" : "treinos"}` : metric === "sets" ? `${r.sets} séries` : Number(r.volume) >= 1000 ? `${num(Number(r.volume) / 1000)} t` : `${Math.round(Number(r.volume))} kg`);

  return (
    <>
      <Header title="Amigos" back={{ href: "/feed", label: "Feed" }} />

      <AnimatePresence>
        {msg && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-5 mt-2 rounded-xl bg-good-soft px-4 py-3 text-[15px] font-medium text-good" role="status">
            {msg}
          </motion.p>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="mx-5 mt-2 rounded-xl bg-card px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}

      <SectionTitle>Ranking da semana</SectionTitle>
      <div className="px-5 pb-3">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: "workouts", label: "Treinos" },
            { value: "volume", label: "Volume" },
            { value: "sets", label: "Séries" },
          ]}
        />
      </div>
      {!rows ? (
        <Spinner />
      ) : (
        <Card className="mx-5 overflow-hidden">
          {sorted.map((r, i) => (
            <motion.button
              layout
              key={r.user_id}
              onClick={() => !r.is_me && setRemove(r)}
              className={`flex w-full items-center gap-3 border-b border-sep px-4 py-3 text-left last:border-0 ${r.is_me ? "bg-accent-soft" : "press"}`}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            >
              <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold" style={i < 3 && Number(r[metric]) > 0 ? { background: MEDAL[i], color: "#000" } : undefined}>
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-semibold">{r.is_me ? "Você" : r.name}</span>
                <span className="text-[13px] text-label-2">{lastLabel(r.last_workout)}</span>
              </div>
              <span className="tabular text-[16px] font-bold">{fmt(r)}</span>
            </motion.button>
          ))}
        </Card>
      )}
      <p className="px-6 pt-2 text-[13px] leading-snug text-label-3">Os amigos só veem esses totais da semana — nada de peso, medidas ou detalhes do treino.</p>

      <SectionTitle>{friends > 0 ? "Chamar mais gente" : "Chame a galera"}</SectionTitle>
      <Card className="mx-5 flex flex-col gap-3 p-4">
        <p className="text-[15px] leading-snug text-label-2">Mande seu link pra quem treina com você. Quando a pessoa entrar, vocês aparecem no ranking um do outro.</p>
        <div className="flex items-center gap-2 rounded-xl bg-card-2 px-3 py-2.5">
          <Icon name="link" size={17} className="shrink-0 text-label-2" />
          <span className="min-w-0 flex-1 truncate text-[14px] text-label-2" data-testid="link-convite">{link || "…"}</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!link} onClick={share}>
            <Icon name="send" size={17} /> Convidar
          </Button>
          <Button variant="secondary" disabled={!link} onClick={copy}>
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      </Card>

      <Sheet open={!!pending} onClose={decline} title="Convite pra treinar junto">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] leading-snug text-label-2">Aceitando, vocês entram no ranking semanal um do outro. Só aparecem os totais da semana (treinos, séries e volume).</p>
          <Button size="lg" disabled={busy} onClick={accept}>
            Aceitar convite
          </Button>
          <Button variant="plain" onClick={decline}>Agora não</Button>
        </div>
      </Sheet>

      <Sheet open={!!remove} onClose={() => setRemove(null)} title={remove?.name ?? ""}>
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] text-label-2">
            {remove && `${remove.workouts} treinos e ${remove.sets} séries nesta semana · ${lastLabel(remove.last_workout)}.`}
          </p>
          <Button variant="danger" size="lg" onClick={doRemove}>
            Desfazer amizade
          </Button>
        </div>
      </Sheet>
    </>
  );
}
