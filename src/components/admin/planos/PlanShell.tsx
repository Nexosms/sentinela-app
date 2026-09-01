import type { ReactNode } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import Pager from "@/components/admin/shell/Pager";
import { formatDateOnly, isPastDue, todayInSaoPaulo } from "@/lib/admin/labels";
import {
  NO_OWNER,
  PAGE_SIZE,
  PLAN_PATH,
  RISK_SOURCE,
  RISK_SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  activeFilterCount,
  awaitsVerification,
  planHref,
  planQuery,
  planStatusClass,
  type Effectiveness,
  type MeasureStatus,
  type PlanFilters,
} from "@/lib/admin/planos";

/**
 * Casca do módulo de planos de ação: lista à esquerda, o que a rota mandar à
 * direita. Irmã de `InvestigationShell` pelo mesmo motivo que aquela é irmã de
 * `InboxShell` — o que as três compartilham é o vocabulário do design system,
 * que já é compartilhado porque é CSS. O que cada uma tem de próprio é a
 * consulta, os filtros e a linha.
 *
 * Vive num componente e não num `layout.tsx` porque layouts do App Router não
 * recebem `searchParams`, e todo o estado desta tela mora na querystring.
 */

export default async function PlanShell({
  filters,
  selectedId,
  detail,
}: {
  filters: PlanFilters;
  selectedId?: string;
  detail: ReactNode;
}) {
  const supabase = await createClient();

  // Tudo sob RLS: `plans_read` já limita à organização.
  let query = supabase
    .from("action_plans")
    .select(
      `id, code, title, status, risk_source, owner_id, due_on, created_at,
       profiles!action_plans_owner_id_fkey(full_name)`,
      { count: "exact" },
    );

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.origem) query = query.eq("risk_source", filters.origem);
  if (filters.responsavel === NO_OWNER) query = query.is("owner_id", null);
  else if (filters.responsavel) query = query.eq("owner_id", filters.responsavel);
  // `filters.q` já passou por `sanitizeQuery`: sem vírgula, ponto nem parêntese,
  // que é a gramática do `.or()` do PostgREST.
  if (filters.q) query = query.or(`code.ilike.*${filters.q}*,title.ilike.*${filters.q}*`);

  const from = (filters.pagina - 1) * PAGE_SIZE;

  const { data: rows, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const list = rows ?? [];

  // Os sinalizadores da linha vêm das medidas. Uma consulta só para a página
  // inteira, em vez de uma por plano.
  const { data: measureRows } = list.length
    ? await supabase
        .from("action_measures")
        .select("action_plan_id, status, effectiveness")
        .in(
          "action_plan_id",
          list.map(plan => plan.id),
        )
    : { data: [] };

  const byPlan = new Map<string, { status: MeasureStatus; effectiveness: Effectiveness }[]>();
  for (const measure of measureRows ?? []) {
    const bucket = byPlan.get(measure.action_plan_id) ?? [];
    bucket.push({ status: measure.status, effectiveness: measure.effectiveness });
    byPlan.set(measure.action_plan_id, bucket);
  }

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, profiles!org_members_user_id_fkey(full_name)")
    .eq("status", "active");

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterCount = activeFilterCount(filters);
  // Paginar com um plano aberto não deve fechá-lo.
  const basePath = selectedId ? `${PLAN_PATH}/${selectedId}` : PLAN_PATH;
  // `due_on` é `date`; o "hoje" precisa ser o de São Paulo, não o do servidor.
  const today = todayInSaoPaulo();

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
            placeholder="Buscar código ou título"
            aria-label="Buscar código ou título"
          />
        </div>
        <div className="searchbox">
          <select name="status" defaultValue={filters.status} aria-label="Filtrar por situação">
            <option value="">Todas as situações</option>
            {/*
              `atrasada` aparece aqui porque FILTRAR por ela é justamente o que a
              coordenação precisa fazer. O que não existe em lugar nenhum deste
              módulo é um `<select>` que ESCREVA esse valor.
            */}
            {STATUS_ORDER.map(status => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <select
            name="origem"
            defaultValue={filters.origem}
            aria-label="Filtrar por origem do risco"
          >
            <option value="">Todas as origens</option>
            {RISK_SOURCE.map(source => (
              <option key={source} value={source}>
                {RISK_SOURCE_LABEL[source]}
              </option>
            ))}
          </select>
        </div>
        {/* Terceiro `.searchbox`: `.searchbox select` tem `max-width:150px` e a
            caixa tem `min-width` — três selects numa só transbordariam. */}
        <div className="searchbox">
          <select
            name="responsavel"
            defaultValue={filters.responsavel}
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value={NO_OWNER}>Sem responsável definido</option>
            {(members ?? []).map(member => (
              <option key={member.user_id} value={member.user_id}>
                {member.profiles?.full_name ?? member.user_id}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Filtros{filterCount > 0 ? <b>{filterCount}</b> : null}</button>
      </form>

      <div className="inbox-layout">
        <section className="case-list">
          <div className="list-head">
            <span>
              {total} plano{total === 1 ? "" : "s"} de ação
            </span>
            <small>Mais recentes primeiro</small>
          </div>
          {list.map(plan => {
            const measures = byPlan.get(plan.id) ?? [];
            const flags: string[] = [];
            if (plan.status === "atrasada" || measures.some(m => m.status === "atrasada")) {
              flags.push("ATRASADO");
            }
            const pendentes = measures.filter(awaitsVerification).length;
            if (pendentes > 0) flags.push(`AGUARDANDO VERIFICAÇÃO (${pendentes})`);
            if (measures.length === 0) flags.push("SEM MEDIDAS");

            const overdue =
              plan.status !== "concluida" &&
              plan.status !== "cancelada" &&
              isPastDue(plan.due_on, today);

            return (
              <Link
                key={plan.id}
                href={planHref(plan.id, filters)}
                className={plan.id === selectedId ? "active" : ""}
              >
                <div className="case-row-top">
                  <code>{plan.code}</code>
                  <span className={planStatusClass(plan.status)}>{STATUS_LABEL[plan.status]}</span>
                </div>
                <strong>{plan.title}</strong>
                <small>
                  {plan.profiles?.full_name ?? "Sem responsável definido"} ·{" "}
                  <span className={overdue ? "danger" : undefined}>
                    {plan.due_on ? `prazo ${formatDateOnly(plan.due_on)}` : "sem prazo"}
                  </span>
                </small>
                <div className="case-flags">
                  {flags.map(flag => (
                    <i key={flag}>{flag}</i>
                  ))}
                </div>
              </Link>
            );
          })}
          {list.length === 0 ? (
            <div className="list-head">
              <span>Nenhum plano de ação encontrado</span>
              <small>{filterCount > 0 ? "Revise os filtros" : "Nada foi aberto ainda"}</small>
            </div>
          ) : null}
        </section>

        {detail}
      </div>

      <Pager
        page={filters.pagina}
        pages={pages}
        hrefFor={page => `${basePath}${planQuery(filters, { pagina: page })}`}
      />
    </div>
  );
}
