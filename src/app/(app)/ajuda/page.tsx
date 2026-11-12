"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Header, Icon, Segmented, type IconName } from "@/components/ui";

type Item = { q: string; a: string; href?: string; go?: string };
type Section = { title: string; icon: IconName; items: Item[] };

const ALUNO: Section[] = [
  {
    title: "Começando",
    icon: "compass",
    items: [
      { q: "Como monto meu treino?", a: "Em Treinos, toque em um dia da semana e adicione os exercícios com séries, repetições e carga. Se preferir, use \"Montar com IA\" e descreva o que quer (ex.: ABC, 4x na semana) ou importe a foto da ficha da academia.", href: "/treinos", go: "Abrir Treinos" },
      { q: "Como registro um treino?", a: "Na tela Hoje, toque em \"Iniciar treino\". Em cada exercício, confira a carga e marque cada série quando terminar. No fim, finalize pra salvar e ver o resumo.", href: "/", go: "Ir pra Hoje" },
      { q: "Tenho dor ou lesão. O treino automático leva isso em conta?", a: "Sim. No cadastro (ou em Perfil → Dores ou lesões) marque onde sente dor. O app tira os exercícios que mais forçam a região e coloca cuidados nos que ficam. Mesmo assim, confirme o treino com um personal ou fisioterapeuta.", href: "/perfil", go: "Abrir Perfil" },
      { q: "O que é a sugestão de carga?", a: "O app olha o que você fez nas últimas vezes. Se você bateu todas as repetições com folga, ele sugere subir a carga. O aviso aparece na tela Hoje e dentro do treino.", },
      { q: "Pra que serve o check-in?", a: "É pra marcar que você foi à academia num dia em que não registrou o treino no app. Ele conta pra sua meta da semana e pra sequência.", href: "/", go: "Ir pra Hoje" },
    ],
  },
  {
    title: "Evolução e comida",
    icon: "chart",
    items: [
      { q: "Onde vejo minha evolução?", a: "Na aba Evolução: volume, recordes, séries por músculo e a força de cada exercício. No começo da semana chega um resumo da semana anterior na tela Hoje.", href: "/evolucao", go: "Abrir Evolução" },
      { q: "Como registro meu peso e medidas?", a: "Em Perfil → Peso e medidas. Com o peso, o app calcula suas metas de calorias, proteína e água.", href: "/medidas", go: "Abrir Peso e medidas" },
      { q: "Como anoto o que comi?", a: "Na tela Hoje, toque no card de Nutrição. Tire uma foto do prato ou descreva o que comeu, e a IA separa cada alimento com calorias e macros. A água fica na mesma tela.", href: "/nutricao", go: "Abrir Nutrição" },
    ],
  },
  {
    title: "Personal",
    icon: "users",
    items: [
      { q: "Como entro no app do meu personal?", a: "Abra o link que ele mandou, ou vá em Perfil → Meu personal e digite o código dele. Ele passa a ver seus treinos, peso e fotos, e pode te mandar treino, avaliação e cobrança. Você sai quando quiser.", href: "/meu-personal", go: "Abrir Meu personal" },
      { q: "Onde fica o treino que o personal mandou?", a: "Ele vira seu treino ativo e aparece em Treinos com um aviso no topo. O método de cada exercício (bi-set, drop etc.) aparece no próprio treino.", href: "/treinos", go: "Abrir Treinos" },
      { q: "Como pago o personal?", a: "Em Meu personal, a cobrança aberta tem o Pix copia e cola e o QR Code. O dinheiro vai direto pra chave dele. Depois é só mandar o comprovante pelo app.", href: "/meu-personal", go: "Abrir Meu personal" },
    ],
  },
  {
    title: "Amigos e feed",
    icon: "feed",
    items: [
      { q: "Como posto no feed?", a: "No fim do treino, toque em \"Postar no feed\", ou abra a aba Feed e toque no +. Só seus amigos veem.", href: "/feed", go: "Abrir Feed" },
      { q: "Como adiciono amigos?", a: "No Feed, toque no ícone de amigos no topo e mande seu link de convite. Quando a pessoa entrar, vocês aparecem um pro outro.", href: "/amigos", go: "Abrir Amigos" },
    ],
  },
];

const PERSONAL: Section[] = [
  {
    title: "Começando",
    icon: "compass",
    items: [
      { q: "Como ativo a área do personal?", a: "Em Perfil → Sou personal trainer. Preencha CREF, cidade, WhatsApp e chave Pix. Ela é grátis por enquanto.", href: "/personal/perfil", go: "Abrir meu perfil de personal" },
      { q: "Como coloco um aluno?", a: "Em Alunos, mande o convite (link ou código). Se o aluno ainda não tem o app, use \"Cadastrar aluno sem app\": você já avalia, fotografa, monta o treino e cobra. Quando ele entrar pelo link, tudo vai pra conta dele.", href: "/personal/alunos", go: "Abrir Alunos" },
      { q: "O que o Painel mostra?", a: "No topo, o próximo passo mais importante (cobrança atrasada, aula de hoje, aluno sumido). Embaixo, quem precisa de atenção, com mensagens prontas no WhatsApp, e quem está mandando bem.", href: "/personal", go: "Abrir Painel" },
    ],
  },
  {
    title: "Dentro do aluno",
    icon: "user",
    items: [
      { q: "Como está organizada a página do aluno?", a: "Quatro abas. Resumo: frequência, cargas, peso e o diário alimentar. Treino: a ficha e as orientações de alimentação. Avaliação: avaliação física, anamnese e fotos. Financeiro: mensalidade e cobranças." },
      { q: "Como monto e envio o treino?", a: "Na aba Treino, toque em Montar: no automático pelo perfil do aluno, com a IA (ela lê anamnese e avaliação) ou pela foto de uma ficha de papel. Ajuste e toque em Enviar. Também dá pra baixar o PDF da ficha." },
      { q: "Como faço a avaliação física?", a: "Em Avaliação → Física → Nova avaliação. Ela é dividida em categorias: composição corporal (Pollock 3 ou 7 dobras), perimetria, cardiorrespiratória (esteira escalonada, Bruce, Cooper, Rockport, banco ou caminhada de 6 min, com explicação de cada protocolo), funcional do movimento (FMS, 7 testes de 0 a 3), postural com grade e fotos. Preencha só as que fizer." },
      { q: "Como vejo a evolução entre avaliações?", a: "Em Avaliação → Física, toque em Relatório de evolução, marque 2 ou mais avaliações e veja os gráficos: composição corporal, gordura, peso, VO2, FMS e perimetria. Dá pra baixar em PDF." },
      { q: "Onde aparecem a profissão e as dores do aluno?", a: "No topo da página do aluno. Toque ali pra editar. O aluno também informa na anamnese e no perfil dele, e o treino automático e a IA evitam exercícios que forçam essas regiões." },
      { q: "Como tiro as fotos de progresso?", a: "Em Avaliação → Fotos → Tirar fotos de progresso. A câmera abre pra frente, lado e costas. As fotos que o aluno tirar no app também aparecem aqui." },
      { q: "E a anamnese?", a: "Em Avaliação → Anamnese, mande pro aluno responder no app. Se ele não tem o app ou está com você, toque em \"Preencher agora com o aluno\"." },
    ],
  },
  {
    title: "Dinheiro e agenda",
    icon: "pix",
    items: [
      { q: "Como cobro meus alunos?", a: "Na aba Financeiro do aluno, defina mensalidade e dia do vencimento. O Carga cria a cobrança 5 dias antes e avisa o aluno. O Pix cai direto na sua chave, sem passar pelo Carga. Dá pra mandar o Pix no WhatsApp e marcar como paga.", href: "/personal/cobrancas", go: "Abrir Cobranças" },
      { q: "Como marco aulas?", a: "Em Agenda, toque em + e escolha aluno, dia e horário. O aluno recebe aviso no celular.", href: "/personal/agenda", go: "Abrir Agenda" },
      { q: "Dá pra colocar minha logo e minha cor?", a: "Sim. Em Meu perfil → Sua marca, escolha a cor e envie a logo. Seus alunos passam a ver o app com a sua cor e a sua logo, e os PDFs saem com a sua marca.", href: "/personal/perfil", go: "Abrir meu perfil" },
      { q: "Onde estão desafios e relatórios?", a: "No botão Mais, no menu da área do personal. Desafios fazem um ranking entre seus alunos; Relatórios geram o PDF do mês de cada um com seu nome e CREF." },
    ],
  },
];

export default function HelpPage() {
  const [who, setWho] = useState<"aluno" | "personal">("aluno");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("p") === "personal") setWho("personal");
  }, []);
  const sections = who === "aluno" ? ALUNO : PERSONAL;

  return (
    <>
      <Header title="Como usar" back={{ href: who === "personal" ? "/personal" : "/perfil", label: who === "personal" ? "Painel" : "Perfil" }} />
      <div className="px-5 pt-2">
        <Segmented<"aluno" | "personal">
          value={who}
          onChange={(v) => {
            setWho(v);
            setOpen(null);
          }}
          options={[{ value: "aluno", label: "Pra quem treina" }, { value: "personal", label: "Pra personal" }]}
        />
      </div>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="flex items-center gap-2 px-5 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-wide text-label-2">
            <Icon name={s.icon} size={15} /> {s.title}
          </h2>
          <div className="mx-5 overflow-hidden rounded-2xl bg-card">
            {s.items.map((it) => {
              const isOpen = open === it.q;
              return (
                <div key={it.q} className="border-b border-sep last:border-b-0">
                  <button onClick={() => setOpen(isOpen ? null : it.q)} aria-expanded={isOpen} className="press flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="flex-1 text-[16px] font-medium">{it.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="text-label-3">
                      <Icon name="chevron" size={16} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="flex flex-col gap-2.5 px-4 pb-4">
                          <p className="text-[15px] leading-relaxed text-label-2">{it.a}</p>
                          {it.href && (
                            <Link href={it.href} className="press flex w-fit items-center gap-1 text-[15px] font-semibold text-accent-ink">
                              {it.go} <Icon name="chevron" size={15} />
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="px-8 pb-4 pt-8 text-center text-[13px] leading-snug text-label-3">A apresentação inicial do app está em Perfil → Ver a apresentação de novo.</p>
    </>
  );
}
