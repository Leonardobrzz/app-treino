"use client";

import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Header, Icon, SectionTitle, Segmented, Spinner } from "@/components/ui";
import { PostureFrame } from "@/components/personal/AssessmentView";
import { useTrainer } from "@/components/personal/common";
import { CIRC_LABEL, CIRCS, POSTURE_FINDINGS, SKINFOLD_LABEL, ageFrom, bodyFat, fatClass, sitesFor, studentDetail, uploadTo, type Assessment, type Circ, type Skinfold, type StudentDetail } from "@/lib/personal";
import { shrinkImage } from "@/lib/image";
import { pushNow } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { num, todayISO, vibrate } from "@/lib/util";

type Pose = "frente" | "lado" | "costas";
const POSES: Pose[] = ["frente", "lado", "costas"];
const parse = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

export default function NewAssessment() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useTrainer();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [date, setDate] = useState(todayISO());
  const [sex, setSex] = useState<Assessment["sex"]>(null);
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [protocol, setProtocol] = useState<Assessment["protocol"]>("pollock3");
  const [folds, setFolds] = useState<Partial<Record<Skinfold, string>>>({});
  const [circ, setCirc] = useState<Partial<Record<Circ, string>>>({});
  const [photos, setPhotos] = useState<Partial<Record<Pose, { blob: Blob; url: string }>>>({});
  const [findings, setFindings] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<Partial<Record<Pose, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!me) return;
    studentDetail(id).then((x) => {
      setD(x);
      const p = x.profile;
      if (p.sex === "masculino" || p.sex === "feminino") setSex(p.sex);
      const a = ageFrom(p.birth_date);
      if (a) setAge(String(a));
      const w = x.weights.at(-1);
      if (w) setWeight(String(w.weight).replace(".", ","));
      if (p.height_cm) setHeight(String(p.height_cm));
    });
  }, [me, id]);

  const sites = sitesFor(protocol, sex);
  const nums = useMemo(() => Object.fromEntries(Object.entries(folds).map(([k, v]) => [k, parse(v ?? "")])) as Partial<Record<Skinfold, number>>, [folds]);
  const bf = bodyFat({ protocol, sex, age: Number(age) || null, skinfolds: nums });
  const w = parse(weight);
  const fatMass = bf && w ? Math.round(w * bf.pct) / 100 : null;
  const lean = fatMass != null && w ? Math.round((w - fatMass) * 10) / 10 : null;
  const cls = bf ? fatClass(bf.pct, sex) : null;

  async function pick(p: Pose, f?: File) {
    if (!f) return;
    const { blob, preview } = await shrinkImage(f, 1400, 0.85);
    setPhotos((x) => ({ ...x, [p]: { blob, url: preview } }));
  }

  async function save() {
    if (!d) return;
    setBusy(true);
    setError("");
    try {
      const paths: Partial<Record<Pose, string>> = {};
      for (const p of POSES) if (photos[p]) paths[p] = await uploadTo("avaliacoes", d.profile.id, photos[p]!.blob);
      const c = Object.fromEntries(Object.entries(circ).map(([k, v]) => [k, parse(v ?? "")]).filter(([, v]) => v != null && Number.isFinite(v)));
      const sf = Object.fromEntries(sites.map((k) => [k, nums[k]]).filter(([, v]) => v != null && Number.isFinite(v)));
      const { error: e } = await supabase()
        .from("assessments")
        .insert({
          student_id: d.profile.id,
          assessed_on: date,
          sex,
          age: Number(age) || null,
          weight: w ?? null,
          height: parse(height) ?? null,
          protocol: sites.length ? protocol : "nenhum",
          skinfolds: sf,
          circumferences: c,
          body_fat: bf?.pct ?? null,
          fat_mass: fatMass,
          lean_mass: lean,
          posture: { photos: paths, findings },
          notes: notes.trim() || null,
        });
      if (e) throw e;
      pushNow();
      vibrate([10, 40, 10]);
      router.replace(`/personal/aluno/${d.profile.id}?aba=avaliacao`);
    } catch {
      setBusy(false);
      setError("Não consegui salvar. Confira a internet e tente de novo.");
    }
  }

  const box = "h-11 w-full rounded-xl bg-card px-3 text-[16px] font-semibold outline-none ring-accent focus:ring-2";

  if (!d) return <Spinner />;

  return (
    <>
      <Header title="Nova avaliação" eyebrow={d.profile.name?.toUpperCase() ?? ""} back={{ href: `/personal/aluno/${id}?aba=avaliacao`, label: "Aluno" }} />

      <SectionTitle>Dados</SectionTitle>
      <div className="mx-5 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
          Data
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
          Idade
          <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
          Peso (kg)
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
          Altura (cm)
          <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className={box} />
        </label>
      </div>
      <div className="mx-5 mt-3">
        <Segmented<"masculino" | "feminino"> value={(sex ?? "masculino") as "masculino" | "feminino"} onChange={setSex} options={[{ value: "masculino", label: "Masculino" }, { value: "feminino", label: "Feminino" }]} />
      </div>

      <SectionTitle>Dobras cutâneas</SectionTitle>
      <div className="mx-5">
        <Segmented<Assessment["protocol"]> value={protocol} onChange={setProtocol} options={[{ value: "nenhum", label: "Sem dobras" }, { value: "pollock3", label: "Pollock 3" }, { value: "pollock7", label: "Pollock 7" }]} />
      </div>
      <AnimatePresence initial={false}>
        {sites.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
              {sites.map((k) => (
                <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
                  {SKINFOLD_LABEL[k]} (mm)
                  <input inputMode="decimal" value={folds[k] ?? ""} onChange={(e) => setFolds((f) => ({ ...f, [k]: e.target.value }))} className={box} />
                </label>
              ))}
            </div>
            <motion.div layout className="mx-5 mt-3">
              <Card className={`flex items-center gap-3 p-4 ${bf ? "" : "opacity-60"}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                  <Icon name="body" size={22} />
                </span>
                {bf ? (
                  <div className="flex flex-1 flex-col">
                    <span className="text-[13px] text-label-2">Soma {num(bf.sum)} mm · gordura</span>
                    <motion.span key={bf.pct} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-[24px] font-bold leading-tight">
                      {num(bf.pct)}% <span className={`text-[14px] ${cls?.tone === "good" ? "text-good" : cls?.tone === "bad" ? "text-bad" : "text-accent-ink"}`}>{cls?.label}</span>
                    </motion.span>
                    {fatMass != null && <span className="text-[13px] text-label-2">Massa gorda {num(fatMass)} kg · massa magra {num(lean!)} kg</span>}
                  </div>
                ) : (
                  <span className="text-[14px] text-label-2">Preencha sexo, idade e todas as dobras pra calcular o % de gordura.</span>
                )}
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionTitle>Perimetria (cm)</SectionTitle>
      <div className="mx-5 grid grid-cols-3 gap-2.5">
        {CIRCS.map((k) => (
          <label key={k} className="flex flex-col gap-1 text-[12px] font-semibold text-label-2">
            <span className="truncate">{CIRC_LABEL[k]}</span>
            <input inputMode="decimal" value={circ[k] ?? ""} onChange={(e) => setCirc((c) => ({ ...c, [k]: e.target.value }))} className={box} />
          </label>
        ))}
      </div>

      <SectionTitle>Postura</SectionTitle>
      <p className="mx-5 -mt-1 mb-2 text-[13px] leading-snug text-label-2">Fotos de corpo inteiro, de frente, de lado e de costas. A grade e a linha de prumo ajudam a ver os desvios.</p>
      <div className="mx-5 grid grid-cols-3 gap-2">
        {POSES.map((p) => (
          <div key={p} className="flex flex-col gap-1">
            <input ref={(el) => { inputs.current[p] = el; }} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(p, e.target.files?.[0])} data-testid={`postura-${p}`} />
            {photos[p] ? (
              <button onClick={() => inputs.current[p]?.click()} aria-label={`Trocar foto de ${p}`}>
                <PostureFrame url={photos[p]!.url} label={p} />
              </button>
            ) : (
              <button onClick={() => inputs.current[p]?.click()} className="press flex flex-col items-center justify-center gap-1 rounded-xl bg-card text-label-2" style={{ aspectRatio: "3 / 4" }}>
                <Icon name="camera" size={24} />
                <span className="text-[13px] font-semibold capitalize">{p}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mx-5 mt-3 flex flex-wrap gap-2">
        {POSTURE_FINDINGS.map((f) => {
          const on = findings.includes(f);
          return (
            <motion.button whileTap={{ scale: 0.92 }} key={f} onClick={() => setFindings((x) => (on ? x.filter((y) => y !== f) : [...x, f]))} aria-pressed={on} className={`h-9 rounded-full px-3 text-[14px] font-medium ${on ? "bg-accent text-on-accent" : "bg-card"}`}>
              {f}
            </motion.button>
          );
        })}
      </div>

      <SectionTitle>Observações</SectionTitle>
      <div className="mx-5">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} rows={3} placeholder="Pontos de atenção, metas pra próxima avaliação…" className="w-full resize-none rounded-2xl bg-card px-4 py-3 text-[15px] outline-none ring-accent placeholder:text-label-3 focus:ring-2" />
      </div>

      {error && <p role="alert" className="mx-5 mt-3 text-[14px] text-bad">{error}</p>}
      <div className="mx-5 mt-5">
        <Button size="lg" className="w-full" disabled={busy} onClick={save}>
          {busy ? "Salvando…" : "Salvar e mandar pro aluno"}
        </Button>
      </div>
    </>
  );
}
