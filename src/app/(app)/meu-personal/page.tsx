"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Button, Card, Header, Icon, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { AssessmentView } from "@/components/personal/AssessmentView";
import { ChallengeCard } from "@/components/personal/ChallengeCard";
import { Pill } from "@/components/personal/common";
import { chargeTone } from "@/components/personal/ChargeRow";
import { brl, dateBR, myId, myTrainers, pixCode, uploadTo, waLink, type Anamnese, type Appointment, type Assessment, type Challenge, type Charge, type MyTrainer } from "@/lib/personal";
import { pushNow } from "@/lib/push";
import { PdfButton } from "@/components/personal/PdfButton";
import { DietSheetPages, type Diet } from "@/components/personal/SheetPages";
import { getProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { todayISO, vibrate } from "@/lib/util";

type Bundle = { charges: Charge[]; anamneses: Anamnese[]; appts: Appointment[]; challenges: Challenge[]; assessments: Assessment[]; diets: (Diet & { trainer_id: string })[] };

export default function MyTrainer() {
  const router = useRouter();
  const [list, setList] = useState<MyTrainer[] | null>(null);
  const [data, setData] = useState<Bundle | null>(null);
  const [invite, setInvite] = useState<{ code: string; name: string; cref: string | null; city: string | null; claim?: string } | null>(null);
  const [ranking, setRanking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(false);

  const load = useCallback(async () => {
    const [t, uid] = await Promise.all([myTrainers(), myId()]);
    setList(t);
    if (!t.length) return setData({ charges: [], anamneses: [], appts: [], challenges: [], assessments: [], diets: [] });
    const now = new Date().toISOString();
    const [c, a, ap, ch, as, di] = await Promise.all([
      supabase().from("charges").select("*").eq("student_id", uid).neq("status", "cancelada").order("due_on", { ascending: false }).limit(24),
      supabase().from("anamneses").select("*").eq("student_id", uid).order("requested_at", { ascending: false }),
      supabase().from("appointments").select("*").eq("student_id", uid).gte("starts_at", now).neq("status", "cancelada").order("starts_at").limit(10),
      supabase().from("challenges").select("*").gte("ends_on", todayISO()).order("ends_on"),
      supabase().from("assessments").select("*").eq("student_id", uid).order("assessed_on", { ascending: false }).limit(10),
      supabase().from("diet_plans").select("*").eq("student_id", uid).eq("active", true),
    ]);
    setData({ charges: (c.data ?? []) as Charge[], anamneses: (a.data ?? []) as Anamnese[], appts: (ap.data ?? []) as Appointment[], challenges: (ch.data ?? []) as Challenge[], assessments: (as.data ?? []) as Assessment[], diets: (di.data ?? []) as Bundle["diets"] });
  }, []);

  useEffect(() => {
    load();
    let c = new URLSearchParams(location.search).get("entrar");
    let v = new URLSearchParams(location.search).get("vinculo");
    try {
      c ||= localStorage.getItem("convite_personal");
      v ||= localStorage.getItem("convite_vinculo");
    } catch {
      /* sem storage */
    }
    if (c) lookup(c, v);
  }, [load]);

  async function lookup(c: string, v?: string | null) {
    setError("");
    if (v) {
      const { data: gd } = await supabase().rpc("guest_by_code", { p_claim: v });
      const g = (gd ?? [])[0] as { trainer_code: string; trainer_name: string; student_name: string } | undefined;
      if (g) {
        const { data: t0 } = await supabase().rpc("trainer_by_code", { p_code: g.trainer_code });
        const r0 = (t0 ?? [])[0] as { cref: string | null; city: string | null } | undefined;
        return setInvite({ code: g.trainer_code, name: g.trainer_name, cref: r0?.cref ?? null, city: r0?.city ?? null, claim: v.toUpperCase() });
      }
    }
    const { data: t } = await supabase().rpc("trainer_by_code", { p_code: c });
    const row = (t ?? [])[0] as { trainer_id: string; name: string; cref: string | null; city: string | null } | undefined;
    if (!row) {
      try {
        localStorage.removeItem("convite_personal");
      } catch {}
      return setError("Código de personal não encontrado.");
    }
    if (row.trainer_id === (await myId())) return setError("Esse é o seu próprio código 😄");
    setInvite({ code: c.toUpperCase(), name: row.name, cref: row.cref, city: row.city });
  }

  async function accept() {
    if (!invite) return;
    setBusy(true);
    const { error: e } = invite.claim ? await supabase().rpc("claim_guest", { p_claim: invite.claim, p_ranking: ranking }) : await supabase().rpc("join_trainer", { p_code: invite.code, p_ranking: ranking });
    setBusy(false);
    try {
      localStorage.removeItem("convite_personal");
      localStorage.removeItem("convite_vinculo");
    } catch {}
    history.replaceState(null, "", "/meu-personal");
    if (e) return setError(e.message.includes("inválido") ? "Esse convite já foi usado ou não existe mais." : "Não consegui entrar agora. Tenta de novo.");
    pushNow();
    vibrate([10, 40, 10, 40]);
    setInvite(null);
    setParty(true);
    setTimeout(() => setParty(false), 2800);
    load();
  }
  function decline() {
    try {
      localStorage.removeItem("convite_personal");
      localStorage.removeItem("convite_vinculo");
    } catch {}
    history.replaceState(null, "", "/meu-personal");
    setInvite(null);
  }

  return (
    <>
      <Confetti active={party} />
      <Header title="Meu personal" back={{ href: "/perfil", label: "Perfil" }} />
      {error && <p role="alert" className="mx-5 mt-1 rounded-xl bg-card px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}
      {!list || !data ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card className="mx-5 mt-2 flex flex-col gap-3 p-5">
          <span className="text-[18px] font-bold">Você ainda não tem personal no Carga</span>
          <span className="text-[15px] leading-snug text-label-2">Se o seu personal usa o Carga, peça o link ou o código dele. Ele vai poder mandar treinos, avaliações e acompanhar sua evolução.</span>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="Código" aria-label="Código do personal" className="h-11 min-w-0 flex-1 rounded-xl bg-card-2 px-3.5 text-[17px] font-semibold tracking-widest outline-none ring-accent focus:ring-2" />
            <Button disabled={code.length < 4} onClick={() => lookup(code)}>Entrar</Button>
          </div>
        </Card>
      ) : (
        list.map((t) => <TrainerBlock key={t.trainer_id} t={t} data={data} reload={load} onLeft={() => router.refresh()} />)
      )}

      <Sheet open={!!invite} onClose={decline} title="Entrar como aluno">
        {invite && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-3">
              <Avatar id={invite.code} name={invite.name} size={52} />
              <div className="flex flex-col">
                <span className="text-[18px] font-bold">{invite.name}</span>
                <span className="text-[14px] text-label-2">Personal trainer{invite.cref ? ` · CREF ${invite.cref}` : ""}{invite.city ? ` · ${invite.city}` : ""}</span>
              </div>
            </div>
            {invite.claim && (
              <p className="rounded-xl bg-good-soft p-3 text-[14px] font-medium leading-snug text-good">Seu personal já cadastrou seus dados (avaliação, fotos, treino). Entrando, tudo vem pra sua conta.</p>
            )}
            <p className="text-[14px] leading-snug text-label-2">Entrando, esse personal passa a ver seus treinos, cargas, peso, medidas e fotos de progresso, e pode mandar treinos, avaliações e cobranças pra você. Você pode sair quando quiser.</p>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
              <span className="text-[15px]">Aparecer no ranking dos alunos dele</span>
              <input type="checkbox" checked={ranking} onChange={(e) => setRanking(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            </label>
            <Button size="lg" disabled={busy} onClick={accept}>Entrar como aluno</Button>
            <Button variant="plain" onClick={decline}>Agora não</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function TrainerBlock({ t, data, reload, onLeft }: { t: MyTrainer; data: Bundle; reload: () => void; onLeft: () => void }) {
  const charges = data.charges.filter((c) => c.trainer_id === t.trainer_id);
  const open = charges.filter((c) => c.status === "aberta");
  const pending = data.anamneses.find((a) => a.trainer_id === t.trainer_id && !a.answered_at);
  const appts = data.appts.filter((a) => a.trainer_id === t.trainer_id);
  const chall = data.challenges.filter((c) => c.trainer_id === t.trainer_id);
  const assess = data.assessments.filter((a) => a.trainer_id === t.trainer_id);
  const diet = data.diets.find((x) => x.trainer_id === t.trainer_id);
  const [leaving, setLeaving] = useState(false);
  const [rk, setRk] = useState(t.ranking_opt_in);
  const [sc, setSc] = useState(t.showcase_consent);

  async function update(r: boolean, s: boolean) {
    setRk(r);
    setSc(s);
    await supabase().rpc("student_link_update", { p_trainer: t.trainer_id, p_ranking: r, p_showcase: s, p_leave: false });
  }
  async function leave() {
    await supabase().rpc("student_link_update", { p_trainer: t.trainer_id, p_ranking: null, p_showcase: null, p_leave: true });
    pushNow();
    setLeaving(false);
    reload();
    onLeft();
  }

  return (
    <section className="pb-4">
      <Card className="mx-5 mt-2 flex items-center gap-3 p-4">
        <Avatar id={t.trainer_id} name={t.name} size={52} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[18px] font-bold">{t.name}</span>
          <span className="truncate text-[13px] text-label-2">Personal{t.cref ? ` · CREF ${t.cref}` : ""}{t.plan_ends_on ? ` · plano até ${dateBR(t.plan_ends_on)}` : ""}</span>
        </div>
        {t.whatsapp && (
          <a href={waLink(t.whatsapp, `Oi ${t.name.split(" ")[0]}!`)} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp" className="press flex h-11 w-11 items-center justify-center rounded-full bg-good-soft text-good">
            <Icon name="chat" size={20} />
          </a>
        )}
      </Card>

      {pending && (
        <Link href={`/meu-personal/anamnese/${pending.id}`} className="press mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-accent p-4 text-on-accent">
          <Icon name="clipboard" size={22} />
          <span className="flex flex-1 flex-col">
            <span className="text-[16px] font-bold">Responder anamnese</span>
            <span className="text-[13px] opacity-90">Leva uns 3 minutos</span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      {open.length > 0 && (
        <>
          <SectionTitle>Pagamentos</SectionTitle>
          <div className="mx-5 flex flex-col gap-3">
            {open.map((c) => (
              <PayCard key={c.id} c={c} t={t} onDone={reload} />
            ))}
          </div>
        </>
      )}

      {appts.length > 0 && (
        <>
          <SectionTitle>Próximas aulas</SectionTitle>
          <Card className="mx-5 overflow-hidden">
            {appts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b border-sep px-4 py-3 last:border-b-0">
                <Icon name="calendar" size={19} className="text-accent-ink" />
                <span className="flex-1 text-[15px] font-semibold">
                  {new Date(a.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} às {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {a.note && <span className="max-w-[45%] truncate text-[13px] text-label-2">{a.note}</span>}
              </div>
            ))}
          </Card>
        </>
      )}

      {diet && <DietCard diet={diet} t={t} />}

      {chall.length > 0 && (
        <>
          <SectionTitle>Desafios</SectionTitle>
          <div className="mx-5 flex flex-col gap-3">
            {chall.map((c) => (
              <ChallengeCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {assess.length > 0 && (
        <>
          <SectionTitle>Sua avaliação física</SectionTitle>
          <div className="mx-5">
            <AssessmentView a={assess[0]} prev={assess[1]} />
          </div>
        </>
      )}

      {charges.some((c) => c.status === "paga") && (
        <>
          <SectionTitle>Pagamentos feitos</SectionTitle>
          <Card className="mx-5 overflow-hidden">
            {charges.filter((c) => c.status === "paga").slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-sep px-4 py-2.5 text-[14px] last:border-b-0">
                <span>{c.description ?? "Cobrança"} · {dateBR(c.due_on)}</span>
                <span className="font-semibold text-good">{brl(Number(c.amount))} ✓</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Privacidade</SectionTitle>
      <Card className="mx-5 overflow-hidden">
        <label className="flex items-center justify-between gap-3 border-b border-sep px-4 py-3">
          <span className="flex flex-col">
            <span className="text-[15px]">Aparecer no ranking dos alunos</span>
            <span className="text-[12px] text-label-2">Só nome e o número do desafio</span>
          </span>
          <input type="checkbox" checked={rk} onChange={(e) => update(e.target.checked, sc)} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex flex-col">
            <span className="text-[15px]">Permitir antes e depois na vitrine</span>
            <span className="text-[12px] text-label-2">O personal escolhe as fotos; desligando, elas saem na hora</span>
          </span>
          <input type="checkbox" checked={sc} onChange={(e) => update(rk, e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
      </Card>
      <div className="mx-5 mt-2">
        <Button variant="plain" className="w-full !text-bad" onClick={() => setLeaving(true)}>Sair do acompanhamento</Button>
      </div>
      <Sheet open={leaving} onClose={() => setLeaving(false)} title={`Sair do acompanhamento?`}>
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] leading-snug text-label-2">{t.name} deixa de ver seus dados. Seus treinos, avaliações e histórico continuam com você.</p>
          <Button variant="danger" size="lg" className="!bg-card" onClick={leave}>Sair</Button>
        </div>
      </Sheet>
    </section>
  );
}

function PayCard({ c, t, onDone }: { c: Charge; t: MyTrainer; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!c.receipt_path);
  const file = useRef<HTMLInputElement>(null);
  const code = t.pix_key ? pixCode(t.pix_key, t.pix_name ?? t.name, t.city, Number(c.amount)) : null;
  const tone = chargeTone(c);

  useEffect(() => {
    if (open && code && !qr) import("qrcode").then((Q) => Q.toDataURL(code, { margin: 1, width: 420 }).then(setQr));
  }, [open, code, qr]);

  async function copy() {
    if (!code) return;
    await navigator.clipboard?.writeText(code).catch(() => {});
    vibrate(10);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function receipt(f?: File) {
    if (!f) return;
    setSending(true);
    try {
      const path = await uploadTo("comprovantes", await myId(), f);
      await supabase().rpc("send_receipt", { p_charge: c.id, p_path: path });
      pushNow();
      vibrate([10, 40, 10]);
      setSent(true);
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Icon name="pix" size={22} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[20px] font-bold leading-tight">{brl(Number(c.amount))}</span>
          <span className="truncate text-[13px] text-label-2">{c.description ?? "Cobrança"} · vence {dateBR(c.due_on)}</span>
        </span>
        <Pill tone={sent ? "accent" : tone.tone}>{sent ? "enviado" : tone.label}</Pill>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pb-4">
              {code ? (
                <>
                  <div className="mx-auto rounded-2xl bg-white p-3">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <motion.img initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={qr} alt="QR Code do Pix" className="h-48 w-48" />
                    ) : (
                      <div className="h-48 w-48" />
                    )}
                  </div>
                  <Button size="lg" onClick={copy}>
                    <Icon name="copy" size={18} /> {copied ? "Código copiado!" : "Copiar Pix copia e cola"}
                  </Button>
                  <p className="text-center text-[12px] text-label-3">Pagamento direto pra {t.pix_name ?? t.name}. Depois de pagar, mande o comprovante.</p>
                </>
              ) : (
                <p className="text-[14px] text-label-2">Seu personal ainda não cadastrou a chave Pix. Combine o pagamento com ele.</p>
              )}
              <input ref={file} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => receipt(e.target.files?.[0])} data-testid={`comprovante-${c.id}`} />
              <Button variant="secondary" className="!bg-card-2" disabled={sending} onClick={() => file.current?.click()}>
                <Icon name="image" size={17} /> {sending ? "Enviando…" : sent ? "Trocar comprovante" : "Enviar comprovante"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function DietCard({ diet, t }: { diet: Diet; t: MyTrainer }) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState("Aluno");
  useEffect(() => {
    getProfile().then((p) => setMe(p?.name ?? "Aluno"));
  }, []);
  const tg = diet.targets;
  return (
    <>
      <SectionTitle>Alimentação</SectionTitle>
      <Card className="mx-5 overflow-hidden">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 p-4 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-good-soft text-good">
            <Icon name="apple" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[16px] font-semibold">{diet.title}</span>
            <span className="truncate text-[13px] text-label-2">
              {diet.meals.length} refeições{tg.kcal ? ` · ${tg.kcal} kcal` : ""}
              {tg.protein ? ` · ${tg.protein} g de proteína` : ""}
            </span>
          </span>
          <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-label-3">
            <Icon name="chevron" size={18} />
          </motion.span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="flex flex-col gap-3 px-4 pb-4">
                {diet.meals.map((m, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[15px] font-semibold">{m.name}</span>
                      <span className="text-[13px] text-label-2">{m.time}</span>
                    </div>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {m.items.map((it, j) => (
                        <li key={j} className="flex gap-2 text-[14px]">
                          <span className="text-accent">•</span>
                          {it}
                        </li>
                      ))}
                    </ul>
                    {m.notes && <p className="mt-0.5 text-[12px] text-label-2">{m.notes}</p>}
                  </div>
                ))}
                {diet.notes && <p className="rounded-xl bg-card-2 p-3 text-[13px] leading-snug">{diet.notes}</p>}
                <PdfButton label="Baixar em PDF" filename="minha-alimentacao.pdf" title={diet.title} render={() => <DietSheetPages diet={diet} who={{ student: me, trainer: t.name, cref: t.cref }} />} className="!bg-card-2" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </>
  );
}
