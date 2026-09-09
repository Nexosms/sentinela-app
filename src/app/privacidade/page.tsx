import type { Metadata } from "next";
import LegalShell from "@/components/public/LegalShell";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o canal trata os dados dos relatos, em conformidade com a LGPD.",
};

/**
 * Rascunho escrito para substituir o placeholder de entrega ("conteúdo a ser
 * preenchido pela organização"). Cobre os pontos que o próprio placeholder
 * listava como pendentes, com os números que já valem hoje (retenção,
 * prazos). Precisa de revisão jurídica/compliance antes de valer como
 * política oficial — não é aconselhamento jurídico.
 */
export default function PrivacidadePage() {
  return (
    <LegalShell kicker="PRIVACIDADE" title="Como tratamos os seus dados.">
      <p>
        Este canal é operado por <strong>Canal de Prevenção e Gestão de Riscos Organizacionais
        Ltda.</strong> (CNPJ 68.843.115/0001-81), em conformidade com a Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018) e com a Lei nº 14.457/2022, que trata dos canais de denúncia no
        ambiente de trabalho.
      </p>
      <p>
        No relato anônimo, nenhum nome, e-mail, telefone ou identificador é solicitado. O endereço
        de IP não é armazenado em texto claro pelo canal — apenas um valor derivado e irreversível,
        usado exclusivamente para limitar tentativas abusivas de consulta.
      </p>
      <p>
        <strong>Base legal e finalidade.</strong> O tratamento dos dados eventualmente fornecidos
        (no relato identificado) tem como base o cumprimento de obrigação legal e o legítimo
        interesse na prevenção e apuração de riscos ocupacionais, nos termos da NR-01. Os dados são
        usados exclusivamente para receber, triar, apurar e responder ao relato.
      </p>
      <p>
        <strong>Prazo de retenção.</strong> Os relatos e as evidências anexadas são retidos por até
        60 meses após o encerramento do caso, prazo após o qual entram no fluxo de expurgo. A
        trilha de auditoria — que registra apenas metadados, nunca o conteúdo do relato — não é
        expurgada.
      </p>
      <p>
        <strong>Prazos de atendimento.</strong> Todo relato é classificado em até 72 horas, e a
        apuração é conduzida com meta de conclusão em até 30 dias corridos, prorrogáveis conforme a
        complexidade do caso.
      </p>
      <p>
        <strong>Seus direitos.</strong> Quem relata de forma identificada pode solicitar acesso,
        correção ou eliminação dos próprios dados, dentro dos limites que preservam a integridade
        de uma apuração em andamento. Pedidos podem ser feitos pelo telefone (75) 9948-9071.
      </p>
      <p>
        Os dados são armazenados em infraestrutura de nuvem com criptografia em trânsito e em
        repouso, controle de acesso por papel e trilha de auditoria de todo acesso a evidências e a
        dados de identidade.
      </p>
    </LegalShell>
  );
}
