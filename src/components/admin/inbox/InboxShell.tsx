import type { ReactNode } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  RISK_LABEL,
  RISK_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  relativeAge,
  riskClass,
} from "@/lib/admin/labels";
import {
  INBOX_BOXES,
  INBOX_PATH,
  PAGE_SIZE,
  UNASSIGNED,
  activeFilterCount,
  caseHref,
  inboxBoxHref,
  inboxQuery,
  looksLikeProtocol,
  type InboxFilters,
} from "@/lib/admin/inbox";

/** Sinais que a triagem precisa ver sem abrir o caso. */
function flagsOf(item: {
  retaliation: boolean;
  urgent: boolean;
  due_at: string | null;
  assigned_to: string | null;
}): string[] {
  const flags: string[] = [];
  if (item.retaliation) flags.push("RETALIAÇÃO");
  if (item.urgent) flags.push("URGENTE");
  if (item.due_at && new Date(item.due_at).getTime() < Date.now()) flags.push("PRAZO VENCIDO");
  if (!item.assigned_to) flags.push("SEM RESPONSÁVEL");
  return flags;
}

function primaryCategory(
  rows: { is_primary: boolean; categories: { label_pt: string } | null }[] | null,
): string {
  const primary = rows?.find(row => row.is_primary) ?? rows?.[0];
  return primary?.categories?.label_pt ?? "Relato sem categoria";
}

/**
 * Casca da caixa de entrada: a lista à esquerda e, à direita, o que a rota
 * mandar (o detalhe do caso ou o vazio "selecione um caso").
 *
 * Vive num componente e não num `layout.tsx` porque layouts do App Router não
 * recebem `searchParams` — e todo o estado desta tela mora na querystring.
 */
export default async function InboxShell({
  filters,
  selectedId,
  detail,
}: {
  filters: InboxFilters;
  selectedId?: string;
  detail: ReactNode;
}) {
  const supabase = await createClient();

  // Tudo sob RLS: o investigador só enxerga o que lhe foi atribuído.
  let query = supabase
    .from("reports")
    .select(
      "id, protocol, status, risk, created_at, due_at, retaliation, urgent, assigned_to, org_units(name), report_categories(is_primary, categories(label_pt))",
      { count: "exact" },
    );

  // "Arquivadas" é a única caixa que mostra `arquivada` — em "Ativas" ela
  // nunca aparece, mesmo que um filtro de status antigo ainda esteja na URL.
  if (filters.caixa === "arquivadas") {
    query = query.eq("status", "arquivada");
  } else {
    query = query.neq("status", "arquivada");
    if (filters.status) query = query.eq("status", filters.status);
  }
  if (filters.risk) query = query.eq("risk", filters.risk);
  if (filters.unidade) query = query.eq("org_unit_id", filters.unidade);
  if (filters.responsavel === UNASSIGNED) query = query.is("assigned_to", null);
  else if (filters.responsavel) query = query.eq("assigned_to", filters.responsavel);

  if (filters.q) {
    if (looksLikeProtocol(filters.q)) {
      // Protocolo é só [A-Z0-9-]: não há o que escapar no filtro do PostgREST.
      query = query.or(`protocol.ilike.*${filters.q}*,search_tsv.wfts(portuguese).${filters.q}`);
    } else {
      query = query.textSearch("search_tsv", filters.q, { type: "websearch", config: "portuguese" });
    }
  }

  const from = (filters.pagina - 1) * PAGE_SIZE;

  // `risk` é enum, e a ordem natural do tipo é baixo < moderado < alto < critico:
  // descendente já entrega o crítico no topo, como promete o "Ordenados por prioridade".
  const { data: cases, count } = await query
    .order("risk", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const [{ data: units }, { data: members }] = await Promise.all([
    supabase.from("org_units").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("org_members")
      .select("user_id, profiles!org_members_user_id_fkey(full_name)")
      .eq("status", "active"),
  ]);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = activeFilterCount(filters);
  const list = cases ?? [];
  // Paginar com um caso aberto não deve fechá-lo.
  const basePath = selectedId ? `${INBOX_PATH}/${selectedId}` : INBOX_PATH;

  const arquivadas = filters.caixa === "arquivadas";

  return (
    <div className="inbox">
      <div className="detail-tabs">
        {INBOX_BOXES.map(box => (
          <Link
            key={box.key}
            href={inboxBoxHref(filters, box.key)}
            className={filters.caixa === box.key ? "active" : ""}
          >
            {box.label}
          </Link>
        ))}
      </div>

      {/* Filtros sem JavaScript: GET puro, para a página seguir sendo Server Component. */}
      <form className="inbox-tools" method="get">
        {filters.aba !== "visao-geral" ? <input type="hidden" name="aba" value={filters.aba} /> : null}
        {arquivadas ? <input type="hidden" name="caixa" value={filters.caixa} /> : null}
        <div className="searchbox">
          ⌕{" "}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar protocolo ou palavra autorizada"
            aria-label="Buscar protocolo ou palavra autorizada"
          />
        </div>
        <div className="searchbox">
          {arquivadas ? null : (
            <select name="status" defaultValue={filters.status} aria-label="Filtrar por status">
              <option value="">Todos os status</option>
              {STATUS_ORDER.filter(status => status !== "arquivada").map(status => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          )}
          <select name="risk" defaultValue={filters.risk} aria-label="Filtrar por risco">
            <option value="">Todos os riscos</option>
            {RISK_ORDER.map(risk => (
              <option key={risk} value={risk}>
                {RISK_LABEL[risk]}
              </option>
            ))}
          </select>
          <select name="unidade" defaultValue={filters.unidade} aria-label="Filtrar por unidade">
            <option value="">Todas as unidades</option>
            {(units ?? []).map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <select
            name="responsavel"
            defaultValue={filters.responsavel}
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value={UNASSIGNED}>Sem responsável</option>
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
        {/* TODO(fase4-export): a rota /api/admin/denuncias/export é de outro agente. */}
        <a href={`/api/admin/denuncias/export${inboxQuery(filters, { aba: null, pagina: null })}`}>
          Exportar
        </a>
      </form>

      <div className="inbox-layout">
        <section className="case-list">
          <div className="list-head">
            <span>
              {total} caso{total === 1 ? "" : "s"}
            </span>
            <small>Ordenados por prioridade</small>
          </div>
          {list.map(item => (
            <Link
              key={item.id}
              href={caseHref(item.id, filters)}
              className={item.id === selectedId ? "active" : ""}
            >
              <div className="case-row-top">
                <code>{item.protocol}</code>
                {item.status === "arquivada" ? (
                  <span className="risk arquivada">ARQUIVADA</span>
                ) : (
                  <span className={riskClass(item.risk)}>{RISK_LABEL[item.risk]}</span>
                )}
              </div>
              <strong>{primaryCategory(item.report_categories)}</strong>
              <small>
                {item.org_units?.name ? `${item.org_units.name} · ` : ""}
                {relativeAge(item.created_at)}
              </small>
              {item.status === "arquivada" ? null : (
                <div className="case-flags">
                  {flagsOf(item).map(flag => (
                    <i key={flag}>{flag}</i>
                  ))}
                </div>
              )}
            </Link>
          ))}
          {list.length === 0 ? (
            <div className="list-head">
              <span>Nenhum caso encontrado</span>
              <small>{filterCount > 0 ? "Revise os filtros" : "A caixa está vazia"}</small>
            </div>
          ) : null}
        </section>

        {detail}
      </div>

      {pages > 1 ? (
        <div className="inbox-tools">
          {filters.pagina > 1 ? (
            <Link href={`${basePath}${inboxQuery(filters, { pagina: filters.pagina - 1 })}`}>
              ← Anterior
            </Link>
          ) : null}
          <button type="button" disabled>
            Página {filters.pagina} de {pages}
          </button>
          {filters.pagina < pages ? (
            <Link href={`${basePath}${inboxQuery(filters, { pagina: filters.pagina + 1 })}`}>
              Próxima →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
