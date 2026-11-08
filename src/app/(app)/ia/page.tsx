"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Header, Icon } from "@/components/ui";
import { vibrate } from "@/lib/util";

type Msg = { id: string; role: "user" | "assistant"; content: string; changed?: boolean; link?: { href: string; label: string } | null };

const SUGGESTIONS = [
  "Monte uma semana ABC, 4x por semana, foco em hipertrofia",
  "Treino de pernas completo pra quinta",
  "Quanto devo descansar entre as séries?",
  "Almocei arroz, feijão, frango grelhado e salada",
];

type SpeechRec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export default function AIPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [usage, setUsage] = useState<{ pro: boolean; used: number; limit: number | null } | null>(null);
  const [limited, setLimited] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/ia")
      .then((r) => r.json())
      .then((d) => {
        setMsgs(d.messages ?? []);
        if (d.usage) {
          setUsage(d.usage);
          setLimited(!d.usage.pro && d.usage.used >= d.usage.limit);
        }
      })
      .catch(() => {});
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    if (new URLSearchParams(location.search).get("prompt") === "monte") {
      setInput("Monte minha semana de treinos: ");
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(text = input) {
    const t = text.trim();
    if (!t || busy) return;
    setError("");
    setInput("");
    vibrate(8);
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", content: t }]);
    setBusy(true);
    try {
      const r = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const d = await r.json();
      if (d.usage) setUsage(d.usage);
      if (r.status === 402) {
        setLimited(true);
        setMsgs((m) => m.slice(0, -1));
        setInput(t);
        return;
      }
      if (!r.ok) throw new Error(d.error);
      if (d.usage && !d.usage.pro && d.usage.used >= d.usage.limit) setLimited(true);
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: d.reply, changed: d.changed, link: d.link }]);
      if (d.changed) vibrate([10, 40, 10]);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não foi possível falar com a IA.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join("");
      setInput(base + said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    vibrate(12);
    rec.start();
  }

  async function clear() {
    await fetch("/api/ia", { method: "DELETE" });
    setMsgs([]);
  }

  return (
    <div className="flex min-h-[calc(100dvh-90px)] flex-col">
      <Header
        title="Assistente"
        eyebrow="TREINO E ALIMENTAÇÃO"
        right={
          usage && !usage.pro && !msgs.length ? (
            <Link href="/pro" className="press flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-label-2">
              <span className="tabular">{Math.max(0, (usage.limit ?? 0) - usage.used)}/{usage.limit}</span> grátis
            </Link>
          ) : msgs.length > 0 ? (
            <button onClick={clear} className="press h-9 rounded-full bg-card px-3 text-[14px] font-semibold text-label-2">
              Limpar
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-1 flex-col gap-3 px-4 pb-44 pt-3">
        {msgs.length === 0 && !busy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 px-1">
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
                <Icon name="spark" size={24} />
              </div>
              <p className="text-[15px] leading-snug text-label-2">
                Fale ou digite o que você quer. Eu monto sua semana, ajusto exercícios, registro peso e medidas e tiro dúvidas.
              </p>
            </div>
            <span className="pt-2 text-[13px] font-semibold text-label-2">EXPERIMENTE</span>
            {SUGGESTIONS.map((s, i) => (
              <motion.button key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} onClick={() => send(s)} className="press rounded-2xl bg-card px-4 py-3 text-left text-[16px]">
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-[16px] leading-snug ${m.role === "user" ? "rounded-br-md bg-accent text-on-accent" : "rounded-bl-md bg-card"}`}>{m.content}</div>
              {m.changed && (
                <Link href={m.link?.href ?? "/treinos"} className="press mt-1.5 flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1.5 text-[14px] font-semibold text-good">
                  <Icon name="check" size={15} stroke={3} /> Salvo · {m.link?.label ?? "ver minha semana"}
                </Link>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-16 items-center justify-center gap-1 rounded-[20px] rounded-bl-md bg-card py-3.5" aria-label="A IA está escrevendo">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-2 w-2 rounded-full bg-label-3" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
            ))}
          </motion.div>
        )}
        {error && <p role="alert" className="px-1 text-[15px] text-bad">{error}</p>}
        {limited && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-5 text-center">
            <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-on-accent">PRO</span>
            <span className="text-[17px] font-semibold">Você usou as mensagens grátis deste mês</span>
            <span className="text-[14px] leading-snug text-label-2">Com o Pro, a IA fica sem limite: monta e ajusta seus treinos quantas vezes quiser.</span>
            <Link href="/pro" className="press mt-1 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[16px] font-semibold text-on-accent">
              Testar 7 dias grátis
            </Link>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+58px)] z-30 px-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-[500px] items-end gap-2 rounded-[26px] border border-sep bg-[var(--tabbar)] p-1.5 shadow-lg backdrop-blur-xl"
        >
          {canSpeak && (
            <motion.button type="button" onClick={toggleMic} aria-label={listening ? "Parar de ouvir" : "Falar"} animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={listening ? { repeat: Infinity, duration: 1 } : {}} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? "bg-bad-fill text-white" : "bg-card-2 text-accent-ink"}`}>
              <Icon name="mic" size={20} />
            </motion.button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Ouvindo…" : "Pergunte ou peça um treino"}
            aria-label="Mensagem para a IA"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[16px] outline-none placeholder:text-label-3"
          />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Enviar" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-30">
            <Icon name="send" size={20} stroke={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
