import type { Metadata } from "next";
import LegalShell from "@/components/public/LegalShell";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o canal trata os dados dos relatos, em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <LegalShell kicker="PRIVACIDADE" title="Como tratamos os seus dados.">
      <p>
        <strong>Conteúdo a ser preenchido pela organização antes da entrada em produção.</strong>{" "}
        Esta página precisa declarar, no mínimo: a base legal do tratamento, as finalidades, o prazo
        de retenção dos relatos, o contato do encarregado pelo tratamento de dados (DPO), o
        procedimento para exercício dos direitos do titular e a lista de suboperadores.
      </p>
      <p>
        No relato anônimo, nenhum nome, e-mail, telefone ou identificador é solicitado. O endereço
        de IP não é armazenado em texto claro pelo canal — apenas um valor derivado e irreversível,
        usado exclusivamente para limitar tentativas abusivas de consulta.
      </p>
    </LegalShell>
  );
}
