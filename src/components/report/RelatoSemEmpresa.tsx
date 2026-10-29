"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";
import { ArrowLeft, Building, Search } from "@/components/public/icons";
import { caminhoDoRelato, useEmpresaLembrada } from "@/lib/report/empresaLembrada";

import ListeningPanel from "./ListeningPanel";

import "./wizard.css";

/**
 * `/relato` sem o link de uma empresa. Não existe empresa padrão: o relato é
 * sempre de uma empresa, e quem chega aqui sem o link dela não pode registrar
 * nada por engano em outra. Se a aba já abriu o link de uma empresa, volta para
 * ela; senão, pede o link que a empresa enviou.
 */
export default function RelatoSemEmpresa() {
  const router = useRouter();
  const slug = useEmpresaLembrada();

  useEffect(() => {
    if (slug) router.replace(caminhoDoRelato(slug));
  }, [slug, router]);

  return (
    <main className="wz">
      <header className="wz-header">
        <Brand />
        <button type="button" className="wz-exit" onClick={() => router.push("/")}>
          <ArrowLeft size={18} />
          <span>
            Voltar<span className="wz-ao"> ao canal</span>
          </span>
        </button>
      </header>
      <div className="wz-body">
        <ListeningPanel
          title="Cada relato é de uma empresa."
          text="Assim ele chega só à equipe que pode tratá-lo, com a confidencialidade que você espera."
          note="Nada foi escrito nem enviado até aqui."
        />
        <section className="form-card wz-card wz-sem-empresa">
          <span className="wz-kicker">ANTES DE COMEÇAR</span>
          <h1>Use o link da sua empresa.</h1>
          <p className="wz-lead">
            Para fazer um relato, abra o link que a sua empresa enviou. É ele que indica para qual
            empresa o relato será registrado.
          </p>
          <p className="wz-org">
            <Building size={18} />
            <span>
              Não encontrou o link? Peça ao RH ou à gestão da sua empresa. Ele tem o formato{" "}
              <strong>…/relato/nome-da-empresa</strong>.
            </span>
          </p>
          <div className="wz-actions wz-sem-empresa-a">
            <Link className="wz-back" href="/">
              <ArrowLeft size={18} /> Voltar ao início
            </Link>
            <Link className="wz-back" href="/acompanhar">
              <Search size={18} /> Acompanhar protocolo
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
