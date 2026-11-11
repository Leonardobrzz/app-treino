"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button, Card, Header, Icon, Spinner, type IconName } from "@/components/ui";
import { timeAgo } from "@/lib/feed";
import { enablePush, pushPermission, pushSupported } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";

type N = { id: string; kind: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null };
const ICON: Record<string, IconName> = {
  treino_novo: "dumbbell", anamnese: "clipboard", anamnese_ok: "clipboard", avaliacao: "body", cobranca: "pix", pagamento_ok: "check", comprovante: "image",
  aula: "calendar", desafio: "trophy", plano: "clock", sumido: "users", novo_aluno: "users", aluno_saiu: "users",
};

export default function Notifications() {
  const [list, setList] = useState<N[] | null>(null);
  const [perm, setPerm] = useState<string>("default");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPerm(pushPermission());
    supabase().from("notifications").select("id,kind,title,body,url,created_at,read_at").order("created_at", { ascending: false }).limit(60).then(async ({ data }) => {
      setList((data ?? []) as N[]);
      const unread = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);
      if (unread.length) await supabase().from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
    });
  }, []);

  async function turnOn() {
    const r = await enablePush();
    setPerm(pushPermission());
    setMsg(r === "ok" ? "Pronto! Os avisos vão chegar no seu celular." : r === "negado" ? "As notificações estão bloqueadas. Libere nas configurações do navegador ou do celular." : r === "sem-suporte" ? "Esse navegador não aceita notificações. No iPhone, instale o Carga na tela de início primeiro." : "Não consegui ativar agora.");
  }

  const ios = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent);

  return (
    <>
      <Header title="Avisos" back={{ href: "/", label: "Hoje" }} />
      {perm !== "granted" && (
        <Card className="mx-5 mt-1 flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <motion.span animate={{ rotate: [0, -14, 12, -8, 0] }} transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.6 }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon name="bell" size={21} />
            </motion.span>
            <span className="flex flex-col">
              <span className="text-[16px] font-semibold">Receber avisos no celular</span>
              <span className="text-[13px] leading-snug text-label-2">Treino novo, cobrança, aula marcada, desafios… {ios && !pushSupported() ? "No iPhone, primeiro adicione o Carga à tela de início." : ""}</span>
            </span>
          </div>
          {ios && !pushSupported() ? (
            <Link href="/instalar" className="press flex h-11 items-center justify-center rounded-xl bg-accent text-[16px] font-semibold text-on-accent">Como instalar</Link>
          ) : (
            <Button onClick={turnOn}>Ativar notificações</Button>
          )}
          {msg && <p className="text-[13px] text-label-2">{msg}</p>}
        </Card>
      )}
      {perm === "granted" && msg && <p className="mx-5 rounded-xl bg-good-soft px-4 py-3 text-[14px] font-medium text-good">{msg}</p>}

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-5 text-center text-[15px] text-label-2">Nenhum aviso por enquanto.</p>
      ) : (
        <div className="mx-5 mt-3 flex flex-col gap-2">
          <AnimatePresence initial>
            {list.map((n, i) => {
              const body = (
                <>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.read_at ? "bg-fill text-label-2" : "bg-accent text-on-accent"}`}>
                    <Icon name={ICON[n.kind] ?? "bell"} size={19} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold leading-snug">{n.title}</span>
                    {n.body && <span className="text-[13px] leading-snug text-label-2">{n.body}</span>}
                    <span className="mt-0.5 text-[12px] text-label-3">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Novo" />}
                </>
              );
              return (
                <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                  {n.url ? (
                    <Link href={n.url} className="press flex items-start gap-3 rounded-2xl bg-card p-3.5">{body}</Link>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl bg-card p-3.5">{body}</div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
