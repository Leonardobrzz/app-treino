// Qual modelo do Claude cada uso chama.
// Pro (e tudo que lê imagem): Sonnet, o mais inteligente.
// Plano grátis no assistente: Haiku, bem mais barato e rápido pra perguntas simples.
export const MODEL_PRO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const MODEL_FREE = process.env.ANTHROPIC_MODEL_FREE || "claude-haiku-5-5";

export const chatModel = (pro: boolean) => (pro ? MODEL_PRO : MODEL_FREE);
