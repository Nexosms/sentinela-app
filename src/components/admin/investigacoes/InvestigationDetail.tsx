import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { RISK_LABEL, formatDate, formatDateTime, riskClass } from "@/lib/admin/labels";
import Field from "@/components/admin/shell/Field";
import {
  CONFIDENCE_LABEL,
  INTERVIEW_KIND_LABEL,
  INV_STATUS_LABEL,
  OUTCOME_LABEL,
  ROLE_IN_CASE_LABEL,
  formatDateOnly,
  TABS,
  investigationHref,
  investigationStatusClass,
  isPastDue,
  isReadyForReview,
  type Confidence,
  type InvestigationFilters,
  type RoleInCase,
} from "@/lib/admin/investigacoes";
import {
  AchadoForm,
  AdicionarMembroForm,
  ConclusaoForm,
  DesvincularDenunciaButton,
  EntrevistaForm,
  PlanoForm,
  RemoverMembroButton,
  RevisarConcluirForm,
  VincularDenunciaForm,
  type EvidenceOption,
  type Person,
  type ReportOption,
} from "./InvestigationControls";

/**
 * Detalhe da investigação: cabeçalho, abas por `?aba=` e o painel da aba
 * aberta. Server Component — as folhas interativas vêm de
 * `InvestigationControls`.
 *
 * A regra que organiza este arquivo inteiro é uma só: quando `reviewed_at` não
 * é nulo, NENHUM controle de escrita é montado. O banco já recusaria
 * (`inv_update` só enxerga a linha enquanto `reviewed_at IS NULL`), mas a
 * interface não pode oferecer o que vai falhar.
 */

/** `planned_start`/`planned_end` são `date`; o "hoje" tem que ser o de São Paulo. */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * Uma consulta só, num lugar só: as abas recebem a linha já lida em vez de
 * relerem a investigação inteira. O tipo `Investigation` sai daqui, então
 * mudar o `select` reflete nas abas sem `any` no meio.
 */
async function loadInvestigation(id: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("investigations")
    .select(
      `id, org_id, code, status, scope, hypotheses, methodology, protective_measures,
       planned_start, planned_end, started_at, concluded_at, outcome, findings, recommendation,
       lead_id, reviewed_by, reviewed_at, created_at,
       lead:profiles!investigations_lead_id_fkey(full_name),
       reviewer:profiles!investigations_reviewed_by_fkey(full_name)`,
    )
    .eq("id", id)
    // `inv_read` autoriza por TODO vínculo ativo, não só a organização
    // "ativa" no seletor — este filtro evita abrir uma investigação de
    // outro cliente pelo id.
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

type Investigation = NonNullable<Awaited<ReturnType<typeof loadInvestigation>>>;

export default async function InvestigationDetail({
  id,
  filters,
}: {
  id: string;
  filters: InvestigationFilters;
}) {
  const supabase = await createClient();
  const staff = await getStaffContext();

  // Sem RLS que autorize, isto volta vazio. É a única checagem de acesso, e é a certa
  // (mais o filtro de organização em `loadInvestigation`).
  const inv = await loadInvestigation(id, staff.orgId);
  if (!inv) notFound();

  // Papel aqui só esconde controle. `triagem` e `comite` leem e não escrevem;
  // quem recusa a escrita é a policy `inv_update`.
  const roleCanWrite = staff.role === "admin" || staff.role === "investigador";
  const signed = inv.reviewed_at !== null;
  const editable = roleCanWrite && !signed;
  const isLead = inv.lead_id !== null && inv.lead_id === staff.userId;
  const ready = isReadyForReview(inv);
  const today = todayInSaoPaulo();
  const overdue = !signed && isPastDue(inv.planned_end, today);

  const [{ count: interviewCount }, { count: findingCount }, { count: linkCount }, { count: teamCount }] =
    await Promise.all([
      supabase
        .from("investigation_interviews")
        .select("id", { count: "exact", head: true })
        .eq("investigation_id", id),
      supabase
        .from("investigation_findings")
        .select("id", { count: "exact", head: true })
        .eq("investigation_id", id),
      supabase
        .from("investigation_reports")
        .select("report_id", { count: "exact", head: true })
        .eq("investigation_id", id),
      supabase
        .from("investigation_members")
        .select("user_id", { count: "exact", head: true })
        .eq("investigation_id", id),
    ]);

  const counts: Partial<Record<(typeof TABS)[number]["key"], number | null>> = {
    equipe: teamCount,
    denuncias: linkCount,
    entrevistas: interviewCount,
    achados: findingCount,
  };

  return (
    <section className="case-detail">
      <div className="detail-head">
        <div>
          <code>{inv.code}</code>
          <h2>{inv.scope?.trim() || "Sem escopo definido"}</h2>
          <span>
            {inv.lead?.full_name ?? "Sem condução definida"} · aberta em{" "}
            {formatDate(inv.created_at)}
          </span>
        </div>
        <span className={investigationStatusClass(inv.status)}>
          {INV_STATUS_LABEL[inv.status]}
        </span>
      </div>

      {signed ? (
        <div className="privacy-note">
          <b>INVESTIGAÇÃO ENCERRADA E ASSINADA · SOMENTE LEITURA</b>
          <p>
            Revisada e concluída por{" "}
            <strong>{inv.reviewer?.full_name ?? "revisor não identificado"}</strong> em{" "}
            {formatDateTime(inv.reviewed_at as string)}, com desfecho{" "}
            <strong>{inv.outcome ? OUTCOME_LABEL[inv.outcome] : "não registrado"}</strong>.
          </p>
          <p>
            A partir da assinatura o banco recusa qualquer escrita nesta investigação — plano,
            equipe, entrevistas e achados ficam como estavam no momento em que foi assinada. É a
            política <code>inv_update</code>, não uma trava de tela: nem quem conduziu pode
            reabrir.
          </p>
        </div>
      ) : null}

      {!signed && ready ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>Pronta para revisão · aguardando a segunda assinatura</strong>
            <p>
              Síntese, recomendação e desfecho já estão escritos. Falta a leitura e a assinatura de
              outra pessoa — quem conduziu a apuração não pode assiná-la
              (<code>inv_reviewer_not_lead</code>). O botão está na aba Achados.
            </p>
          </div>
        </div>
      ) : null}

      {!signed && overdue ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>Prazo planejado vencido</strong>
            <p>
              O fim planejado era {formatDateOnly(inv.planned_end as string)}. Apuração que se arrasta
              desprotege quem relatou: replaneje o prazo na aba Plano ou conclua.
            </p>
          </div>
        </div>
      ) : null}

      {/* Abas por URL: o conteúdo é do servidor e o link é compartilhável. */}
      <div className="detail-tabs">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={investigationHref(id, filters, tab.key)}
            className={filters.aba === tab.key ? "active" : ""}
          >
            {tab.label}
            {counts[tab.key] ? <b>{counts[tab.key]}</b> : null}
          </Link>
        ))}
      </div>

      {filters.aba === "plano" ? (
        <PlanoTab inv={inv} editable={editable} overdue={overdue} today={today} />
      ) : null}
      {filters.aba === "equipe" ? (
        <EquipeTab id={id} orgId={inv.org_id} leadId={inv.lead_id} editable={editable} />
      ) : null}
      {filters.aba === "denuncias" ? <DenunciasTab id={id} editable={editable} /> : null}
      {filters.aba === "entrevistas" ? <EntrevistasTab id={id} editable={editable} /> : null}
      {filters.aba === "achados" ? (
        <AchadosTab id={id} inv={inv} editable={editable} isLead={isLead} ready={ready} />
      ) : null}
    </section>
  );
}

// ── Plano ────────────────────────────────────────────────────────────────────

async function PlanoTab({
  inv,
  editable,
  overdue,
}: {
  inv: Investigation;
  editable: boolean;
  overdue: boolean;
  today: string;
}) {
  const periodo =
    inv.planned_start && inv.planned_end
      ? `${formatDateOnly(inv.planned_start)} a ${formatDateOnly(inv.planned_end)}`
      : inv.planned_end
        ? `até ${formatDateOnly(inv.planned_end)}`
        : inv.planned_start
          ? `a partir de ${formatDateOnly(inv.planned_start)}`
          : "Sem período planejado";

  if (editable) {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("org_members")
      .select("user_id, profiles!org_members_user_id_fkey(full_name)")
      .eq("status", "active");
    const people: Person[] = (rows ?? []).map(row => ({
      user_id: row.user_id,
      name: row.profiles?.full_name ?? "Membro sem nome",
    }));

    return (
      <>
        <div className="care-note">
          <span>✎</span>
          <div>
            <strong>O plano ainda pode ser escrito</strong>
            <small>
              Escopo, hipóteses, metodologia e medidas protetivas ficam editáveis enquanto ninguém
              assinou a conclusão. Depois da assinatura, congelam.
            </small>
          </div>
        </div>
        <PlanoForm
          id={inv.id}
          inv={{
            scope: inv.scope,
            hypotheses: inv.hypotheses,
            methodology: inv.methodology,
            protective_measures: inv.protective_measures,
            planned_start: inv.planned_start,
            planned_end: inv.planned_end,
            lead_id: inv.lead_id,
            status: inv.status,
          }}
          people={people}
        />
      </>
    );
  }

  return (
    <div className="detail-columns">
      <article>
        <small>ESCOPO DA APURAÇÃO</small>
        <p>{inv.scope?.trim() || "Nenhum escopo foi registrado."}</p>
        <small>HIPÓTESES</small>
        <p>{inv.hypotheses?.trim() || "Nenhuma hipótese registrada."}</p>
        <small>METODOLOGIA</small>
        <p>{inv.methodology?.trim() || "Nenhuma metodologia registrada."}</p>
        <small>MEDIDAS PROTETIVAS</small>
        <p>{inv.protective_measures?.trim() || "Nenhuma medida protetiva registrada."}</p>
      </article>
      <aside>
        <Field label="SITUAÇÃO" value={INV_STATUS_LABEL[inv.status]} />
        <Field label="CONDUÇÃO" value={inv.lead?.full_name ?? "Não definida"} />
        <Field label="PERÍODO PLANEJADO" value={periodo} danger={overdue} />
        <Field
          label="INÍCIO EFETIVO"
          value={inv.started_at ? formatDate(inv.started_at) : "Ainda não iniciada"}
        />
        <Field
          label="CONCLUSÃO"
          value={inv.concluded_at ? formatDateTime(inv.concluded_at) : "Em aberto"}
        />
        <Field
          label="DESFECHO"
          value={inv.outcome ? OUTCOME_LABEL[inv.outcome] : "Sem desfecho registrado"}
        />
      </aside>
    </div>
  );
}

// ── Equipe ───────────────────────────────────────────────────────────────────

async function EquipeTab({
  id,
  orgId,
  leadId,
  editable,
}: {
  id: string;
  orgId: string;
  leadId: string | null;
  editable: boolean;
}) {
  const supabase = await createClient();
  const [{ data: rows }, { data: orgRows }] = await Promise.all([
    supabase
      .from("investigation_members")
      .select(
        "user_id, role_in_case, conflict_statement, conflict_declared_at, created_at, profiles!investigation_members_user_id_fkey(full_name)",
      )
      .eq("investigation_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("org_members")
      .select("user_id, profiles!org_members_user_id_fkey(full_name)")
      .eq("org_id", orgId)
      .eq("status", "active"),
  ]);

  const team = rows ?? [];
  const already = new Set(team.map(row => row.user_id));
  const candidates: Person[] = (orgRows ?? [])
    .filter(row => !already.has(row.user_id))
    .map(row => ({ user_id: row.user_id, name: row.profiles?.full_name ?? "Membro sem nome" }));

  const leadIsMember = leadId !== null && already.has(leadId);
  const undeclared = team.filter(row => row.conflict_declared_at === null);

  return (
    <>
      <div className="privacy-note">
        <b>DECLARAÇÃO DE IMPEDIMENTO · É ELA QUE SUSTENTA A APURAÇÃO</b>
        <p>
          Quem apura precisa declarar por escrito que não é a pessoa apontada no relato, nem
          subordinada ou gestora dela. Investigação conduzida por quem tem conflito é nula, e a
          prática da CIPA prevê comitê alternativo quando o impedimento existe. A declaração fica
          gravada com data e hora ao lado de cada nome.
        </p>
      </div>

      {leadId !== null && !leadIsMember ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>Quem conduz a apuração ainda não consta na equipe</strong>
            <p>
              A pessoa está no campo de condução, mas não há declaração de impedimento dela neste
              caso. Inclua-a abaixo com a declaração antes de ouvir alguém.
            </p>
          </div>
        </div>
      ) : null}

      {undeclared.length > 0 ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>
              {undeclared.length} pessoa{undeclared.length === 1 ? "" : "s"} sem declaração de
              impedimento
            </strong>
            <p>
              Enquanto a declaração não existe, a participação dessa pessoa é contestável — e ela
              já enxerga as denúncias vinculadas.
            </p>
          </div>
        </div>
      ) : null}

      {team.length === 0 ? (
        <div className="care-note">
          <span>⚑</span>
          <div>
            <strong>Nenhuma pessoa na equipe</strong>
            <small>Ninguém foi incluído nesta apuração ainda.</small>
          </div>
        </div>
      ) : (
        <div className="file-list">
          {team.map(member => {
            const declared = member.conflict_declared_at !== null;
            const name = member.profiles?.full_name ?? "Membro sem nome";
            return (
              <div key={member.user_id}>
                <span>{declared ? "✓" : "!"}</span>
                <b>
                  {name}
                  {member.user_id === leadId ? " · conduz a apuração" : ""}
                  <small>
                    {ROLE_IN_CASE_LABEL[member.role_in_case as RoleInCase] ?? member.role_in_case} ·{" "}
                    {declared ? (
                      `impedimento declarado em ${formatDateTime(member.conflict_declared_at as string)}`
                    ) : (
                      <span className="danger">SEM DECLARAÇÃO DE IMPEDIMENTO</span>
                    )}
                  </small>
                  {member.conflict_statement ? <small>“{member.conflict_statement}”</small> : null}
                </b>
                {editable ? (
                  <RemoverMembroButton id={id} userId={member.user_id} name={name} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {editable ? (
        candidates.length > 0 ? (
          <AdicionarMembroForm id={id} candidates={candidates} />
        ) : (
          <div className="care-note">
            <span>⚑</span>
            <div>
              <strong>Não há mais quem incluir</strong>
              <small>
                Todo membro ativo da organização já está nesta equipe. Convide alguém em
                Configurações para ampliar o comitê.
              </small>
            </div>
          </div>
        )
      ) : null}
    </>
  );
}

// ── Denúncias vinculadas ─────────────────────────────────────────────────────

async function DenunciasTab({ id, editable }: { id: string; editable: boolean }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("investigation_reports")
    .select("report_id, is_primary, created_at, reports(protocol, status, risk)")
    .eq("investigation_id", id)
    .order("created_at", { ascending: true });

  const links = rows ?? [];
  const linked = new Set(links.map(row => row.report_id));

  // As candidatas saem da mesma RLS que a caixa de entrada: quem não pode ver
  // um relato não o encontra aqui para vincular.
  const { data: reportRows } = await supabase
    .from("reports")
    .select("id, protocol, status")
    .order("created_at", { ascending: false })
    .limit(200);
  const options: ReportOption[] = (reportRows ?? [])
    .filter(report => !linked.has(report.id))
    .map(report => ({ id: report.id, protocol: report.protocol, status: report.status }));

  return (
    <>
      <div className="privacy-note">
        <b>VINCULAR AMPLIA O QUE A EQUIPE INTEIRA ENXERGA</b>
        <p>
          A relação é N:N de propósito — uma apuração pode cobrir vários relatos contra a mesma
          pessoa. Mas cada denúncia vinculada passa a ser legível por todos os membros desta
          investigação, inclusive por quem entrar depois.
        </p>
      </div>

      {links.length === 0 ? (
        <div className="care-note">
          <span>◇</span>
          <div>
            <strong>Nenhuma denúncia vinculada</strong>
            <small>
              Esta apuração não está ligada a nenhum relato. Investigação de ofício é legítima, mas
              é bom deixar a origem registrada no escopo.
            </small>
          </div>
        </div>
      ) : (
        <div className="file-list">
          {links.map(link => (
            <div key={link.report_id}>
              <span>◇</span>
              <b>
                {link.reports?.protocol ?? "Protocolo fora do seu acesso"}
                <small>
                  {link.is_primary ? "denúncia principal" : "apensada"} · vinculada em{" "}
                  {formatDate(link.created_at)}
                </small>
              </b>
              {link.reports ? (
                <span className={riskClass(link.reports.risk)}>
                  {RISK_LABEL[link.reports.risk]}
                </span>
              ) : null}
              <Link
                href={`/admin/denuncias/${link.report_id}`}
                aria-label={`Abrir a denúncia ${link.reports?.protocol ?? ""}`}
              >
                →
              </Link>
              {editable ? (
                <DesvincularDenunciaButton
                  id={id}
                  reportId={link.report_id}
                  protocol={link.reports?.protocol ?? ""}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {editable && options.length > 0 ? (
        <VincularDenunciaForm id={id} options={options} />
      ) : null}
    </>
  );
}

// ── Entrevistas ──────────────────────────────────────────────────────────────

async function EntrevistasTab({ id, editable }: { id: string; editable: boolean }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("investigation_interviews")
    .select(
      `id, kind, interviewee_label, held_at, location, accompanied_by, script, summary,
       consent_recorded, non_retaliation_notice_given, created_at,
       profiles!investigation_interviews_conducted_by_fkey(full_name)`,
    )
    .eq("investigation_id", id)
    .order("created_at", { ascending: true });

  const interviews = rows ?? [];

  return (
    <div className="message-box">
      {interviews.length === 0 ? (
        <div className="care-note">
          <span>◷</span>
          <div>
            <strong>Nenhuma entrevista registrada</strong>
            <small>Ninguém foi ouvido ainda, ou o registro ficou para depois.</small>
          </div>
        </div>
      ) : null}

      {interviews.map(interview => (
        <div className="company-message" key={interview.id}>
          <small>
            {INTERVIEW_KIND_LABEL[interview.kind]} · {interview.interviewee_label.toUpperCase()} ·{" "}
            {interview.held_at ? formatDateTime(interview.held_at) : "sem data registrada"}
          </small>
          <p>
            Conduzida por {interview.profiles?.full_name ?? "não registrado"}
            {interview.accompanied_by ? `, acompanhada por ${interview.accompanied_by}` : ""}
            {interview.location ? ` · ${interview.location}` : ""}
          </p>
          <p>
            Consentimento de gravação:{" "}
            <strong>{interview.consent_recorded ? "concedido" : "não houve"}</strong>
            <br />
            Ciência da política de não retaliação:{" "}
            <strong>
              {interview.non_retaliation_notice_given ? "dada antes de começar" : "NÃO REGISTRADA"}
            </strong>
          </p>
          {interview.script ? <p>Roteiro: {interview.script}</p> : null}
          {interview.summary ? <p>{interview.summary}</p> : null}
        </div>
      ))}

      {editable ? <EntrevistaForm id={id} /> : null}
    </div>
  );
}

// ── Achados e conclusão ──────────────────────────────────────────────────────

async function AchadosTab({
  id,
  inv,
  editable,
  isLead,
  ready,
}: {
  id: string;
  inv: Investigation;
  editable: boolean;
  isLead: boolean;
  ready: boolean;
}) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("investigation_findings")
    .select("id, statement, confidence, evidence_ids, created_at")
    .eq("investigation_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const findings = rows ?? [];

  // Cadeia de custódia: os arquivos das denúncias vinculadas, sob a mesma RLS
  // que a aba Evidências do caso. O que não é legível aqui simplesmente não vem.
  const { data: linkRows } = await supabase
    .from("investigation_reports")
    .select("report_id, reports(protocol)")
    .eq("investigation_id", id);

  const protocolOf = new Map(
    (linkRows ?? []).map(row => [row.report_id, row.reports?.protocol ?? "protocolo reservado"]),
  );
  const reportIds = (linkRows ?? []).map(row => row.report_id);

  const { data: evidenceRows } = reportIds.length
    ? await supabase
        .from("report_evidence")
        .select("id, filename, report_id, is_quarantined")
        .in("report_id", reportIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const evidence: EvidenceOption[] = (evidenceRows ?? [])
    .filter(file => file.is_quarantined !== true)
    .map(file => ({
      id: file.id,
      filename: file.filename,
      protocol: protocolOf.get(file.report_id) ?? "protocolo reservado",
    }));
  const evidenceById = new Map(evidence.map(file => [file.id, file]));

  return (
    <>
      <div className="message-box">
        {findings.length === 0 ? (
          <div className="care-note">
            <span>◈</span>
            <div>
              <strong>Nenhum achado registrado</strong>
              <small>
                O achado é a afirmação verificável que a apuração sustenta, com as evidências que a
                embasam.
              </small>
            </div>
          </div>
        ) : null}

        {findings.map((finding, index) => (
          <div key={finding.id}>
            <div className="company-message">
              <small>
                ACHADO {index + 1} ·{" "}
                {CONFIDENCE_LABEL[finding.confidence as Confidence] ?? finding.confidence} ·{" "}
                {formatDate(finding.created_at)}
              </small>
              <p>{finding.statement}</p>
            </div>
            {finding.evidence_ids.length > 0 ? (
              <div className="file-list">
                {finding.evidence_ids.map(evidenceId => {
                  const file = evidenceById.get(evidenceId);
                  return (
                    <div key={evidenceId}>
                      <span>▧</span>
                      <b>
                        {file?.filename ?? "Evidência fora do seu acesso"}
                        <small>
                          {file
                            ? `${file.protocol} · o download fica registrado com hora e autor`
                            : "o arquivo existe mas a RLS não o entrega a você"}
                        </small>
                      </b>
                      {file ? (
                        <a
                          href={`/api/admin/evidence/${evidenceId}`}
                          aria-label={`Baixar ${file.filename}`}
                        >
                          ⤓
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="care-note">
                <span>▧</span>
                <div>
                  <strong>Achado sem evidência apontada</strong>
                  <small>
                    Nada nas denúncias vinculadas foi marcado como suporte deste achado.
                  </small>
                </div>
              </div>
            )}
          </div>
        ))}

        {editable ? null : (
          <div className="care-note">
            <span>◈</span>
            <div>
              <strong>Registro encerrado</strong>
              <small>
                Nenhum achado novo pode ser acrescentado — a investigação está assinada ou seu
                papel não escreve neste módulo.
              </small>
            </div>
          </div>
        )}
      </div>

      {editable ? <AchadoForm id={id} evidence={evidence} /> : null}

      {/* Conclusão: primeiro tempo (quem conduz escreve) e segundo (outra pessoa assina). */}
      {inv.reviewed_at !== null ? (
        <div className="detail-columns">
          <article>
            <small>SÍNTESE DOS ACHADOS</small>
            <p>{inv.findings?.trim() || "Não registrada."}</p>
            <small>RECOMENDAÇÃO</small>
            <p>{inv.recommendation?.trim() || "Não registrada."}</p>
          </article>
          <aside>
            <Field
              label="DESFECHO"
              value={inv.outcome ? OUTCOME_LABEL[inv.outcome] : "Não registrado"}
            />
            <Field label="ASSINADA POR" value={inv.reviewer?.full_name ?? "Não identificado"} />
            <Field label="EM" value={formatDateTime(inv.reviewed_at)} />
            <Field label="CONDUZIDA POR" value={inv.lead?.full_name ?? "Não definida"} />
          </aside>
        </div>
      ) : (
        <>
          {editable ? <ConclusaoForm id={id} inv={inv} /> : null}

          {ready ? (
            isLead ? (
              <div className="privacy-note">
                <b>VOCÊ CONDUZIU ESTA APURAÇÃO · NÃO PODE ASSINÁ-LA</b>
                <p>
                  A dupla assinatura da Lei nº 14.457 só vale se quem revisa não for quem apurou. O
                  CHECK <code>inv_reviewer_not_lead</code> recusa no banco qualquer tentativa de
                  gravar <code>reviewed_by = lead_id</code> — esconder o botão aqui é só evitar que
                  você bata numa porta fechada. Peça a outra pessoa da organização que leia o plano,
                  as entrevistas e os achados e assine.
                </p>
              </div>
            ) : editable ? (
              <RevisarConcluirForm id={id} />
            ) : null
          ) : (
            <div className="care-note">
              <span>◷</span>
              <div>
                <strong>Ainda não está pronta para revisão</strong>
                <small>
                  A segunda assinatura só aparece quando síntese, recomendação e desfecho estiverem
                  preenchidos. Não existe coluna “pronta para revisão”: é esse trio que faz o
                  estado.
                </small>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
