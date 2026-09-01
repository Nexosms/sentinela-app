"use client";

import { useActionState } from "react";

import {
  alterarRisco,
  alterarStatus,
  atribuirResponsavel,
  concederAcessoIdentidade,
  enviarMensagem,
  solicitarComplementacao,
  type ActionState,
} from "@/app/admin/denuncias/[id]/actions";
import { RISK_LABEL, RISK_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/admin/labels";
import type { ReportStatus, RiskLevel } from "@/lib/admin/labels";

/**
 * As folhas interativas do detalhe do caso. São client components pelo
 * `useActionState` — é o que permite mostrar o erro da ação sem transformar a
 * página inteira em cliente, e os formulários continuam funcionando sem JS:
 * cada um é um `<form action=…>` de verdade, com submit nativo.
 *
 * Nenhum deles decide acesso. O que some da tela por papel some por cortesia;
 * quem garante é a RLS.
 */

const EMPTY: ActionState = {};

export type Member = { user_id: string; name: string };

/** O `<select>` de status vive no `<aside>`, dentro de um `<form display:contents>`. */
export function StatusControl({ id, status }: { id: string; status: ReportStatus }) {
  const [state, action, pending] = useActionState(alterarStatus, EMPTY);
  // Quando a ação recusa, o React repõe os `defaultValue` — que passam a ser o
  // que a pessoa tinha escrito. Em caso de sucesso, `enviado` some e o
  // formulário volta ao estado do servidor.
  const eco = state.enviado ?? {};

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {/* `key` no bloco: `<select>` e `<textarea>` são não controlados, e nem o
          re-render nem o reset automático do React reescrevem o valor de um
          `<select>`. Sem isto, a barra mostraria o status antigo depois de uma
          mudança feita por outro formulário — e perderia a escolha recusada. */}
      <div key={`${status}:${eco.status ?? ""}`}>
        <small>STATUS</small>
        <select
          name="status"
          defaultValue={eco.status ?? status}
          aria-label="Status do caso"
        >
          {STATUS_ORDER.map(option => (
            <option key={option} value={option}>
              {STATUS_LABEL[option]}
            </option>
          ))}
        </select>
        <textarea
          name="rationale"
          defaultValue={eco.rationale ?? ""}
          rows={2}
          placeholder="Justificativa da mudança (opcional, vira nota interna)"
          aria-label="Justificativa da mudança de status"
        />
        <textarea
          name="closure_summary"
          defaultValue={eco.closure_summary ?? ""}
          rows={3}
          placeholder="Resumo de fechamento — obrigatório para concluir ou arquivar (mín. 30 caracteres)"
          aria-label="Resumo de fechamento"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Aplicando…" : "Aplicar status"}
        </button>
        {state.error ? <span className="field-error-message">{state.error}</span> : null}
      </div>
    </form>
  );
}

/**
 * O botão "Registrar avaliação" do `.risk-banner` é o submit deste formulário
 * (atributo `form=`), e não uma cópia dele: assim o banner leva à mesma decisão
 * de risco, com a mesma justificativa, sem duplicar controle nem mexer no CSS.
 */
export const RISK_FORM_ID = "alterar-risco";

export function RiskControl({ id, risk }: { id: string; risk: RiskLevel }) {
  const [state, action, pending] = useActionState(alterarRisco, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <form action={action} id={RISK_FORM_ID}>
      <input type="hidden" name="id" value={id} />
      <div key={`${risk}:${eco.risk ?? ""}`}>
        <small>RISCO</small>
        <select name="risk" defaultValue={eco.risk ?? risk} aria-label="Nível de risco">
          {RISK_ORDER.map(option => (
            <option key={option} value={option}>
              {RISK_LABEL[option]}
            </option>
          ))}
        </select>
        <textarea
          name="risk_rationale"
          defaultValue={eco.risk_rationale ?? ""}
          rows={3}
          placeholder="Justificativa — obrigatória para elevar a alto ou crítico (mín. 15 caracteres)"
          aria-label="Justificativa do risco"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Registrando…" : "Registrar risco"}
        </button>
        {state.error ? <span className="field-error-message">{state.error}</span> : null}
      </div>
    </form>
  );
}

/**
 * O rodapé de ações. Cada botão é um `<form>` próprio — um formulário gigante
 * faria três decisões distintas viajarem juntas.
 */
export function CaseActionsBar({
  id,
  assignedTo,
  members,
  canAssign,
}: {
  id: string;
  assignedTo: string | null;
  members: Member[];
  canAssign: boolean;
}) {
  const [complemento, complementarAction, complementando] = useActionState(
    solicitarComplementacao,
    EMPTY,
  );
  const [atribuicao, atribuirAction, atribuindo] = useActionState(atribuirResponsavel, EMPTY);
  const [triagem, triagemAction, triando] = useActionState(alterarStatus, EMPTY);

  const erros = [complemento.error, atribuicao.error, triagem.error].filter(Boolean);

  return (
    <>
      <div className="case-actions">
        <form action={complementarAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={complementando}>
            {complementando ? "Enviando…" : "Solicitar complementação"}
          </button>
        </form>

        {canAssign ? (
          <form action={atribuirAction}>
            <input type="hidden" name="id" value={id} />
            <select
              key={assignedTo ?? ""}
              name="assigned_to"
              defaultValue={assignedTo ?? ""}
              aria-label="Responsável pelo caso"
            >
              <option value="">Sem responsável</option>
              {members.map(member => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={atribuindo}>
              {atribuindo ? "Designando…" : "Designar investigador"}
            </button>
          </form>
        ) : null}

        <form action={triagemAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="em_apuracao" />
          <button type="submit" className="primary-button" disabled={triando}>
            {triando ? "Iniciando…" : "Iniciar triagem"} <span>→</span>
          </button>
        </form>
      </div>

      {erros.map(erro => (
        <span key={erro} className="field-error-message">
          {erro}
        </span>
      ))}
    </>
  );
}

/**
 * Duas coisas muito diferentes saem daqui, e a única proteção contra confundi-las
 * é o rótulo do botão: um envio errado entrega deliberação interna a quem
 * denunciou. Por isso são dois submits distintos, com o destino escrito neles, e
 * não uma caixa de seleção "interna" ao lado de um botão "Enviar".
 */
export function MessageComposer({ id }: { id: string }) {
  const [state, action, pending] = useActionState(enviarMensagem, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="privacy-note">
        <b>DOIS DESTINOS DIFERENTES</b>
        <p>
          <strong>Enviar ao denunciante</strong> publica o texto no acompanhamento do protocolo:
          quem relatou vai ler. <strong>Registrar nota interna</strong> fica só para a equipe do
          canal e nunca aparece em /acompanhar.
        </p>
      </div>
      <textarea
        name="body"
        defaultValue={eco.body ?? ""}
        rows={3}
        placeholder="Escrever ao denunciante ou registrar nota interna…"
        aria-label="Nova mensagem"
      />
      <button type="submit" name="internal" value="1" disabled={pending}>
        {pending ? "Gravando…" : "Registrar nota interna"}
      </button>
      <button
        type="submit"
        name="internal"
        value="0"
        className="primary-button"
        disabled={pending}
      >
        {pending ? "Enviando…" : "Enviar ao denunciante"} <span>→</span>
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </form>
  );
}

/**
 * Pedido de quebra do sigilo de identidade. Para o administrador, a ação abre o
 * acesso na hora; para os demais, registra o pedido e avisa os administradores.
 * O texto do botão diz qual dos dois vai acontecer.
 */
export function IdentityRequestForm({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(concederAcessoIdentidade, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <textarea
        name="justification"
        defaultValue={eco.justification ?? ""}
        rows={3}
        placeholder="Por que este caso exige saber quem relatou? (mín. 20 caracteres — fica registrado na auditoria)"
        aria-label="Justificativa do acesso à identidade"
      />
      <button type="submit" disabled={pending}>
        {pending
          ? "Registrando…"
          : isAdmin
            ? "Abrir acesso por 2 horas"
            : "Pedir acesso a um administrador"}
      </button>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      {state.aviso ? <p>{state.aviso}</p> : null}
    </form>
  );
}
