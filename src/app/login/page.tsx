import type { Metadata } from "next";
import Link from "next/link";

import Brand from "@/components/brand/Brand";
import { ArrowLeft, Lock, Mail } from "@/components/public/icons";

import LoginForm from "./LoginForm";
import LoginPreview from "./LoginPreview";
import "./login.css";

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
    <div className="lg">
      <aside className="lg-side">
        <Brand />
        <div className="lg-mid">
          <h2>
            Acompanhe cada relato, <em>com clareza.</em>
          </h2>
          <p>Indicadores, andamento e status das tratativas em um só lugar.</p>
          <LoginPreview />
        </div>
        <p className="lg-foot">ÁREA RESTRITA · NÃO INDEXADA</p>
      </aside>

      <main className="lg-main">
        <div className="lg-top">
          <span className="lg-chip">
            <Lock size={17} /> ÁREA ADMINISTRATIVA
          </span>
          <Link className="lg-back" href="/">
            <ArrowLeft size={18} />
            <span>Voltar ao site</span>
          </Link>
        </div>
        <div className="lg-center">
          <section className="lg-card">
            <span className="lg-kicker">ACESSO RESTRITO</span>
            <h1>Entrar no painel.</h1>
            <p className="lg-sub">Use o e-mail e a senha cadastrados no seu convite.</p>
            <LoginForm next={next} />
            <p className="lg-invite">
              <Mail size={18} />
              <span>
                O acesso é concedido por convite. Se você deveria ter acesso e ainda não recebeu,
                procure a pessoa responsável pelo canal na sua organização.
              </span>
            </p>
          </section>
        </div>
        <p className="lg-note">Este painel não é indexado e não pode ser acessado sem convite.</p>
      </main>
    </div>
  );
}
