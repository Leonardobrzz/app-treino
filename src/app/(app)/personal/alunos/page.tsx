"use client";

import { Tip } from "@/components/guide";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Icon, Segmented, Sheet, Spinner } from "@/components/ui";
import { Field2, PHeader, Pill, StudentLine, inputCls, useTrainer } from "@/components/personal/common";
import { daysSince, guestMap, trainerDashboard, type DashRow, type Guest } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { vibrate } from "@/lib/util";

export default function Students() {
  const me = useTrainer();
  const [rows, setRows] = useState<DashRow[] | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [guests, setGuests] = useState<Map<string, Guest>>(new Map());
  const [adding, setAdding] = useState(false);
  const [g, setG] = useState({ name: "", phone: "", sex: "feminino" as "masculino" | "feminino", birth: "", height: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Atalho do Início: /personal/alunos?novo=1 já abre o cadastro.
    if (new URLSearchParams(location.search).get("novo")) setAdding(true);
  }, []);

  useEffect(() => {
    if (!me) return;
    trainerDashboard().then(setRows).catch(() => setRows([]));
    guestMap().then(setGuests);
  }, [me]);

  async function addGuest() {
    if (!g.name.trim()) return setError("Coloque o nome do aluno.");
    setBusy(true);
    setError("");
    const { data, error: e } = await supabase().rpc("trainer_add_guest", { p_name: g.name, p_phone: g.phone, p_sex: g.sex, p_birth: g.birth || null, p_height: g.height ? Number(g.height) : null });
    setBusy(false);
    if (e || !data) return setError("Não consegui cadastrar. Tenta de novo.");
    vibrate([10, 40, 10]);
    router.push(`/personal/aluno/${data}?aba=avaliacao`);
  }

  const link = typeof window !== "undefined" && me?.trainer_code ? `${location.origin}/convite-personal/${me.trainer_code}` : "";
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  async function share() {
    const text = "Bora treinar comigo no Carga! Entra pelo meu link pra receber seus treinos 💪";
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        return await nav.share({ title: "Carga", text, url: link });
      } catch {
        /* cancelou */
      }
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PHeader title="Alunos" sub={rows ? `${rows.length} ${rows.length === 1 ? "aluno ativo" : "alunos ativos"}` : undefined} />
      <Tip id="p-alunos" className="pt-1">Toque num aluno pra ver tudo dele. Se ele ainda não tem o app, cadastre mesmo assim: quando entrar pelo link, recebe tudo.</Tip>

      <Card className="mx-5 mt-2 flex items-center gap-3 p-3.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">Convidar aluno</span>
          <span className="truncate text-[13px] text-label-2">
            Código <b className="tracking-wider text-label">{me?.trainer_code ?? "…"}</b> · {link.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <button onClick={share} disabled={!link} className="press flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[15px] font-semibold text-on-accent">
          <Icon name="send" size={16} /> {copied ? "Copiado" : "Enviar"}
        </button>
      </Card>

      <button onClick={() => (setError(""), setAdding(true))} className="press mx-5 mt-2 flex w-[calc(100%-40px)] items-center gap-3 rounded-2xl bg-card p-3.5 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name="plus" size={20} stroke={2.5} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">Cadastrar aluno sem app</span>
          <span className="text-[13px] leading-snug text-label-2">Avalie, fotografe e monte o treino agora. Quando ele baixar o app, tudo vai pra conta dele.</span>
        </span>
      </button>

      <label className="mx-5 mt-3 flex h-11 items-center gap-2 rounded-xl bg-card px-3">
        <Icon name="search" size={18} className="text-label-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno" aria-label="Buscar aluno" className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-3" />
      </label>

      {!rows ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] text-label-2">{rows.length ? "Ninguém com esse nome." : "Nenhum aluno ainda. Mande o convite ou cadastre um aluno sem app, aqui em cima."}</p>
      ) : (
        <Card className="mx-5 mt-3 overflow-hidden">
          {shown.map((r) => {
            const d = daysSince(r.last_workout);
            return (
              <StudentLine
                key={r.student_id}
                id={r.student_id}
                name={r.name}
                href={`/personal/aluno/${r.student_id}`}
                sub={guests.has(r.student_id) ? "cadastrado por você" : d == null ? "ainda não treinou" : d === 0 ? "treinou hoje" : `último treino há ${d} ${d === 1 ? "dia" : "dias"} · ${r.workouts_30d} no mês`}
                right={
                  <span className="flex items-center gap-1.5">
                    {guests.has(r.student_id) && <Pill tone="accent">sem app</Pill>}
                    {r.overdue_charges > 0 && <Pill tone="bad">atrasado</Pill>}
                    {r.anamnese === "pendente" && <Pill>anamnese</Pill>}
                    <Icon name="chevron" size={17} className="text-label-3" />
                  </span>
                }
              />
            );
          })}
        </Card>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Aluno sem app">
        <div className="flex flex-col gap-3 pt-1">
          <Field2 label="Nome">
            <input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value.slice(0, 60) })} className={inputCls} autoFocus />
          </Field2>
          <Field2 label="WhatsApp (pra mandar o convite e o Pix)">
            <input inputMode="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} placeholder="(85) 9…" className={inputCls} />
          </Field2>
          <Segmented<"masculino" | "feminino"> value={g.sex} onChange={(v) => setG({ ...g, sex: v })} options={[{ value: "feminino", label: "Feminino" }, { value: "masculino", label: "Masculino" }]} />
          <div className="grid grid-cols-2 gap-3">
            <Field2 label="Nascimento">
              <input type="date" value={g.birth} onChange={(e) => setG({ ...g, birth: e.target.value })} className={inputCls} />
            </Field2>
            <Field2 label="Altura (cm)">
              <input inputMode="numeric" value={g.height} onChange={(e) => setG({ ...g, height: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={inputCls} />
            </Field2>
          </div>
          {error && <p className="text-[14px] text-bad">{error}</p>}
          <Button size="lg" disabled={busy} onClick={addGuest}>{busy ? "Cadastrando…" : "Cadastrar e começar a avaliação"}</Button>
        </div>
      </Sheet>
    </>
  );
}
