import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { publicEnv } from "@/lib/env";
import {
  MODE_LABEL,
  RISK_LABEL,
  STATUS_LABEL,
  formatBytes,
  formatDate,
  formatDateTime,
  relativeAge,
  riskClass,
} from "@/lib/admin/labels";
import type { ReportMode } from "@/lib/admin/labels";
import { TABS, caseHref, type InboxFilters } from "@/lib/admin/inbox";
import { RECURRENCES, RELATIONSHIPS } from "@/lib/report/schema";
import {
  CaseActionsBar,
  IdentityRequestForm,
  MessageComposer,
  RISK_FORM_ID,
  RiskControl,
  StatusControl,
  type Member,
} from "./CaseControls";

/** `relationship` e `recurrence` são códigos: o rótulo é o mesmo que o canal público mostrou. */
function labelOf(
  options: readonly { value: string; label: string }[],
  value: string | null,
): string | null {
  if (!value) return null;
  return options.find(option => option.value === value)?.label ?? value;
}

/** Cada bloco do `<aside>` é `<div><small>RÓTULO</small><strong>valor</strong></div>`. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

/** Fora do corpo do componente: `Date.now()` em render é impureza para o compilador do React. */
function isOverdue(dueAt: string | null): boolean {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now());
}

function periodOf(report: {
  period_text: string | null;
  occurred_from: string | null;
  occurred_to: string | null;
}): string | null {
  if (report.period_text) return report.period_text;
  if (report.occurred_from && report.occurred_to) {
    return `${formatDate(report.occurred_from)} a ${formatDate(report.occurred_to)}`;
  }
  return report.occurred_from ? formatDate(report.occurred_from) : null;
}

export default async function CaseDetail({ id, filters }: { id: string; filters: InboxFilters }) {
  const supabase = await createClient();
  const staff = await getStaffContext();

  // Com o Sentinela ativo, qualquer relato de qualquer cliente pode ser
  // aberto por id (a lista já agrega todos); com outra organização ativa,
  // o filtro por `org_id` garante que um id de outro cliente vira "não
  // encontrado" em vez de abrir — sem isso, a RLS (que autoriza por TODO
  // vínculo ativo, não só o "ativo" no seletor) deixaria vazar.
  const agregando = staff.orgSlug === publicEnv.defaultOrgSlug;

  // Sem RLS que autorize, isto volta vazio — inclusive para o investigador sem
  // atribuição. É a única checagem de acesso que existe, e é a certa (mais o
  // filtro de organização acima, quando não agregando).
  let reportQuery = supabase
    .from("reports")
    .select(
      `id, org_id, protocol, status, risk, risk_rationale, mode, description, witnesses, location,
       period_text, occurred_from, occurred_to, recurrence, city, relationship,
       category_specification, due_at, created_at, retaliation, urgent, assigned_to, unit_unknown,
       org_units(name),
       organizations(trade_name),
       profiles!reports_assigned_to_fkey(full_name),
       report_categories(is_primary, categories(label_pt))`,
    )
    .eq("id", id);
  if (!agregando) reportQuery = reportQuery.eq("org_id", staff.orgId);
  const { data: report } = await reportQuery.maybeSingle();

  if (!report) notFound();

  const { count: messageCount } = await supabase
    .from("report_messages")
    .select("id", { count: "exact", head: true })
    .eq("report_id", id);

  // O papel aqui só esconde controle. `comite` é somente leitura — a RLS nem
  // deixa esse papel ver o relato — e a designação e a quebra de sigilo são de
  // `admin`. Quem autoriza de verdade continua sendo a política do Postgres.
  const canMutate = staff.role !== "comite";
  const canAssign = staff.role === "admin";

  let members: Member[] = [];
  if (canAssign) {
    // Escopo pela organização DONA do relato — não pela organização ativa no
    // seletor: no modo agregado, atribuir precisa listar o time do cliente
    // certo, não o do Sentinela.
    const { data: memberRows } = await supabase
      .from("org_members")
      .select("user_id, profiles!org_members_user_id_fkey(full_name)")
      .eq("org_id", report.org_id)
      .eq("status", "active");
    members = (memberRows ?? []).map(row => ({
      user_id: row.user_id,
      name: row.profiles?.full_name ?? "Membro sem nome",
    }));
  }

  const categories = [...(report.report_categories ?? [])]
    // A categoria principal encabeça a lista; a ordem do PostgREST é a da tabela.
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map(row => row.categories?.label_pt)
    .filter((label): label is string => Boolean(label));
  const primary =
    report.report_categories?.find(row => row.is_primary)?.categories?.label_pt ??
    categories[0] ??
    "Relato sem categoria";
  // A empresa vem do relato de verdade (`report.organizations`), nunca da
  // organização ativa no seletor — no modo agregado elas quase sempre
  // divergem, e mesmo fora dele é mais correto depender do dado real.
  const empresa = report.organizations?.trade_name ?? staff.orgName;
  const unidade = report.org_units?.name;
  const identificacao = unidade ? `${empresa} · ${unidade}` : empresa;
  const overdue = isOverdue(report.due_at);

  return (
    <section className="case-detail">
      <div className="detail-head">
        <div>
          <code>{report.protocol}</code>
          <h2>{primary}</h2>
          <span>
            {identificacao} · recebido {relativeAge(report.created_at)}
          </span>
        </div>
        {report.status === "arquivada" ? (
          <span className="risk arquivada">ARQUIVADA</span>
        ) : (
          <span className={riskClass(report.risk)}>{RISK_LABEL[report.risk]}</span>
        )}
      </div>

      {/* Abas por URL: o conteúdo é do servidor e o link é compartilhável entre investigadores. */}
      <div className="detail-tabs">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={caseHref(id, filters, tab.key)}
            className={filters.aba === tab.key ? "active" : ""}
          >
            {tab.label}
            {tab.key === "mensagens" && messageCount ? <b>{messageCount}</b> : null}
          </Link>
        ))}
      </div>

      {filters.aba === "visao-geral" ? (
        <>
          {report.retaliation || report.urgent ? (
            <div className="risk-banner">
              <span>!</span>
              <div>
                <strong>
                  {report.retaliation
                    ? "Possível retaliação informada"
                    : "Relato marcado como urgente"}
                </strong>
                <p>
                  Avalie medidas protetivas imediatas e preserve evidências. Qualquer decisão deve
                  ser registrada por pessoa autorizada.
                </p>
              </div>
              {/* Submete o formulário de risco do `<aside>` pelo atributo `form`.
                  Assim o banner leva à mesma decisão, com a mesma justificativa,
                  sem duplicar controle nem embrulhar este botão num <form>
                  (o CSS mira `.risk-banner button` e `.risk-banner div`). */}
              <button type="submit" form={RISK_FORM_ID} disabled={!canMutate}>
                Registrar avaliação
              </button>
            </div>
          ) : null}

          <div className="detail-columns">
            <article>
              <small>RELATO ORIGINAL · IMUTÁVEL</small>
              <p>{report.description}</p>
            </article>
            <aside>
              {canMutate ? (
                <>
                  <StatusControl id={id} status={report.status} />
                  <RiskControl id={id} risk={report.risk} />
                </>
              ) : (
                <>
                  <Field label="STATUS" value={STATUS_LABEL[report.status]} />
                  <Field label="RISCO" value={RISK_LABEL[report.risk]} />
                </>
              )}
              <Field
                label="RESPONSÁVEL"
                value={report.profiles?.full_name ?? "Ninguém atribuído"}
              />
              <div>
                <small>PRAZO</small>
                <strong className={overdue ? "danger" : ""}>
                  {report.due_at
                    ? `${formatDate(report.due_at)}${overdue ? " · atrasado" : ""}`
                    : "Sem prazo definido"}
                </strong>
              </div>
              <Field label="MODALIDADE" value={MODE_LABEL[report.mode]} />
              <Field
                label="CATEGORIAS"
                value={categories.length > 0 ? categories.join(" · ") : "Sem categoria"}
              />
              <Field label="EMPRESA" value={identificacao} />
              {report.city ? <Field label="CIDADE" value={report.city} /> : null}
              {report.relationship ? (
                <Field
                  label="RELAÇÃO COM A EMPRESA"
                  value={labelOf(RELATIONSHIPS, report.relationship)}
                />
              ) : null}
              {periodOf(report) ? <Field label="PERÍODO" value={periodOf(report)} /> : null}
              {report.location ? <Field label="LOCAL" value={report.location} /> : null}
              <Field label="RECORRÊNCIA" value={labelOf(RECURRENCES, report.recurrence)} />
              {report.witnesses ? <Field label="TESTEMUNHAS" value={report.witnesses} /> : null}
              {report.category_specification ? (
                <Field label="ESPECIFICAÇÃO" value={report.category_specification} />
              ) : null}
              {report.risk_rationale ? (
                <Field label="JUSTIFICATIVA DO RISCO" value={report.risk_rationale} />
              ) : null}
            </aside>
          </div>

          {/* `reveal_identity` grava um acesso a cada chamada: o bloco só é
              montado na aba que está aberta, nunca especulativamente. */}
          <IdentityBlock
            id={id}
            mode={report.mode}
            userId={staff.userId}
            isAdmin={canAssign}
            canRequest={canMutate}
          />
        </>
      ) : null}

      {filters.aba === "linha-do-tempo" ? <Timeline id={id} /> : null}
      {filters.aba === "evidencias" ? <Evidence id={id} /> : null}
      {filters.aba === "mensagens" ? <Messages id={id} canWrite={canMutate} /> : null}

      {canMutate ? (
        <CaseActionsBar
          id={id}
          assignedTo={report.assigned_to}
          members={members}
          canAssign={canAssign}
        />
      ) : null}
    </section>
  );
}

/**
 * A promessa da página pública é que a identidade fica separada do conteúdo e
 * exige permissão específica. Aqui ela é verdade em três estados: relato
 * anônimo (não há o que revelar), identificado sem concessão (nada aparece, só
 * o formulário de justificativa) e identificado com concessão viva.
 *
 * Nada do que sai daqui pode ir para `audit_events`, `notifications`, URL,
 * `title` de página ou log — o único registro do acesso é o que a própria
 * `reveal_identity` grava em `data_access_log`.
 */
async function IdentityBlock({
  id,
  mode,
  userId,
  isAdmin,
  canRequest,
}: {
  id: string;
  mode: ReportMode;
  userId: string;
  isAdmin: boolean;
  canRequest: boolean;
}) {
  if (mode === "anonymous") {
    return (
      <div className="privacy-note">
        <b>RELATO ANÔNIMO · NÃO EXISTE IDENTIDADE A REVELAR</b>
        <p>
          Quem relatou não informou nome nem contato, e o canal não guardou nada que permita
          identificá-lo. Isto não é um acesso negado: não há dado. Qualquer tentativa de descobrir
          quem relatou por fora do canal é retaliação e está vedada pela Lei nº 14.457.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: grant } = await supabase
    .from("identity_access_grants")
    .select("expires_at, justification")
    .eq("report_id", id)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!grant) {
    return (
      <div className="privacy-note">
        <b>IDENTIDADE PROTEGIDA · ACESSO EXIGE JUSTIFICATIVA</b>
        <p>
          O relato é identificado, mas o nome e o contato ficam numa tabela separada, fechada até
          que alguém declare por escrito por que precisa deles. A justificativa entra na auditoria,
          o acesso vence sozinho e cada leitura fica registrada com hora e autor.
        </p>
        {canRequest ? <IdentityRequestForm id={id} isAdmin={isAdmin} /> : null}
      </div>
    );
  }

  const { data: revealed, error } = await supabase.rpc("reveal_identity", { p_report: id });
  const identity = Array.isArray(revealed) ? revealed[0] : revealed;

  if (error || !identity) {
    return (
      <div className="privacy-note">
        <b>IDENTIDADE INDISPONÍVEL</b>
        <p>
          A concessão está viva, mas a identidade não pôde ser lida. Fale com a administração antes
          de tentar de novo — cada tentativa é registrada.
        </p>
      </div>
    );
  }

  return (
    <div className="privacy-note">
      <b>IDENTIDADE REVELADA · ACESSO REGISTRADO</b>
      <p>
        Nome: {identity.full_name ?? "não informado"}
        <br />
        Contato: {identity.contact ?? "não informado"}
        {identity.contact_kind ? ` (${identity.contact_kind})` : ""}
      </p>
      <p>
        Consentimento para contato:{" "}
        <strong>{identity.consent_to_contact ? "concedido" : "NÃO concedido"}</strong>
        <br />
        Consentimento para revelar ao acusado:{" "}
        <strong>
          {identity.consent_to_disclose_to_accused ? "concedido" : "NÃO concedido"}
        </strong>
        {identity.consent_to_disclose_to_accused
          ? ""
          : " — revelar o nome ao acusado sem este consentimento expõe quem relatou à retaliação."}
      </p>
      <p>Seu acesso expira em {formatDateTime(grant.expires_at)}.</p>
    </div>
  );
}

async function Timeline({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: history } = await supabase
    .from("report_status_history")
    .select(
      "id, created_at, from_status, to_status, from_risk, to_risk, rationale, profiles!report_status_history_changed_by_fkey(full_name)",
    )
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  const entries = history ?? [];
  if (entries.length === 0) {
    return (
      <div className="care-note">
        <span>◷</span>
        <div>
          <strong>Sem histórico registrado</strong>
          <small>Nenhuma mudança de status ou risco foi gravada para este caso.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-timeline">
      {entries.map((entry, index) => (
        <article key={entry.id} className={index === entries.length - 1 ? "current" : "done"}>
          <i>{index === entries.length - 1 ? "•" : "✓"}</i>
          <div>
            <strong>
              {entry.from_status
                ? `${STATUS_LABEL[entry.from_status]} → ${STATUS_LABEL[entry.to_status]}`
                : STATUS_LABEL[entry.to_status]}
            </strong>
            <small>
              {formatDateTime(entry.created_at)} ·{" "}
              {entry.profiles?.full_name ?? "Canal público"}
              {entry.to_risk && entry.to_risk !== entry.from_risk
                ? ` · risco ${RISK_LABEL[entry.to_risk].toLowerCase()}`
                : ""}
              {entry.rationale ? ` · ${entry.rationale}` : ""}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

async function Evidence({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("report_evidence")
    .select("id, filename, mime_type, size_bytes, sha256_verified, is_quarantined, created_at")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  const evidence = files ?? [];
  if (evidence.length === 0) {
    return (
      <div className="care-note">
        <span>▧</span>
        <div>
          <strong>Nenhum arquivo anexado</strong>
          <small>O relato foi enviado sem evidências e nada foi complementado depois.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="file-list">
      {evidence.map(file => {
        // A RLS já esconde arquivo em quarentena; a checagem aqui é defesa em profundidade.
        const quarantined = file.is_quarantined === true;
        const integrity = quarantined
          ? "em quarentena"
          : file.sha256_verified
            ? "integridade verificada"
            : "integridade em verificação";
        return (
          <div key={file.id}>
            <span>▧</span>
            <b>
              {file.filename}
              <small>
                {formatBytes(file.size_bytes)} · {file.mime_type} · {integrity} ·{" "}
                {formatDate(file.created_at)}
              </small>
            </b>
            {quarantined ? null : (
              <a href={`/api/admin/evidence/${file.id}`} aria-label={`Baixar ${file.filename}`}>
                ⤓
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function Messages({ id, canWrite }: { id: string; canWrite: boolean }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("report_messages")
    .select("id, body, author_type, internal, created_at, profiles!report_messages_author_id_fkey(full_name)")
    .eq("report_id", id)
    .order("created_at", { ascending: true });

  const messages = rows ?? [];

  return (
    <div className="message-box">
      {messages.length === 0 ? (
        <div className="care-note">
          <span>✉</span>
          <div>
            <strong>Nenhuma mensagem trocada</strong>
            <small>Ainda não houve conversa entre a equipe do canal e quem relatou.</small>
          </div>
        </div>
      ) : null}
      {messages.map(message => (
        <div
          key={message.id}
          className={message.author_type === "reporter" ? "user-message" : "company-message"}
        >
          <small>
            {message.internal
              ? "NOTA INTERNA · O DENUNCIANTE NÃO VÊ"
              : message.author_type === "reporter"
                ? "DENUNCIANTE"
                : message.author_type === "system"
                  ? "SISTEMA"
                  : (message.profiles?.full_name?.toUpperCase() ?? "EQUIPE DO CANAL")}{" "}
            · {formatDateTime(message.created_at)}
          </small>
          <p>{message.body}</p>
        </div>
      ))}
      {canWrite ? <MessageComposer id={id} /> : null}
    </div>
  );
}
