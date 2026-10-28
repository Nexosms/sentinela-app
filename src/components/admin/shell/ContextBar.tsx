"use client";

import Link from "next/link";

import { IconRadar } from "./AdminIcons";
import { useAdminShell } from "./AdminShellFrame";

/**
 * Faixa no topo quando a pessoa (que tem Central) está dentro de UMA empresa: diz qual é e leva de
 * volta à Central. Evita a confusão de "em qual empresa estou?". Não aparece na própria Central nem
 * nas telas de cadastro de clientes, que não são de uma empresa só.
 */
export default function ContextBar({ orgName, equipeNexo }: { orgName: string; equipeNexo: boolean }) {
  const { pathname } = useAdminShell();
  if (pathname.startsWith("/admin/central") || pathname.startsWith("/admin/clientes")) return null;

  return (
    <div className="ad-ctx" role="status">
      <span className="ad-ctx-dot" aria-hidden="true" />
      <b>Você está vendo a empresa {orgName}</b>
      {equipeNexo ? <span className="ad-ctx-sub">como equipe Nexo</span> : null}
      <Link className="ad-ctx-back" href="/admin/central">
        <IconRadar size={17} />
        Voltar à Central
      </Link>
    </div>
  );
}
