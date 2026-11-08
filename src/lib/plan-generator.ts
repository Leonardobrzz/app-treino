import type { Exercise } from "./types";

export type Goal = "perder" | "manter" | "ganhar" | "recompor" | "nao-sei";
export type Level = "iniciante" | "intermediario" | "avancado";
export type Location = "academia" | "casa" | "corpo";

export type GenInput = {
  goal: Goal;
  level: Level;
  location: Location;
  days: number[]; // 0 = domingo … 6 = sábado
  minutes: number;
  priorities: string[]; // rótulos de PRIORITY_OPTIONS
};

export type GenExercise = { exercise: Exercise; sets: number; reps: string; rest: number };
export type GenDay = { weekday: number; title: string; focus: string; exercises: GenExercise[]; minutes: number };
export type GenPlan = { name: string; days: GenDay[] };

export const PRIORITY_OPTIONS = ["Peito", "Costas", "Ombros", "Braços", "Abdômen", "Pernas", "Glúteos", "Panturrilha"] as const;
const PRIORITY_GROUPS: Record<string, string[]> = {
  Peito: ["Peito"],
  Costas: ["Costas"],
  Ombros: ["Ombros"],
  Braços: ["Bíceps", "Tríceps"],
  Abdômen: ["Abdômen"],
  Pernas: ["Quadríceps", "Posterior de coxa"],
  Glúteos: ["Glúteos"],
  Panturrilha: ["Panturrilha"],
};

const EQUIPMENT: Record<Location, string[] | null> = {
  academia: null,
  casa: ["Halter", "Peso corporal", "Elástico", "Kettlebell", "Anilha", "Acessório"],
  corpo: ["Peso corporal", "Acessório"],
};

// Ordem de preferência por grupo (compostos primeiro). O que não estiver aqui entra depois.
const PREFERRED: Record<string, string[]> = {
  Peito: ["Supino reto com barra", "Supino inclinado com halteres", "Crucifixo na máquina (peck deck)", "Crossover na polia alta", "Supino reto com halteres", "Supino inclinado com barra", "Flexão de braço", "Crucifixo reto com halteres", "Paralelas (mergulho)"],
  Costas: ["Puxada frontal aberta", "Remada baixa com triângulo", "Remada curvada com barra", "Remada unilateral com halter (serrote)", "Barra fixa pronada", "Puxada supinada", "Remada na máquina", "Pulldown com braços estendidos", "Barra fixa supinada"],
  Ombros: ["Desenvolvimento com halteres", "Elevação lateral com halteres", "Face pull", "Elevação lateral na polia", "Crucifixo invertido na máquina", "Desenvolvimento na máquina", "Crucifixo invertido com halteres", "Elevação frontal com halteres"],
  Bíceps: ["Rosca direta com barra W", "Rosca alternada com halteres", "Rosca martelo", "Rosca Scott na máquina", "Rosca concentrada", "Rosca com elástico"],
  Tríceps: ["Tríceps corda", "Tríceps testa com barra W", "Tríceps pulley com barra", "Tríceps francês com halter", "Tríceps banco", "Tríceps coice com halter"],
  Quadríceps: ["Agachamento livre com barra", "Leg press 45°", "Cadeira extensora", "Agachamento búlgaro", "Agachamento hack", "Agachamento goblet", "Afundo com halteres", "Passada (avanço caminhando)", "Agachamento com kettlebell"],
  "Posterior de coxa": ["Mesa flexora", "Stiff com barra", "Cadeira flexora", "Levantamento terra romeno", "Stiff com halteres", "Nordic curl"],
  Glúteos: ["Elevação pélvica com barra", "Cadeira abdutora", "Glúteo na polia (coice)", "Ponte de glúteo", "Kettlebell swing"],
  Panturrilha: ["Panturrilha em pé na máquina", "Panturrilha sentado", "Panturrilha no leg press", "Panturrilha unilateral com halter"],
  Abdômen: ["Abdominal na polia (crunch ajoelhado)", "Prancha", "Elevação de pernas no banco", "Abdominal supra no solo", "Abdominal bicicleta", "Abdominal remador"],
  Trapézio: ["Encolhimento com halteres", "Encolhimento com barra"],
  Cardio: ["Esteira", "Bicicleta ergométrica", "Elíptico", "Pular corda", "Burpee"],
};

type Slot = [group: string, count: number];
type Template = { title: string; focus: string; slots: Slot[] };

const T = {
  push: { title: "Empurrar", focus: "Peito, ombros e tríceps", slots: [["Peito", 2], ["Ombros", 2], ["Tríceps", 2]] },
  pull: { title: "Puxar", focus: "Costas e bíceps", slots: [["Costas", 3], ["Bíceps", 2], ["Ombros", 1]] },
  legs: { title: "Pernas", focus: "Quadríceps, posterior e glúteos", slots: [["Quadríceps", 2], ["Posterior de coxa", 2], ["Glúteos", 1], ["Panturrilha", 1]] },
  upper: { title: "Superiores", focus: "Peito, costas, ombros e braços", slots: [["Peito", 1], ["Costas", 2], ["Ombros", 1], ["Bíceps", 1], ["Tríceps", 1]] },
  lower: { title: "Inferiores", focus: "Pernas, glúteos e abdômen", slots: [["Quadríceps", 2], ["Posterior de coxa", 1], ["Glúteos", 2], ["Panturrilha", 1], ["Abdômen", 1]] },
  fullA: { title: "Corpo inteiro A", focus: "Treino completo", slots: [["Quadríceps", 1], ["Peito", 1], ["Costas", 1], ["Ombros", 1], ["Posterior de coxa", 1], ["Abdômen", 1]] },
  fullB: { title: "Corpo inteiro B", focus: "Treino completo", slots: [["Glúteos", 1], ["Costas", 1], ["Peito", 1], ["Quadríceps", 1], ["Bíceps", 1], ["Tríceps", 1]] },
} satisfies Record<string, Template>;

function templatesFor(n: number, level: Level): Template[] {
  if (n <= 1) return [T.fullA];
  if (n === 2) return [T.fullA, T.fullB];
  if (n === 3) return level === "iniciante" ? [T.fullA, T.fullB, T.fullA] : [T.push, T.pull, T.legs];
  if (n === 4) return [T.upper, T.lower, T.upper, T.lower];
  if (n === 5) return [T.push, T.pull, T.legs, T.upper, T.lower];
  return [T.push, T.pull, T.legs, T.push, T.pull, T.legs];
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function generatePlan(input: GenInput, catalog: Exercise[]): GenPlan {
  const allowed = EQUIPMENT[input.location];
  const pool = catalog.filter((e) => !e.created_by && (!allowed || allowed.includes(e.equipment)));
  const byGroup = (g: string) => {
    const list = pool.filter((e) => e.muscle_group === g);
    const pref = (PREFERRED[g] ?? []).map((n) => list.find((e) => norm(e.name) === norm(n))).filter(Boolean) as Exercise[];
    return [...pref, ...list.filter((e) => !pref.includes(e))];
  };

  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = [...new Set(input.days)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).slice(0, 6);
  const templates = templatesFor(days.length, input.level);
  const priorityGroups = input.priorities.flatMap((p) => PRIORITY_GROUPS[p] ?? []);

  const perExercise = input.level === "avancado" ? 8 : 7; // minutos aproximados por exercício
  const maxExercises = Math.max(4, Math.min(9, Math.floor(input.minutes / perExercise)));
  const baseSets = input.level === "avancado" ? 4 : 3;
  const reps = { perder: "10-15", manter: "10-12", ganhar: "8-12", recompor: "8-12", "nao-sei": "10-12" }[input.goal];
  const used = new Map<string, number>(); // quantas vezes cada exercício já foi usado na semana

  const out: GenDay[] = days.map((weekday, i) => {
    const tpl = templates[i % templates.length];
    const variant = templates.slice(0, i).filter((t) => t === tpl).length;
    const slots: Slot[] = tpl.slots.map(([g, c]) => [g, c]);
    // músculos prioritários ganham uma série de exercício a mais nos dias em que já aparecem
    for (const g of priorityGroups) {
      const s = slots.find(([sg]) => sg === g);
      if (s) s[1] += 1;
      else if (g === "Abdômen") slots.push(["Abdômen", 1]);
    }
    const chosen: GenExercise[] = [];
    for (const [g, count] of slots) {
      const options = byGroup(g);
      for (let k = 0; k < count && options.length; k++) {
        const ordered = [...options.slice(variant % options.length), ...options.slice(0, variant % options.length)];
        const pick = ordered.filter((e) => !chosen.some((c) => c.exercise.id === e.id)).sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0))[0];
        if (!pick) break;
        const compound = chosen.length === 0 && ["Peito", "Costas", "Quadríceps"].includes(g);
        chosen.push({
          exercise: pick,
          sets: compound && input.level !== "iniciante" ? baseSets + (input.level === "avancado" ? 0 : 1) : baseSets,
          reps: g === "Abdômen" ? "15" : compound && input.level !== "iniciante" && input.goal !== "perder" ? "6-10" : reps,
          rest: compound ? 120 : g === "Abdômen" ? 45 : 75,
        });
        used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      }
    }
    // respeita o tempo disponível, mantendo os prioritários
    while (chosen.length > maxExercises) {
      const idx = [...chosen].reverse().findIndex((c) => !priorityGroups.includes(c.exercise.muscle_group));
      chosen.splice(idx === -1 ? chosen.length - 1 : chosen.length - 1 - idx, 1);
    }
    if (input.goal === "perder" && chosen.length < maxExercises + 1) {
      const cardio = byGroup("Cardio")[i % Math.max(1, byGroup("Cardio").length)];
      if (cardio) chosen.push({ exercise: cardio, sets: 1, reps: "15", rest: 0 });
    }
    const minutes = Math.round(chosen.reduce((s, c) => s + c.sets * (45 + c.rest), 0) / 60);
    const letter = templates.filter((t) => t === tpl).length > 1 ? ` ${String.fromCharCode(65 + variant)}` : "";
    return { weekday, title: tpl.title + (tpl.title.includes("Corpo inteiro") ? "" : letter), focus: tpl.focus, exercises: chosen, minutes };
  });

  const split = days.length === 4 ? "Superiores e inferiores" : days.length === 5 ? "Empurrar, puxar, pernas + sup/inf" : days.length >= 6 ? "Empurrar, puxar, pernas" : days.length === 3 && input.level !== "iniciante" ? "Empurrar, puxar, pernas" : "Corpo inteiro";
  return { name: `${split} · ${days.length}x por semana`, days: out };
}
