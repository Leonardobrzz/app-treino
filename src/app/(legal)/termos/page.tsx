import type { Metadata } from "next";
import { LegalPage, Mail, OWNER, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de uso · Carga" };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" updated="9 de novembro de 2026">
      <p>
        Estes termos valem para o uso do Carga, app de registro de treinos disponível em carga.app.br. O Carga é oferecido por {OWNER}, com sede em Fortaleza/CE. Ao criar uma conta, você
        concorda com estes termos e com a <a href="/privacidade" className="font-semibold text-accent-ink">Política de privacidade</a>.
      </p>

      <Section n={1} title="O que é o Carga">
        <p>
          O Carga ajuda você a montar fichas de treino, registrar séries e cargas, acompanhar sua evolução, medidas e alimentação, e conversar com um assistente baseado em inteligência
          artificial (IA).
        </p>
      </Section>

      <Section n={2} title="Não é orientação médica">
        <p>
          As sugestões de treino, cargas, metas de calorias e as estimativas de nutrição por foto são <b className="text-label">informativas</b> e podem conter erros. Elas não substituem
          avaliação de médico, educador físico ou nutricionista. Procure um profissional antes de começar ou mudar sua rotina, principalmente se tiver lesões, dores ou alguma condição de
          saúde. Pare o exercício se sentir dor, tontura ou mal-estar.
        </p>
      </Section>

      <Section n={3} title="Sua conta">
        <ul className="list-disc space-y-1 pl-5">
          <li>Você precisa ter pelo menos 18 anos para usar o Carga.</li>
          <li>Use um e-mail válido e mantenha sua senha em segredo. Você é responsável pelo que for feito na sua conta.</li>
          <li>Não use o app para fins ilegais, para tentar invadir o sistema, sobrecarregar a IA de forma automatizada ou revender o serviço.</li>
          <li>Podemos suspender contas que violem estes termos.</li>
        </ul>
      </Section>

      <Section n={4} title="Plano gratuito e plano Pro">
        <ul className="list-disc space-y-1 pl-5">
          <li>O plano gratuito tem os recursos básicos e um número limitado de usos da IA.</li>
          <li>
            O Pro é uma assinatura mensal ou anual, com os preços mostrados na tela do Pro no momento da compra. O pagamento é processado pela Stripe; não guardamos os dados do seu
            cartão.
          </li>
          <li>Quando houver período de teste grátis, a primeira cobrança acontece só ao fim dele. Se cancelar antes, não é cobrado.</li>
          <li>A assinatura renova automaticamente ao fim de cada período, até você cancelar.</li>
          <li>
            Os recursos de IA do Pro seguem uma política de uso justo (por exemplo, um limite mensal de mensagens e diário de análises), informada no app, para manter o serviço estável para
            todos.
          </li>
          <li>Podemos mudar preços no futuro. Se isso acontecer, avisamos antes e o novo valor só vale a partir da renovação seguinte.</li>
        </ul>
      </Section>

      <Section n={5} title="Cancelamento e reembolso">
        <ul className="list-disc space-y-1 pl-5">
          <li>Você pode cancelar quando quiser em Perfil → Carga Pro → Gerenciar assinatura. O acesso Pro continua até o fim do período já pago.</li>
          <li>
            Se você se arrepender, pode pedir reembolso integral em até 7 dias depois da primeira cobrança, conforme o Código de Defesa do Consumidor. Basta escrever para <Mail />.
          </li>
          <li>Fora desse prazo, não há reembolso proporcional de períodos já iniciados, salvo falha nossa que impeça o uso do serviço.</li>
        </ul>
      </Section>

      <Section n={6} title="Seu conteúdo">
        <p>
          Seus treinos, medidas, fotos e registros são seus. Você nos autoriza a armazená-los e processá-los apenas para fazer o app funcionar, como explicado na Política de privacidade.
          Você pode apagar registros no app ou pedir a exclusão da conta a qualquer momento.
        </p>
      </Section>

      <Section n={7} title="Disponibilidade">
        <p>
          Trabalhamos para manter o Carga no ar, mas ele pode ter instabilidades, manutenções ou mudanças de recursos. Os serviços de IA dependem de fornecedores externos e podem ficar
          indisponíveis temporariamente. Nesses casos, a responsabilidade se limita ao valor pago por você nos últimos 3 meses, respeitados os seus direitos de consumidor.
        </p>
      </Section>

      <Section n={8} title="Mudanças nestes termos">
        <p>Podemos atualizar estes termos. Mudanças importantes serão avisadas no app ou por e-mail. Continuar usando o Carga depois disso significa que você concorda com a nova versão.</p>
      </Section>

      <Section n={9} title="Contato e foro">
        <p>
          Dúvidas, pedidos de reembolso ou reclamações: <Mail />. Estes termos seguem as leis brasileiras, e fica eleito o foro do domicílio do consumidor.
        </p>
      </Section>
    </LegalPage>
  );
}
