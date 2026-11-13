"use client";

import { Tip } from "@/components/guide";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Button, Icon, Sheet, Spinner } from "@/components/ui";
import { QuickMessage, useTrainer } from "@/components/personal/common";
import { StudentSummary } from "@/components/personal/StudentSummary";
import { PlanEditor } from "@/components/personal/PlanEditor";
import { AssessmentsTab } from "@/components/personal/AssessmentsTab";
import { AnamneseTab } from "@/components/personal/AnamneseTab";
import { PhotosTab } from "@/components/personal/PhotosTab";
import { FinanceTab } from "@/components/personal/FinanceTab";
import { DietTab } from "@/components/personal/DietTab";
import { MealsTab } from "@/components/personal/MealsTab";
import { ageFrom, claimLink, inviteText, studentDetail, waLink, type StudentDetail } from "@/lib/personal";
import { Field2, inputCls } from "@/components/personal/common";
import { PAIN_OPTIONS, painLabel } from "@/lib/plan-generator";
import { Segmented } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

const TABS = [
  ["resumo", "Resumo"],
  ["treino", "Treino"],
  ["avaliacao", "Avaliação"],
  ["financeiro", "Financeiro"],
] as const;
type Tab = (typeof TABS)[number][0];
type Sub = "geral" | "diario" | "ficha" | "dieta" | "fisica" | "anamnese" | "fotos";
const SUBS: Partial<Record<Tab, { value: Sub; label: string }[]>> = {
  resumo: [{ value: "geral", label: "Visão geral" }, { value: "diario", label: "Diário alimentar" }],
  treino: [{ value: "ficha", label: "Treino" }, { value: "dieta", label: "Alimentação" }],
  avaliacao: [{ value: "fisica", label: "Física" }, { value: "anamnese", label: "Anamnese" }, { value: "fotos", label: "Fotos" }],
};
// Links antigos (?aba=anamnese etc.) continuam funcionando
const OLD: Record<string, [Tab, Sub?]> = { diario: ["resumo", "diario"], dieta: ["treino", "dieta"], anamnese: ["avaliacao", "anamnese"], fotos: ["avaliacao", "fotos"] };
const FIRST: Record<Tab, Sub | undefined> = { resumo: "geral", treino: "ficha", avaliacao: "fisica", financeiro: undefined };

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useTrainer();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [tab, setTab] = useState<Tab>("resumo");
  const [sub, setSub] = useState<Sub | undefined>("geral");
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [claim, setClaim] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { name: string; sex: "masculino" | "feminino"; birth: string; height: string }>(null);
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<null | { profession: string; pains: string[] }>(null);

  const load = useCallback(async () => {
    try {
      setD(await studentDetail(id));
    } catch {
      setError("Esse aluno não está mais na sua lista.");
    }
  }, [id]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const a = q.get("aba") ?? "";
    const old = OLD[a];
    if (old) {
      setTab(old[0]);
      setSub(old[1]);
    } else if (TABS.some((t) => t[0] === a)) {
      const t = a as Tab;
      const v = q.get("ver") as Sub | null;
      setTab(t);
      setSub(v && SUBS[t]?.some((o) => o.value === v) ? v : FIRST[t]);
    }
  }, []);
  useEffect(() => {
    if (!me) return;
    load();
    supabase().from("guest_students").select("claim_code").eq("id", id).is("claimed_by", null).maybeSingle().then(({ data }) => setClaim(data?.claim_code ?? null));
  }, [me, load, id]);

  async function saveInfo() {
    if (!info) return;
    await supabase().rpc("trainer_set_student_info", { p_student: id, p_profession: info.profession, p_pains: info.pains });
    setInfo(null);
    load();
  }

  async function saveGuest() {
    if (!editing) return;
    await supabase().rpc("trainer_update_guest", { p_student: id, p_name: editing.name, p_sex: editing.sex, p_birth: editing.birth || null, p_height: editing.height ? Number(editing.height) : null });
    setEditing(null);
    load();
  }

  function pick(t: Tab, v: Sub | undefined = FIRST[t]) {
    setTab(t);
    setSub(v);
    history.replaceState(null, "", `?aba=${t}${v && v !== FIRST[t] ? `&ver=${v}` : ""}`);
  }

  async function end() {
    await supabase().rpc("trainer_end_student", { p_student: id });
    router.replace("/personal/alunos");
  }

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 px-8 pt-40 text-center">
        <p className="text-[17px] font-semibold">{error}</p>
        <Link href="/personal/alunos" className="text-[16px] font-semibold text-accent-ink">Voltar pros alunos</Link>
      </div>
    );

  const p = d?.profile;
  const brand = { name: me?.name ?? "Personal", cref: me?.cref ?? null };
  const age = ageFrom(p?.birth_date);

  return (
    <>
      <header className="safe-top px-5 pb-1">
        <Link href="/personal/alunos" className="press -ml-1 mb-1 flex h-8 w-fit items-center gap-0.5 text-[17px] text-accent-ink">
          <Icon name="back" size={22} /> Alunos
        </Link>
        {p ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
            <Avatar id={p.id} name={p.name ?? "?"} size={56} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.4px]">{p.name ?? "Sem nome"}</h1>
              <span className="truncate text-[14px] text-label-2">{[age ? `${age} anos` : null, p.goal, p.level].filter(Boolean).join(" · ") || "Sem dados do perfil"}</span>
            </div>
            <QuickMessage name={p.name ?? "Aluno"} phone={d!.link.phone} className="!h-11 !w-11" />
          </motion.div>
        ) : null}
        {p ? (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setInfo({ profession: p.profession ?? "", pains: p.pains ?? [] })} className="press mt-2.5 flex w-full flex-wrap items-center gap-1.5 text-left" aria-label="Profissão e dores do aluno">
            {p.profession ? (
              <span className="inline-flex h-7 items-center gap-1 rounded-full bg-card px-2.5 text-[13px] font-semibold">
                <Icon name="building" size={14} className="text-label-2" /> {p.profession}
              </span>
            ) : null}
            {(p.pains ?? []).map((x) => (
              <span key={x} className="inline-flex h-7 items-center rounded-full bg-bad/15 px-2.5 text-[13px] font-semibold text-bad">
                Dor: {painLabel(x).toLowerCase()}
              </span>
            ))}
            {!p.profession && !(p.pains ?? []).length ? (
              <span className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-fill px-2.5 text-[13px] font-semibold text-accent-ink">
                <Icon name="plus" size={13} /> Profissão e dores
              </span>
            ) : (
              <span className="inline-flex h-7 items-center px-1 text-[13px] font-semibold text-accent-ink">Editar</span>
            )}
          </motion.button>
        ) : (
          <div className="h-14" />
        )}
      </header>
      <Tip id="p-aluno" className="pt-1">Tudo do aluno fica em 4 abas: Resumo, Treino, Avaliação e Financeiro. O botão verde no topo manda mensagem pronta no WhatsApp.</Tip>
      {claim && d && me?.trainer_code && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mb-2 flex flex-col gap-2.5 rounded-2xl bg-accent-soft p-3.5">
          <span className="text-[14px] font-medium leading-snug">
            <b>Aluno sem app.</b> Você já pode avaliar, tirar fotos, montar treino e cobrar. Quando ele entrar pelo link, tudo vai pra conta dele.
          </span>
          <div className="flex flex-wrap gap-2">
            <a href={waLink(d.link.phone, inviteText(p?.name ?? "", claimLink(me.trainer_code, claim)))} target="_blank" rel="noreferrer" className="press flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[14px] font-semibold text-on-accent">
              <Icon name="chat" size={15} /> Convidar no WhatsApp
            </a>
            <button onClick={async () => (await navigator.clipboard?.writeText(claimLink(me.trainer_code!, claim)).catch(() => {}), setCopied(true), setTimeout(() => setCopied(false), 1500))} className="press h-9 rounded-full bg-card px-3.5 text-[14px] font-semibold text-accent-ink">
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <button onClick={() => setEditing({ name: p?.name ?? "", sex: p?.sex === "masculino" ? "masculino" : "feminino", birth: p?.birth_date ?? "", height: p?.height_cm ? String(p.height_cm) : "" })} className="press h-9 rounded-full bg-card px-3.5 text-[14px] font-semibold text-accent-ink">
              Editar dados
            </button>
          </div>
        </motion.div>
      )}
      <div role="tablist" className="grid grid-cols-4 border-b border-sep px-3">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => pick(k)} className={`relative h-11 px-1 text-[15px] ${tab === k ? "font-semibold text-label" : "font-medium text-label-2"}`}>
            {l}
            {tab === k && <motion.span layoutId="stab" className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {!d ? (
        <Spinner />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab + (sub ?? "")} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            {SUBS[tab] && (
              <div className="px-5 pb-1 pt-3">
                <Segmented<Sub> value={sub ?? FIRST[tab]!} onChange={(v) => pick(tab, v)} options={SUBS[tab]!} />
              </div>
            )}
            {sub === "geral" && <StudentSummary d={d} onSaved={load} />}
            {sub === "diario" && <MealsTab d={d} />}
            {sub === "ficha" && <PlanEditor d={d} onSent={load} trainer={brand} />}
            {sub === "dieta" && <DietTab d={d} trainer={brand} />}
            {sub === "fisica" && <AssessmentsTab d={d} />}
            {sub === "anamnese" && <AnamneseTab d={d} guest={!!claim} />}
            {sub === "fotos" && <PhotosTab d={d} onSaved={load} />}
            {tab === "financeiro" && <FinanceTab d={d} onSaved={load} pix={me?.pix_key ? { key: me.pix_key, name: me.pix_name ?? me.name ?? "Personal", city: me.trainer_city ?? null } : null} />}
          </motion.div>
        </AnimatePresence>
      )}

      {d && (
        <div className="px-5 pt-10">
          <Button variant="plain" className="w-full !text-bad" onClick={() => setEnding(true)}>
            Encerrar acompanhamento
          </Button>
        </div>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Dados do aluno">
        {editing && (
          <div className="flex flex-col gap-3 pt-1">
            <Field2 label="Nome">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value.slice(0, 60) })} className={inputCls} />
            </Field2>
            <Segmented<"masculino" | "feminino"> value={editing.sex} onChange={(v) => setEditing({ ...editing, sex: v })} options={[{ value: "feminino", label: "Feminino" }, { value: "masculino", label: "Masculino" }]} />
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Nascimento">
                <input type="date" value={editing.birth} onChange={(e) => setEditing({ ...editing, birth: e.target.value })} className={inputCls} />
              </Field2>
              <Field2 label="Altura (cm)">
                <input inputMode="numeric" value={editing.height} onChange={(e) => setEditing({ ...editing, height: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={inputCls} />
              </Field2>
            </div>
            <Button size="lg" onClick={saveGuest}>Salvar</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!info} onClose={() => setInfo(null)} title="Profissão e dores">
        {info && (
          <div className="flex flex-col gap-3 pt-1">
            <Field2 label="Profissão">
              <input value={info.profession} onChange={(e) => setInfo({ ...info, profession: e.target.value.slice(0, 80) })} placeholder="Ex.: enfermeira, trabalha em plantão" className={inputCls} />
            </Field2>
            <span className="text-[13px] font-semibold text-label-2">Onde sente dor</span>
            <div className="grid grid-cols-2 gap-2">
              {PAIN_OPTIONS.map((o) => {
                const on = info.pains.includes(o.id);
                return (
                  <button key={o.id} aria-pressed={on} onClick={() => setInfo({ ...info, pains: on ? info.pains.filter((x) => x !== o.id) : [...info.pains, o.id] })} className={`press flex flex-col items-start rounded-xl px-3 py-2 text-left ${on ? "bg-bad/15 text-bad" : "bg-card"}`}>
                    <span className="text-[15px] font-semibold">{o.label}</span>
                    <span className={`text-[12px] ${on ? "" : "text-label-2"}`}>{o.hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] leading-snug text-label-2">Aparece no topo do aluno e entra no treino automático e na IA. O aluno também informa na anamnese.</p>
            <Button size="lg" onClick={saveInfo}>Salvar</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={ending} onClose={() => setEnding(false)} title="Encerrar acompanhamento?">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] leading-snug text-label-2">O aluno sai da sua lista e você deixa de ver os dados dele. Ele continua com a conta, os treinos e o histórico.</p>
          <Button variant="danger" size="lg" className="!bg-card" onClick={end}>
            Encerrar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
