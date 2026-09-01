import type { Metadata } from "next";
import Brand from "@/components/brand/Brand";
import ConviteClient from "./ConviteClient";

export const metadata: Metadata = {
  title: "Definir senha",
  description: "Primeiro acesso ao painel, por convite.",
  robots: { index: false, follow: false },
};

/**
 * Destino do link de convite. É o pedaço que faltava para o convite ser
 * utilizável: o GoTrue redireciona para cá com a sessão na URL, e sem uma tela
 * que a consuma o link não faz nada visível.
 *
 * Toda a lógica é cliente porque os tokens chegam no FRAGMENTO da URL
 * (`#access_token=…`), que o navegador nunca envia ao servidor.
 */
export default function ConvitePage() {
  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <span>PRIMEIRO ACESSO</span>
      </header>
      <ConviteClient />
    </main>
  );
}
