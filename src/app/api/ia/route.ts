import { chatModel } from "@/lib/ai-models";
import { painLabel } from "@/lib/plan-generator";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { MEASURES } from "@/lib/types";
import { FREE_AI_MESSAGES, PRO_AI_MESSAGES, isPro } from "@/lib/pro";
import { aiError } from "@/lib/ai-errors";
import { WEEKDAYS } from "@/lib/util";
import { findOrCreate, norm, savePlan, type Ex, type PlanInput } from "@/lib/plan-save";
import { ITEM_SCHEMA, cleanItem, computeTargets, mealForHour } from "@/lib/nutrition";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/types";

type SB = Awaited<ReturnType<typeof supabaseServer>>;

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
    name: "registrar_refeicao",
    description: "Registra no diário alimentar o que o usuário comeu, com porção e macros estimados por item. Use quando ele contar o que comeu ou bebeu.",
    input_schema: {
      type: "object",
      properties: {
        refeicao: { type: "string", enum: [...MEAL_TYPES], description: "cafe, almoco, lanche ou jantar" },
        data: { type: "string", description: "AAAA-MM-DD (padrão hoje)" },
        itens: { type: "array", items: ITEM_SCHEMA },
      },
      required: ["refeicao", "itens"],
    },
  },
  {
    name: "historico_exercicio",
    description: "Mostra as últimas sessões de um exercício (cargas e repetições) para orientar a progressão.",
    input_schema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
  },
];

async function activePlan(sb: SB) {
  const { data } = await sb.from("plans").select("id,name,plan_days(id,weekday,title,plan_exercises(id,position,sets,reps,target_weight,exercises(name)))").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as null | { id: string; name: string; plan_days: { id: string; weekday: number; title: string; plan_exercises: { id: string; position: number; sets: number; reps: string; target_weight: number | null; exercises: { name: string } }[] }[] };
}

async function runTool(sb: SB, userId: string, catalog: Ex[], name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "montar_semana") {
    const input2 = input as unknown as PlanInput;
    const r = await savePlan(sb, userId, catalog, input2);
    if (!r.ok) return "Erro ao criar o plano.";
    return `Plano salvo com ${r.days} dias: ${(input2.dias ?? []).map((d) => `${WEEKDAYS[d.dia_semana]} (${d.titulo})`).join(", ")}.`;
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
  if (name === "registrar_refeicao") {
    const meal = (MEAL_TYPES as readonly string[]).includes(String(input.refeicao)) ? (input.refeicao as MealType) : mealForHour(hourBR());
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(input.data ?? "")) ? String(input.data) : todayBR();
    const items = ((input.itens as Record<string, unknown>[]) ?? []).map(cleanItem).filter((x) => x !== null).slice(0, 20);
    if (!items.length) return "Nenhum alimento válido para registrar.";
    const { error } = await sb.from("meals").insert(items.map((it) => ({ ...it, portion: it.portion || null, meal, eaten_on: day, source: "chat" })));
    if (error) return "Erro ao salvar a refeição.";
    const tot = items.reduce((a, b) => a + b.kcal, 0);
    return `Registrado em ${MEAL_LABEL[meal]} (${day}): ${items.map((i) => i.name).join(", ")} — ${Math.round(tot)} kcal.`;
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

const todayBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const hourBR = () => Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })) % 24;

async function usage(sb: SB) {
  const { data: sub } = await sb.from("subscriptions").select("status").maybeSingle();
  const pro = isPro(sub);
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count } = await sb.from("ai_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", start.toISOString());
  return { pro, used: count ?? 0, limit: pro ? PRO_AI_MESSAGES : FREE_AI_MESSAGES };
}

export async function GET() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { data } = await sb.from("ai_messages").select("id,role,content,created_at").eq("hidden", false).order("created_at").limit(100);
  return NextResponse.json({ messages: data ?? [], usage: await usage(sb) });
}

export async function DELETE() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  // esconde em vez de apagar: o histórico some, mas a contagem do plano grátis continua valendo
  await sb.from("ai_messages").update({ hidden: true }).eq("user_id", u.user.id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada (falta ANTHROPIC_API_KEY)." }, { status: 503 });

  const u0 = await usage(sb);
  if (!u0.pro && u0.used >= FREE_AI_MESSAGES) {
    return NextResponse.json({ error: `Você usou as ${FREE_AI_MESSAGES} mensagens grátis deste mês.`, limit: true, usage: u0 }, { status: 402 });
  }
  if (u0.pro && u0.used >= PRO_AI_MESSAGES) {
    return NextResponse.json({ error: `Você chegou ao uso justo de ${PRO_AI_MESSAGES} mensagens neste mês. Volta no dia 1º — o resto do Pro continua liberado.`, usage: u0 }, { status: 429 });
  }

  const { message } = (await req.json()) as { message?: string };
  const text = (message ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "mensagem vazia" }, { status: 400 });

  const [profile, plan, hist, catalogRes, weight, mealsToday] = await Promise.all([
    sb.from("profiles").select("name,goal,weekly_goal,level,location,priority_muscles,pains,profession,session_minutes,height_cm,sex,birth_date,kcal_target,protein_target,carbs_target,fat_target,water_target_ml").eq("id", u.user.id).maybeSingle(),
    activePlan(sb),
    sb.from("ai_messages").select("role,content").eq("hidden", false).order("created_at", { ascending: false }).limit(16),
    sb.from("exercises").select("id,name,muscle_group,equipment,created_by").order("name"),
    sb.from("body_weights").select("measured_on,weight").order("measured_on", { ascending: false }).limit(3),
    sb.from("meals").select("meal,name,kcal,protein,carbs,fat").eq("eaten_on", todayBR()),
  ]);
  const targets = computeTargets(profile.data as never, weight.data?.[0]?.weight ?? null);
  const eaten = (mealsToday.data ?? []).reduce((a, m) => ({ kcal: a.kcal + Number(m.kcal), p: a.p + Number(m.protein), c: a.c + Number(m.carbs), g: a.g + Number(m.fat) }), { kcal: 0, p: 0, c: 0, g: 0 });
  const nutritionText = `Metas diárias: ${targets.kcal} kcal · ${targets.protein} g proteína · ${targets.carbs} g carboidrato · ${targets.fat} g gordura.
Comido hoje: ${Math.round(eaten.kcal)} kcal · ${Math.round(eaten.p)} g P · ${Math.round(eaten.c)} g C · ${Math.round(eaten.g)} g G${(mealsToday.data ?? []).length ? ` (${(mealsToday.data ?? []).map((m) => `${MEAL_LABEL[m.meal as MealType]}: ${m.name}`).join("; ")})` : " (nada registrado)"}.`;
  const catalog = (catalogRes.data ?? []) as Ex[];

  const planText = plan?.plan_days.length
    ? plan.plan_days
        .sort((a, b) => a.weekday - b.weekday)
        .map((d) => `- ${WEEKDAYS[d.weekday]}: ${d.title} → ${d.plan_exercises.sort((a, b) => a.position - b.position).map((e) => `${e.exercises.name} ${e.sets}x${e.reps}${e.target_weight ? ` ${e.target_weight}kg` : ""}`).join("; ")}`)
        .join("\n")
    : "(sem plano ainda)";

  // catálogo global em ordem fixa (vai no cache); exercícios do próprio usuário vão na parte variável
  const byGroup = new Map<string, string[]>();
  catalog.filter((e) => !(e as Ex & { created_by?: string | null }).created_by).forEach((e) => byGroup.set(e.muscle_group, [...(byGroup.get(e.muscle_group) ?? []), e.name]));
  const own = catalog.filter((e) => (e as Ex & { created_by?: string | null }).created_by);

  // parte fixa (igual pra todo mundo) → fica em cache na Anthropic e sai ~10x mais barata
  const staticPrompt = `Você é o assistente de treino e alimentação do app Carga: um personal trainer brasileiro com boa base de nutrição, direto, animado e prático. Responda em português do Brasil, curto (feito para ler no celular), sem enrolação.

Regras:
- Quando o usuário pedir para montar/refazer a semana, monte direto com a ferramenta montar_semana (não peça confirmação se o pedido estiver claro; se faltar o essencial, como quantos dias, assuma algo razoável e diga o que assumiu). Depois resuma o plano em poucas linhas.
- Para mudar só um dia, use ajustar_dia.
- Se o usuário disser o peso ou medidas, registre com a ferramenta.
- Volume típico: 3–4 séries, 6–12 reps para hipertrofia, 3–6 para força, 12–20 para resistência; 4–7 exercícios por dia.
- Se o usuário contar o que comeu, registre com registrar_refeicao (estime porção e macros com a Tabela TACO) e diga quanto falta para as metas do dia.
- Em dúvidas de alimentação, dê sugestões práticas com comida brasileira do dia a dia. Nada de dietas extremas, jejuns prolongados ou cortes radicais; se houver sinais de relação difícil com a comida, acolha e sugira um nutricionista ou profissional de saúde.
- Não dê diagnóstico médico. Em caso de dor ou lesão, recomende procurar um profissional de saúde.
- Não use markdown pesado: no máximo listas curtas com "-".

Catálogo de exercícios do app (use estes nomes exatos ao montar treinos):
${[...byGroup.entries()].map(([g, l]) => `${g}: ${l.join(" | ")}`).join("\n")}`;

  const userPrompt = `Hoje é ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}.

Usuário: ${profile.data?.name ?? "sem nome"} · objetivo: ${profile.data?.goal ?? "não informado"} · meta: ${profile.data?.weekly_goal ?? 4} treinos/semana · nível: ${profile.data?.level ?? "?"} · treina em: ${profile.data?.location ?? "?"} · tempo por treino: ${profile.data?.session_minutes ?? "?"} min · músculos prioritários: ${(profile.data?.priority_muscles ?? []).join(", ") || "nenhum"}${(profile.data as { pains?: string[] } | null)?.pains?.length ? ` · DORES/LESÕES: ${(profile.data as { pains: string[] }).pains.map(painLabel).join(", ")} (evite exercícios que forcem essas regiões e prefira alternativas seguras)` : ""}${profile.data?.height_cm ? ` · altura: ${profile.data.height_cm} cm` : ""}.
Peso recente: ${(weight.data ?? []).map((w) => `${w.weight} kg em ${w.measured_on}`).join(", ") || "não registrado"}.
${own.length ? `Exercícios criados pelo usuário: ${own.map((e) => `${e.name} (${e.muscle_group})`).join(" | ")}.\n` : ""}
Nutrição:
${nutritionText}

Plano atual:
${planText}`;

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: userPrompt },
  ];

  const history = (hist.data ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // o histórico também entra no cache: nas voltas das ferramentas ele é relido de graça
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: [{ type: "text", text, cache_control: { type: "ephemeral" } }] }];

  const client = new Anthropic();
  let changed = false;
  let link: { href: string; label: string } | null = null;
  let reply = "";
  try {
    for (let i = 0; i < 6; i++) {
      const res = await client.messages.create({
        model: chatModel(u0.pro),
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
        if (t.name !== "historico_exercicio") {
          changed = true;
          link =
            t.name === "registrar_refeicao" ? { href: "/nutricao", label: "ver nutrição" }
            : t.name === "registrar_peso" || t.name === "registrar_medidas" ? { href: "/medidas", label: "ver medidas" }
            : { href: "/treinos", label: "ver minha semana" };
        }
        results.push({ type: "tool_result", tool_use_id: t.id, content: out });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return aiError(e, "chat");
  }

  reply ||= "Pronto!";
  await sb.from("ai_messages").insert([
    { role: "user", content: text },
    { role: "assistant", content: reply },
  ]);
  return NextResponse.json({ reply, changed, link, usage: { ...u0, used: u0.used + 1 } });
}
