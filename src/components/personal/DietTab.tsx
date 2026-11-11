"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { useEffect, useState } from "react";
import { Button, Card, Icon, SectionTitle, Spinner } from "@/components/ui";
import { Confetti } from "@/components/motion";
import { PdfButton } from "./PdfButton";
import { DietSheetPages, type Diet, type DietMeal } from "./SheetPages";
import { type StudentDetail } from "@/lib/personal";
import { slug } from "@/lib/pdf";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { fmtDate, vibrate } from "@/lib/util";

const TEMPLATE: DietMeal[] = [
  { name: "Café da manhã", time: "07:00", items: [], notes: "" },
  { name: "Lanche da manhã", time: "10:00", items: [], notes: "" },
  { name: "Almoço", time: "12:30", items: [], notes: "" },
  { name: "Lanche da tarde", time: "16:00", items: [], notes: "" },
  { name: "Jantar", time: "19:30", items: [], notes: "" },
];

let k = 0;
type M = DietMeal & { k: number; text: string };
const toM = (m: DietMeal): M => ({ ...m, k: ++k, text: m.items.join("\n") });

export function DietTab({ d, trainer }: { d: StudentDetail; trainer: { name: string; cref: string | null } }) {
  const [loaded, setLoaded] = useState(false);
  const [last, setLast] = useState<Diet | null>(null);
  const [title, setTitle] = useState("Orientações alimentares");
  const [t, setT] = useState({ kcal: "", protein: "", carbs: "", fat: "", water: "" });
  const [meals, setMeals] = useState<M[]>(TEMPLATE.map(toM));
  const [notes, setNotes] = useState("");
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [party, setParty] = useState(false);

  useEffect(() => {
    supabase()
      .from("diet_plans")
      .select("*")
      .eq("student_id", d.profile.id)
      .eq("trainer_id", d.link.trainer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const p = d.profile;
        if (data) {
          const x = data as Diet;
          setLast(x);
          setTitle(x.title);
          setMeals(x.meals.map(toM));
          setNotes(x.notes ?? "");
          setT({ kcal: s(x.targets.kcal), protein: s(x.targets.protein), carbs: s(x.targets.carbs), fat: s(x.targets.fat), water: s(x.targets.water) });
        } else setT({ kcal: s(p.kcal_target), protein: s(p.protein_target), carbs: s(p.carbs_target), fat: s(p.fat_target), water: s(p.water_target_ml) });
        setLoaded(true);
      });
  }, [d]);

  const n = (v: string) => (v.trim() ? Math.round(Number(v.replace(",", "."))) || null : null);
  const diet = (): Diet => ({
    title: title.trim() || "Orientações alimentares",
    targets: { kcal: n(t.kcal), protein: n(t.protein), carbs: n(t.carbs), fat: n(t.fat), water: n(t.water) },
    meals: meals.map((m) => ({ name: m.name.trim() || "Refeição", time: m.time, items: m.text.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 25), notes: m.notes.trim() })).filter((m) => m.items.length || m.notes),
    notes: notes.trim() || null,
  });

  async function send() {
    const x = diet();
    if (!x.meals.length) return setMsg("Escreva pelo menos uma refeição.");
    setBusy(true);
    setMsg("");
    const { error } = await supabase().from("diet_plans").insert({ student_id: d.profile.id, title: x.title, targets: x.targets, meals: x.meals, notes: x.notes });
    if (!error && apply && (x.targets.kcal || x.targets.protein)) {
      await supabase().rpc("trainer_apply_targets", { p_student: d.profile.id, p_kcal: x.targets.kcal, p_protein: x.targets.protein, p_carbs: x.targets.carbs, p_fat: x.targets.fat, p_water: x.targets.water });
    }
    setBusy(false);
    if (error) return setMsg("Não consegui enviar.");
    pushNow();
    vibrate([10, 40, 10]);
    setParty(true);
    setTimeout(() => setParty(false), 2500);
    setLast({ ...x, created_at: new Date().toISOString() });
    setMsg("Enviado! O aluno recebeu um aviso e vê as refeições em “Meu personal”.");
  }

  const patch = (key: number, p: Partial<M>) => setMeals((ms) => ms.map((m) => (m.k === key ? { ...m, ...p } : m)));
  const box = "h-11 w-full rounded-xl bg-card px-2 text-center text-[16px] font-semibold outline-none ring-accent focus:ring-2";

  if (!loaded) return <Spinner />;

  return (
    <div className="pt-3">
      <Confetti active={party} count={50} />
      <p className="mx-5 rounded-2xl bg-card p-3.5 text-[13px] leading-snug text-label-2">
        {last?.created_at ? `Última versão enviada em ${fmtDate(last.created_at, { year: true })}. Edite e envie de novo quando quiser.` : "Monte as orientações de alimentação do aluno. Prescrição de dieta é atribuição do nutricionista: use pra orientar e, se precisar, trabalhe junto com um."}
      </p>
      <div className="mx-5 mt-3">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} aria-label="Título" className="h-11 w-full rounded-xl bg-card px-3.5 text-[16px] font-semibold outline-none ring-accent focus:ring-2" />
      </div>

      <SectionTitle>Metas por dia</SectionTitle>
      <div className="mx-5 grid grid-cols-5 gap-2">
        {(
          [
            ["kcal", "kcal"],
            ["protein", "Prot (g)"],
            ["carbs", "Carb (g)"],
            ["fat", "Gord (g)"],
            ["water", "Água (ml)"],
          ] as const
        ).map(([key, l]) => (
          <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold text-label-2">
            {l}
            <input inputMode="numeric" value={t[key]} onChange={(e) => setT({ ...t, [key]: e.target.value.replace(/[^\d]/g, "").slice(0, 5) })} className={box} />
          </label>
        ))}
      </div>
      <label className="mx-5 mt-2 flex items-center gap-2 text-[14px] text-label-2">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        Usar essas metas no diário de alimentação do aluno
      </label>

      <SectionTitle action={<button onClick={() => setMeals((m) => [...m, toM({ name: "Ceia", time: "22:00", items: [], notes: "" })])} className="text-[15px] font-semibold text-accent-ink">+ Refeição</button>}>Refeições</SectionTitle>
      <Reorder.Group axis="y" values={meals} onReorder={setMeals} className="mx-5 flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {meals.map((m) => (
            <Reorder.Item key={m.k} value={m} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} whileDrag={{ scale: 1.02 }}>
              <Card className="flex flex-col gap-2 p-3.5">
                <div className="flex items-center gap-2">
                  <input value={m.name} onChange={(e) => patch(m.k, { name: e.target.value.slice(0, 40) })} aria-label="Nome da refeição" className="h-10 min-w-0 flex-1 rounded-lg bg-card-2 px-3 text-[15px] font-semibold outline-none" />
                  <input type="time" value={m.time} onChange={(e) => patch(m.k, { time: e.target.value })} aria-label="Horário" className="h-10 w-[96px] rounded-lg bg-card-2 px-2 text-[15px] outline-none" />
                  <button onClick={() => setMeals((ms) => ms.filter((x) => x.k !== m.k))} aria-label={`Tirar ${m.name}`} className="press flex h-10 w-10 items-center justify-center rounded-lg text-bad">
                    <Icon name="trash" size={17} />
                  </button>
                </div>
                <textarea value={m.text} onChange={(e) => patch(m.k, { text: e.target.value })} rows={3} placeholder={"Um item por linha, ex.:\n2 ovos mexidos\n1 pão integral\n1 fruta"} className="w-full resize-none rounded-lg bg-card-2 px-3 py-2 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
                <input value={m.notes} onChange={(e) => patch(m.k, { notes: e.target.value.slice(0, 200) })} placeholder="Substituições ou observação (opcional)" className="h-10 rounded-lg bg-card-2 px-3 text-[14px] outline-none placeholder:text-label-3" />
              </Card>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      <SectionTitle>Observações gerais</SectionTitle>
      <div className="mx-5">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} rows={3} placeholder="Ex.: beber água ao longo do dia, evitar frituras…" className="w-full resize-none rounded-2xl bg-card px-4 py-3 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
      </div>

      {msg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-5 mt-4 rounded-xl bg-good-soft px-4 py-2.5 text-center text-[14px] font-medium text-good">{msg}</motion.p>}
      <div className="sticky bottom-[84px] z-20 mt-4 flex gap-2 bg-bg/95 px-5 pb-3 pt-2 backdrop-blur">
        <Button size="lg" className="flex-1 shadow-xl" disabled={busy} onClick={send}>
          <Icon name="send" size={18} /> {busy ? "Enviando…" : "Enviar pro aluno"}
        </Button>
        <PdfButton label="PDF" className="!h-[52px] shadow-xl" filename={`alimentacao-${slug(d.profile.name ?? "aluno")}.pdf`} title={`Orientação alimentar · ${d.profile.name ?? ""}`} render={() => <DietSheetPages diet={diet()} who={{ student: d.profile.name ?? "Aluno", trainer: trainer.name, cref: trainer.cref }} />} />
      </div>
    </div>
  );
}

function s(v: unknown) {
  return v == null ? "" : String(v);
}
