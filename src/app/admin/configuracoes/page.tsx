import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import CategoriasPanel from "@/components/admin/configuracoes/CategoriasPanel";
import EquipePanel from "@/components/admin/configuracoes/EquipePanel";
import OrganizacaoPanel from "@/components/admin/configuracoes/OrganizacaoPanel";
import UnidadesPanel from "@/components/admin/configuracoes/UnidadesPanel";
import { getStaffContext, getRoleNavOverrides, roleLabel } from "@/lib/org/context";
import { CONFIGURACOES_ITEM, isNavVisible } from "@/lib/admin/navItems";
import {
  TABS,
  parseSettingsFilters,
  settingsHref,
  type SearchParams,
  type SettingsTab,
} from "@/lib/admin/configuracoes";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Configurações da organização em quatro áreas.
 *
 * ABAS POR `?aba=`, NÃO SUB-ROTAS — a decisão e o porquê estão em
 * `lib/admin/configuracoes.ts`, junto de `TABS`: o `layout.tsx` do App Router
 * não recebe `searchParams`, então sub-rotas repetiriam o cabeçalho em quatro
 * arquivos ou o esconderiam num layout cego à aba aberta. Com `?aba=` a página
 * segue um Server Component único, o link continua compartilhável, e
 * `.detail-tabs` — o vocabulário de aba que denúncias, investigações e planos
 * já usam — vale sem nenhuma regra nova de CSS.
 */

const HEADINGS: Record<SettingsTab, { title: string; lead: string }> = {
  organizacao: {
    title: "A sua organização.",
    lead:
      "Identificação, fuso, prazos de atendimento e as duas configurações que decidem por quanto tempo os dados ficam e quanto detalhe um relatório pode mostrar sem apontar para quem denunciou.",
  },
  unidades: {
    title: "Unidades e estabelecimentos.",
    lead:
      "A lista que o formulário público oferece a quem vai relatar, e o eixo de quase todo relatório. Unidade se desativa, não se apaga: os relatos já recebidos apontam para ela.",
  },
  categorias: {
    title: "Categorias do relato.",
    lead:
      "O catálogo da NR-01, da NR-05 e da Lei 14.457 vem pronto e é somente leitura. A organização pode acrescentar as suas quando o vocabulário interno exigir.",
  },
  equipe: {
    title: "Quem tem acesso.",
    lead:
      "O painel é só por convite. Aqui você vê quem entra, com que papel, convida quem falta e escolhe, por cargo, quais abas do menu admin cada um enxerga.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseSettingsFilters(await searchParams);
  const staff = await getStaffContext();
  const heading = HEADINGS[filters.aba];
  const overrides = await getRoleNavOverrides(staff.orgId);

  // A visibilidade da ABA é decidida pela grade de permissões (como qualquer
  // outro item do menu). A ESCRITA, porém, nunca depende disto: quem recusa
  // de verdade são `org_update`, `units_*`, `categories_*`, `members_update`
  // e `role_nav_permissions_write`, todas exigindo `admin` na RLS. Por isso
  // quem não é admin mas tem a aba liberada vê os quatro painéis em modo
  // leitura — mostrar formulários que o banco sempre recusaria é pior do que
  // dizer a verdade.
  const podeVer = isNavVisible(staff.role, CONFIGURACOES_ITEM, overrides);
  const somenteLeitura = staff.role !== "admin";

  if (!podeVer) {
    return (
      <>
        <AdminTopbar eyebrow="ORGANIZAÇÃO" title="Configurações" />
        <div className="placeholder">
          <span>⚙</span>
          <small>ACESSO RESTRITO À ADMINISTRAÇÃO</small>
          <h2>Configurações</h2>
          <p>
            Dados da organização, unidades, categorias e equipe são alterados apenas por quem tem o
            papel Administração. Procure quem administra o canal em {staff.orgName}.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar eyebrow="ORGANIZAÇÃO" title="Configurações" />
      <section className="form-card">
        <span className="section-kicker">{staff.orgName}</span>
        <h1>{heading.title}</h1>
        <p className="lead">{heading.lead}</p>

        {somenteLeitura ? (
          <div className="privacy-note">
            <b>Modo leitura</b>
            <p>
              Seu papel ({roleLabel(staff.role)}) tem esta aba liberada, mas só quem tem o papel
              Administração pode alterar dados aqui. Você vê tudo, sem os formulários de edição.
            </p>
          </div>
        ) : null}

        {/* Abas por URL: o conteúdo é do servidor e o link é compartilhável. */}
        <div className="detail-tabs">
          {TABS.map(tab => (
            <Link
              key={tab.key}
              href={settingsHref(tab.key)}
              className={filters.aba === tab.key ? "active" : ""}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {filters.aba === "organizacao" ? <OrganizacaoPanel readOnly={somenteLeitura} /> : null}
        {filters.aba === "unidades" ? (
          <UnidadesPanel filters={filters} readOnly={somenteLeitura} />
        ) : null}
        {filters.aba === "categorias" ? (
          <CategoriasPanel filters={filters} readOnly={somenteLeitura} />
        ) : null}
        {filters.aba === "equipe" ? <EquipePanel filters={filters} readOnly={somenteLeitura} /> : null}
      </section>
    </>
  );
}
