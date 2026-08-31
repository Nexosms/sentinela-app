import type { Metadata } from "next";
import LegalShell from "@/components/public/LegalShell";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description: "Recursos de acessibilidade do canal de denúncias.",
};

export default function AcessibilidadePage() {
  return (
    <LegalShell kicker="ACESSIBILIDADE" title="Recursos de acessibilidade.">
      <p>
        O canal pode ser percorrido inteiramente por teclado, com indicação visível de foco em todos
        os controles. O botão <strong>◐ Acessibilidade</strong>, no topo de cada página, amplia o
        texto e reforça o contraste.
      </p>
      <p>
        Se você encontrar uma barreira que o impeça de registrar um relato, informe a organização
        pelos canais de contato indicados na página de privacidade.
      </p>
    </LegalShell>
  );
}
