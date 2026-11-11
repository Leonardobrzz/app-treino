import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { MODEL_PRO } from "@/lib/ai-models";
import { aiError } from "@/lib/ai-errors";
import { supabaseServer } from "@/lib/supabase/server";
import { findMatch, type Ex } from "@/lib/plan-save";

export const maxDuration = 90;
const LIMIT_PER_DAY = 30;
const METHODS = ["biset", "triset", "drop", "piramide", "restpause", "cluster", "isometria", "cadencia"];

const TOOL: Anthropic.Tool = {
  name: "plano_de_treino",
  description: "Devolve a semana de treino organizada por dia.",
  input_schema: {
    type: "object",
    properties: {
      ok: { type: "boolean", description: "false se não der pra montar (ex.: imagem não é uma ficha)" },
      nome: { type: "string" },
      dias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dia_semana: { type: "integer", minimum: 0, maximum: 6, description: "0=domingo … 6=sábado" },
            titulo: { type: "string" },
            exercicios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome EXATO de um exercício do catálogo" },
                  series: { type: "integer", minimum: 1, maximum: 10 },
                  repeticoes: { type: "string" },
                  carga_kg: { type: "number" },
                  descanso_s: { type: "integer" },
                  metodo: { type: "string", enum: METHODS },
                  nota: { type: "string", description: "Orientação curta pro aluno" },
                },
                required: ["nome", "series", "repeticoes"],
              },
            },
          },
          required: ["dia_semana", "titulo", "exercicios"],
        },
      },
      justificativa: { type: "string", description: "2 a 4 frases pro personal: por que essa divisão e o que foi considerado (lesões, PAR-Q, objetivo)" },
    },
    required: ["ok", "dias"],
  },
};

type Out = { ok?: boolean; nome?: string; dias?: { dia_semana: number; titulo: string; exercicios: { nome: string; series: number; repeticoes: string; carga_kg?: number; descanso_s?: number; metodo?: string; nota?: string }[] }[]; justificativa?: string };

/** IA do personal: monta a semana a partir da anamnese/avaliação, ou transcreve uma ficha por foto. Não salva nada. */
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { student?: string; mode?: "montar" | "ficha"; images?: string[]; text?: string; pedido?: string };
  if (!body.student) return NextResponse.json({ error: "aluno faltando" }, { status: 400 });

  // confere o vínculo (a função dá erro se não for aluno deste personal)
  const { data: detail, error: dErr } = await sb.rpc("trainer_student", { p_student: body.student });
  if (dErr || !detail) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("kind", "personal").gte("created_at", since);
  if ((count ?? 0) >= LIMIT_PER_DAY) return NextResponse.json({ error: "Você chegou ao limite de usos da IA por hoje. Tente amanhã." }, { status: 429 });

  const { data: catalogData } = await sb.from("exercises").select("id,name,muscle_group,equipment").is("created_by", null);
  const catalog = (catalogData ?? []) as Ex[];
  const catalogText = [...new Set(catalog.map((c) => c.muscle_group))].map((g) => `${g}: ${catalog.filter((c) => c.muscle_group === g).map((c) => c.name).join(" | ")}`).join("\n");

  const d = detail as { profile: Record<string, unknown>; sessions: unknown[] };
  const p = d.profile;
  const content: Anthropic.ContentBlockParam[] = [];
  let system: string;

  if (body.mode === "ficha") {
    const images = (body.images ?? []).filter((x) => typeof x === "string" && x.length > 100).slice(0, 4).map((x) => x.replace(/^data:[^,]+,/, ""));
    const text = (body.text ?? "").trim().slice(0, 6000);
    if (!images.length && !text) return NextResponse.json({ error: "Mande a foto da ficha." }, { status: 400 });
    if (images.some((x) => x.length > 4_000_000)) return NextResponse.json({ error: "Foto muito grande." }, { status: 413 });
    system = `Você transcreve fichas de treino (papel, quadro, print) que um personal trainer escreveu para um aluno.
- Leia todos os exercícios de cada treino, na ordem, com séries, repetições, carga e observações.
- "3x12" = 3 séries de 12. Bi-set, drop-set, pirâmide, rest-pause, cluster, isometria e cadência vão em "metodo".
- Use SEMPRE o nome EXATO de um exercício do catálogo abaixo (o equivalente mais próximo). Se não houver nada parecido, pule.
- Dias: use os da ficha; se não tiver, distribua A/B/C nos dias ${(p.training_days as number[] | null)?.join(", ") || "1, 3, 5"} (0=domingo).
- Não invente exercícios. Se não for uma ficha, ok=false.

Catálogo:
${catalogText}`;
    images.forEach((data) => content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }));
    content.push({ type: "text", text: text ? `Ficha (texto):\n${text}` : "Transcreva a ficha das imagens." });
  } else {
    const [{ data: anam }, { data: assess }] = await Promise.all([
      sb.from("anamneses").select("answers,extra_questions,answered_at").eq("student_id", body.student).not("answered_at", "is", null).order("answered_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("assessments").select("assessed_on,sex,age,weight,height,body_fat,lean_mass,posture,notes").eq("student_id", body.student).order("assessed_on", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const perfil = {
      nome: p.name, sexo: p.sex, nascimento: p.birth_date, altura_cm: p.height_cm, objetivo: p.goal, nivel: p.level, local: p.location,
      dias_que_treina: p.training_days, minutos_por_treino: p.session_minutes, prioridades: p.priority_muscles,
      treinos_nos_ultimos_120_dias: (d.sessions ?? []).length,
    };
    system = `Você ajuda um personal trainer a montar a semana de treino de um aluno no app Carga. O personal vai revisar antes de enviar.
- Respeite o objetivo, o nível, os dias e o tempo disponível do aluno.
- Leve a sério lesões, dores, condições de saúde e o PAR-Q da anamnese: evite exercícios que agravem e prefira alternativas seguras. Se houver "Sim" no PAR-Q, monte algo conservador e diga na justificativa que o aluno precisa de liberação médica.
- Desvios posturais da avaliação: inclua trabalho compensatório quando fizer sentido (ex.: ombros protusos → mais remadas e face pull).
- Iniciante: poucos exercícios, máquinas e técnica. Avançado: pode usar métodos (bi-set, drop etc.) com moderação.
- Use SOMENTE nomes EXATOS do catálogo. Carga só se fizer sentido; normalmente deixe em branco.
- Dias da semana: 0=domingo … 6=sábado.

Catálogo:
${catalogText}`;
    content.push({
      type: "text",
      text: `Perfil do aluno: ${JSON.stringify(perfil)}
Anamnese: ${anam ? JSON.stringify({ respostas: anam.answers, perguntas_extras: anam.extra_questions }) : "não respondida"}
Última avaliação física: ${assess ? JSON.stringify(assess) : "nenhuma"}
${body.pedido?.trim() ? `Pedido do personal: ${body.pedido.trim().slice(0, 600)}` : ""}
Monte a semana.`,
    });
  }

  let out: Out = {};
  try {
    const res = await new Anthropic().messages.create({ model: MODEL_PRO, max_tokens: 6000, system, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content }] });
    out = (res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")?.input ?? {}) as Out;
  } catch (e) {
    return aiError(e, "ia do personal");
  }
  await sb.from("ai_usage").insert({ kind: "personal" });

  if (out.ok === false || !out.dias?.length) return NextResponse.json({ error: body.mode === "ficha" ? "Não encontrei uma ficha nessa foto. Tente uma foto mais nítida." : "A IA não conseguiu montar agora. Tente de novo." }, { status: 422 });

  const missing: string[] = [];
  const used = new Set<number>();
  const days = out.dias
    .filter((x) => Number.isInteger(x.dia_semana) && x.dia_semana >= 0 && x.dia_semana <= 6 && !used.has(x.dia_semana) && used.add(x.dia_semana))
    .slice(0, 7)
    .map((x) => ({
      weekday: x.dia_semana,
      title: String(x.titulo || "Treino").slice(0, 80),
      exercises: (x.exercicios ?? []).slice(0, 20).flatMap((e) => {
        const m = findMatch(catalog, e.nome ?? "");
        if (!m) {
          missing.push(e.nome);
          return [];
        }
        return [{
          exercise_id: m.id, name: m.name, muscle_group: m.muscle_group, equipment: m.equipment,
          sets: Math.min(10, Math.max(1, Math.round(Number(e.series) || 3))),
          reps: String(e.repeticoes || "10").slice(0, 8),
          target_weight: e.carga_kg ? Number(e.carga_kg) : null,
          rest_seconds: Math.min(600, Math.max(15, Math.round(Number(e.descanso_s) || 90))),
          notes: e.nota ? String(e.nota).slice(0, 200) : null,
          method: e.metodo && METHODS.includes(e.metodo) ? e.metodo : null,
        }];
      }),
    }))
    .sort((a, b) => a.weekday - b.weekday);

  return NextResponse.json({ name: (out.nome || (body.mode === "ficha" ? "Ficha do personal" : "Treino do personal")).slice(0, 80), days, why: out.justificativa ?? "", missing });
}
