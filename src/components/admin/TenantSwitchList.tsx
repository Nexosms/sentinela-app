"use client";

import { useMemo, useState } from "react";

import { trocarOrganizacaoAtiva } from "@/lib/org/actions";
import { formatDocumento } from "@/lib/admin/configuracoes";
import type { MyOrganization } from "@/lib/org/context";

/** Sem acento e sem caixa: "natalia" acha "Natália". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Lista do seletor de empresa: ordem alfabética (A–Z), busca em tempo real e a
 * organização fixa (a Sentinela, a plataforma principal) sempre no topo —
 * qualquer que seja a busca, ela não sai da lista.
 */
export default function TenantSwitchList({
  orgs,
  activeOrgId,
  pinnedSlug,
}: {
  orgs: MyOrganization[];
  activeOrgId: string;
  pinnedSlug: string;
}) {
  const [busca, setBusca] = useState("");

  const { fixada, demais } = useMemo(() => {
    const termo = normalizar(busca);
    const digitos = busca.replace(/\D/g, "");
    const casa = (org: MyOrganization) =>
      termo === "" ||
      normalizar(org.tradeName).includes(termo) ||
      (digitos.length >= 3 && (org.cnpj ?? "").includes(digitos));

    const ordenadas = orgs
      .filter(org => org.slug !== pinnedSlug)
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR", { sensitivity: "base" }));

    return {
      fixada: orgs.find(org => org.slug === pinnedSlug) ?? null,
      demais: ordenadas.filter(casa),
    };
  }, [orgs, busca, pinnedSlug]);

  function item(org: MyOrganization) {
    return (
      <form action={trocarOrganizacaoAtiva} key={org.orgId}>
        <input type="hidden" name="orgId" value={org.orgId} />
        <button type="submit" className={org.orgId === activeOrgId ? "active" : ""}>
          {org.tradeName}
          <em className="tenant-doc">{formatDocumento(org.cnpj)}</em>
        </button>
      </form>
    );
  }

  return (
    <div className="tenant-switch-list">
      <input
        type="search"
        className="tenant-search"
        placeholder="Buscar empresa…"
        aria-label="Buscar empresa"
        value={busca}
        onChange={event => setBusca(event.target.value)}
      />
      <div className="tenant-switch-scroll">
        {fixada ? (
          <>
            {item(fixada)}
            <hr className="tenant-switch-divider" />
          </>
        ) : null}
        {demais.length > 0 ? (
          demais.map(item)
        ) : (
          <p className="tenant-switch-empty">Nenhuma empresa encontrada.</p>
        )}
      </div>
    </div>
  );
}
