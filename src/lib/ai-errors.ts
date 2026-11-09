import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Transforma erros da API da Anthropic em mensagens claras pro usuário
 * e deixa um log com etiqueta [IA] pra achar fácil nos logs da Vercel.
 */
export function aiError(e: unknown, where: string) {
  let status = 502;
  let error = "A IA não respondeu agora. Tente de novo em instantes.";
  let kind = "desconhecido";

  if (e instanceof Anthropic.APIError) {
    const msg = String((e.error as { error?: { message?: string } } | undefined)?.error?.message ?? e.message ?? "").toLowerCase();
    if (e.status === 429) {
      kind = "limite_por_minuto";
      status = 429;
      error = "Muita gente usando a IA neste minuto. Espere uns segundos e tente de novo.";
    } else if (e.status === 529 || msg.includes("overloaded")) {
      kind = "sobrecarga";
      status = 503;
      error = "A IA está sobrecarregada agora. Tente de novo em 1 minuto.";
    } else if (msg.includes("credit balance") || msg.includes("billing") || e.status === 402) {
      kind = "sem_credito";
      status = 503;
      error = "A IA está em manutenção rápida. Já estamos resolvendo, tente de novo mais tarde.";
    } else if (e.status === 401 || e.status === 403) {
      kind = "chave_invalida";
      status = 503;
      error = "A IA está em manutenção rápida. Tente de novo mais tarde.";
    } else if (e.status === 400 && (msg.includes("image") || msg.includes("too large"))) {
      kind = "imagem";
      status = 422;
      error = "Não consegui ler essa imagem. Tente outra foto, mais nítida.";
    } else if (e.status === 400 && (msg.includes("prompt is too long") || msg.includes("context"))) {
      kind = "muito_longo";
      status = 422;
      error = "A conversa ficou longa demais. Toque em Limpar e tente de novo.";
    }
    console.error(`[IA] ${where} · ${kind} · status ${e.status} · ${e.message}`);
  } else {
    console.error(`[IA] ${where} · ${kind}`, e);
  }
  return NextResponse.json({ error, aiError: kind }, { status });
}
