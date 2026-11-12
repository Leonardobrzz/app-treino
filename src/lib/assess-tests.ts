/** Protocolos da avaliação cardiorrespiratória e da avaliação funcional do movimento */

export type Sex = "masculino" | "feminino" | null;
export type Ctx = { sex: Sex; age: number | null; weight: number | null; height: number | null };

// ---------------------------------------------------------------- cardio
export type Stage = { min: string; speed: string; grade: string; hr: string; rpe: string };
export type CardioData = {
  protocol: CardioId;
  /** campos simples do protocolo (distância, tempo, FC...) */
  inputs: Record<string, string>;
  /** planilha por estágio (esteira escalonada e Bruce) */
  stages?: Stage[];
  vo2?: number | null;
  /** só no teste de 6 minutos: % da distância prevista */
  pctPredicted?: number | null;
  classLabel?: string | null;
  hrMax?: number | null;
  notes?: string;
};
export type CardioId = "escalonado" | "bruce" | "cooper" | "rockport" | "queens" | "tc6";

type Field = { key: string; label: string; unit?: string };
export type CardioProtocol = { id: CardioId; name: string; where: string; how: string[]; fields: Field[]; stages?: boolean; defaultStages?: Stage[] };

const n = (s?: string) => (s == null || s.trim() === "" ? NaN : Number(s.replace(",", ".")));
const r1 = (v: number) => Math.round(v * 10) / 10;

export const BRUCE_STAGES: Stage[] = [
  ["3", "2,7", "10"],
  ["6", "4,0", "12"],
  ["9", "5,5", "14"],
  ["12", "6,8", "16"],
  ["15", "8,0", "18"],
  ["18", "8,8", "20"],
  ["21", "9,6", "22"],
].map(([min, speed, grade]) => ({ min, speed, grade, hr: "", rpe: "" }));

export const CARDIO_PROTOCOLS: CardioProtocol[] = [
  {
    id: "escalonado",
    name: "Esteira escalonada",
    where: "Esteira",
    stages: true,
    how: [
      "Aquecimento de 3 min caminhando leve.",
      "A cada estágio (normalmente 2 ou 3 min) aumente a velocidade (ou a inclinação).",
      "No fim de cada estágio anote a frequência cardíaca e a percepção de esforço (escala de Borg, de 6 a 20).",
      "Pare quando o aluno não conseguir manter a velocidade, chegar perto da FC máxima ou pedir pra parar.",
      "O VO2 é estimado pelo último estágio completo (equações do ACSM).",
    ],
    fields: [],
    defaultStages: [
      { min: "3", speed: "6", grade: "1", hr: "", rpe: "" },
      { min: "6", speed: "7,5", grade: "1", hr: "", rpe: "" },
      { min: "9", speed: "9", grade: "1", hr: "", rpe: "" },
      { min: "12", speed: "10,5", grade: "1", hr: "", rpe: "" },
    ],
  },
  {
    id: "bruce",
    name: "Protocolo de Bruce",
    where: "Esteira",
    stages: true,
    how: [
      "Estágios de 3 minutos: velocidade e inclinação sobem a cada estágio (veja a tabela).",
      "Anote FC e esforço no fim de cada estágio.",
      "Registre o tempo total que o aluno aguentou, em minutos (ex.: 10,5).",
      "VO2 pela equação de Foster (homens) e de Pollock (mulheres).",
    ],
    fields: [{ key: "time", label: "Tempo total", unit: "min" }],
    defaultStages: BRUCE_STAGES,
  },
  {
    id: "cooper",
    name: "Teste de Cooper (12 min)",
    where: "Pista ou esteira",
    how: ["Aluno corre (ou alterna corrida e caminhada) o máximo que conseguir em 12 minutos.", "Anote a distância percorrida em metros.", "VO2 = (distância − 504,9) ÷ 44,73."],
    fields: [{ key: "distance", label: "Distância", unit: "m" }],
  },
  {
    id: "rockport",
    name: "Caminhada de 1 milha (Rockport)",
    where: "Pista",
    how: ["Aluno caminha 1.609 m o mais rápido possível, sem correr.", "Anote o tempo (em minutos) e a FC logo ao terminar.", "Bom pra iniciantes, idosos e quem não pode correr."],
    fields: [
      { key: "time", label: "Tempo", unit: "min" },
      { key: "hr", label: "FC ao terminar", unit: "bpm" },
    ],
  },
  {
    id: "queens",
    name: "Banco (Queens College)",
    where: "Degrau de 41 cm",
    how: [
      "Subir e descer o degrau por 3 minutos, no ritmo do metrônomo: 24 subidas/min (homens) ou 22 (mulheres).",
      "Ao terminar, espere 5 s e conte a FC por 15 s. Multiplique por 4.",
      "Bom quando não há esteira nem pista.",
    ],
    fields: [{ key: "hr", label: "FC de recuperação", unit: "bpm" }],
  },
  {
    id: "tc6",
    name: "Caminhada de 6 minutos",
    where: "Corredor de 30 m",
    how: ["Aluno caminha o mais rápido que conseguir, ida e volta num corredor, por 6 minutos.", "Anote a distância total.", "Compara com a distância prevista pra idade, altura e peso (Enright). Ideal pra idosos e sedentários."],
    fields: [{ key: "distance", label: "Distância", unit: "m" }],
  },
];

/** FC máxima prevista (Tanaka) */
export const hrMaxFor = (age: number | null) => (age ? Math.round(208 - 0.7 * age) : null);

/** VO2 (ml/kg/min) de um estágio de esteira pelas equações do ACSM */
export function acsmTreadmill(speedKmh: number, gradePct: number) {
  const S = (speedKmh * 1000) / 60;
  const G = gradePct / 100;
  return speedKmh >= 7 ? 0.2 * S + 0.9 * S * G + 3.5 : 0.1 * S + 1.8 * S * G + 3.5;
}

/** Tabela da AHA de VO2máx por idade e sexo: limites de fraco, regular, bom e excelente */
const AHA: Record<"masculino" | "feminino", [number, number[]][]> = {
  masculino: [
    [29, [25, 34, 43, 53]],
    [39, [23, 31, 39, 49]],
    [49, [20, 27, 36, 45]],
    [59, [18, 25, 34, 43]],
    [200, [16, 23, 31, 41]],
  ],
  feminino: [
    [29, [24, 31, 38, 49]],
    [39, [20, 28, 34, 45]],
    [49, [17, 24, 31, 42]],
    [59, [15, 21, 28, 38]],
    [200, [13, 18, 24, 35]],
  ],
};
const VO2_LABELS = ["Muito fraco", "Fraco", "Regular", "Bom", "Excelente"];
export function vo2Class(vo2: number, sex: Sex, age: number | null) {
  if (!sex || !age) return null;
  const row = AHA[sex].find(([max]) => age <= max)![1];
  const i = row.filter((lim) => vo2 >= lim).length;
  return { label: VO2_LABELS[i], tone: i >= 3 ? "good" : i === 2 ? "accent" : "bad", index: i } as const;
}

export function computeCardio(d: CardioData, c: Ctx): CardioData {
  const i = d.inputs;
  let vo2: number | null = null;
  let pct: number | null = null;
  const male = c.sex === "masculino";
  if (d.protocol === "escalonado") {
    const done = (d.stages ?? []).filter((s) => Number.isFinite(n(s.speed)) && (s.hr.trim() || s.rpe.trim()));
    const last = done.at(-1);
    if (last) vo2 = acsmTreadmill(n(last.speed), Number.isFinite(n(last.grade)) ? n(last.grade) : 0);
  } else if (d.protocol === "bruce") {
    const T = n(i.time);
    if (Number.isFinite(T) && T > 0) vo2 = male || !c.sex ? 14.8 - 1.379 * T + 0.451 * T * T - 0.012 * T ** 3 : 4.38 * T - 3.9;
  } else if (d.protocol === "cooper") {
    const dist = n(i.distance);
    if (Number.isFinite(dist) && dist > 500) vo2 = (dist - 504.9) / 44.73;
  } else if (d.protocol === "rockport") {
    const t = n(i.time);
    const hr = n(i.hr);
    if (Number.isFinite(t) && Number.isFinite(hr) && c.weight && c.age && c.sex) vo2 = 132.853 - 0.0769 * c.weight * 2.2046 - 0.3877 * c.age + 6.315 * (male ? 1 : 0) - 3.2649 * t - 0.1565 * hr;
  } else if (d.protocol === "queens") {
    const hr = n(i.hr);
    if (Number.isFinite(hr) && c.sex) vo2 = male ? 111.33 - 0.42 * hr : 65.81 - 0.1847 * hr;
  } else if (d.protocol === "tc6") {
    const dist = n(i.distance);
    if (Number.isFinite(dist) && c.height && c.weight && c.age && c.sex) {
      const pred = male ? 7.57 * c.height - 5.02 * c.age - 1.76 * c.weight - 309 : 2.11 * c.height - 2.29 * c.weight - 5.78 * c.age + 667;
      pct = Math.round((dist / pred) * 100);
    }
  }
  const v = vo2 != null && Number.isFinite(vo2) && vo2 > 0 ? r1(vo2) : null;
  const cls = v != null ? vo2Class(v, c.sex, c.age) : null;
  const tc6Label = pct != null ? (pct >= 100 ? "Acima do previsto" : pct >= 80 ? "Dentro do esperado" : "Abaixo do previsto") : null;
  return { ...d, vo2: v, pctPredicted: pct, classLabel: cls?.label ?? tc6Label, hrMax: hrMaxFor(c.age) };
}

export const cardioName = (id?: string) => CARDIO_PROTOCOLS.find((p) => p.id === id)?.name ?? "Cardiorrespiratória";

// ---------------------------------------------------------------- funcional (FMS)
export type FmsTest = { id: string; name: string; bilateral: boolean; how: string; three: string; two: string; one: string; clearing?: string };
export const FMS_TESTS: FmsTest[] = [
  { id: "agachamento", name: "Agachamento profundo", bilateral: false, how: "Bastão acima da cabeça, pés na largura dos ombros. Agacha o mais fundo possível.", three: "Tronco paralelo à tíbia, coxa abaixo do joelho, joelhos alinhados, bastão sobre os pés.", two: "Só consegue o 3 com calço sob os calcanhares.", one: "Mesmo com calço não atinge os critérios." },
  { id: "barreira", name: "Passo sobre barreira", bilateral: true, how: "Barreira na altura da tíbia. Passa uma perna por cima e volta, sem tocar.", three: "Quadril, joelho e tornozelo alinhados, coluna estável, sem tocar a barreira.", two: "Perde alinhamento ou mexe a coluna.", one: "Toca a barreira ou perde o equilíbrio." },
  { id: "avanco", name: "Avanço em linha", bilateral: true, how: "Pés em linha, bastão nas costas (cabeça, torácica e sacro). Desce até o joelho de trás tocar atrás do pé da frente.", three: "Bastão mantém os 3 contatos, joelho toca atrás do calcanhar, sem perder equilíbrio.", two: "Perde contato com o bastão ou o alinhamento.", one: "Perde o equilíbrio." },
  { id: "ombro", name: "Mobilidade de ombro", bilateral: true, how: "Mãos fechadas, uma por cima e outra por baixo, aproximam-se nas costas. Mede a distância entre os punhos.", three: "Punhos a até 1 palmo de distância.", two: "Até 1,5 palmo.", one: "Mais de 1,5 palmo.", clearing: "Mão no ombro oposto e eleva o cotovelo: se doer, nota 0." },
  { id: "perna", name: "Elevação ativa da perna estendida", bilateral: true, how: "Deitado, eleva uma perna estendida com o pé em flexão, a outra fica no chão.", three: "Tornozelo passa do meio da coxa oposta.", two: "Tornozelo entre o meio da coxa e o joelho.", one: "Tornozelo abaixo do joelho." },
  { id: "flexao", name: "Flexão com estabilidade do tronco", bilateral: false, how: "Flexão de braço saindo do chão, corpo subindo em bloco.", three: "Homens: polegares na linha da testa. Mulheres: linha do queixo. Sobe em bloco.", two: "Só consegue com as mãos mais baixas (homens no queixo, mulheres na clavícula).", one: "Não sobe em bloco nem com as mãos mais baixas.", clearing: "Extensão da coluna deitado de bruços (press-up): se doer, nota 0." },
  { id: "rotacao", name: "Estabilidade rotatória", bilateral: true, how: "Quatro apoios. Estende braço e perna do mesmo lado e volta encostando cotovelo no joelho.", three: "Faz com braço e perna do mesmo lado, coluna estável.", two: "Só faz com braço e perna opostos (diagonal).", one: "Não faz nem a diagonal.", clearing: "Flexão da coluna (sentar nos calcanhares com braços à frente): se doer, nota 0." },
];
export const FMS_SCORE_LABEL: Record<number, string> = { 3: "Sem compensação", 2: "Com compensação", 1: "Não completa", 0: "Dor" };

export type FmsScore = { l?: number; r?: number; s?: number; pain?: boolean };
export type FunctionalData = { protocol: "fms"; scores: Record<string, FmsScore>; total?: number; classLabel?: string; asym?: string[]; notes?: string };

export function fmsTestScore(t: FmsTest, s?: FmsScore): number | null {
  if (!s) return null;
  if (s.pain) return 0;
  if (t.bilateral) return s.l != null && s.r != null ? Math.min(s.l, s.r) : null;
  return s.s ?? null;
}

export function computeFms(d: FunctionalData): FunctionalData {
  const parts = FMS_TESTS.map((t) => fmsTestScore(t, d.scores[t.id]));
  const complete = parts.every((x) => x != null);
  const total = complete ? parts.reduce<number>((a, x) => a + (x ?? 0), 0) : undefined;
  const asym = FMS_TESTS.filter((t) => t.bilateral && d.scores[t.id]?.l != null && d.scores[t.id]?.r != null && d.scores[t.id]!.l !== d.scores[t.id]!.r && !d.scores[t.id]?.pain).map((t) => t.name);
  const classLabel = total == null ? undefined : parts.some((x) => x === 0) ? "Dor: encaminhar pra avaliação" : total <= 14 ? "Risco aumentado de lesão" : total <= 16 ? "Moderado" : "Bom";
  return { ...d, total, classLabel, asym };
}
export const fmsTone = (label?: string) => (!label ? "muted" : label === "Bom" ? "good" : label === "Moderado" ? "accent" : "bad");
