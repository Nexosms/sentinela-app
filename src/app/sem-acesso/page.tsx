import type { Metadata } from "next";
import Brand from "@/components/brand/Brand";
import SignOutButton from "@/components/admin/SignOutButton";

export const metadata: Metadata = {
  title: "Sem acesso",
  robots: { index: false, follow: false },
};

export default function SemAcessoPage() {
  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <span>ACESSO NÃO AUTORIZADO</span>
      </header>
      <section className="track-card">
        <span className="section-kicker">CONTA SEM VÍNCULO</span>
        <h1>Sua conta não tem acesso ativo.</h1>
        <p>
          Você está autenticado, mas não há vínculo ativo com nenhuma organização. Isso acontece
          quando o convite ainda não foi concluído ou quando o acesso foi revogado.
        </p>
        <p>Procure a pessoa responsável pelo canal na sua organização.</p>
        <SignOutButton />
      </section>
    </main>
  );
}
