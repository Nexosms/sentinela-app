import type { Metadata } from "next";
import LegalShell from "@/components/public/LegalShell";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso do canal de denúncias.",
};

/**
 * Rascunho escrito para substituir o placeholder de entrega ("conteúdo a ser
 * preenchido pela organização"). Cobre os pontos que o próprio placeholder
 * listava como pendentes. Precisa de revisão jurídica/compliance antes de
 * valer como política oficial — não é aconselhamento jurídico.
 */
export default function TermosPage() {
  return (
    <LegalShell kicker="TERMOS DE USO" title="Condições de uso do canal.">
      <p>
        Este canal é disponibilizado por <strong>Canal de Prevenção e Gestão de Riscos
        Organizacionais Ltda.</strong> (CNPJ 68.843.115/0001-81) para o recebimento de relatos
        relacionados ao ambiente de trabalho, em conformidade com a Lei nº 14.457/2022 e as Normas
        Regulamentadoras NR-01, NR-05 e NR-17.
      </p>
      <p>
        <strong>Relato de boa-fé.</strong> Espera-se que quem relata o faça de boa-fé, com base em
        fatos que acredita serem verdadeiros. Relatos manifestamente falsos, feitos com a intenção
        de prejudicar terceiros, não estão protegidos por este canal e podem ser encaminhados às
        medidas cabíveis.
      </p>
      <p>
        <strong>Não retaliação.</strong> É vedada qualquer forma de retaliação contra quem relata
        de boa-fé — incluindo demissão, rebaixamento, perseguição ou qualquer outro prejuízo
        funcional. Situações de retaliação podem, elas próprias, ser objeto de um novo relato.
      </p>
      <p>
        <strong>O que este canal não é.</strong> Este canal não é um serviço de emergência. Em
        situações de risco imediato à vida ou à integridade física, procure o 190, o 192 ou uma
        rede de apoio próxima antes de registrar um relato aqui.
      </p>
      <p>
        <strong>Fluxo de apuração.</strong> Todo relato recebido é classificado em até 72 horas.
        Quando há indícios suficientes, abre-se uma apuração, conduzida com meta de conclusão em
        até 30 dias corridos. Quem relata pode acompanhar o andamento e responder pedidos de
        informação usando o protocolo e a chave privada recebidos no envio, sem necessidade de
        criar conta.
      </p>
      <p>
        O uso deste canal para fins diversos do relato de boa-fé de situações relacionadas ao
        trabalho — incluindo spam, testes automatizados ou tentativas de acesso não autorizado —
        não é permitido e pode ser bloqueado.
      </p>
    </LegalShell>
  );
}
