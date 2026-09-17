import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import {
  addDaysOnly,
  formatDate,
  formatDateOnly,
  formatDateTime,
  isPastDue,
  todayInSaoPaulo,
} from "@/lib/admin/labels";
import Field from "@/components/admin/shell/Field";
import {
  CATEGORY_GROUP_LABEL,
  EFFECTIVENESS_LABEL,
  KIND_LABEL,
  RISK_SOURCE_LABEL,
  STATUS_LABEL,
  TABS,
  VERIFY_DEFAULT_DAYS,
  awaitsVerification,
  encodeOrigem,
  measureHref,
  needsFollowUp,
  planHref,
  planStatusClass,
  summarize,
  type PlanFilters,
} from "@/lib/admin/planos";
import {
  AgendarVerificacaoForm,
  ConcluirMedidaForm,
  EditarMedidaForm,
  ExcluirMedidaButton,
  FollowUpForm,
  NovaMedidaForm,
  PlanoForm,
  VerificarMedidaForm,
  type CategoryGroupOption,
  type OrigemGroup,
  type Person,
  type UnitOption,
} from "./PlanControls";

/**
 * Detalhe do plano de ação: resumo em `.kpi-grid`, abas por `?aba=` e o painel
 * da aba aberta. Server Component — as folhas interativas vêm de
 * `PlanControls`.
 *
 * O que organiza este arquivo é o ciclo da NR-01, não o CRUD: fator de risco →
 * medida de prevenção e controle → conclusão → **verificação de eficácia** →
 * follow-up quando não funcionou. A aba Eficácia existe porque essa é a etapa
 * que todo mundo pula e todo auditor pergunta.
 */

async function loadPlan(id: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_plans")
    .select(
      `id, org_id, code, title, status, risk_source, rationale, report_id, investigation_id,
       owner_id, starts_on, due_on, closed_at, created_at,
       owner:profiles!action_plans_owner_id_fkey(full_name),
       reports(protocol, status),
       investigations(code, status)`,
    )
    .eq("id", id)
    // `plans_read` autoriza por TODO vínculo ativo, não só a organização
    // "ativa" no seletor — este filtro evita abrir um plano de outro
    // cliente pelo id.
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

type Plan = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;

async function loadMeasures(planId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_measures")
    .select(
      `id, description, kind, status, category_id, org_unit_id, owner_id, due_on,
       completed_at, completion_notes, effectiveness, effectiveness_criteria,
       verify_on, verified_at, verified_by, verification_notes, sort_order, created_at,
       categories(label_pt, group_key),
       org_units(name),
       owner:profiles!action_measures_owner_id_fkey(full_name),
       verifier:profiles!action_measures_verified_by_fkey(full_name)`,
    )
    .eq("action_plan_id", planId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

type Measure = Awaited<ReturnType<typeof loadMeasures>>[number];

/** Membros ativos, categorias e unidades — os três catálogos dos formulários. */
async function loadCatalogs(orgId: string) {
  const supabase = await createClient();
  const [{ data: memberRows }, { data: categoryRows }, { data: unitRows }] = await Promise.all([
    supabase
      .from("org_members")
      .select("user_id, profiles!org_members_user_id_fkey(full_name)")
      .eq("org_id", orgId)
      .eq("status", "active"),
    supabase
      .from("categories")
      .select("id, label_pt, group_key, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("org_units")
      .select("id, name, sort_order")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const people: Person[] = (memberRows ?? []).map(row => ({
    user_id: row.user_id,
    name: row.profiles?.full_name ?? "Membro sem nome",
  }));

  // O Grupo B (organização do trabalho) vem primeiro: é o que a NR-01 chama de
  // fator psicossocial e o que um plano de ação normalmente trata. O Grupo A
  // continua logo abaixo, sem escondê-lo.
  const categorias: CategoryGroupOption[] = (
    ["organizacao_trabalho", "violencia_conduta"] as const
  ).map(group => ({
    label: CATEGORY_GROUP_LABEL[group],
    options: (categoryRows ?? [])
      .filter(row => row.group_key === group)
      .map(row => ({ id: row.id, label: row.label_pt })),
  }));

  const units: UnitOption[] = (unitRows ?? []).map(row => ({ id: row.id, name: row.name }));

  return { people, categorias, units };
}

/**
 * As opções do campo Origem. Denúncias e investigações vêm sob a RLS de cada
 * módulo: o que a pessoa não pode abrir lá não aparece aqui para vincular.
 */
async function loadOrigens(): Promise<OrigemGroup[]> {
  const supabase = await createClient();
  const [{ data: reportRows }, { data: investigationRows }] = await Promise.all([
    supabase.from("reports").select("id, protocol").order("created_at", { ascending: false }).limit(200),
    supabase
      .from("investigations")
      .select("id, code, scope")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return [
    {
      label: "Denúncia recebida",
      options: (reportRows ?? []).map(report => ({
        value: encodeOrigem("denuncia", report.id),
        label: report.protocol,
      })),
    },
    {
      label: "Investigação",
      options: (investigationRows ?? []).map(investigation => ({
        value: encodeOrigem("investigacao", investigation.id),
        label: `${investigation.code} · ${investigation.scope?.slice(0, 60) ?? "sem escopo"}`,
      })),
    },
    {
      label: "Sem registro vinculado",
      options: [
        { value: encodeOrigem("denuncia", null), label: "Denúncia (sem vincular o protocolo)" },
        { value: encodeOrigem("investigacao", null), label: "Investigação (sem vincular)" },
        { value: encodeOrigem("inventario_riscos", null), label: RISK_SOURCE_LABEL.inventario_riscos },
        { value: encodeOrigem("auditoria", null), label: RISK_SOURCE_LABEL.auditoria },
        { value: encodeOrigem("cipa", null), label: RISK_SOURCE_LABEL.cipa },
        { value: encodeOrigem("outro", null), label: RISK_SOURCE_LABEL.outro },
      ],
    },
  ];
}

/** O ícone da linha diz o estado sem depender de cor. */
function measureIcon(measure: Measure): string {
  if (measure.effectiveness === "eficaz") return "✓";
  if (needsFollowUp(measure.effectiveness)) return "↻";
  if (measure.status === "atrasada") return "!";
  if (measure.status === "concluida") return "◷";
  if (measure.status === "cancelada") return "—";
  return "◇";
}

export default async function PlanDetail({
  id,
  filters,
}: {
  id: string;
  filters: PlanFilters;
}) {
  const staff = await getStaffContext();

  // Sem RLS que autorize, isto volta vazio. É a única checagem de acesso, e é a certa
  // (mais o filtro de organização em `loadPlan`).
  const plan = await loadPlan(id, staff.orgId);
  if (!plan) notFound();

  // Papel aqui só esconde controle: `comite` e `triagem` leem e não escrevem.
  // Quem recusa a escrita são `plans_update` e `measures_update`.
  const editable = staff.role === "admin" || staff.role === "investigador";
  const isAdmin = staff.role === "admin";

  const measures = await loadMeasures(id);
  const resumo = summarize(measures);
  const today = todayInSaoPaulo();
  const planOverdue =
    plan.status !== "concluida" && plan.status !== "cancelada" && isPastDue(plan.due_on, today);

  const counts: Partial<Record<(typeof TABS)[number]["key"], number>> = {
    medidas: resumo.total,
    eficacia: resumo.aguardandoVerificacao,
  };

  return (
    <section className="case-detail">
      <div className="detail-head">
        <div>
          <code>{plan.code}</code>
          <h2>{plan.title}</h2>
          <span>
            {plan.owner?.full_name ?? "Sem responsável definido"} · aberto em{" "}
            {formatDate(plan.created_at)}
          </span>
        </div>
        <span className={planStatusClass(plan.status)}>{STATUS_LABEL[plan.status]}</span>
      </div>

      {/* O quarto número é o que a CIPA lê: medida implantada não é medida que funcionou. */}
      <div className="kpi-grid">
        <article>
          <small>MEDIDAS</small>
          <strong>{resumo.total}</strong>
          <span>de prevenção e controle</span>
        </article>
        <article>
          <small>CONCLUÍDAS</small>
          <strong>{resumo.concluidas}</strong>
          <span>implantadas</span>
        </article>
        <article className={resumo.atrasadas > 0 ? "attention" : undefined}>
          <small>ATRASADAS</small>
          <strong>{resumo.atrasadas}</strong>
          <span>prazo vencido</span>
        </article>
        <article className={resumo.eficazes === 0 && resumo.concluidas > 0 ? "attention" : undefined}>
          <small>VERIFICADAS COMO EFICAZES</small>
          <strong>{resumo.eficazes}</strong>
          <span>o número que importa</span>
        </article>
      </div>

      {planOverdue ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>Prazo do plano vencido</strong>
            <p>
              O prazo era {formatDateOnly(plan.due_on as string)}. Plano de ação que passa do prazo
              deixa o fator de risco em aberto — replaneje na aba Plano ou conclua as medidas que
              faltam.
            </p>
          </div>
        </div>
      ) : null}

      {resumo.aguardandoVerificacao > 0 ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>
              {resumo.aguardandoVerificacao} medida
              {resumo.aguardandoVerificacao === 1 ? "" : "s"} concluída
              {resumo.aguardandoVerificacao === 1 ? "" : "s"} sem verificação de eficácia
            </strong>
            <p>
              Implantar não é o fim. Enquanto ninguém conferir o resultado contra o critério
              escrito na criação, o plano não prova que o risco foi tratado. A aba Eficácia tem o
              controle — e quem verifica não pode ser quem executou.
            </p>
          </div>
        </div>
      ) : null}

      {/* Abas por URL: o conteúdo é do servidor e o link é compartilhável. */}
      <div className="detail-tabs">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={planHref(id, filters, tab.key)}
            className={filters.aba === tab.key ? "active" : ""}
          >
            {tab.label}
            {counts[tab.key] ? <b>{counts[tab.key]}</b> : null}
          </Link>
        ))}
      </div>

      {filters.aba === "plano" ? (
        <PlanoTab plan={plan} editable={editable} overdue={planOverdue} />
      ) : null}
      {filters.aba === "medidas" ? (
        <MedidasTab
          plan={plan}
          measures={measures}
          filters={filters}
          editable={editable}
          isAdmin={isAdmin}
          today={today}
        />
      ) : null}
      {filters.aba === "eficacia" ? (
        <EficaciaTab
          plan={plan}
          measures={measures}
          editable={editable}
          selfId={staff.userId}
          today={today}
        />
      ) : null}
    </section>
  );
}

// ── Plano ────────────────────────────────────────────────────────────────────

async function PlanoTab({
  plan,
  editable,
  overdue,
}: {
  plan: Plan;
  editable: boolean;
  overdue: boolean;
}) {
  const periodo =
    plan.starts_on && plan.due_on
      ? `${formatDateOnly(plan.starts_on)} a ${formatDateOnly(plan.due_on)}`
      : plan.due_on
        ? `até ${formatDateOnly(plan.due_on)}`
        : plan.starts_on
          ? `a partir de ${formatDateOnly(plan.starts_on)}`
          : "Sem período definido";

  const origem = plan.risk_source
    ? RISK_SOURCE_LABEL[plan.risk_source as keyof typeof RISK_SOURCE_LABEL]
    : "Não registrada";

  return (
    <>
      {/* A origem com link é o que costura o plano ao módulo que o gerou. */}
      {plan.report_id || plan.investigation_id ? (
        <div className="file-list">
          {plan.report_id ? (
            <div>
              <span>◇</span>
              <b>
                {plan.reports?.protocol ?? "Protocolo fora do seu acesso"}
                <small>
                  denúncia que deu origem a este plano
                  {plan.reports?.status ? ` · ${plan.reports.status}` : ""}
                </small>
              </b>
              <Link href={`/admin/denuncias/${plan.report_id}`} aria-label="Abrir a denúncia">
                →
              </Link>
            </div>
          ) : null}
          {plan.investigation_id ? (
            <div>
              <span>⚖</span>
              <b>
                {plan.investigations?.code ?? "Investigação fora do seu acesso"}
                <small>investigação que deu origem a este plano</small>
              </b>
              <Link
                href={`/admin/investigacoes/${plan.investigation_id}`}
                aria-label="Abrir a investigação"
              >
                →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="detail-columns">
        <article>
          <small>JUSTIFICATIVA</small>
          <p>{plan.rationale?.trim() || "Nenhuma justificativa registrada."}</p>
        </article>
        <aside>
          <Field label="SITUAÇÃO" value={STATUS_LABEL[plan.status]} />
          <Field label="ORIGEM DO RISCO" value={origem} />
          <Field label="RESPONSÁVEL" value={plan.owner?.full_name ?? "Não definido"} />
          <Field label="PERÍODO" value={periodo} danger={overdue} />
          <Field
            label="ENCERRAMENTO"
            value={plan.closed_at ? formatDateTime(plan.closed_at) : "Em aberto"}
          />
        </aside>
      </div>

      {editable ? <PlanoFormBlock plan={plan} /> : null}
    </>
  );
}

/** Separado só para manter o `await` dos catálogos fora do corpo da aba. */
async function PlanoFormBlock({ plan }: { plan: Plan }) {
  const [{ people }, origens] = await Promise.all([
    loadCatalogs(plan.org_id),
    loadOrigens(),
  ]);

  return (
    <PlanoForm
      id={plan.id}
      plan={{
        title: plan.title,
        rationale: plan.rationale,
        status: plan.status,
        owner_id: plan.owner_id,
        starts_on: plan.starts_on,
        due_on: plan.due_on,
        origem: `${plan.risk_source ?? "outro"}:${plan.report_id ?? plan.investigation_id ?? ""}`,
      }}
      origens={origens}
      people={people}
    />
  );
}

// ── Medidas ──────────────────────────────────────────────────────────────────

async function MedidasTab({
  plan,
  measures,
  filters,
  editable,
  isAdmin,
  today,
}: {
  plan: Plan;
  measures: Measure[];
  filters: PlanFilters;
  editable: boolean;
  isAdmin: boolean;
  today: string;
}) {
  const { people, categorias, units } = await loadCatalogs(plan.org_id);
  const aberta = measures.find(measure => measure.id === filters.medida) ?? null;
  const semFator = measures.filter(measure => !measure.category_id).length;

  return (
    <>
      <div className="privacy-note">
        <b>MEDIDAS DE PREVENÇÃO E CONTROLE · NÃO SÃO TAREFAS</b>
        <p>
          É o vocabulário da NR-01, e é o que o auditor procura. Cada medida aponta um{" "}
          <strong>fator de risco</strong> do catálogo — é esse vínculo que permite responder “que
          percentual dos fatores de risco identificados tem plano ativo”, o número que separa um
          PGR real de um PGR de papel.
        </p>
        <p>
          A situação <strong>Atrasada</strong> não aparece em nenhum campo de escolha: quem a marca
          é <code>sweep_overdue()</code>, no cron, quando o prazo vence — e ela some sozinha quando
          a medida é concluída.
        </p>
      </div>

      {semFator > 0 ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>
              {semFator} medida{semFator === 1 ? "" : "s"} sem fator de risco associado
            </strong>
            <p>
              Medida sem fator de risco não entra em nenhum indicador do PGR. Abra a medida e
              escolha o fator que ela trata.
            </p>
          </div>
        </div>
      ) : null}

      {measures.length === 0 ? (
        <div className="care-note">
          <span>◈</span>
          <div>
            <strong>Nenhuma medida registrada</strong>
            <small>
              Um plano sem medidas é uma intenção. Acrescente abaixo a primeira medida de prevenção
              ou controle.
            </small>
          </div>
        </div>
      ) : (
        <div className="file-list">
          {measures.map(measure => {
            const overdue = measure.status === "atrasada" || isPastDue(measure.due_on, today);
            const aberto = measure.id === filters.medida;
            return (
              <div key={measure.id}>
                <span>{measureIcon(measure)}</span>
                <b>
                  {measure.description}
                  <small>
                    {measure.categories?.label_pt ?? "SEM FATOR DE RISCO"} ·{" "}
                    {KIND_LABEL[measure.kind].split(" — ")[0]} ·{" "}
                    {measure.owner?.full_name ?? "sem responsável"}
                  </small>
                  <small>
                    {measure.due_on ? (
                      <span className={overdue ? "danger" : undefined}>
                        prazo {formatDateOnly(measure.due_on)}
                      </span>
                    ) : (
                      "sem prazo"
                    )}
                    {measure.org_units?.name ? ` · ${measure.org_units.name}` : ""}
                    {measure.effectiveness !== "nao_verificada"
                      ? ` · ${EFFECTIVENESS_LABEL[measure.effectiveness]}`
                      : ""}
                  </small>
                </b>
                <span className={planStatusClass(measure.status)}>
                  {STATUS_LABEL[measure.status]}
                </span>
                <Link
                  href={measureHref(plan.id, filters, aberto ? null : measure.id)}
                  aria-label={aberto ? "Fechar esta medida" : "Abrir esta medida"}
                >
                  {aberto ? "×" : "→"}
                </Link>
                {isAdmin ? <ExcluirMedidaButton id={plan.id} measureId={measure.id} /> : null}
              </div>
            );
          })}
        </div>
      )}

      {aberta ? (
        <MedidaAberta
          plan={plan}
          measure={aberta}
          editable={editable}
          categorias={categorias}
          people={people}
          units={units}
          today={today}
        />
      ) : null}

      {editable && !aberta ? (
        <NovaMedidaForm id={plan.id} categorias={categorias} people={people} units={units} />
      ) : null}
    </>
  );
}

/** O painel da medida escolhida na lista: leitura completa e, se couber, os controles. */
function MedidaAberta({
  plan,
  measure,
  editable,
  categorias,
  people,
  units,
  today,
}: {
  plan: Plan;
  measure: Measure;
  editable: boolean;
  categorias: CategoryGroupOption[];
  people: Person[];
  units: UnitOption[];
  today: string;
}) {
  const verificada = measure.effectiveness !== "nao_verificada";

  return (
    <>
      <div className="detail-columns">
        <article>
          <small>MEDIDA</small>
          <p>{measure.description}</p>
          <small>CRITÉRIO DE EFICÁCIA (ESCRITO NA CRIAÇÃO)</small>
          <p>
            {measure.effectiveness_criteria?.trim() ||
              "Nenhum critério foi escrito — esta medida não tem como ser verificada."}
          </p>
          {measure.completion_notes ? (
            <>
              <small>O QUE FOI IMPLANTADO</small>
              <p>{measure.completion_notes}</p>
            </>
          ) : null}
        </article>
        <aside>
          <Field label="SITUAÇÃO" value={STATUS_LABEL[measure.status]} />
          <Field
            label="FATOR DE RISCO"
            value={measure.categories?.label_pt ?? "Não associado"}
            danger={!measure.category_id}
          />
          <Field label="TIPO" value={KIND_LABEL[measure.kind]} />
          <Field label="QUEM EXECUTA" value={measure.owner?.full_name ?? "Não definido"} />
          <Field label="UNIDADE" value={measure.org_units?.name ?? "Toda a organização"} />
          <Field
            label="PRAZO"
            value={measure.due_on ? formatDateOnly(measure.due_on) : "Sem prazo"}
            danger={measure.status === "atrasada" || isPastDue(measure.due_on, today)}
          />
          <Field
            label="CONCLUÍDA EM"
            value={measure.completed_at ? formatDateTime(measure.completed_at) : "Em aberto"}
          />
          <Field
            label="VERIFICAR EM"
            value={measure.verify_on ? formatDateOnly(measure.verify_on) : "Não agendada"}
          />
          <Field label="EFICÁCIA" value={EFFECTIVENESS_LABEL[measure.effectiveness]} />
        </aside>
      </div>

      {verificada ? (
        <div className="privacy-note">
          <b>MEDIDA JÁ VERIFICADA · O REGISTRO NÃO SE REESCREVE</b>
          <p>
            Verificada como{" "}
            <strong>{EFFECTIVENESS_LABEL[measure.effectiveness]}</strong> por{" "}
            {measure.verifier?.full_name ?? "pessoa não identificada"} em{" "}
            {measure.verified_at ? formatDateTime(measure.verified_at) : "data não registrada"}.
            Reescrever a medida agora apagaria o critério contra o qual ela foi julgada — se o
            tratamento precisa continuar, o caminho é um plano de follow-up, na aba Eficácia.
          </p>
        </div>
      ) : null}

      {editable && !verificada ? (
        <>
          <EditarMedidaForm
            id={plan.id}
            measureId={measure.id}
            medida={{
              description: measure.description,
              kind: measure.kind,
              status: measure.status,
              category_id: measure.category_id,
              owner_id: measure.owner_id,
              org_unit_id: measure.org_unit_id,
              due_on: measure.due_on,
              effectiveness_criteria: measure.effectiveness_criteria,
            }}
            categorias={categorias}
            people={people}
            units={units}
          />
          {measure.status === "concluida" ? (
            <div className="message-box">
              <div className="message-head">
                <span>◷</span>
                <div>
                  <strong>Verificação agendada para {measure.verify_on ? formatDateOnly(measure.verify_on) : "data não definida"}</strong>
                  <small>A verificação em si é feita na aba Eficácia, por outra pessoa.</small>
                </div>
              </div>
              <AgendarVerificacaoForm
                id={plan.id}
                measureId={measure.id}
                atual={measure.verify_on ?? addDaysOnly(today, VERIFY_DEFAULT_DAYS)}
              />
            </div>
          ) : (
            <ConcluirMedidaForm
              id={plan.id}
              measureId={measure.id}
              sugestaoVerificacao={addDaysOnly(today, VERIFY_DEFAULT_DAYS)}
            />
          )}
        </>
      ) : null}
    </>
  );
}

// ── Eficácia ─────────────────────────────────────────────────────────────────

function EficaciaTab({
  plan,
  measures,
  editable,
  selfId,
  today,
}: {
  plan: Plan;
  measures: Measure[];
  editable: boolean;
  selfId: string;
  today: string;
}) {
  const pendentes = measures.filter(awaitsVerification);
  const verificadas = measures.filter(measure => measure.effectiveness !== "nao_verificada");
  const abertas = measures.filter(measure => measure.status !== "concluida");

  return (
    <>
      <div className="privacy-note">
        <b>VERIFICAÇÃO DE EFICÁCIA · A ETAPA QUE TODO MUNDO PULA</b>
        <p>
          Uma medida implantada não é uma medida que funcionou. A verificação compara o resultado
          com o <strong>critério escrito quando a medida foi criada</strong> — por isso o critério é
          obrigatório lá e não aqui: critério definido depois do resultado é justificativa, não
          verificação.
        </p>
        <p>
          E quem verifica não é quem executou. O CHECK <code>measure_verifier_not_owner</code>{" "}
          recusa no banco qualquer registro em que <code>verified_by = owner_id</code>; a tela
          apenas evita que a pessoa bata numa porta fechada.
        </p>
      </div>

      {pendentes.length === 0 && verificadas.length === 0 ? (
        <div className="care-note">
          <span>◷</span>
          <div>
            <strong>Nada a verificar ainda</strong>
            <small>
              {abertas.length > 0
                ? "A verificação começa quando uma medida é concluída, na aba Medidas."
                : "Este plano ainda não tem medidas."}
            </small>
          </div>
        </div>
      ) : null}

      {pendentes.map(measure => {
        const sou = measure.owner_id !== null && measure.owner_id === selfId;
        const atrasada = isPastDue(measure.verify_on, today);
        return (
          <div key={measure.id}>
            <div className="detail-columns">
              <article>
                <small>MEDIDA CONCLUÍDA · AGUARDA VERIFICAÇÃO</small>
                <p>{measure.description}</p>
                <small>CRITÉRIO DEFINIDO NA CRIAÇÃO</small>
                <p>{measure.effectiveness_criteria?.trim() || "Sem critério escrito."}</p>
              </article>
              <aside>
                <Field
                  label="FATOR DE RISCO"
                  value={measure.categories?.label_pt ?? "Não associado"}
                />
                <Field label="QUEM EXECUTOU" value={measure.owner?.full_name ?? "Não definido"} />
                <Field
                  label="CONCLUÍDA EM"
                  value={measure.completed_at ? formatDateTime(measure.completed_at) : "—"}
                />
                <Field
                  label="VERIFICAR EM"
                  value={measure.verify_on ? formatDateOnly(measure.verify_on) : "Não agendada"}
                  danger={atrasada}
                />
              </aside>
            </div>

            {!editable ? null : sou ? (
              <div className="privacy-note">
                <b>VOCÊ EXECUTOU ESTA MEDIDA · NÃO PODE VERIFICÁ-LA</b>
                <p>
                  Verificar o próprio trabalho não é verificação. O CHECK{" "}
                  <code>measure_verifier_not_owner</code> recusa no banco a gravação de{" "}
                  <code>verified_by = owner_id</code> — esconder o formulário aqui é só evitar que
                  você bata numa porta fechada. Peça a outra pessoa da organização que confira o
                  resultado contra o critério acima.
                </p>
              </div>
            ) : (
              <VerificarMedidaForm
                id={plan.id}
                measureId={measure.id}
                criterio={
                  measure.effectiveness_criteria?.trim() ||
                  "Nenhum critério foi escrito quando a medida foi criada. Registre isso na verificação: sem critério prévio, o que se pode afirmar é limitado."
                }
              />
            )}
          </div>
        );
      })}

      {verificadas.map(measure => (
        <div key={measure.id}>
          <div className="detail-columns">
            <article>
              <small>MEDIDA VERIFICADA · {EFFECTIVENESS_LABEL[measure.effectiveness].toUpperCase()}</small>
              <p>{measure.description}</p>
              <small>CRITÉRIO</small>
              <p>{measure.effectiveness_criteria?.trim() || "Sem critério escrito."}</p>
              <small>O QUE FOI OBSERVADO</small>
              <p>{measure.verification_notes?.trim() || "Sem observações registradas."}</p>
            </article>
            <aside>
              <Field
                label="RESULTADO"
                value={EFFECTIVENESS_LABEL[measure.effectiveness]}
                danger={needsFollowUp(measure.effectiveness)}
              />
              <Field
                label="VERIFICADA POR"
                value={measure.verifier?.full_name ?? "Não identificado"}
              />
              <Field
                label="EM"
                value={measure.verified_at ? formatDateTime(measure.verified_at) : "—"}
              />
              <Field label="QUEM EXECUTOU" value={measure.owner?.full_name ?? "Não definido"} />
            </aside>
          </div>

          {needsFollowUp(measure.effectiveness) && editable ? (
            <FollowUpForm
              id={plan.id}
              measureId={measure.id}
              tituloSugerido={`Follow-up do ${plan.code}: ${measure.categories?.label_pt ?? "fator de risco"}`}
              prazoSugerido={addDaysOnly(today, 90)}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}
