import type { Metadata } from "next";
import Brand from "@/components/brand/Brand";
import EsqueciForm from "./EsqueciForm";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  description: "Receba por e-mail um link para criar uma nova senha.",
  robots: { index: false, follow: false },
};

export default function EsqueciSenhaPage() {
  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <span>ÁREA ADMINISTRATIVA</span>
      </header>
      <section className="track-card">
        <span className="section-kicker">ACESSO RESTRITO</span>
        <h1>Esqueci minha senha.</h1>
        <p>
          Informe o e-mail do seu acesso. Se ele existir, você recebe uma mensagem com o link para criar uma
          nova senha.
        </p>
        <EsqueciForm />
      </section>
    </main>
  );
}
