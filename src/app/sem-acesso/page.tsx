import type { Metadata } from "next";
import Link from "next/link";

import SignOutButton from "@/components/admin/SignOutButton";
import Brand from "@/components/brand/Brand";
import { Alert, ArrowLeft, Check, Lock, User } from "@/components/public/icons";

import "../login/login.css";

export const metadata: Metadata = {
  title: "Sem acesso",
  robots: { index: false, follow: false },
};

export default function SemAcessoPage() {
  return (
    <div className="lg">
      <aside className="lg-side">
        <Brand />
        <div className="lg-mid">
          <h2>
            Seu acesso ainda não foi <em>liberado.</em>
          </h2>
          <p>Sua conta está autenticada, mas falta o vínculo com uma organização.</p>
          <ol className="lg-steps" aria-hidden="true">
            <li className="ok">
              <i>
                <Check size={16} />
              </i>
              <div>
                <b>Conta autenticada</b>
                <small>Você entrou com e-mail e senha.</small>
              </div>
            </li>
            <li className="now pend">
              <i>
                <Alert size={16} />
              </i>
              <div>
                <b>Vínculo com a organização</b>
                <small>Pendente: ainda não há acesso ativo.</small>
              </div>
            </li>
            <li>
              <i>
                <Lock size={16} />
              </i>
              <div>
                <b>Acesso ao painel</b>
                <small>Liberado depois que o vínculo estiver ativo.</small>
              </div>
            </li>
          </ol>
        </div>
        <p className="lg-foot">ÁREA RESTRITA · NÃO INDEXADA</p>
      </aside>

      <main className="lg-main">
        <div className="lg-top">
          <span className="lg-chip">
            <Lock size={17} /> ACESSO NÃO AUTORIZADO
          </span>
          <Link className="lg-back" href="/">
            <ArrowLeft size={18} />
            <span>Voltar ao site</span>
          </Link>
        </div>
        <div className="lg-center">
          <section className="lg-card lg-card-wide">
            <span className="lg-kicker">CONTA SEM VÍNCULO</span>
            <h1>Sua conta não tem acesso ativo.</h1>
            <p className="lg-sub">
              Você está autenticado, mas não há vínculo ativo com nenhuma organização. Isso acontece
              quando o convite ainda não foi concluído ou quando o acesso foi revogado.
            </p>
            <div className="lg-next">
              <span className="lg-next-ic" aria-hidden="true">
                <User size={20} />
              </span>
              <div>
                <b>O que fazer agora</b>
                <p>Procure a pessoa responsável pelo canal na sua organização.</p>
              </div>
            </div>
            <div className="lg-actions">
              <SignOutButton variant="page" />
              <Link className="lg-text" href="/">
                Voltar ao site
              </Link>
            </div>
          </section>
        </div>
        <p className="lg-note">Este painel não é indexado e não pode ser acessado sem vínculo ativo.</p>
      </main>
    </div>
  );
}
