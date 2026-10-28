import type { Metadata } from "next";
import Link from "next/link";

import Brand from "@/components/brand/Brand";
import { Check, Lock, LoginIcon } from "@/components/public/icons";

import "../login/login.css";
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
    <div className="lg">
      <aside className="lg-side">
        <Brand />
        <div className="lg-mid">
          <h2>
            Falta pouco para <em>começar.</em>
          </h2>
          <p>Defina a sua senha e acesse o painel.</p>
          <ol className="lg-steps" aria-hidden="true">
            <li className="ok">
              <i>
                <Check size={16} />
              </i>
              <div>
                <b>Convite confirmado</b>
                <small>O link do seu convite foi aceito.</small>
              </div>
            </li>
            <li className="now">
              <i>2</i>
              <div>
                <b>Defina a sua senha</b>
                <small>É por ela que você volta nas próximas vezes.</small>
              </div>
            </li>
            <li>
              <i>3</i>
              <div>
                <b>Acesse o painel</b>
                <small>Entrada liberada logo depois de salvar.</small>
              </div>
            </li>
          </ol>
        </div>
        <p className="lg-foot">CONVITE PESSOAL · USO ÚNICO</p>
      </aside>

      <main className="lg-main">
        <div className="lg-top">
          <span className="lg-chip">
            <Lock size={17} /> PRIMEIRO ACESSO
          </span>
          <Link className="lg-back" href="/login">
            <LoginIcon size={18} />
            <span>Já tenho senha · Entrar</span>
          </Link>
        </div>
        <div className="lg-center">
          <ConviteClient />
        </div>
        <p className="lg-note">O link do convite serve uma vez só e vale por tempo limitado.</p>
      </main>
    </div>
  );
}
