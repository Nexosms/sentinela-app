import type { Metadata } from "next";
import Brand from "@/components/brand/Brand";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso restrito à equipe do canal.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <span>ÁREA ADMINISTRATIVA</span>
      </header>
      <section className="track-card">
        <span className="section-kicker">ACESSO RESTRITO</span>
        <h1>Entrar no painel.</h1>
        <p>
          O acesso é concedido por convite. Se você deveria ter acesso e ainda não recebeu o
          convite, procure a pessoa responsável pelo canal na sua organização.
        </p>
        <LoginForm next={next} />
        <small>Este painel não é indexado e não pode ser acessado sem convite.</small>
      </section>
    </main>
  );
}
