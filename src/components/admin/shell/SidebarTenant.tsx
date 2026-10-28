"use client";

import { iniciais } from "@/lib/admin/centralFila";
import type { MyOrganization } from "@/lib/org/context";

import TenantSwitchList from "../TenantSwitchList";
import { IconChevronDown, IconRadar } from "./AdminIcons";
import { useAdminShell } from "./AdminShellFrame";

/**
 * Cartão da empresa no topo do menu. Nas páginas da Central troca de cara ("Central de comando"),
 * porque ali a pessoa está olhando todas as empresas, não uma; nas demais mostra a empresa ativa.
 * Quem tem mais de uma empresa abre a lista de troca (o mesmo `TenantSwitchList` de antes).
 */
export default function SidebarTenant({
  orgName,
  roleText,
  doc,
  orgs,
  activeOrgId,
  pinnedSlug,
  central,
}: {
  orgName: string;
  roleText: string;
  doc: string;
  orgs: MyOrganization[];
  activeOrgId: string;
  pinnedSlug: string;
  /** Texto da Central; `null` quando a pessoa não tem Central. */
  central: { titulo: string; subtitulo: string } | null;
}) {
  const { pathname } = useAdminShell();
  const naCentral = central !== null && pathname.startsWith("/admin/central");

  const cartao = naCentral ? (
    <>
      <span className="ad-av ad-av-central" aria-hidden="true">
        <IconRadar size={22} />
      </span>
      <span className="ad-org-tx">
        <small>Central de comando</small>
        <strong>{central.titulo}</strong>
        <em>{central.subtitulo}</em>
      </span>
    </>
  ) : (
    <>
      <span className="ad-av" aria-hidden="true">
        {iniciais(orgName)}
      </span>
      <span className="ad-org-tx">
        <small>{roleText}</small>
        <strong>{orgName}</strong>
        <em>{doc}</em>
      </span>
    </>
  );

  if (orgs.length > 1) {
    return (
      <details className="ad-tenant">
        <summary className={`ad-org ${naCentral ? "central" : ""}`}>
          {cartao}
          <IconChevronDown />
        </summary>
        <TenantSwitchList orgs={orgs} activeOrgId={activeOrgId} pinnedSlug={pinnedSlug} />
      </details>
    );
  }

  return (
    <div className="ad-org static">
      {cartao}
    </div>
  );
}
