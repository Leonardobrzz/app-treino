"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { Card, Icon, SectionTitle, Spinner } from "@/components/ui";
import { PHeader, Pill, PersonalNav, QuickMessage, StudentLine, useTrainer } from "@/components/personal/common";
import { Checklist, NextStep } from "@/components/guide";
import { TEMPLATES, waLink, brl, daysSince, guestMap, trainerDashboard, type Appointment, type Charge, type DashRow, type Guest } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { todayISO } from "@/lib/util";

type Alert = { row: DashRow; reasons: { text: string; tone: "bad" | "accent" | "muted" }[]; suggest: "sumido" | "cobranca" | "renovacao" | "avaliacao" | "recorde" };

export default function TrainerHome() {
  const me = useTrainer();
  const [rows, setRows] = useState<DashRow[] | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [today, setToday] = useState<(Appointment & { name: string })[]>([]);
  const [error, setError] = useState("");
  const [guests, setGuests] = useState<Map<string, Guest>>(new Map());
  const [onb, setOnb] = useState<{ sent_plan: boolean; assessed: boolean; charged: boolean; anamnese: boolean } | null>(null);

  useEffect(() => {
    if (!me) return;
    const now = new Date();
    const m0 = todayISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const m1 = todayISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    guestMap().then(setGuests);
    supabase().rpc("trainer_onboarding").then(({ data }) => setOnb(Array.isArray(data) ? data[0] : data));
    Promise.all([
      trainerDashboard(),
      supabase().from("charges").select("*").eq("trainer_id", me.id).gte("due_on", m0).lte("due_on", m1).neq("status", "cancelada"),
      supabase().from("appointments").select("*").eq("trainer_id", me.id).gte("starts_at", d0).lt("starts_at", d1).neq("status", "cancelada").order("starts_at"),
    ])
      .then(([d, c, a]) => {
        setRows(d);
        setCharges((c.data ?? []) as Charge[]);
        const names = new Map(d.map((r) => [r.student_id, r.name]));
        setToday(((a.data ?? []) as Appointment[]).map((x) => ({ ...x, name: names.get(x.student_id) ?? "Aluno" })));
      })
      .catch(() => setError("Não consegui carregar o painel."));
  }, [me]);

  const stats = useMemo(() => {
    const open = charges.filter((c) => c.status === "aberta").reduce((a, c) => a + Number(c.amount), 0);
    const paid = charges.filter((c) => c.status === "paga").reduce((a, c) => a + Number(c.amount), 0);
    return { active: rows?.length ?? 0, trained: rows?.filter((r) => r.workouts_7d > 0).length ?? 0, open, paid };
  }, [rows, charges]);

  const { attention, good } = useMemo(() => {
    const attention: Alert[] = [];
    const good: Alert[] = [];
    for (const r of rows ?? []) {
      const reasons: Alert["reasons"] = [];
      let suggest: Alert["suggest"] = "sumido";
      const gone = daysSince(r.last_workout ?? r.since);
      if (guests.has(r.student_id)) reasons.push({ text: "sem app", tone: "muted" });
      else if (gone != null && gone >= 5) reasons.push({ text: r.last_workout ? `sem treinar há ${gone} dias` : "ainda não treinou", tone: gone >= 10 ? "bad" : "accent" });
      if (r.overdue_charges > 0) {
        reasons.push({ text: "mensalidade atrasada", tone: "bad" });
        if (!reasons.some((x) => x.text.includes("treinar"))) suggest = "cobranca";
      }
      const left = r.plan_ends_on ? Math.ceil((new Date(r.plan_ends_on + "T12:00:00").getTime() - Date.now()) / 864e5) : null;
      if (left != null && left <= 7) {
        reasons.push({ text: left < 0 ? "plano vencido" : `plano acaba em ${left} ${left === 1 ? "dia" : "dias"}`, tone: left < 0 ? "bad" : "accent" });
        if (suggest === "sumido" && !reasons[0]?.text.includes("treinar")) suggest = "renovacao";
      }
      if (!r.anamnese) reasons.push({ text: "sem anamnese", tone: "muted" });
      else if (r.anamnese === "pendente") reasons.push({ text: "anamnese pendente", tone: "muted" });
      const lastA = daysSince(r.last_assessment);
      if (lastA == null || lastA > 90) {
        reasons.push({ text: lastA == null ? "sem avaliação física" : "reavaliação atrasada", tone: "muted" });
        if (reasons.length === 1) suggest = "avaliacao";
      }
      if (r.volume_prev_14d > 0 && r.volume_14d < r.volume_prev_14d * 0.7 && (gone ?? 0) < 5) reasons.push({ text: "volume caiu", tone: "accent" });
      if (reasons.some((x) => x.tone !== "muted")) attention.push({ row: r, reasons, suggest });
      if (r.prs_14d > 0 || r.workouts_7d >= 3) good.push({ row: r, reasons: [], suggest: "recorde" });
    }
    const w = (a: Alert) => a.reasons.filter((x) => x.tone === "bad").length * 10 + a.reasons.length;
    attention.sort((a, b) => w(b) - w(a));
    good.sort((a, b) => b.row.prs_14d - a.row.prs_14d || b.row.workouts_7d - a.row.workouts_7d);
    return { attention, good };
  }, [rows, guests]);

  const next = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const owe = rows.find((r) => r.overdue_charges > 0);
    if (owe)
      return { icon: "pix" as const, eyebrow: "Próximo passo", title: `Cobrar ${owe.name.split(" ")[0]}`, text: "A mensalidade está atrasada. Mande um lembrete com o Pix.", action: { label: "Mandar no WhatsApp", href: waLink(owe.phone, TEMPLATES.cobranca(owe.name, owe.fee ? brl(Number(owe.fee)) : undefined)), external: true } };
    const aula = today.find((a) => a.status !== "feita" && new Date(a.starts_at).getTime() > now - 30 * 60e3);
    if (aula)
      return { icon: "calendar" as const, eyebrow: "Hoje", title: `Aula com ${aula.name.split(" ")[0]} às ${new Date(aula.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, text: aula.note ?? `${aula.minutes} min`, action: { label: "Abrir agenda", href: "/personal/agenda" } };
    const gone = rows
      .filter((r) => !guests.has(r.student_id))
      .map((r) => ({ r, d: daysSince(r.last_workout ?? r.since) ?? 0 }))
      .sort((a, b) => b.d - a.d)[0];
    if (gone && gone.d >= 7)
      return { icon: "chat" as const, eyebrow: "Próximo passo", title: `Chamar ${gone.r.name.split(" ")[0]} de volta`, text: gone.r.last_workout ? `Está há ${gone.d} dias sem treinar.` : "Ainda não fez nenhum treino no app.", action: { label: "Mandar no WhatsApp", href: waLink(gone.r.phone, TEMPLATES.sumido(gone.r.name)), external: true } };
    const ending = rows.find((r) => r.plan_ends_on && (new Date(r.plan_ends_on + "T12:00:00").getTime() - now) / 864e5 <= 7);
    if (ending)
      return { icon: "refresh" as const, eyebrow: "Próximo passo", title: `Renovar o plano de ${ending.name.split(" ")[0]}`, text: "O plano acaba nos próximos dias.", action: { label: "Mandar no WhatsApp", href: waLink(ending.phone, TEMPLATES.renovacao(ending.name)), external: true } };
    const noEval = rows.find((r) => !r.last_assessment);
    if (noEval) return { icon: "body" as const, eyebrow: "Próximo passo", title: `Avaliar ${noEval.name.split(" ")[0]}`, text: "Sem avaliação física ainda. Ela vira a base pra comparar a evolução.", action: { label: "Fazer avaliação", href: `/personal/aluno/${noEval.student_id}?aba=avaliacao` } };
    return null;
  }, [rows, today, guests]);

  const first = rows?.[0]?.student_id;
  const toStudent = (aba: string) => (first ? `/personal/aluno/${first}?aba=${aba}` : "/personal/alunos");

  return (
    <>
      <PHeader
        title="Painel"
        sub={me?.name ? `Olá, ${me.name.split(" ")[0]}` : undefined}
        right={
          <Link href="/avisos" aria-label="Avisos" className="press mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent-ink">
            <Icon name="bell" size={21} />
          </Link>
        }
      />
      <PersonalNav />
      {error && <p className="mx-5 mt-2 text-[15px] text-bad">{error}</p>}
      {!rows ? (
        <Spinner />
      ) : (
        <Stagger delay={0.05}>
          {next && (
            <StaggerItem>
              <NextStep {...next} />
            </StaggerItem>
          )}
          {me && onb && (
            <StaggerItem>
              <Checklist
                id="personal"
                title="Monte sua área"
                steps={[
                  { label: "Complete seu perfil", sub: "CREF e chave Pix aparecem pros alunos, nos PDFs e nas cobranças.", done: !!(me.cref && me.pix_key), href: "/personal/perfil" },
                  { label: "Coloque seu primeiro aluno", sub: "Mande seu link ou cadastre um aluno que ainda não tem o app.", done: rows.length > 0, href: "/personal/alunos" },
                  { label: "Faça uma avaliação física", sub: "Dobras, medidas e fotos de postura. Vira a base da evolução.", done: onb.assessed, href: toStudent("avaliacao") },
                  { label: "Envie um treino", sub: "Monte na mão, no automático ou com a IA, e mande pro aluno.", done: onb.sent_plan, href: toStudent("treino") },
                  { label: "Crie uma cobrança", sub: "Defina a mensalidade. O Pix cai direto na sua chave.", done: onb.charged, href: toStudent("financeiro") },
                ]}
              />
            </StaggerItem>
          )}

          {today.length > 0 && !(next?.eyebrow === "Hoje" && today.length === 1) && (
            <StaggerItem>
              <SectionTitle action={<Link href="/personal/agenda" className="text-[15px] text-accent-ink">Agenda</Link>}>Hoje</SectionTitle>
              <Card className="mx-5 overflow-hidden">
                {today.map((a) => (
                  <StudentLine key={a.id} id={a.student_id} name={a.name} href={`/personal/aluno/${a.student_id}`} sub={`${new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${a.minutes} min${a.note ? ` · ${a.note}` : ""}`} right={a.status === "feita" ? <Pill tone="good">feita</Pill> : <Icon name="chevron" size={17} className="text-label-3" />} />
                ))}
              </Card>
            </StaggerItem>
          )}

          {attention.length > 0 && (
            <StaggerItem>
              <SectionTitle>Precisam de atenção</SectionTitle>
              <Card className="mx-5 overflow-hidden">
                {attention.slice(0, 8).map((a) => (
                  <StudentLine
                    key={a.row.student_id}
                    id={a.row.student_id}
                    name={a.row.name}
                    href={`/personal/aluno/${a.row.student_id}`}
                    sub={
                      <span className="flex flex-wrap gap-1 pt-0.5">
                        {a.reasons.slice(0, 3).map((r) => (
                          <Pill key={r.text} tone={r.tone}>
                            {r.text}
                          </Pill>
                        ))}
                      </span>
                    }
                    right={<QuickMessage name={a.row.name} phone={a.row.phone} suggest={a.suggest} extra={a.row.fee ? brl(Number(a.row.fee)) : undefined} />}
                  />
                ))}
              </Card>
            </StaggerItem>
          )}

          <StaggerItem className="mx-5 mt-4 grid grid-cols-2 gap-3">
            {[
              ["Alunos ativos", stats.active, (v: number) => String(Math.round(v)), `${stats.trained} ${stats.trained === 1 ? "treinou" : "treinaram"} na semana`],
              ["Recebido no mês", stats.paid, (v: number) => brl(v), `${brl(stats.open)} a receber`],
            ].map(([l, v, f, foot]) => (
              <Card key={l as string} className="flex flex-col gap-1 px-4 py-3.5">
                <span className="text-[13px] font-semibold text-label-2">{l as string}</span>
                <CountUp value={v as number} format={f as (v: number) => string} className="text-[24px] font-bold tracking-[-0.4px]" />
                <span className="text-[12px] font-semibold text-label-2">{foot as string}</span>
              </Card>
            ))}
          </StaggerItem>

          {good.length > 0 && (
            <StaggerItem>
              <SectionTitle>Mandando bem</SectionTitle>
              <Card className="mx-5 overflow-hidden">
                {good.slice(0, 6).map((a) => (
                  <StudentLine
                    key={a.row.student_id}
                    id={a.row.student_id}
                    name={a.row.name}
                    href={`/personal/aluno/${a.row.student_id}`}
                    sub={
                      <span className="flex flex-wrap gap-1 pt-0.5">
                        {a.row.prs_14d > 0 && <Pill tone="good">🏆 {a.row.prs_14d} {a.row.prs_14d === 1 ? "recorde" : "recordes"}</Pill>}
                        <Pill tone="accent">{a.row.workouts_7d} treinos na semana</Pill>
                      </span>
                    }
                    right={<QuickMessage name={a.row.name} phone={a.row.phone} suggest="recorde" />}
                  />
                ))}
              </Card>
            </StaggerItem>
          )}

          {rows.length > 0 && attention.length === 0 && (
            <StaggerItem>
              <motion.p initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="mx-5 mt-4 rounded-2xl bg-good-soft p-4 text-[15px] font-medium text-good">
                Tudo em dia com seus alunos 🎉
              </motion.p>
            </StaggerItem>
          )}
        </Stagger>
      )}
    </>
  );
}
