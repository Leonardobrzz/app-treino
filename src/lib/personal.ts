// Área do personal: tipos, chamadas ao banco e cálculos (avaliação física, Pix, mensagens prontas)
import { supabase } from "./supabase/client";
import { getUserId } from "./data";
import { shrinkImage } from "./image";
import { pushNow } from "./push";
import type { BodyMeasurement, BodyWeight, Profile, ProgressPhoto } from "./types";

export type DashRow = {
  student_id: string;
  name: string;
  since: string;
  fee: number | null;
  due_day: number | null;
  plan_ends_on: string | null;
  phone: string | null;
  last_workout: string | null;
  workouts_7d: number;
  workouts_30d: number;
  volume_14d: number;
  volume_prev_14d: number;
  prs_14d: number;
  open_charges: number;
  overdue_charges: number;
  anamnese: "respondida" | "pendente" | null;
  last_assessment: string | null;
};

export type Link = { id: string; trainer_id: string; student_id: string; fee: number | null; due_day: number | null; plan_ends_on: string | null; phone: string | null; notes: string | null; ranking_opt_in: boolean; showcase_consent: boolean; created_at: string };

export type PlanEx = { exercise_id: string; name: string; muscle_group: string; equipment?: string; sets: number; reps: string; target_weight: number | null; rest_seconds: number; notes: string | null; method: string | null };
export type PlanDayT = { weekday: number; title: string; exercises: PlanEx[] };
export type StudentPlan = { id?: string; name: string; trainer_id?: string | null; created_at?: string; days: PlanDayT[] };

export type StudentDetail = {
  profile: Profile;
  link: Link;
  sessions: { id: string; title: string; started_at: string; finished_at: string; sets: number; volume: number }[];
  weights: BodyWeight[];
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  plan: StudentPlan | null;
};

export type Anamnese = { id: string; trainer_id: string; student_id: string; extra_questions: string[]; answers: Record<string, string> | null; requested_at: string; answered_at: string | null };

export type Assessment = {
  id: string;
  trainer_id: string;
  student_id: string;
  assessed_on: string;
  sex: "masculino" | "feminino" | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  protocol: "nenhum" | "pollock3" | "pollock7";
  skinfolds: Partial<Record<Skinfold, number>>;
  circumferences: Partial<Record<Circ, number>>;
  body_fat: number | null;
  fat_mass: number | null;
  lean_mass: number | null;
  posture: { photos?: Partial<Record<"frente" | "lado" | "costas", string>>; findings?: string[] };
  notes: string | null;
  created_at: string;
};

export type Charge = { id: string; trainer_id: string; student_id: string; amount: number; due_on: string; description: string | null; status: "aberta" | "paga" | "cancelada"; paid_at: string | null; receipt_path: string | null; receipt_sent_at: string | null; created_at: string };
export type Appointment = { id: string; trainer_id: string; student_id: string; starts_at: string; minutes: number; status: "marcada" | "feita" | "cancelada"; note: string | null };
export type Challenge = { id: string; trainer_id: string; title: string; metric: "treinos" | "volume" | "series"; starts_on: string; ends_on: string; prize: string | null; created_at: string };
export type RankRow = { student_id: string; name: string; is_me: boolean; workouts: number; sets: number; volume: number };
export type MyTrainer = { trainer_id: string; name: string; cref: string | null; bio: string | null; city: string | null; whatsapp: string | null; pix_key: string | null; pix_name: string | null; since: string; ranking_opt_in: boolean; showcase_consent: boolean; plan_ends_on: string | null };

// ---------- chamadas ----------
export async function trainerDashboard(): Promise<DashRow[]> {
  const { data, error } = await supabase().rpc("trainer_dashboard");
  if (error) throw error;
  return (data ?? []) as DashRow[];
}

export async function studentDetail(id: string): Promise<StudentDetail> {
  const { data, error } = await supabase().rpc("trainer_student", { p_student: id });
  if (error) throw error;
  return data as StudentDetail;
}

export async function sendPlan(student: string, plan: StudentPlan) {
  const { error } = await supabase().rpc("trainer_send_plan", { p_student: student, p_plan: plan });
  if (error) throw error;
  pushNow();
}

export async function myTrainers(): Promise<MyTrainer[]> {
  const { data } = await supabase().rpc("my_trainers");
  return (data ?? []) as MyTrainer[];
}

/** Envia foto pra um bucket na pasta do dono (aluno ou personal) e devolve o caminho */
export async function uploadTo(bucket: "avaliacoes" | "comprovantes" | "vitrine" | "progresso", folder: string, file: Blob, max = 1400) {
  const isImg = file.type.startsWith("image/");
  const blob = isImg ? (await shrinkImage(file, max, 0.85)).blob : file;
  const ext = isImg ? "jpg" : "pdf";
  const path = `${folder}/${crypto.randomUUID?.() ?? Date.now().toString(36)}.${ext}`;
  const { error } = await supabase().storage.from(bucket).upload(path, blob, { contentType: isImg ? "image/jpeg" : file.type });
  if (error) throw error;
  return path;
}

export async function signed(bucket: string, paths: string[], secs = 3600) {
  const list = paths.filter(Boolean);
  if (!list.length) return new Map<string, string>();
  const { data } = await supabase().storage.from(bucket).createSignedUrls(list, secs);
  return new Map<string, string>((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}

export async function myId() {
  return (await getUserId())!;
}

// ---------- avaliação física ----------
export const SKINFOLDS = ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"] as const;
export type Skinfold = (typeof SKINFOLDS)[number];
export const SKINFOLD_LABEL: Record<Skinfold, string> = {
  peitoral: "Peitoral",
  axilar: "Axilar média",
  triceps: "Tríceps",
  subescapular: "Subescapular",
  abdominal: "Abdominal",
  suprailiaca: "Supra-ilíaca",
  coxa: "Coxa",
};
export const CIRCS = ["pescoco", "ombro", "peito", "braco_d", "braco_e", "antebraco", "cintura", "abdomen", "quadril", "coxa_d", "coxa_e", "panturrilha"] as const;
export type Circ = (typeof CIRCS)[number];
export const CIRC_LABEL: Record<Circ, string> = {
  pescoco: "Pescoço",
  ombro: "Ombros",
  peito: "Peitoral",
  braco_d: "Braço direito",
  braco_e: "Braço esquerdo",
  antebraco: "Antebraço",
  cintura: "Cintura",
  abdomen: "Abdômen",
  quadril: "Quadril",
  coxa_d: "Coxa direita",
  coxa_e: "Coxa esquerda",
  panturrilha: "Panturrilha",
};

/** Dobras usadas em cada protocolo */
export function sitesFor(protocol: Assessment["protocol"], sex: Assessment["sex"]): Skinfold[] {
  if (protocol === "pollock7") return [...SKINFOLDS];
  if (protocol === "pollock3") return sex === "feminino" ? ["triceps", "suprailiaca", "coxa"] : ["peitoral", "abdominal", "coxa"];
  return [];
}

/** Pollock (3 ou 7 dobras) + Siri. Devolve null se faltar dado. */
export function bodyFat(a: Pick<Assessment, "protocol" | "sex" | "age" | "skinfolds">) {
  const sites = sitesFor(a.protocol, a.sex);
  if (!sites.length || !a.sex || !a.age) return null;
  const vals = sites.map((k) => a.skinfolds[k]);
  if (vals.some((v) => v == null || !(v > 0))) return null;
  const S: number = (vals as number[]).reduce((x, v) => x + v, 0);
  const age = a.age;
  const female = a.sex === "feminino";
  let D: number;
  if (a.protocol === "pollock3") D = female ? 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * age : 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * age;
  else D = female ? 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * age : 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * age;
  const pct = 495 / D - 450;
  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return { sum: S, pct: Math.round(pct * 10) / 10 };
}

export function fatClass(pct: number, sex: Assessment["sex"]) {
  const f = sex === "feminino";
  const [atleta, bom, medio] = f ? [17, 24, 31] : [10, 17, 24];
  if (pct < atleta) return { label: "Muito baixo / atleta", tone: "good" as const };
  if (pct < bom) return { label: "Bom", tone: "good" as const };
  if (pct < medio) return { label: "Na média", tone: "accent" as const };
  return { label: "Acima do ideal", tone: "bad" as const };
}

export const POSTURE_FINDINGS = [
  "Cabeça anteriorizada",
  "Ombros protusos",
  "Ombro direito mais alto",
  "Ombro esquerdo mais alto",
  "Hipercifose torácica",
  "Hiperlordose lombar",
  "Retificação lombar",
  "Escoliose aparente",
  "Anteversão pélvica",
  "Retroversão pélvica",
  "Quadril desnivelado",
  "Joelho valgo",
  "Joelho varo",
  "Joelho hiperestendido",
  "Pé plano",
  "Pé cavo",
];

// ---------- anamnese ----------
export type Question = { key: string; label: string; type: "choice" | "yesno" | "text" | "number"; options?: string[]; parq?: boolean };
export const ANAMNESE: { title: string; questions: Question[] }[] = [
  {
    title: "Objetivo e rotina",
    questions: [
      { key: "objetivo", label: "Qual é o seu principal objetivo?", type: "choice", options: ["Perder gordura", "Ganhar massa", "Condicionamento", "Saúde e qualidade de vida", "Performance em esporte", "Reabilitação"] },
      { key: "experiencia", label: "Há quanto tempo você treina?", type: "choice", options: ["Nunca treinei", "Menos de 6 meses", "6 meses a 2 anos", "Mais de 2 anos"] },
      { key: "dias", label: "Quantos dias por semana pode treinar?", type: "choice", options: ["2", "3", "4", "5", "6"] },
      { key: "tempo", label: "Quanto tempo tem por treino?", type: "choice", options: ["30 min", "45 min", "1 hora", "Mais de 1 hora"] },
      { key: "local", label: "Onde vai treinar?", type: "choice", options: ["Academia", "Em casa", "Ao ar livre", "Condomínio"] },
    ],
  },
  {
    title: "Prontidão para atividade física (PAR-Q)",
    questions: [
      { key: "parq1", label: "Algum médico já disse que você tem problema no coração e que só deve fazer atividade física com orientação médica?", type: "yesno", parq: true },
      { key: "parq2", label: "Você sente dor no peito quando faz atividade física?", type: "yesno", parq: true },
      { key: "parq3", label: "No último mês, sentiu dor no peito sem estar fazendo atividade física?", type: "yesno", parq: true },
      { key: "parq4", label: "Você perde o equilíbrio por tontura ou já perdeu a consciência?", type: "yesno", parq: true },
      { key: "parq5", label: "Tem algum problema nos ossos ou articulações que pode piorar com exercício?", type: "yesno", parq: true },
      { key: "parq6", label: "Toma remédio para pressão ou para o coração?", type: "yesno", parq: true },
      { key: "parq7", label: "Existe algum outro motivo pelo qual você não deveria fazer atividade física?", type: "yesno", parq: true },
    ],
  },
  {
    title: "Saúde",
    questions: [
      { key: "lesoes", label: "Tem ou teve lesões ou dores? Onde?", type: "text" },
      { key: "doencas", label: "Tem alguma condição de saúde (pressão alta, diabetes, asma…)?", type: "text" },
      { key: "medicamentos", label: "Usa algum medicamento?", type: "text" },
      { key: "cirurgias", label: "Já fez cirurgias? Quais e quando?", type: "text" },
      { key: "fuma", label: "Você fuma?", type: "yesno" },
    ],
  },
  {
    title: "Hábitos",
    questions: [
      { key: "sono", label: "Como está seu sono?", type: "choice", options: ["Durmo bem (7h ou mais)", "Mais ou menos", "Durmo mal"] },
      { key: "alimentacao", label: "Como está sua alimentação?", type: "choice", options: ["Bem organizada", "Mais ou menos", "Desorganizada"] },
      { key: "agua", label: "Bebe água ao longo do dia?", type: "choice", options: ["Bastante", "Pouco", "Quase nada"] },
      { key: "observacoes", label: "Algo mais que seu personal deveria saber?", type: "text" },
    ],
  },
];
export const PARQ_KEYS = ANAMNESE.flatMap((s) => s.questions.filter((q) => q.parq).map((q) => q.key));

// ---------- métodos de treino ----------
export const METHODS: { value: string; label: string; hint: string }[] = [
  { value: "biset", label: "Bi-set", hint: "Junto com o próximo, sem descanso" },
  { value: "triset", label: "Tri-set", hint: "Três exercícios seguidos" },
  { value: "drop", label: "Drop-set", hint: "Na última série, tira peso e continua" },
  { value: "piramide", label: "Pirâmide", hint: "Sobe a carga e desce as repetições" },
  { value: "restpause", label: "Rest-pause", hint: "Pausa de 10–15 s e continua" },
  { value: "cluster", label: "Cluster", hint: "Mini-séries com pausas curtas" },
  { value: "isometria", label: "Isometria", hint: "Segura a posição" },
  { value: "cadencia", label: "Cadência", hint: "Descida lenta e controlada" },
];
export const methodLabel = (m?: string | null) => METHODS.find((x) => x.value === m)?.label ?? null;

// ---------- mensagens prontas (WhatsApp) ----------
export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const full = digits && digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
export const first = (name: string) => name.trim().split(/\s+/)[0] || name;
export const TEMPLATES = {
  sumido: (n: string) => `Oi ${first(n)}! Senti sua falta nos treinos essa semana 💪 Tá tudo bem? Bora voltar com tudo, me conta como posso ajudar.`,
  recorde: (n: string) => `${first(n)}, vi que você bateu recorde! 🏆 Parabéns, a evolução tá aparecendo. Continua assim!`,
  cobranca: (n: string, v?: string) => `Oi ${first(n)}, tudo bem? Passando pra lembrar da mensalidade${v ? ` de ${v}` : ""}. O Pix tá no app do Carga, em "Meu personal". Qualquer coisa me chama!`,
  renovacao: (n: string) => `Oi ${first(n)}! Seu plano comigo tá acabando. Bora renovar e continuar a evolução? Me fala o que achou até aqui 😊`,
  avaliacao: (n: string) => `${first(n)}, bora marcar sua reavaliação? Assim a gente vê tudo que mudou desde a última 📏`,
};

// ---------- Pix copia e cola (BR Code) ----------
function tlv(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const plain = (s: string, max: number) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, max).toUpperCase() || "CARGA";

/** Código "Pix copia e cola" com valor. A chave é a do personal: o dinheiro cai direto na conta dele. */
export function pixCode(key: string, name: string, city: string | null, amount: number, txid = "***") {
  const k = key.trim();
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", k);
  const payload =
    tlv("00", "01") +
    tlv("26", mai) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount > 0 ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", plain(name, 25)) +
    tlv("60", plain(city || "BRASIL", 15)) +
    tlv("62", tlv("05", txid.replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***")) +
    "6304";
  return payload + crc16(payload);
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateBR = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
export function ageFrom(birth: string | null | undefined) {
  if (!birth) return null;
  const b = new Date(birth + "T12:00:00");
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

// ---------- aluno sem app ----------
export type Guest = { id: string; claim_code: string; claimed_by: string | null };

/** Alunos sem app (ainda não vinculados a uma conta) deste personal */
export async function guestMap(): Promise<Map<string, Guest>> {
  const { data } = await supabase().from("guest_students").select("id,claim_code,claimed_by").is("claimed_by", null);
  return new Map(((data ?? []) as Guest[]).map((g) => [g.id, g]));
}

export function claimLink(trainerCode: string, claim: string) {
  const origin = typeof window !== "undefined" ? location.origin : "https://carga.app.br";
  return `${origin}/convite-personal/${trainerCode}?vinculo=${claim}`;
}

export const inviteText = (name: string, link: string) =>
  `Oi ${first(name)}! Cadastrei sua avaliação e seu treino no Carga. Cria sua conta grátis por esse link que tudo aparece pra você, e você já recebe os treinos no celular: ${link}`;

/** Texto do Pix pra mandar no WhatsApp (copia e cola com valor) */
export function pixMessage(name: string, amount: number, due: string, code: string) {
  return `Oi ${first(name)}! Segue o Pix da mensalidade de ${brl(amount)} (vence ${dateBR(due)}).\n\nPix copia e cola:\n${code}`;
}
