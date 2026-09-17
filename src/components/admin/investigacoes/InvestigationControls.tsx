"use client";

import { useActionState } from "react";

import {
  adicionarMembro,
  criarInvestigacao,
  desvincularDenuncia,
  registrarAchado,
  registrarEntrevista,
  removerMembro,
  revisarEConcluir,
  salvarConclusao,
  salvarPlano,
  vincularDenuncia,
  type ActionState,
} from "@/app/admin/investigacoes/[id]/actions";
import {
  CONFIDENCE,
  CONFIDENCE_LABEL,
  EDITABLE_STATUS,
  INTERVIEW_KIND_LABEL,
  INTERVIEW_KIND_ORDER,
  INV_STATUS_LABEL,
  OUTCOME_LABEL,
  OUTCOME_ORDER,
  ROLE_IN_CASE,
  ROLE_IN_CASE_LABEL,
  type InvestigationOutcome,
  type InvestigationStatus,
} from "@/lib/admin/investigacoes";

/**
 * As folhas interativas do módulo de investigações. São client components pelo
 * `useActionState` — é o que permite mostrar o erro da ação sem transformar a
 * página em cliente, e cada uma continua sendo um `<form action=…>` de verdade.
 *
 * Nenhuma decide acesso. O que some da tela some por cortesia; quem garante é
 * a RLS e os CHECKs (`inv_reviewer_not_lead`, `inv_signoff_before_close`).
 */

const EMPTY: ActionState = {};

export type Person = { user_id: string; name: string };
export type ReportOption = { id: string; protocol: string; status: string };
export type EvidenceOption = { id: string; filename: string; protocol: string };

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
 * recusada some da tela e a pessoa refaz tudo. Mesmo remédio de `CaseControls`.
 */
function ecoKey(eco: Record<string, string>, ...names: string[]): string {
  // O nome do campo entra na chave: dois blocos irmãos com eco vazio gerariam
  // a mesma `key` e o React reclama de chaves duplicadas entre irmãos.
  return names.map(name => `${name}=${eco[name] ?? ""}`).join("&");
}

/**
 * Nos formulários que EDITAM algo já gravado, a `key` tem que carregar também o
 * valor que veio do servidor. Sem isso, salvar com sucesso limpa o eco mas não
 * repõe o `defaultValue`: o `<select>` de desfecho volta a exibir "Escolha o
 * desfecho" logo depois de gravar "Parcialmente procedente". Remontar o <form>
 * é barato — `useActionState` mora no componente, não no elemento.
 */
function formKey(eco: Record<string, string>, ...serverValues: (string | null)[]): string {
  return [...serverValues.map(value => value ?? ""), JSON.stringify(eco)].join("|");
}

// ── Abertura ─────────────────────────────────────────────────────────────────

/**
 * Abrir uma investigação a partir de uma denúncia. O escopo é obrigatório
 * desde o primeiro minuto: um plano de apuração escrito depois dos fatos não
 * prova nada a um auditor.
 */
export function NovaInvestigacaoForm({
  reports,
  people,
  selfId,
  preselectedReportId,
}: {
  reports: ReportOption[];
  people: Person[];
  selfId: string;
  /** Veio de um "Abrir investigação" clicado na própria tela da denúncia. */
  preselectedReportId?: string;
}) {
  const [state, action, pending] = useActionState(criarInvestigacao, EMPTY);
  const eco = state.enviado ?? {};
  const preselected = eco.report_id ? undefined : reports.find(r => r.id === preselectedReportId);

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⚖</span>
        <div>
          <strong>Abrir investigação</strong>
          <small>O código (INV-AAAA-NNNN) é gerado pelo banco, um por organização.</small>
        </div>
      </div>

      {preselected ? (
        <div className="care-note">
          <span>⚖</span>
          <div>
            <strong>Abrindo a partir de uma denúncia</strong>
            <small>Protocolo {preselected.protocol}, já selecionado abaixo.</small>
          </div>
        </div>
      ) : null}

      <form action={action}>
        <div className="field-grid two" key={ecoKey(eco, "report_id", "lead_id")}>
          <label>
            Denúncia de origem
            <select name="report_id" defaultValue={eco.report_id ?? preselectedReportId ?? ""}>
              <option value="">Sem denúncia vinculada</option>
              {reports.map(report => (
                <option key={report.id} value={report.id}>
                  {report.protocol}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quem conduz a apuração
            <select name="lead_id" defaultValue={eco.lead_id ?? selfId}>
              <option value="">Ainda não definido</option>
              {people.map(person => (
                <option key={person.user_id} value={person.user_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início planejado
            <input type="date" name="planned_start" defaultValue={eco.planned_start ?? ""} />
          </label>
          <label>
            Fim planejado
            <input type="date" name="planned_end" defaultValue={eco.planned_end ?? ""} />
          </label>
        </div>

        <label className="wide-field">
          Escopo da apuração
          <textarea
            name="scope"
            defaultValue={eco.scope ?? ""}
            rows={4}
            placeholder="O que exatamente será apurado, e o que fica de fora (mín. 20 caracteres)"
          />
          <small>Delimitar o escopo é o que impede a apuração de virar devassa.</small>
        </label>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Abrindo…" : "Abrir investigação"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Plano ────────────────────────────────────────────────────────────────────

export function PlanoForm({
  id,
  inv,
  people,
}: {
  id: string;
  inv: {
    scope: string | null;
    hypotheses: string | null;
    methodology: string | null;
    protective_measures: string | null;
    planned_start: string | null;
    planned_end: string | null;
    lead_id: string | null;
    status: InvestigationStatus;
  };
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
          inv.status,
          inv.lead_id,
          inv.scope,
          inv.hypotheses,
          inv.methodology,
          inv.protective_measures,
          inv.planned_start,
          inv.planned_end,
        )}
      >
        <input type="hidden" name="id" value={id} />
        <div className="field-grid two" key={ecoKey(eco, "status", "lead_id")}>
          <label>
            Situação
            <select name="status" defaultValue={eco.status ?? inv.status}>
              {EDITABLE_STATUS.map(status => (
                <option key={status} value={status}>
                  {INV_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quem conduz a apuração
            <select name="lead_id" defaultValue={eco.lead_id ?? inv.lead_id ?? ""}>
              <option value="">Ainda não definido</option>
              {people.map(person => (
                <option key={person.user_id} value={person.user_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início planejado
            <input
              type="date"
              name="planned_start"
              defaultValue={eco.planned_start ?? inv.planned_start ?? ""}
            />
          </label>
          <label>
            Fim planejado
            <input
              type="date"
              name="planned_end"
              defaultValue={eco.planned_end ?? inv.planned_end ?? ""}
            />
          </label>
        </div>

        <label className="wide-field">
          Escopo
          <textarea name="scope" rows={3} defaultValue={eco.scope ?? inv.scope ?? ""} />
          <small>O que será apurado e o que fica de fora.</small>
        </label>
        <label className="wide-field">
          Hipóteses
          <textarea
            name="hypotheses"
            rows={3}
            defaultValue={eco.hypotheses ?? inv.hypotheses ?? ""}
          />
          <small>Hipótese é o que se vai testar, não conclusão antecipada.</small>
        </label>
        <label className="wide-field">
          Metodologia
          <textarea
            name="methodology"
            rows={3}
            defaultValue={eco.methodology ?? inv.methodology ?? ""}
          />
          <small>Quem será ouvido, que documentos serão pedidos, em que ordem.</small>
        </label>
        <label className="wide-field">
          Medidas protetivas
          <textarea
            name="protective_measures"
            rows={3}
            defaultValue={eco.protective_measures ?? inv.protective_measures ?? ""}
          />
          <small>
            Afastamento, mudança de escala, suspensão de contato. Proteger quem relatou não
            depende do desfecho da apuração.
          </small>
        </label>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar plano"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Equipe ───────────────────────────────────────────────────────────────────

export function AdicionarMembroForm({ id, candidates }: { id: string; candidates: Person[] }) {
  const [state, action, pending] = useActionState(adicionarMembro, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⚑</span>
        <div>
          <strong>Incluir alguém na equipe</strong>
          <small>Isto é uma concessão de acesso, não um cadastro.</small>
        </div>
      </div>

      <div className="privacy-note">
        <b>QUEM ENTRA NA EQUIPE PASSA A LER AS DENÚNCIAS VINCULADAS</b>
        <p>
          A política <code>reports_staff_read</code> inclui os membros da investigação: ao incluir
          esta pessoa, ela ganha acesso de leitura a todas as denúncias vinculadas a este caso,
          inclusive às que forem vinculadas depois. Inclua só quem precisa apurar.
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <div className="field-grid two" key={ecoKey(eco, "user_id", "role_in_case")}>
          <label>
            Pessoa
            <select name="user_id" defaultValue={eco.user_id ?? ""}>
              <option value="">Escolha quem entra</option>
              {candidates.map(person => (
                <option key={person.user_id} value={person.user_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Papel no caso
            <select name="role_in_case" defaultValue={eco.role_in_case ?? "investigador"}>
              {ROLE_IN_CASE.map(role => (
                <option key={role} value={role}>
                  {ROLE_IN_CASE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="wide-field">
          Declaração de impedimento
          <textarea
            name="conflict_statement"
            rows={4}
            defaultValue={eco.conflict_statement ?? ""}
            placeholder="Ex.: Declaro que não sou a pessoa apontada neste relato, não sou subordinado nem gestor dela e não tenho relação pessoal que comprometa minha imparcialidade."
          />
          <small>
            Mínimo de 40 caracteres. Investigação conduzida por quem tem conflito é nula — havendo
            impedimento, a CIPA prevê comitê alternativo.
          </small>
        </label>

        <label className="check-row">
          <input type="checkbox" name="confirmado" value="1" />
          Afirmo que esta pessoa não é a denunciada, não é subordinada nem gestora dela, e que a
          declaração acima é dela ou foi feita em nome dela com o seu conhecimento.
        </label>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Incluindo…" : "Incluir com declaração"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function RemoverMembroButton({
  id,
  userId,
  name,
}: {
  id: string;
  userId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(removerMembro, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="user_id" value={userId} />
      <button type="submit" disabled={pending} aria-label={`Remover ${name} da equipe`}>
        {pending ? "…" : "✕"}
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </form>
  );
}

// ── Denúncias vinculadas ─────────────────────────────────────────────────────

export function VincularDenunciaForm({
  id,
  options,
}: {
  id: string;
  options: ReportOption[];
}) {
  const [state, action, pending] = useActionState(vincularDenuncia, EMPTY);

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⊕</span>
        <div>
          <strong>Vincular outra denúncia</strong>
          <small>Uma apuração pode cobrir vários relatos contra a mesma pessoa.</small>
        </div>
      </div>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <div className="field-grid">
          <label>
            Denúncia
            <select name="report_id" defaultValue="">
              <option value="">Escolha o protocolo</option>
              {options.map(report => (
                <option key={report.id} value={report.id}>
                  {report.protocol}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Vinculando…" : "Vincular denúncia"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function DesvincularDenunciaButton({
  id,
  reportId,
  protocol,
}: {
  id: string;
  reportId: string;
  protocol: string;
}) {
  const [state, action, pending] = useActionState(desvincularDenuncia, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="report_id" value={reportId} />
      <button type="submit" disabled={pending} aria-label={`Desvincular ${protocol}`}>
        {pending ? "…" : "✕"}
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </form>
  );
}

// ── Entrevistas ──────────────────────────────────────────────────────────────

/**
 * Os dois booleanos aparecem como afirmações, não como caixinhas de rodapé. A
 * ciência da não retaliação é obrigatória (Lei nº 14.457) e o consentimento de
 * gravação é uma resposta de duas vias — "não perguntei" não é resposta.
 */
export function EntrevistaForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(registrarEntrevista, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>◷</span>
        <div>
          <strong>Registrar entrevista</strong>
          <small>Registre logo depois de ouvir: memória não é prova.</small>
        </div>
      </div>

      <div className="privacy-note">
        <b>RÓTULO, NÃO NOME COMPLETO</b>
        <p>
          Quando o entrevistado é o denunciante de um relato anônimo, escrever o nome dele aqui
          desfaz o anonimato numa tabela que toda a equipe da apuração lê. Use um rótulo estável —
          “Denunciante do protocolo NF53”, “Testemunha 1” — e mantenha o nome onde ele já está
          protegido.
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <div className="field-grid two" key={ecoKey(eco, "kind")}>
          <label>
            Quem foi entrevistado
            <select name="kind" defaultValue={eco.kind ?? "testemunha"}>
              {INTERVIEW_KIND_ORDER.map(kind => (
                <option key={kind} value={kind}>
                  {INTERVIEW_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rótulo do entrevistado
            <input
              name="interviewee_label"
              defaultValue={eco.interviewee_label ?? ""}
              placeholder="Testemunha 1"
            />
          </label>
          <label>
            Data e hora
            <input type="datetime-local" name="held_at" defaultValue={eco.held_at ?? ""} />
          </label>
          <label>
            Local
            <input
              name="location"
              defaultValue={eco.location ?? ""}
              placeholder="Sala reservada, videochamada…"
            />
          </label>
        </div>

        <label className="wide-field">
          Quem acompanhou
          <textarea
            name="accompanied_by"
            rows={2}
            defaultValue={eco.accompanied_by ?? ""}
            placeholder="Segunda pessoa presente na sala, se houve"
          />
          <small>Entrevista com duas pessoas do lado da apuração resiste melhor à contestação.</small>
        </label>
        <label className="wide-field">
          Roteiro
          <textarea name="script" rows={3} defaultValue={eco.script ?? ""} />
        </label>
        <label className="wide-field">
          Resumo
          <textarea name="summary" rows={4} defaultValue={eco.summary ?? ""} />
          <small>O resumo fica só aqui — nunca na trilha de auditoria nem em notificação.</small>
        </label>

        {/* Duas afirmações legais. O `key` repõe a escolha recusada. */}
        <div className="toggle-row" key={ecoKey(eco, "consent_recorded")}>
          <label>
            <input
              type="radio"
              name="consent_recorded"
              value="1"
              defaultChecked={eco.consent_recorded === "1"}
            />
            A pessoa consentiu com a gravação da entrevista.
          </label>
          <label>
            <input
              type="radio"
              name="consent_recorded"
              value="0"
              defaultChecked={eco.consent_recorded === "0"}
            />
            Não houve gravação, ou a pessoa não consentiu com ela.
          </label>
        </div>

        <label className="check-row">
          <input type="checkbox" name="non_retaliation_notice_given" value="1" />
          Afirmo que informei a esta pessoa, antes de começar, que qualquer retaliação por ter
          relatado, testemunhado ou colaborado com a apuração é vedada pela Lei nº 14.457 e será
          apurada como falta autônoma.
        </label>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Registrar entrevista"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Achados ──────────────────────────────────────────────────────────────────

export function AchadoForm({ id, evidence }: { id: string; evidence: EvidenceOption[] }) {
  const [state, action, pending] = useActionState(registrarAchado, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>◈</span>
        <div>
          <strong>Registrar achado</strong>
          <small>Um achado sem evidência que o sustente é opinião.</small>
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <label className="wide-field">
          O que foi apurado
          <textarea
            name="statement"
            rows={3}
            defaultValue={eco.statement ?? ""}
            placeholder="Afirmação verificável, com data e circunstância"
          />
        </label>
        <div className="field-grid" key={ecoKey(eco, "confidence")}>
          <label>
            Grau de confiança
            <select name="confidence" defaultValue={eco.confidence ?? "media"}>
              {CONFIDENCE.map(level => (
                <option key={level} value={level}>
                  {CONFIDENCE_LABEL[level]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {evidence.length > 0 ? (
          <>
            <label className="wide-field">
              Evidências que sustentam o achado
              <small>Arquivos das denúncias vinculadas. Marque os que embasam esta afirmação.</small>
            </label>
            {evidence.map(file => (
              <label className="check-row" key={file.id}>
                <input type="checkbox" name="evidence_ids" value={file.id} />
                {file.filename} · {file.protocol}
              </label>
            ))}
          </>
        ) : (
          <div className="care-note">
            <span>▧</span>
            <div>
              <strong>Nenhuma evidência disponível</strong>
              <small>
                As denúncias vinculadas não têm arquivos anexados, então não há cadeia de custódia
                a apontar aqui.
              </small>
            </div>
          </div>
        )}

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Registrar achado"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Conclusão e dupla assinatura ─────────────────────────────────────────────

export function ConclusaoForm({
  id,
  inv,
}: {
  id: string;
  inv: {
    findings: string | null;
    recommendation: string | null;
    outcome: InvestigationOutcome | null;
  };
}) {
  const [state, action, pending] = useActionState(salvarConclusao, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div className="message-box">
      <div className="message-head">
        <span>✎</span>
        <div>
          <strong>Conclusão de quem conduziu</strong>
          <small>Primeiro tempo da dupla assinatura. Isto não encerra a investigação.</small>
        </div>
      </div>

      <form
        action={action}
        key={formKey(eco, inv.findings, inv.recommendation, inv.outcome)}
      >
        <input type="hidden" name="id" value={id} />
        <label className="wide-field">
          Síntese dos achados
          <textarea name="findings" rows={5} defaultValue={eco.findings ?? inv.findings ?? ""} />
        </label>
        <label className="wide-field">
          Recomendação
          <textarea
            name="recommendation"
            rows={4}
            defaultValue={eco.recommendation ?? inv.recommendation ?? ""}
          />
          <small>
            Medidas de prevenção e controle que decorrem do apurado — é daqui que sai o plano de
            ação.
          </small>
        </label>
        <div className="field-grid" key={ecoKey(eco, "outcome")}>
          <label>
            Desfecho
            <select name="outcome" defaultValue={eco.outcome ?? inv.outcome ?? ""}>
              <option value="">Escolha o desfecho</option>
              {OUTCOME_ORDER.map(outcome => (
                <option key={outcome} value={outcome}>
                  {OUTCOME_LABEL[outcome]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar conclusão"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/**
 * Segundo tempo. Um único `.update({...})` grava status, `concluded_at`,
 * `outcome`, `reviewed_by` e `reviewed_at` de uma vez — ver o comentário da
 * ação. Este formulário só é montado para quem NÃO conduziu.
 */
export function RevisarConcluirForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revisarEConcluir, EMPTY);

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⚖</span>
        <div>
          <strong>Revisar e concluir</strong>
          <small>Segundo tempo da dupla assinatura. É irreversível.</small>
        </div>
      </div>

      <div className="privacy-note">
        <b>ASSINAR FECHA A INVESTIGAÇÃO PARA SEMPRE</b>
        <p>
          A conclusão e a assinatura são um único registro: depois dele o banco recusa qualquer
          escrita nesta investigação — plano, equipe, entrevistas e achados ficam congelados como
          estão agora. Leia tudo antes de marcar.
        </p>
      </div>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <label className="check-row">
          <input type="checkbox" name="confirmado" value="1" />
          Li o plano de apuração, as entrevistas registradas e os achados, e confirmo que a
          conclusão corresponde ao que foi apurado.
        </label>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Assinando…" : "Revisar e concluir"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
