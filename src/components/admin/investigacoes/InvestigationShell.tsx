import type { ReactNode } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import Pager from "@/components/admin/shell/Pager";
import {
  INVESTIGATION_PATH,
  INV_STATUS_LABEL,
  INV_STATUS_ORDER,
  NO_LEAD,
  PAGE_SIZE,
  activeFilterCount,
  formatDateOnly,
  investigationHref,
  investigationQuery,
  investigationStatusClass,
  isPastDue,
  isReadyForReview,
  type InvestigationFilters,
} from "@/lib/admin/investigacoes";

/**
 * Casca do módulo de investigações: lista à esquerda, o que a rota mandar à
 * direita. É irmã de `InboxShell`, não uma extração dela — ver o comentário no
 * fim deste arquivo.
 *
 * Vive num componente e não num `layout.tsx` porque layouts do App Router não
 * recebem `searchParams`, e todo o estado desta tela mora na querystring.
 */

/** Sinais que a coordenação precisa ver sem abrir o caso. */
function flagsOf(
  inv: {
    planned_end: string | null;
    reviewed_at: string | null;
    findings: string | null;
    recommendation: string | null;
    outcome: "procedente" | "parcialmente_procedente" | "improcedente" | "inconclusiva" | null;
    lead_id: string | null;
  },
  today: string,
): string[] {
  const flags: string[] = [];
  if (isReadyForReview(inv)) flags.push("AGUARDANDO ASSINATURA");
  if (inv.reviewed_at === null && isPastDue(inv.planned_end, today)) flags.push("PRAZO VENCIDO");
  if (!inv.lead_id) flags.push("SEM CONDUÇÃO");
  return flags;
}

export default async function InvestigationShell({
  filters,
  selectedId,
  detail,
}: {
  filters: InvestigationFilters;
  selectedId?: string;
  detail: ReactNode;
}) {
  const supabase = await createClient();

  // Tudo sob RLS: `inv_read` já limita à organização e aos papéis que podem ver.
  let query = supabase
    .from("investigations")
    .select(
      `id, code, status, scope, planned_end, reviewed_at, findings, recommendation, outcome,
       lead_id, created_at, profiles!investigations_lead_id_fkey(full_name)`,
      { count: "exact" },
    );

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.responsavel === NO_LEAD) query = query.is("lead_id", null);
  else if (filters.responsavel) query = query.eq("lead_id", filters.responsavel);
  // `filters.q` já passou por `sanitizeQuery`: sem vírgula, ponto nem parêntese,
  // que é a gramática do `.or()` do PostgREST.
  if (filters.q) query = query.or(`code.ilike.*${filters.q}*,scope.ilike.*${filters.q}*`);

  const from = (filters.pagina - 1) * PAGE_SIZE;

  const { data: rows, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, profiles!org_members_user_id_fkey(full_name)")
    .eq("status", "active");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = activeFilterCount(filters);
  const list = rows ?? [];
  // Paginar com uma investigação aberta não deve fechá-la.
  const basePath = selectedId ? `${INVESTIGATION_PATH}/${selectedId}` : INVESTIGATION_PATH;
  // `planned_end` é `date`; o "hoje" precisa ser o de São Paulo, não o do servidor.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );

  return (
    <div className="inbox">
      {/* Filtros sem JavaScript: GET puro, para a página seguir Server Component. */}
      <form className="inbox-tools" method="get">
        {filters.aba !== "plano" ? <input type="hidden" name="aba" value={filters.aba} /> : null}
        <div className="searchbox">
          ⌕{" "}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar código ou escopo"
            aria-label="Buscar código ou escopo"
          />
        </div>
        <div className="searchbox">
          <select name="status" defaultValue={filters.status} aria-label="Filtrar por situação">
            <option value="">Todas as situações</option>
            {INV_STATUS_ORDER.map(status => (
              <option key={status} value={status}>
                {INV_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <select
            name="responsavel"
            defaultValue={filters.responsavel}
            aria-label="Filtrar por quem conduz"
          >
            <option value="">Todos os responsáveis</option>
            <option value={NO_LEAD}>Sem condução definida</option>
            {(members ?? []).map(member => (
              <option key={member.user_id} value={member.user_id}>
                {member.profiles?.full_name ?? member.user_id}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">
          Filtros{filterCount > 0 ? <b>{filterCount}</b> : null}
        </button>
      </form>

      <div className="inbox-layout">
        <section className="case-list">
          <div className="list-head">
            <span>
              {total} investigaç{total === 1 ? "ão" : "ões"}
            </span>
            <small>Mais recentes primeiro</small>
          </div>
          {list.map(inv => {
            const overdue = inv.reviewed_at === null && isPastDue(inv.planned_end, today);
            return (
              <Link
                key={inv.id}
                href={investigationHref(inv.id, filters)}
                className={inv.id === selectedId ? "active" : ""}
              >
                <div className="case-row-top">
                  <code>{inv.code}</code>
                  <span className={investigationStatusClass(inv.status)}>
                    {INV_STATUS_LABEL[inv.status]}
                  </span>
                </div>
                <strong>{inv.scope?.trim() || "Sem escopo definido"}</strong>
                <small>
                  {inv.profiles?.full_name ?? "Sem condução definida"} ·{" "}
                  <span className={overdue ? "danger" : undefined}>
                    {inv.planned_end ? `prazo ${formatDateOnly(inv.planned_end)}` : "sem prazo"}
                  </span>
                </small>
                <div className="case-flags">
                  {flagsOf(inv, today).map(flag => (
                    <i key={flag}>{flag}</i>
                  ))}
                </div>
              </Link>
            );
          })}
          {list.length === 0 ? (
            <div className="list-head">
              <span>Nenhuma investigação encontrada</span>
              <small>{filterCount > 0 ? "Revise os filtros" : "Nada foi aberto ainda"}</small>
            </div>
          ) : null}
        </section>

        {detail}
      </div>

      <Pager
        page={filters.pagina}
        pages={pages}
        hrefFor={page => `${basePath}${investigationQuery(filters, { pagina: page })}`}
      />
    </div>
  );
}

/*
 * Por que uma casca irmã e não uma extração de `InboxShell`:
 *
 * O que as duas telas compartilham é o VOCABULÁRIO do design system
 * (`.inbox`, `.inbox-layout`, `.case-list`, `.list-head`, `.case-row-top`,
 * `.case-flags`) — e esse vocabulário já é compartilhado, porque é CSS. O que
 * `InboxShell` tem de próprio é tudo o resto: a consulta a `reports`, o
 * full-text com o caminho especial de protocolo, o filtro de unidade e risco, o
 * botão Exportar e os sinalizadores de retaliação. Um componente genérico o
 * bastante para servir aos dois receberia a consulta, as colunas, os filtros e
 * o renderizador de linha por parâmetro — seria um construtor de tabela, e o
 * módulo de denúncias, já entregue e verificado, teria de ser reescrito por
 * cima dele para provar que nada mudou.
 *
 * O que era genérico de verdade saiu daqui para `components/admin/shell/`:
 * `Pager` (paginação em `.inbox-tools`) e `Field` (o bloco do `<aside>`).
 * Denúncias segue intocado.
 */
