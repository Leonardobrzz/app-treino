import { MODEL_PRO } from "@/lib/ai-models";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { aiError } from "@/lib/ai-errors";
import { supabaseServer } from "@/lib/supabase/server";
import { isPro } from "@/lib/pro";
import { DAILY_SCANS, ITEM_SCHEMA, cleanItem } from "@/lib/nutrition";

export const maxDuration = 60;

const TOOL: Anthropic.Tool = {
  name: "registrar_alimentos",
  description: "Devolve os alimentos identificados com porção e macronutrientes estimados.",
  input_schema: {
    type: "object",
    properties: {
      e_comida: { type: "boolean", description: "false se a imagem/texto não mostrar comida ou bebida" },
      itens: { type: "array", items: ITEM_SCHEMA },
      observacao: { type: "string", description: "Uma frase curta e útil sobre a refeição (opcional)" },
    },
    required: ["e_comida", "itens"],
  },
};

const SYSTEM = `Você é um nutricionista brasileiro que estima calorias e macronutrientes de refeições a partir de uma foto ou descrição.
- Identifique cada alimento separadamente (ex.: arroz, feijão, frango grelhado, salada), em português do Brasil.
- Estime a porção com medidas caseiras e gramas, ex.: "4 colheres de sopa (100 g)". Na foto, use o tamanho do prato e talheres como referência.
- Use valores de referência brasileiros (Tabela TACO) e considere o preparo (frito, com óleo, com molho).
- Se o usuário informar quantidades na descrição, respeite-as.
- Seja realista: não arredonde tudo para baixo nem para cima.
- Se não for comida ou bebida, responda e_comida=false e itens vazio.
- A observação, se houver, deve ser neutra e prática (sem julgar a comida).
Sempre responda chamando a ferramenta registrar_alimentos.`;

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: sub } = await sb.from("subscriptions").select("status").maybeSingle();
  if (!isPro(sub)) return NextResponse.json({ error: "A análise com IA faz parte do Carga Pro.", pro: false }, { status: 402 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "A IA ainda não foi configurada." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { image?: string; mime?: string; text?: string };
  const text = (body.text ?? "").trim().slice(0, 1000);
  const image = typeof body.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : "";
  const mime = (["image/jpeg", "image/png", "image/webp"] as const).find((m) => m === body.mime) ?? "image/jpeg";
  if (!image && !text) return NextResponse.json({ error: "Mande uma foto ou descreva a refeição." }, { status: 400 });
  if (image.length > 6_000_000) return NextResponse.json({ error: "Foto muito grande." }, { status: 413 });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await sb.from("nutrition_scans").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= DAILY_SCANS) return NextResponse.json({ error: `Você chegou ao limite de ${DAILY_SCANS} análises em 24 h. Dá pra registrar manualmente enquanto isso.` }, { status: 429 });

  const content: Anthropic.ContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: mime, data: image } });
  content.push({ type: "text", text: text ? `Descrição do usuário: ${text}` : "Identifique os alimentos desta refeição." });

  let input: { e_comida?: boolean; itens?: Record<string, unknown>[]; observacao?: string } = {};
  try {
    const res = await new Anthropic().messages.create({
      model: MODEL_PRO,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content }],
    });
    const tool = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    input = (tool?.input ?? {}) as typeof input;
  } catch (e) {
    return aiError(e, "foto do prato");
  }

  await sb.from("nutrition_scans").insert({ kind: image ? "foto" : "texto" });

  const items = (input.itens ?? []).map(cleanItem).filter((x) => x !== null).slice(0, 20);
  if (input.e_comida === false || !items.length) {
    return NextResponse.json({ items: [], note: "Não consegui identificar comida aqui. Tente outra foto ou descreva o que comeu." });
  }
  return NextResponse.json({ items, note: String(input.observacao ?? "").slice(0, 240) });
}
