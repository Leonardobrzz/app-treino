import type { Metadata } from "next";
import { LegalPage, Mail, OWNER, Section } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de privacidade · Carga" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" updated="11 de novembro de 2026">
      <p>
        Esta política explica quais dados o Carga coleta, para que usa e quais são seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). O controlador dos
        dados é {OWNER}. Contato do encarregado: <Mail />.
      </p>

      <Section n={1} title="Dados que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-label">Conta:</b> nome, e-mail e senha (guardada de forma criptografada; nem nós conseguimos vê-la).</li>
          <li>
            <b className="text-label">Perfil físico:</b> sexo, data de nascimento, altura, peso, peso-alvo, nível, objetivo, dias e local de treino, que você informa na configuração inicial.
          </li>
          <li><b className="text-label">Treinos:</b> fichas, exercícios, séries, cargas, check-ins e como você estava no dia (disposição e áreas com dor, se você informar).</li>
          <li><b className="text-label">Corpo e alimentação:</b> medidas, refeições, água, metas de nutrição e fotos de progresso.</li>
          <li><b className="text-label">IA:</b> mensagens trocadas com o assistente e fotos de pratos ou de fichas enviadas para análise.</li>
          <li><b className="text-label">Social:</b> seu código de amigo, a lista de amigos que você adicionar e o que você postar no feed (fotos, legendas, curtidas e comentários).</li>
          <li>
            <b className="text-label">Personal trainer:</b> se você entrar como aluno de um personal, a anamnese que responder, avaliações físicas (dobras, medidas e fotos de postura), cobranças,
            comprovantes e aulas marcadas. Se você for personal, sua chave Pix, CREF, cidade e WhatsApp.
          </li>
          <li><b className="text-label">Notificações:</b> o endereço técnico do seu aparelho para enviar avisos, se você ativar.</li>
          <li>
            <b className="text-label">Assinatura:</b> status do plano e identificadores da Stripe. Os dados do cartão ficam com a Stripe; não temos acesso a eles.
          </li>
          <li><b className="text-label">Técnicos:</b> registros de acesso e erros (como IP e navegador), necessários para segurança e para o app funcionar.</li>
        </ul>
        <p>Não usamos cookies de publicidade nem vendemos seus dados.</p>
      </Section>

      <Section n={2} title="Para que usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fazer o app funcionar: salvar seus treinos, calcular evolução, metas e resumos (execução do contrato).</li>
          <li>Gerar fichas, respostas e estimativas de nutrição com IA quando você pede (execução do contrato).</li>
          <li>Processar pagamentos e manter sua assinatura (execução do contrato e obrigações legais).</li>
          <li>Enviar e-mails da conta, como confirmação de cadastro e troca de senha (execução do contrato).</li>
          <li>Prevenir abuso e manter a segurança (legítimo interesse).</li>
        </ul>
        <p>
          Peso, medidas, fotos do corpo, alimentação e dores podem ser considerados dados de saúde, que a LGPD trata como sensíveis. Só tratamos esses dados porque você os informa por
          vontade própria, com consentimento, para usar os recursos que dependem deles. Você pode apagá-los a qualquer momento.
        </p>
      </Section>

      <Section n={3} title="Com quem compartilhamos">
        <p>Apenas com fornecedores necessários para o app funcionar, que tratam os dados em nosso nome:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-label">Supabase:</b> banco de dados, login e armazenamento de fotos.</li>
          <li><b className="text-label">Vercel:</b> hospedagem do app.</li>
          <li>
            <b className="text-label">Anthropic:</b> modelo de IA (Claude). Recebe só o conteúdo necessário para responder (sua mensagem, foto enviada e um resumo do seu perfil e treinos). Pelos
            termos comerciais da Anthropic, esses dados não são usados para treinar os modelos dela.
          </li>
          <li><b className="text-label">Stripe:</b> pagamentos.</li>
          <li><b className="text-label">Resend:</b> envio de e-mails.</li>
        </ul>
        <p>
          Quando você entra como aluno de um personal pelo link ou código dele, esse personal passa a ver seus treinos, cargas, peso, medidas, fotos de progresso, anamnese e avaliações, para
          acompanhar você. Você pode sair a qualquer momento em “Meu personal”, e ele deixa de ver tudo na hora. Fotos de antes e depois só vão para a vitrine pública do personal se você
          autorizar, e saem quando você desligar a autorização. Os pagamentos por Pix vão direto para a conta do personal; o Carga não recebe nem guarda esse dinheiro.
        </p>
        <p>
          Alguns desses fornecedores guardam dados fora do Brasil (por exemplo, nos Estados Unidos), com garantias contratuais de proteção, conforme a LGPD. Amigos que você adicionar veem
          apenas seu nome e o resumo do ranking da semana (número de treinos, séries, volume total e data do último treino) — nunca suas cargas por exercício, medidas, alimentação ou
          fotos.
        </p>
      </Section>

      <Section n={4} title="Fotos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fotos de progresso ficam em armazenamento privado, acessível só pela sua conta.</li>
          <li>Fotos de pratos e de fichas são enviadas à IA para análise e não são guardadas por nós; guardamos só o resultado (alimentos, calorias, exercícios).</li>
        </ul>
      </Section>

      <Section n={5} title="Por quanto tempo guardamos">
        <p>
          Enquanto sua conta existir. Se você pedir a exclusão, apagamos seus dados em até 30 dias, exceto o que a lei manda guardar (como registros de pagamento e de acesso, pelos prazos
          legais).
        </p>
      </Section>

      <Section n={6} title="Seus direitos">
        <p>Pela LGPD, você pode a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
          <li>corrigir dados incompletos ou errados (a maioria dá para editar no próprio app);</li>
          <li>pedir uma cópia dos seus dados;</li>
          <li>pedir a exclusão da conta e dos dados;</li>
          <li>retirar o consentimento para dados de saúde;</li>
          <li>reclamar na Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>
          Para exercer esses direitos, escreva para <Mail /> usando o e-mail da sua conta. Respondemos em até 15 dias.
        </p>
      </Section>

      <Section n={7} title="Segurança">
        <p>
          Usamos conexão criptografada (HTTPS), senhas criptografadas e regras de acesso no banco que impedem que um usuário veja os dados de outro. Nenhum sistema é 100% seguro; se houver
          um incidente que possa afetar você, avisaremos e comunicaremos a ANPD, como manda a lei.
        </p>
      </Section>

      <Section n={8} title="Idade mínima">
        <p>O Carga é destinado a maiores de 18 anos. Não coletamos dados de menores de idade de forma intencional.</p>
      </Section>

      <Section n={9} title="Mudanças nesta política">
        <p>Se mudarmos algo importante, avisaremos no app ou por e-mail antes de a mudança valer.</p>
      </Section>
    </LegalPage>
  );
}
