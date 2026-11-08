import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { MEASURES } from "@/lib/types";
import { WEEKDAYS } from "@/lib/util";

type SB = Awaited<ReturnType<typeof supabaseServer>>;
type Ex = { id: string; name: string; muscle_group: string; equipment: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "montar_semana",
    description:
      "Cria a semana de treinos do usuário e a salva como plano ativo, substituindo o plano anterior. Use os nomes EXATOS do catálogo sempre que possível. Use quando o usuário pedir para montar, refazer ou trocar a semana/divisão de treino.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do plano, ex.: 'ABC — hipertrofia'" },
        dias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dia_semana: { type: "integer", minimum: 0, maximum: 6, description: "0=domingo, 1=segunda … 6=sábado" },
              titulo: { type: "string", description: "Ex.: 'Treino A — Peito e tríceps'" },
              exercicios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    grupo: { type: "string", description: "Músculo principal, só se o exercício não estiver no catálogo" },
                    series: { type: "integer", minimum: 1, maximum: 10 },
                    repeticoes: { type: "string", description: "Faixa como '8-12' ou número como '15'" },
                    carga_kg: { type: "number" },
                    descanso_s: { type: "integer" },
                    nota: { type: "string" },
                  },
                  required: ["nome", "series", "repeticoes"],
                },
              },
            },
            required: ["dia_semana", "titulo", "exercicios"],
          },
        },
      },
      required: ["nome", "dias"],
    },
  },
  {
    name: "ajustar_dia",
    description: "Adiciona ou remove exercícios de um dia já existente do plano ativo, sem refazer a semana inteira.",
    input_schema: {
      type: "object",
      properties: {
        dia_semana: { type: "integer", minimum: 0, maximum: 6 },
        adicionar: {
          type: "array",
          items: {
            type: "object",
            properties: { nome: { type: "string" }, series: { type: "integer" }, repeticoes: { type: "string" }, carga_kg: { type: "number" } },
            required: ["nome", "series", "repeticoes"],
          },
        },
        remover: { type: "array", items: { type: "string" }, description: "Nomes dos exercícios a remover" },
      },
      required: ["dia_semana"],
    },
  },
  {
    name: "registrar_peso",
    description: "Registra o peso corporal do usuário numa data (padrão hoje).",
    input_schema: {
      type: "object",
      properties: { kg: { type: "number" }, data: { type: "string", description: "AAAA-MM-DD" }, gordura_percentual: { type: "number" } },
      required: ["kg"],
    },
  },
  {
    name: "registrar_medidas",
    description: "Registra medidas corporais em centímetros numa data (padrão hoje).",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "AAAA-MM-DD" },
        ...Object.fromEntries(MEASURES.map((k) => [k, { type: "number" }])),
      },
    },
  },
  {
    name: "historico_exercicio",
    description: "Mostra as últimas sessões de um exercício (cargas e repetições) para orientar a progressão.",
    input_schema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
  },
];

async function findOrCreate(sb: SB, userId: string, catalog: Ex[], name: string, group?: string) {
  const n = norm(name);
  let ex = catalog.find((e) => norm(e.name) === n) ?? catalog.find((e) => norm(e.name).includes(n) || n.includes(norm(e.name)));
  if (!ex) {
    const words = n.split(" ").filter((w) => w.length > 3);
    ex = catalog
      .map((e) => ({ e, score: words.filter((w) => norm(e.name).includes(w)).length }))
      .filter((x) => x.score >= Math.max(2, words.length - 1))
      .sort((a, b) => b.score - a.score)[0]?.e;
  }
  if (ex) return ex;
  const { data } = await sb.from("exercises").insert({ name, muscle_group: group ?? "Outro", equipment: "Outro", created_by: userId }).select("id,name,muscle_group,equipment").single();
  if (data) catalog.push(data as Ex);
  return data as Ex;
}

async function activePlan(sb: SB) {
  const { data } = await sb.from("plans").select("id,name,plan_days(id,weekday,title,plan_exercises(id,position,sets,reps,target_weight,exercises(name)))").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as null | { id: string; name: string; plan_days: { id: string; weekday: number; title: string; plan_exercises: { id: string; position: number; sets: number; reps: string; target_weight: number | null; exercises: { name: string } }[] }[] };
}

async function runTool(sb: SB, userId: string, catalog: Ex[], name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "montar_semana") {
    const dias = (input.dias as { dia_semana: number; titulo: string; exercicios: { nome: string; grupo?: string; series: number; repeticoes: string; carga_kg?: number; descanso_s?: number; nota?: string }[] }[]) ?? [];
    await sb.from("plans").update({ active: false }).eq("active", true);
    const { data: plan, error } = await sb.from("plans").insert({ name: String(input.nome ?? "Minha semana") }).select("id").single();
    if (error || !plan) return "Erro ao criar o plano.";
    const seen = new Set<number>();
    for (const d of dias) {
      if (seen.has(d.dia_semana)) continue;
      seen.add(d.dia_semana);
      const { data: day } = await sb.from("plan_days").insert({ plan_id: plan.id, weekday: d.dia_semana, title: d.titulo }).select("id").single();
      if (!day) continue;
      const rows = [];
      for (const [i, e] of d.exercicios.entries()) {
        const ex = await findOrCreate(sb, userId, catalog, e.nome, e.grupo);
        if (!ex) continue;
        rows.push({ plan_day_id: day.id, exercise_id: ex.id, position: i, sets: e.series, reps: String(e.repeticoes).slice(0, 8), target_weight: e.carga_kg ?? null, rest_seconds: e.descanso_s ?? 90, notes: e.nota ?? null });
      }
      if (rows.length) await sb.from("plan_exercises").insert(rows);
    }
    return `Plano salvo com ${seen.size} dias: ${dias.map((d) => `${WEEKDAYS[d.dia_semana]} (${d.titulo})`).join(", ")}.`;
  }
  if (name === "ajustar_dia") {
    const plan = await activePlan(sb);
    const day = plan?.plan_days.find((d) => d.weekday === input.dia_semana);
    if (!day) return "Não existe treino nesse dia. Use montar_semana ou peça ao usuário para criar o dia.";
    const remover = ((input.remover as string[]) ?? []).map(norm);
    const toDelete = day.plan_exercises.filter((pe) => remover.some((r) => norm(pe.exercises.name).includes(r) || r.includes(norm(pe.exercises.name))));
    if (toDelete.length) await sb.from("plan_exercises").delete().in("id", toDelete.map((x) => x.id));
    const add = (input.adicionar as { nome: string; series: number; repeticoes: string; carga_kg?: number }[]) ?? [];
    let pos = day.plan_exercises.length;
    for (const a of add) {
      const ex = await findOrCreate(sb, userId, catalog, a.nome);
      if (ex) await sb.from("plan_exercises").insert({ plan_day_id: day.id, exercise_id: ex.id, position: pos++, sets: a.series, reps: String(a.repeticoes), target_weight: a.carga_kg ?? null });
    }
    return `Dia atualizado: ${toDelete.length} removido(s), ${add.length} adicionado(s).`;
  }
  if (name === "registrar_peso") {
    const { error } = await sb.from("body_weights").upsert({ measured_on: (input.data as string) || new Date().toISOString().slice(0, 10), weight: input.kg, body_fat: input.gordura_percentual ?? null }, { onConflict: "user_id,measured_on" });
    return error ? "Erro ao salvar o peso." : "Peso registrado.";
  }
  if (name === "registrar_medidas") {
    const row: Record<string, unknown> = { measured_on: (input.data as string) || new Date().toISOString().slice(0, 10) };
    MEASURES.forEach((k) => input[k] != null && (row[k] = input[k]));
    const { error } = await sb.from("body_measurements").upsert(row, { onConflict: "user_id,measured_on" });
    return error ? "Erro ao salvar as medidas." : "Medidas registradas.";
  }
  if (name === "historico_exercicio") {
    const ex = catalog.find((e) => norm(e.name).includes(norm(String(input.nome))));
    if (!ex) return "Exercício não encontrado.";
    const { data } = await sb.from("session_sets").select("weight,reps,created_at,session_id").eq("exercise_id", ex.id).eq("done", true).order("created_at", { ascending: false }).limit(40);
    if (!data?.length) return `Sem histórico para ${ex.name}.`;
    const bySes = new Map<string, string[]>();
    data.forEach((s) => {
      const k = s.created_at.slice(0, 10) + "|" + s.session_id;
      bySes.set(k, [...(bySes.get(k) ?? []), `${s.weight}kg×${s.reps}`]);
    });
    return `${ex.name}:\n` + [...bySes.entries()].slice(0, 6).map(([k, v]) => `${k.split("|")[0]}: ${v.reverse().join(", ")}`).join("\n");
  }
  return "Ferramenta desconhecida.";
}

export async function GET() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { data } = await sb.from("ai_messages").select("id,role,content,created_at").order("created_at").limit(100);
  return NextResponse.json({ messages: data ?? [] });
}

export async function DELETE() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  await sb.from("ai_messages").delete().eq("user_id", u.user.id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada (falta ANTHROPIC_API_KEY)." }, { status: 503 });

  const { message } = (await req.json()) as { message?: string };
  const text = (message ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });

  const [profile, plan, hist, catalogRes, weight] = await Promise.all([
    sb.from("profiles").select("name,goal,weekly_goal").eq("id", u.user.id).maybeSingle(),
    activePlan(sb),
    sb.from("ai_messages").select("role,content").order("created_at", { ascending: false }).limit(16),
    sb.from("exercises").select("id,name,muscle_group,equipment"),
    sb.from("body_weights").select("measured_on,weight").order("measured_on", { ascending: false }).limit(3),
  ]);
  const catalog = (catalogRes.data ?? []) as Ex[];

  const planText = plan?.plan_days.length
    ? plan.plan_days
        .sort((a, b) => a.weekday - b.weekday)
        .map((d) => `- ${WEEKDAYS[d.weekday]}: ${d.title} → ${d.plan_exercises.sort((a, b) => a.position - b.position).map((e) => `${e.exercises.name} ${e.sets}x${e.reps}${e.target_weight ? ` ${e.target_weight}kg` : ""}`).join("; ")}`)
        .join("\n")
    : "(sem plano ainda)";

  const byGroup = new Map<string, string[]>();
  catalog.forEach((e) => byGroup.set(e.muscle_group, [...(byGroup.get(e.muscle_group) ?? []), e.name]));

  const system = `Você é o assistente de treino do app Carga: um personal trainer brasileiro, direto, animado e prático. Responda em português do Brasil, curto (feito para ler no celular), sem enrolação.

Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}.

Usuário: ${profile.data?.name ?? "sem nome"} · objetivo: ${profile.data?.goal ?? "não informado"} · meta: ${profile.data?.weekly_goal ?? 4} treinos/semana.
Peso recente: ${(weight.data ?? []).map((w) => `${w.weight} kg em ${w.measured_on}`).join(", ") || "não registrado"}.

Plano atual:
${planText}

Catálogo de exercícios do app (use estes nomes exatos ao montar treinos):
${[...byGroup.entries()].map(([g, l]) => `${g}: ${l.join(" | ")}`).join("\n")}

Regras:
- Quando o usuário pedir para montar/refazer a semana, monte direto com a ferramenta montar_semana (não peça confirmação se o pedido estiver claro; se faltar o essencial, como quantos dias, assuma algo razoável e diga o que assumiu). Depois resuma o plano em poucas linhas.
- Para mudar só um dia, use ajustar_dia.
- Se o usuário disser o peso ou medidas, registre com a ferramenta.
- Volume típico: 3–4 séries, 6–12 reps para hipertrofia, 3–6 para força, 12–20 para resistência; 4–7 exercícios por dia.
- Não dê diagnóstico médico. Em caso de dor ou lesão, recomende procurar um profissional de saúde.
- Não use markdown pesado: no máximo listas curtas com "-".`;

  const history = (hist.data ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: text }];

  const client = new Anthropic();
  let changed = false;
  let reply = "";
  try {
    for (let i = 0; i < 6; i++) {
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        system,
        tools: TOOLS,
        messages,
      });
      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      reply = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim() || reply;
      if (res.stop_reason !== "tool_use" || !toolUses.length) break;
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const t of toolUses) {
        const out = await runTool(sb, u.user.id, catalog, t.name, t.input as Record<string, unknown>);
        if (t.name !== "historico_exercicio") changed = true;
        results.push({ type: "tool_result", tool_use_id: t.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "A IA não respondeu agora. Tente de novo em instantes." }, { status: 502 });
  }

  reply ||= "Pronto!";
  await sb.from("ai_messages").insert([
    { role: "user", content: text },
    { role: "assistant", content: reply },
  ]);
  return NextResponse.json({ reply, changed });
}
