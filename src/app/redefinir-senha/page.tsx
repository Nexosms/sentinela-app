import type { Metadata } from "next";
import Brand from "@/components/brand/Brand";
import ConviteClient from "@/app/convite/ConviteClient";

export const metadata: Metadata = {
  title: "Nova senha",
  description: "Crie uma nova senha pelo link enviado por e-mail.",
  robots: { index: false, follow: false },
};

/**
 * Destino do e-mail de "Esqueci minha senha". Reaproveita a tela do convite
 * (mesmos três formatos de link, mesmo formulário), no modo que NÃO ativa
 * vínculo e encerra as outras sessões.
 */
export default function RedefinirSenhaPage() {
  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <span>REDEFINIÇÃO DE SENHA</span>
      </header>
      <ConviteClient modo="redefinicao" />
    </main>
  );
}
