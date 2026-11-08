# Carga — app de treino

App web (PWA) para registrar treinos, acompanhar a progressão de carga, medidas e peso, com uma IA embutida que monta a semana de treinos por texto ou voz. Visual inspirado nas diretrizes da Apple, com tema claro, escuro ou automático.

## O que tem

- **Conta**: cadastro, login, "esqueci a senha" por e-mail e criação de senha nova.
- **Hoje**: treino do dia, sequência de semanas, meta semanal, check-in e sugestões de carga.
- **Minha semana**: cada pessoa monta os próprios dias com exercícios, séries, repetições, carga, descanso e notas.
- **Biblioteca**: 134 exercícios em português, com busca e filtro por músculo. Também dá pra criar exercícios próprios.
- **Treino ao vivo**: séries já preenchidas com a carga sugerida, timer de descanso com vibração, calculadora de anilhas e resumo com recordes ao finalizar.
- **Progressão automática** (dupla progressão): quando todas as séries batem o topo da faixa de repetições, o app sugere subir a carga.
- **Evolução**: volume, treinos, recordes, 1RM estimado por exercício (Epley) e séries por músculo.
- **Peso e medidas**: registros em qualquer data, gráfico de peso mês a mês e um corpo anatômico que muda de cor e de forma conforme as medidas evoluem.
- **IA (Claude)**: monta ou ajusta a semana, registra peso e medidas e tira dúvidas. Aceita voz no navegador quando há suporte.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · Supabase (Auth + Postgres com RLS) · Claude API (`@anthropic-ai/sdk`).

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha ANTHROPIC_API_KEY
npm run dev
```

### Variáveis

| Variável | O que é |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (pode ficar no front) |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic, usada só no servidor (`/api/ia`) |
| `ANTHROPIC_MODEL` | Modelo do Claude (padrão `claude-sonnet-5-5`) |

### Banco

As migrações estão em `supabase/migrations/`. Num projeto novo, rode as duas no SQL Editor, em ordem, ou use `supabase db push`.

### Supabase Auth (obrigatório para os e-mails funcionarem)

Em **Authentication → URL Configuration**:
- **Site URL**: a URL onde o app está publicado (ex.: `https://carga.vercel.app`)
- **Redirect URLs**: `https://SEU-DOMINIO/auth/confirm` e `http://localhost:3000/auth/confirm`

O SMTP padrão do Supabase envia poucos e-mails por hora. Para produção, configure um SMTP próprio (Resend, por exemplo) em **Authentication → SMTP**.

## Estrutura

```
src/
  app/(auth)/        login, cadastro, esqueci-senha, nova-senha
  app/(app)/         telas com barra inferior: hoje, treinos, ia, evolucao, medidas, perfil
  app/(focus)/       treino ao vivo, em tela cheia
  app/api/ia/        rota do Claude, com ferramentas que gravam no banco
  components/        UI, corpo anatômico, gráfico, seletor de exercícios
  lib/               Supabase, tipos, progressão de carga, tema
supabase/migrations/ schema, RLS e catálogo de exercícios
```
