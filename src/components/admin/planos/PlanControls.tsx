"use client";

import { useActionState } from "react";

import {
  agendarVerificacao,
  atualizarMedida,
  concluirMedida,
  criarMedida,
  criarPlano,
  criarPlanoDeFollowUp,
  excluirMedida,
  salvarPlano,
  verificarMedida,
  type ActionState,
} from "@/app/admin/planos-de-acao/[id]/actions";
import {
  EFFECTIVENESS_LABEL,
  KIND_LABEL,
  KIND_ORDER,
  SELECTABLE_PLAN_STATUS,
  SELECTABLE_STATUS,
  STATUS_LABEL,
  VERDICT_ORDER,
  VERIFY_DEFAULT_DAYS,
  type MeasureKind,
  type MeasureStatus,
} from "@/lib/admin/planos";

/**
 * As folhas interativas do módulo de planos de ação. São client components pelo
 * `useActionState` — é o que permite mostrar o erro da ação sem transformar a
 * página inteira em cliente, e cada uma continua sendo um `<form action=…>` de
 * verdade.
 *
 * Nenhuma decide acesso. O que some da tela some por cortesia; quem garante são
 * as policies (`plans_update`, `measures_update`, `measures_delete`) e os
 * CHECKs (`measure_verifier_not_owner`, as duas consistências).
 *
 * E em nenhum `<select>` deste arquivo existe a opção `atrasada`: esse estado é
 * do `sweep_overdue()`, não de quem preenche formulário.
 */

const EMPTY: ActionState = {};

export type Person = { user_id: string; name: string };
export type OrigemOption = { value: string; label: string };
export type OrigemGroup = { label: string; options: OrigemOption[] };
export type CategoryOption = { id: string; label: string };
export type CategoryGroupOption = { label: string; options: CategoryOption[] };
export type UnitOption = { id: string; name: string };

/** Erro e aviso saem sempre no mesmo lugar e com a mesma marcação. */
function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      {state.aviso ? (
        <div className="care-note">
          <span>✓</span>
          <div>
            <strong>Registrado</strong>
            <small>{state.aviso}</small>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * `<select>` é não controlado: nem o re-render nem o reset automático do React
 * reescrevem o valor de um. Sem uma `key` que mude junto com o eco, a escolha
 * recusada some da tela e a pessoa refaz tudo. Mesmo remédio dos outros módulos.
 */
function ecoKey(eco: Record<string, string>, ...names: string[]): string {
  return names.map(name => `${name}=${eco[name] ?? ""}`).join("&");
}

/**
 * Nos formulários que EDITAM algo já gravado, a `key` carrega também o valor
 * vindo do servidor: sem isso, salvar com sucesso limpa o eco mas não repõe o
 * `defaultValue`, e o `<select>` volta ao primeiro item logo depois de gravar.
 */
function formKey(eco: Record<string, string>, ...serverValues: (string | null)[]): string {
  return [...serverValues.map(value => value ?? ""), JSON.stringify(eco)].join("|");
}

/**
 * A origem é UM campo e três colunas. O valor é `risk_source:uuid?`, montado no
 * servidor por `encodeOrigem` — assim não existe combinação inconsistente para
 * a ação recusar depois.
 */
function OrigemField({ groups, value }: { groups: OrigemGroup[]; value: string }) {
  return (
    <label>
      Origem do risco
      <select name="origem" defaultValue={value}>
        <option value="">Escolha a origem</option>
        {groups.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/**
 * O fator de risco associado é o campo que dá sentido ao módulo: é ele que
 * permite responder "% de fatores de risco com plano ativo". Os fatores do
 * Grupo B (organização do trabalho) vêm primeiro porque são o objeto da NR-01
 * quando se fala em risco psicossocial — mas os demais continuam à mão.
 */
function CategoriaField({
  groups,
  value,
}: {
  groups: CategoryGroupOption[];
  value: string;
}) {
  return (
    <label>
      Fator de risco associado
      <select name="category_id" defaultValue={value}>
        <option value="">Escolha o fator de risco</option>
        {groups.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// ── Abertura do plano ────────────────────────────────────────────────────────

export function NovoPlanoForm({
  origens,
  people,
  selfId,
}: {
  origens: OrigemGroup[];
  people: Person[];
  selfId: string;
}) {
  const [state, action, pending] = useActionState(criarPlano, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>◈</span>
        <div>
          <strong>Abrir plano de ação</strong>
          <small>O código (PA-AAAA-NNNN) é gerado pelo banco, um por organização.</small>
        </div>
      </div>

      <form action={action}>
        <div className="field-grid two" key={ecoKey(eco, "origem", "owner_id")}>
          <OrigemField groups={origens} value={eco.origem ?? ""} />
          <label>
            Responsável pelo plano
            <select name="owner_id" defaultValue={eco.owner_id ?? selfId}>
              <option value="">Ainda não definido</option>
              {people.map(person => (
                <option key={person.user_id} value={person.user_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início
            <input type="date" name="starts_on" defaultValue={eco.starts_on ?? ""} />
          </label>
          <label>
            Prazo
            <input type="date" name="due_on" defaultValue={eco.due_on ?? ""} />
          </label>
        </div>

        <label className="wide-field">
          Título do plano
          <textarea
            name="title"
            rows={2}
            defaultValue={eco.title ?? ""}
            placeholder="Ex.: Redistribuição de carga e revisão de metas na operação noturna"
          />
        </label>
        <label className="wide-field">
          Justificativa
          <textarea
            name="rationale"
            rows={4}
            defaultValue={eco.rationale ?? ""}
            placeholder="Que fator de risco este plano trata e por que ele existe"
          />
          <small>
            É a justificativa que liga o plano ao fator de risco na hora da fiscalização. Sem ela, o
            plano é uma lista de tarefas.
          </small>
        </label>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Abrindo…" : "Abrir plano de ação"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Plano ────────────────────────────────────────────────────────────────────

export function PlanoForm({
  id,
  plan,
  origens,
  people,
}: {
  id: string;
  plan: {
    title: string;
    rationale: string | null;
    status: MeasureStatus;
    owner_id: string | null;
    starts_on: string | null;
    due_on: string | null;
    origem: string;
  };
  origens: OrigemGroup[];
  people: Person[];
}) {
  const [state, action, pending] = useActionState(salvarPlano, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <form
        action={action}
        key={formKey(
          eco,
          plan.title,
          plan.rationale,
          plan.status,
          plan.owner_id,
          plan.starts_on,
          plan.due_on,
          plan.origem,
        )}
      >
        <input type="hidden" name="id" value={id} />
        <div className="field-grid two" key={ecoKey(eco, "status", "owner_id", "origem")}>
          <label>
            Situação do plano
            <select name="status" defaultValue={eco.status ?? plan.status}>
              {SELECTABLE_PLAN_STATUS.map(status => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsável pelo plano
            <select name="owner_id" defaultValue={eco.owner_id ?? plan.owner_id ?? ""}>
              <option value="">Ainda não definido</option>
              {people.map(person => (
                <option key={person.user_id} value={person.user_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <OrigemField groups={origens} value={eco.origem ?? plan.origem} />
          <label>
            Início
            <input
              type="date"
              name="starts_on"
              defaultValue={eco.starts_on ?? plan.starts_on ?? ""}
            />
          </label>
          <label>
            Prazo
            <input type="date" name="due_on" defaultValue={eco.due_on ?? plan.due_on ?? ""} />
          </label>
        </div>

        <label className="wide-field">
          Título do plano
          <textarea name="title" rows={2} defaultValue={eco.title ?? plan.title} />
        </label>
        <label className="wide-field">
          Justificativa
          <textarea
            name="rationale"
            rows={4}
            defaultValue={eco.rationale ?? plan.rationale ?? ""}
          />
        </label>

        <div className="care-note">
          <span>⚙</span>
          <div>
            <strong>“Atrasada” não está na lista, e não é esquecimento</strong>
            <small>
              Esse estado é marcado por <code>sweep_overdue()</code>, que roda no cron: uma medida
              cujo prazo venceu vira atrasada e o plano acompanha; concluída a medida, o plano
              volta sozinho. Se alguém pudesse marcá-lo à mão, o indicador deixaria de significar
              “venceu”.
            </small>
          </div>
        </div>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar plano"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Medidas ──────────────────────────────────────────────────────────────────

/** Os campos que criar e editar uma medida compartilham. */
function CamposDaMedida({
  eco,
  categorias,
  people,
  units,
  atual,
}: {
  eco: Record<string, string>;
  categorias: CategoryGroupOption[];
  people: Person[];
  units: UnitOption[];
  atual?: {
    description: string;
    kind: MeasureKind;
    category_id: string | null;
    owner_id: string | null;
    org_unit_id: string | null;
    due_on: string | null;
    effectiveness_criteria: string | null;
  };
}) {
  return (
    <>
      <label className="wide-field">
        A medida de prevenção ou controle
        <textarea
          name="description"
          rows={3}
          defaultValue={eco.description ?? atual?.description ?? ""}
          placeholder="O que será feito, concretamente. Não é uma intenção nem uma diretriz."
        />
      </label>

      <div
        className="field-grid two"
        key={ecoKey(eco, "kind", "category_id", "owner_id", "org_unit_id")}
      >
        <CategoriaField
          groups={categorias}
          value={eco.category_id ?? atual?.category_id ?? ""}
        />
        <label>
          Tipo da medida
          <select name="kind" defaultValue={eco.kind ?? atual?.kind ?? "estrutural"}>
            {KIND_ORDER.map(kind => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quem executa
          <select name="owner_id" defaultValue={eco.owner_id ?? atual?.owner_id ?? ""}>
            <option value="">Ainda não definido</option>
            {people.map(person => (
              <option key={person.user_id} value={person.user_id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unidade
          <select name="org_unit_id" defaultValue={eco.org_unit_id ?? atual?.org_unit_id ?? ""}>
            <option value="">Toda a organização</option>
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prazo da medida
          <input type="date" name="due_on" defaultValue={eco.due_on ?? atual?.due_on ?? ""} />
        </label>
      </div>

      <label className="wide-field">
        Critério de eficácia
        <textarea
          name="effectiveness_criteria"
          rows={3}
          defaultValue={eco.effectiveness_criteria ?? atual?.effectiveness_criteria ?? ""}
          placeholder="Como saberemos que funcionou: que indicador, medido como, comparado a quê"
        />
        <small>
          Escrito agora, antes de executar. Critério definido depois de ver o resultado é
          justificativa, não verificação — e é a diferença entre um plano auditável e um relatório
          de boas intenções.
        </small>
      </label>
    </>
  );
}

export function NovaMedidaForm({
  id,
  categorias,
  people,
  units,
}: {
  id: string;
  categorias: CategoryGroupOption[];
  people: Person[];
  units: UnitOption[];
}) {
  const [state, action, pending] = useActionState(criarMedida, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⊕</span>
        <div>
          <strong>Acrescentar medida de prevenção ou controle</strong>
          <small>NR-01: medidas, não tarefas. Cada uma trata um fator de risco nomeado.</small>
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <CamposDaMedida eco={eco} categorias={categorias} people={people} units={units} />
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Acrescentar medida"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function EditarMedidaForm({
  id,
  measureId,
  medida,
  categorias,
  people,
  units,
}: {
  id: string;
  measureId: string;
  medida: {
    description: string;
    kind: MeasureKind;
    status: MeasureStatus;
    category_id: string | null;
    owner_id: string | null;
    org_unit_id: string | null;
    due_on: string | null;
    effectiveness_criteria: string | null;
  };
  categorias: CategoryGroupOption[];
  people: Person[];
  units: UnitOption[];
}) {
  const [state, action, pending] = useActionState(atualizarMedida, EMPTY);
  const eco = state.enviado ?? {};

  // `atrasada` nunca chega ao `<select>`: se a medida está atrasada, a situação
  // volta a `em_andamento` ao salvar, e o próximo `sweep_overdue()` remarca se
  // o prazo continuar vencido.
  const situacaoAtual: MeasureStatus =
    medida.status === "atrasada" || medida.status === "concluida"
      ? "em_andamento"
      : medida.status;

  return (
    <div className="message-box">
      <div className="message-head">
        <span>✎</span>
        <div>
          <strong>Editar medida</strong>
          <small>Enquanto a eficácia não foi verificada, a medida ainda pode ser reescrita.</small>
        </div>
      </div>

      <form
        action={action}
        key={formKey(
          eco,
          medida.description,
          medida.kind,
          medida.status,
          medida.category_id,
          medida.owner_id,
          medida.org_unit_id,
          medida.due_on,
          medida.effectiveness_criteria,
        )}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="medida_id" value={measureId} />
        <CamposDaMedida
          eco={eco}
          categorias={categorias}
          people={people}
          units={units}
          atual={medida}
        />
        <div className="field-grid" key={ecoKey(eco, "status")}>
          <label>
            Situação
            <select name="status" defaultValue={eco.status ?? situacaoAtual}>
              {SELECTABLE_STATUS.map(status => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <small>
              “Concluída” tem ação própria (exige data de conclusão no mesmo registro) e
              “Atrasada” é marcada pelo sistema.
            </small>
          </label>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar medida"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function ConcluirMedidaForm({
  id,
  measureId,
  sugestaoVerificacao,
}: {
  id: string;
  measureId: string;
  sugestaoVerificacao: string;
}) {
  const [state, action, pending] = useActionState(concluirMedida, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>✓</span>
        <div>
          <strong>Concluir a medida</strong>
          <small>Concluir não é o fim: agenda-se aqui a verificação de que funcionou.</small>
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="medida_id" value={measureId} />
        <label className="wide-field">
          O que foi efetivamente implantado
          <textarea
            name="completion_notes"
            rows={3}
            defaultValue={eco.completion_notes ?? ""}
            placeholder="O que mudou na prática, e desde quando"
          />
          <small>Este texto fica só aqui — a trilha de auditoria registra o evento, não o texto.</small>
        </label>
        <div className="field-grid">
          <label>
            Verificar a eficácia em
            <input
              type="date"
              name="verify_on"
              defaultValue={eco.verify_on ?? sugestaoVerificacao}
            />
            <small>
              Sugestão de {VERIFY_DEFAULT_DAYS} dias — tempo para o efeito aparecer sem que a
              medida caia no esquecimento. Ajuste se o seu indicador tiver outro ciclo.
            </small>
          </label>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Concluindo…" : "Concluir e agendar verificação"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function AgendarVerificacaoForm({
  id,
  measureId,
  atual,
}: {
  id: string;
  measureId: string;
  atual: string;
}) {
  const [state, action, pending] = useActionState(agendarVerificacao, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="medida_id" value={measureId} />
      <div className="field-grid">
        <label>
          Reagendar a verificação
          <input type="date" name="verify_on" defaultValue={eco.verify_on ?? atual} />
        </label>
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Agendando…" : "Reagendar"}
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </form>
  );
}

/**
 * A verificação de eficácia. Este formulário só é montado para quem NÃO executou
 * a medida — quando o responsável é a própria pessoa logada, o painel mostra a
 * explicação em vez do controle. Esconder não é impedir: `measure_verifier_not_owner`
 * recusaria no banco.
 */
export function VerificarMedidaForm({
  id,
  measureId,
  criterio,
}: {
  id: string;
  measureId: string;
  criterio: string;
}) {
  const [state, action, pending] = useActionState(verificarMedida, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⚖</span>
        <div>
          <strong>Verificar a eficácia</strong>
          <small>Julgue o resultado contra o critério escrito quando a medida foi criada.</small>
        </div>
      </div>

      <div className="privacy-note">
        <b>O CRITÉRIO, COMO FOI ESCRITO NA CRIAÇÃO DA MEDIDA</b>
        <p>{criterio}</p>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="medida_id" value={measureId} />
        <div className="field-grid" key={ecoKey(eco, "effectiveness")}>
          <label>
            Resultado
            <select name="effectiveness" defaultValue={eco.effectiveness ?? ""}>
              <option value="">Escolha o resultado</option>
              {VERDICT_ORDER.map(verdict => (
                <option key={verdict} value={verdict}>
                  {EFFECTIVENESS_LABEL[verdict]}
                </option>
              ))}
            </select>
            <small>
              “Não verificada” não é resultado: é o estado de quem ainda não olhou.
            </small>
          </label>
        </div>
        <label className="wide-field">
          O que foi observado
          <textarea
            name="verification_notes"
            rows={4}
            defaultValue={eco.verification_notes ?? ""}
            placeholder="O indicador do critério, medido agora, e o que ele mostra"
          />
        </label>
        <label className="check-row">
          <input type="checkbox" name="confirmado" value="1" />
          Afirmo que não executei esta medida e que julguei o resultado contra o critério acima,
          não contra o que foi feito.
        </label>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Registrar verificação"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function ExcluirMedidaButton({
  id,
  measureId,
}: {
  id: string;
  measureId: string;
}) {
  const [state, action, pending] = useActionState(excluirMedida, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="medida_id" value={measureId} />
      <button type="submit" disabled={pending} aria-label="Excluir esta medida">
        {pending ? "…" : "✕"}
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </form>
  );
}

/**
 * O fecho do ciclo da NR-01. Aparece só sob uma medida verificada como ineficaz
 * ou parcialmente eficaz, e o plano novo já nasce ligado à mesma origem.
 */
export function FollowUpForm({
  id,
  measureId,
  tituloSugerido,
  prazoSugerido,
}: {
  id: string;
  measureId: string;
  tituloSugerido: string;
  prazoSugerido: string;
}) {
  const [state, action, pending] = useActionState(criarPlanoDeFollowUp, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>↻</span>
        <div>
          <strong>Abrir plano de follow-up</strong>
          <small>Medida que não atingiu o critério não termina em “implantado”.</small>
        </div>
      </div>

      <div className="privacy-note">
        <b>O PLANO NOVO NASCE LIGADO À MESMA ORIGEM</b>
        <p>
          A denúncia ou a investigação que motivou este plano é herdada pelo follow-up, para que a
          cadeia fator de risco → medida → verificação → nova medida fique legível a quem auditar.
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="medida_id" value={measureId} />
        <label className="wide-field">
          Título do plano de follow-up
          <textarea name="title" rows={2} defaultValue={eco.title ?? tituloSugerido} />
        </label>
        <div className="field-grid">
          <label>
            Prazo
            <input type="date" name="due_on" defaultValue={eco.due_on ?? prazoSugerido} />
          </label>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Abrindo…" : "Abrir plano de follow-up"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
