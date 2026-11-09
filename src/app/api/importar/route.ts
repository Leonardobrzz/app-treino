import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { aiError } from "@/lib/ai-errors";
import { supabaseServer } from "@/lib/supabase/server";
import { proOf, usageOf } from "@/lib/limits";
import { findMatch, savePlan, type Ex, type PlanInput } from "@/lib/plan-save";

export const maxDuration = 90;

const TOOL: Anthropic.Tool = {
  name: "transcrever_ficha",
  description: "Devolve a ficha de treino transcrita e organizada por dia.",
  input_schema: {
    type: "object",
    properties: {
      e_ficha: { type: "boolean", description: "false se o conteúdo não for uma ficha/plano de treino" },
      nome: { type: "string", description: "Nome do plano, ex.: 'Ficha da academia — ABC'" },
      dias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dia_semana: { type: "integer", minimum: 0, maximum: 6, description: "0=domingo … 6=sábado" },
            titulo: { type: "string", description: "Ex.: 'Treino A — Peito e tríceps'" },
            exercicios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string", description: "Nome do catálogo quando for o mesmo exercício; senão, o nome da ficha corrigido" },
                  grupo: { type: "string", description: "Grupo muscular principal" },
                  series: { type: "integer", minimum: 1, maximum: 10 },
                  repeticoes: { type: "string", description: "Ex.: '10', '8-12', '15'" },
                  carga_kg: { type: "number" },
                  descanso_s: { type: "integer" },
                  nota: { type: "string", description: "Observações da ficha (ex.: 'drop-set na última', 'cadência 3s')" },
                },
                required: ["nome", "series", "repeticoes"],
              },
            },
          },
          required: ["dia_semana", "titulo", "exercicios"],
        },
      },
      aviso: { type: "string", description: "Algo que não ficou legível ou foi assumido (opcional, curto)" },
    },
    required: ["e_ficha", "dias"],
  },
};

const DEFAULT_DAYS: Record<number, number[]> = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

async function auth() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

export async function GET() {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  return NextResponse.json({ usage: await usageOf(sb, "ficha", await proOf(sb)) });
}

/** Lê a ficha (fotos e/ou texto) e devolve uma prévia do plano, sem salvar */
export async function POST(req: NextRequest) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada." }, { status: 503 });

  const pro = await proOf(sb);
  const usage = await usageOf(sb, "ficha", pro);
  if (usage.left <= 0) {
    return NextResponse.json(
      { error: pro ? "Você chegou ao limite de importações por hoje. Tente amanhã." : `Você já usou as ${usage.limit} importações grátis deste mês. No Pro é à vontade.`, limit: true, usage },
      { status: pro ? 429 : 402 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { images?: string[]; text?: string };
  const images = (Array.isArray(body.images) ? body.images : []).filter((x) => typeof x === "string" && x.length > 100).slice(0, 4).map((x) => x.replace(/^data:[^,]+,/, ""));
  const text = (body.text ?? "").trim().slice(0, 6000);
  if (!images.length && !text) return NextResponse.json({ error: "Mande uma foto da ficha ou cole o texto." }, { status: 400 });
  if (images.some((x) => x.length > 4_000_000)) return NextResponse.json({ error: "Foto muito grande." }, { status: 413 });

  const [{ data: profile }, { data: catalogData }] = await Promise.all([
    sb.from("profiles").select("training_days,weekly_goal,location").eq("id", user.id).maybeSingle(),
    sb.from("exercises").select("id,name,muscle_group,equipment"),
  ]);
  const catalog = (catalogData ?? []) as Ex[];
  const userDays = (profile?.training_days as number[] | null)?.length ? (profile!.training_days as number[]) : null;

  const system = `Você transcreve fichas de treino de academia (papel, quadro, print de outro app ou texto) para o app Carga.
- Leia TODOS os exercícios de cada treino (A, B, C…), na ordem da ficha, com séries, repetições, carga e observações quando existirem.
- Interprete a notação comum: "3x12" = 3 séries de 12; "4x10-12" = 4 séries de 10 a 12; "3x falha" = repeticoes "falha"; "bi-set"/"drop" vão em nota.
- Se o exercício for o mesmo de um item do catálogo abaixo, use o nome EXATO do catálogo. Se não houver equivalente, escreva o nome por extenso e corrigido, com o grupo muscular.
- Dias da semana: se a ficha indicar, use. Se não indicar (Treino A, B, C…), distribua ${userDays ? `nos dias que o usuário treina: ${userDays.join(", ")} (0=domingo)` : "em dias alternados começando na segunda"}, repetindo A/B/C em sequência se houver mais dias que treinos.
- Não invente exercícios. Se algo estiver ilegível, ignore e explique em "aviso".
- Se não for uma ficha de treino, responda e_ficha=false.

Catálogo do app:
${[...new Set(catalog.map((c) => c.muscle_group))].map((g) => `${g}: ${catalog.filter((c) => c.muscle_group === g).map((c) => c.name).join(" | ")}`).join("\n")}`;

  const content: Anthropic.ContentBlockParam[] = images.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }));
  content.push({ type: "text", text: text ? `Ficha (texto):\n${text}` : "Transcreva a ficha das imagens." });

  let out: { e_ficha?: boolean; nome?: string; dias?: PlanInput["dias"]; aviso?: string } = {};
  try {
    const res = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 6000,
      system,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content }],
    });
    out = (res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")?.input ?? {}) as typeof out;
  } catch (e) {
    return aiError(e, "importar ficha");
  }
  await sb.from("ai_usage").insert({ kind: "ficha" });

  const dias = (out.dias ?? []).filter((d) => d.exercicios?.length);
  if (out.e_ficha === false || !dias.length) {
    return NextResponse.json({ error: "Não encontrei uma ficha de treino aqui. Tente uma foto mais nítida, de frente e com boa luz." }, { status: 422 });
  }

  // garante dias diferentes e válidos
  const fallback = userDays ?? DEFAULT_DAYS[Math.min(7, dias.length)] ?? [1, 3, 5];
  const used = new Set<number>();
  dias.forEach((d, i) => {
    let wd = Number.isInteger(d.dia_semana) && d.dia_semana >= 0 && d.dia_semana <= 6 ? d.dia_semana : fallback[i % fallback.length];
    if (used.has(wd)) wd = [...fallback, 0, 1, 2, 3, 4, 5, 6].find((x) => !used.has(x)) ?? wd;
    used.add(wd);
    d.dia_semana = wd;
  });

  const plan = {
    nome: (out.nome || "Ficha importada").slice(0, 80),
    dias: dias.slice(0, 7).map((d) => ({
      dia_semana: d.dia_semana,
      titulo: (d.titulo || "Treino").slice(0, 80),
      exercicios: d.exercicios.slice(0, 20).map((e) => {
        const m = findMatch(catalog, e.nome ?? "");
        return {
          nome: m?.name ?? String(e.nome ?? "").slice(0, 80),
          grupo: m?.muscle_group ?? e.grupo ?? "Outro",
          series: Math.min(10, Math.max(1, Math.round(Number(e.series) || 3))),
          repeticoes: String(e.repeticoes || "10").slice(0, 8),
          carga_kg: e.carga_kg ? Number(e.carga_kg) : null,
          descanso_s: e.descanso_s ? Number(e.descanso_s) : null,
          nota: e.nota ? String(e.nota).slice(0, 200) : null,
          novo: !m,
        };
      }),
    })),
  };
  return NextResponse.json({ plan, aviso: out.aviso ?? "", usage: { ...usage, used: usage.used + 1, left: usage.left - 1 } });
}

/** Salva a prévia (já revisada pelo usuário) como semana ativa */
export async function PUT(req: NextRequest) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanInput };
  if (!plan?.dias?.length) return NextResponse.json({ error: "Plano vazio." }, { status: 400 });
  const { data: catalogData } = await sb.from("exercises").select("id,name,muscle_group,equipment");
  const r = await savePlan(sb, user.id, (catalogData ?? []) as Ex[], { nome: plan.nome, dias: plan.dias.slice(0, 7) });
  if (!r.ok) return NextResponse.json({ error: "Não consegui salvar o plano." }, { status: 500 });
  return NextResponse.json({ ok: true, days: r.days });
}
