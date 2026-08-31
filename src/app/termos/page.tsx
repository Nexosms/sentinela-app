import type { Metadata } from "next";
import LegalShell from "@/components/public/LegalShell";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso do canal de denúncias.",
};

export default function TermosPage() {
  return (
    <LegalShell kicker="TERMOS DE USO" title="Condições de uso do canal.">
      <p>
        <strong>Conteúdo a ser preenchido pela organização antes da entrada em produção.</strong>{" "}
        Deve cobrir: o compromisso de relato de boa-fé, a política de não retaliação, o que o canal
        não é (não é serviço de emergência), o tratamento de relatos manifestamente falsos, e o
        fluxo de apuração.
      </p>
    </LegalShell>
  );
}
