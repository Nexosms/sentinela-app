"use client";

import { useState } from "react";
import { useActionState } from "react";

import {
  editarArquivo,
  excluirAcao,
  excluirArquivo,
  excluirReuniao,
  registrarArquivo,
  salvarAcao,
  salvarReuniao,
  substituirArquivo,
  type ActionState,
} from "@/app/admin/clientes/[orgId]/portal/actions";
import {
  ACTION_STATUS,
  ACTION_STATUS_LABEL,
  MATERIAL_CATEGORIES,
  MEETING_STATUS,
  MEETING_STATUS_LABEL,
  toDatetimeLocal,
  type PortalFileKind,
} from "@/lib/portal/portal";
import { PORTAL_MEDIA_ACCEPT, formatSize } from "@/lib/portal/files";
import UploadField, { type UploadedFile } from "./UploadField";

/**
 * Formulários da gestão do Portal do Cliente. Cada um é um `<form action>` de
 * verdade (`useActionState`), no mesmo desenho de `InvestigationControls`:
 * erro e aviso no mesmo lugar, e eco do que foi digitado — o React limpa o
 * formulário até quando a ação recusa. A `key` remonta o `<form>` com o eco (e
 * a cada sucesso), porque `<select>` não repõe o valor sozinho.
 *
 * Nenhum decide acesso. Quem garante é a RLS (`app.is_nexo_admin()`).
 */

const EMPTY: ActionState = {};

export type MeetingValues = {
  id: string;
  title: string;
  meetingAt: string;
  participants: string[];
  status: string;
  summary: string | null;
  isPublished: boolean;
};

export type ActionValues = {
  id: string;
  description: string;
  ownerName: string | null;
  dueOn: string | null;
  status: string;
};

export type FileValues = {
  id: string;
  kind: PortalFileKind;
  category: string | null;
  title: string;
  description: string | null;
  publishedAt: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isPublished: boolean;
};

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

function formKey(state: ActionState, ...server: (string | null | undefined)[]): string {
  return [...server.map(value => value ?? ""), state.stamp ?? "", JSON.stringify(state.enviado ?? {})].join("|");
}

// ── Reunião ─────────────────────────────────────────────────────────────────

export function ReuniaoForm({ orgId, meeting }: { orgId: string; meeting?: MeetingValues }) {
  const [state, action, pending] = useActionState(salvarReuniao, EMPTY);
  const eco = state.enviado ?? {};
  const publicada = state.enviado ? eco.is_published === "1" : (meeting?.isPublished ?? false);

  return (
    <div className="message-box">
      <div className="message-head">
        <span>◷</span>
        <div>
          <strong>{meeting ? "Dados da reunião" : "Nova reunião"}</strong>
          <small>
            Só aparece para o cliente quando estiver marcada como visível. Rascunhos ficam só com a
            equipe Nexo.
          </small>
        </div>
      </div>

      <form action={action} key={formKey(state, meeting?.id, meeting?.status)}>
        <input type="hidden" name="orgId" value={orgId} />
        {meeting ? <input type="hidden" name="id" value={meeting.id} /> : null}
        <div className="field-grid two">
          <label>
            Título
            <input name="title" defaultValue={eco.title ?? meeting?.title ?? ""} maxLength={200} />
          </label>
          <label>
            Data e hora
            <input
              type="datetime-local"
              name="meeting_at"
              defaultValue={eco.meeting_at ?? (meeting ? toDatetimeLocal(meeting.meetingAt) : "")}
            />
          </label>
          <label>
            Situação
            <select name="status" defaultValue={eco.status ?? meeting?.status ?? "realizada"}>
              {MEETING_STATUS.map(status => (
                <option key={status} value={status}>
                  {MEETING_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Participantes
            <textarea
              name="participants"
              rows={2}
              defaultValue={eco.participants ?? meeting?.participants.join("\n") ?? ""}
              placeholder="Um nome por linha (ou separados por vírgula)"
            />
          </label>
        </div>
        <label className="wide-field">
          Resumo
          <textarea
            name="summary"
            rows={8}
            defaultValue={eco.summary ?? meeting?.summary ?? ""}
            placeholder="Principais assuntos discutidos, decisões e orientações"
          />
        </label>
        <label className="check-row">
          <input type="checkbox" name="is_published" value="1" defaultChecked={publicada} />
          <span>Visível no portal do cliente</span>
        </label>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : meeting ? "Salvar reunião" : "Criar reunião"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Ações ───────────────────────────────────────────────────────────────────

export function AcaoForm({
  orgId,
  meetingId,
  item,
}: {
  orgId: string;
  meetingId: string;
  item?: ActionValues;
}) {
  const [state, action, pending] = useActionState(salvarAcao, EMPTY);
  const eco = state.enviado ?? {};

  return (
    <div>
      <form action={action} key={formKey(state, item?.id, item?.status)}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="meetingId" value={meetingId} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <div className="field-grid two">
          <label>
            Ação
            <textarea
              name="description"
              rows={2}
              defaultValue={eco.description ?? item?.description ?? ""}
              placeholder="O que ficou definido"
            />
          </label>
          <label>
            Responsável
            <input name="owner_name" defaultValue={eco.owner_name ?? item?.ownerName ?? ""} maxLength={200} />
          </label>
          <label>
            Prazo
            <input type="date" name="due_on" defaultValue={eco.due_on ?? item?.dueOn ?? ""} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={eco.status ?? item?.status ?? "pendente"}>
              {ACTION_STATUS.map(status => (
                <option key={status} value={status}>
                  {ACTION_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : item ? "Salvar ação" : "Adicionar ação"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

// ── Exclusão (com confirmação) ──────────────────────────────────────────────

const EXCLUIR = {
  reuniao: {
    action: excluirReuniao,
    confirmar:
      "Excluir esta reunião? As ações, a gravação e os arquivos dela também serão apagados, e não há como desfazer.",
    rotulo: "Excluir reunião",
  },
  acao: { action: excluirAcao, confirmar: "Excluir esta ação?", rotulo: "Excluir ação" },
  arquivo: {
    action: excluirArquivo,
    confirmar: "Excluir este arquivo? Ele será apagado do armazenamento e não há como desfazer.",
    rotulo: "Excluir arquivo",
  },
} as const;

export function ExcluirForm({
  orgId,
  id,
  tipo,
}: {
  orgId: string;
  id: string;
  tipo: keyof typeof EXCLUIR;
}) {
  const config = EXCLUIR[tipo];
  const [state, action, pending] = useActionState(config.action, EMPTY);

  return (
    <div>
      <form
        action={action}
        onSubmit={event => {
          if (!window.confirm(config.confirmar)) event.preventDefault();
        }}
      >
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="portal-danger" disabled={pending}>
          {pending ? "Excluindo…" : config.rotulo}
        </button>
      </form>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
    </div>
  );
}

// ── Arquivos ────────────────────────────────────────────────────────────────

/** Novo arquivo: gravação, arquivo de reunião ou material. */
export function NovoArquivoForm({
  orgId,
  kind,
  meetingId,
  defaultCategory,
  titulo,
  dica,
}: {
  orgId: string;
  kind: PortalFileKind;
  meetingId?: string;
  defaultCategory?: string;
  titulo: string;
  dica: string;
}) {
  const [state, action, pending] = useActionState(registrarArquivo, EMPTY);
  const eco = state.enviado ?? {};
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState<{ file: UploadedFile; stamp: string } | null>(null);
  // O arquivo enviado vale só até o próximo sucesso: depois dele o `stamp` muda e o seletor remonta.
  const atual = enviado && enviado.stamp === (state.stamp ?? "") ? enviado.file : null;
  const publicado = state.enviado ? eco.is_published === "1" : true;

  return (
    <div className="message-box">
      <div className="message-head">
        <span>⤒</span>
        <div>
          <strong>{titulo}</strong>
          <small>{dica}</small>
        </div>
      </div>

      <UploadField
        key={state.stamp ?? "novo"}
        orgId={orgId}
        kind={kind}
        accept={kind === "recording" ? PORTAL_MEDIA_ACCEPT : undefined}
        label={kind === "recording" ? "Escolher gravação (vídeo ou áudio)" : "Escolher arquivo"}
        onBusy={setBusy}
        onDone={file => setEnviado(file ? { file, stamp: state.stamp ?? "" } : null)}
      />

      <form action={action} key={formKey(state)}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="kind" value={kind} />
        {meetingId ? <input type="hidden" name="meetingId" value={meetingId} /> : null}
        <input type="hidden" name="storage_path" value={atual?.path ?? ""} />
        <input type="hidden" name="filename" value={atual?.filename ?? ""} />
        <div className="field-grid two">
          <label>
            Título
            <input
              name="title"
              defaultValue={eco.title ?? (atual && !state.enviado ? atual.filename.replace(/\.[^.]+$/, "") : "")}
              maxLength={200}
            />
          </label>
          <label>
            Data de publicação
            <input type="date" name="published_at" defaultValue={eco.published_at ?? ""} />
          </label>
          {kind === "material" ? (
            <label>
              Categoria
              <select name="category" defaultValue={eco.category ?? defaultCategory ?? ""}>
                <option value="">Escolha</option>
                {MATERIAL_CATEGORIES.map(category => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <label className="wide-field">
          Descrição
          <textarea name="description" rows={2} defaultValue={eco.description ?? ""} />
        </label>
        {kind === "material" ? (
          <label className="check-row">
            <input type="checkbox" name="is_published" value="1" defaultChecked={publicado} />
            <span>Visível no portal do cliente</span>
          </label>
        ) : null}
        <button type="submit" className="primary-button" disabled={pending || busy || !atual}>
          {pending ? "Salvando…" : busy ? "Enviando arquivo…" : "Publicar"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Edição de um arquivo já publicado: dados, substituição do arquivo e exclusão. */
export function ArquivoEditor({ orgId, file }: { orgId: string; file: FileValues }) {
  const [state, action, pending] = useActionState(editarArquivo, EMPTY);
  const eco = state.enviado ?? {};
  const publicado = state.enviado ? eco.is_published === "1" : file.isPublished;

  return (
    <div className="portal-editor">
      <form action={action} key={formKey(state, file.id, file.category)}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="id" value={file.id} />
        <div className="field-grid two">
          <label>
            Título
            <input name="title" defaultValue={eco.title ?? file.title} maxLength={200} />
          </label>
          <label>
            Data de publicação
            <input type="date" name="published_at" defaultValue={eco.published_at ?? file.publishedAt} />
          </label>
          {file.kind === "material" ? (
            <label>
              Categoria
              <select name="category" defaultValue={eco.category ?? file.category ?? ""}>
                {MATERIAL_CATEGORIES.map(category => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <label className="wide-field">
          Descrição
          <textarea name="description" rows={2} defaultValue={eco.description ?? file.description ?? ""} />
        </label>
        {file.kind === "material" ? (
          <label className="check-row">
            <input type="checkbox" name="is_published" value="1" defaultChecked={publicado} />
            <span>Visível no portal do cliente</span>
          </label>
        ) : null}
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"} <span>→</span>
        </button>
      </form>
      <Feedback state={state} />

      <SubstituirArquivo orgId={orgId} file={file} />
      <ExcluirForm orgId={orgId} id={file.id} tipo="arquivo" />
    </div>
  );
}

function SubstituirArquivo({ orgId, file }: { orgId: string; file: FileValues }) {
  const [state, action, pending] = useActionState(substituirArquivo, EMPTY);
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState<{ file: UploadedFile; stamp: string } | null>(null);
  const atual = enviado && enviado.stamp === (state.stamp ?? "") ? enviado.file : null;

  return (
    <div className="portal-replace">
      <small>
        Arquivo atual: {file.filename} · {formatSize(file.sizeBytes)}. Para trocar, escolha um novo
        arquivo — o título, a descrição e a visibilidade continuam os mesmos.
      </small>
      <UploadField
        key={state.stamp ?? "novo"}
        orgId={orgId}
        kind={file.kind}
        accept={file.kind === "recording" ? PORTAL_MEDIA_ACCEPT : undefined}
        label="Escolher arquivo para substituir"
        onBusy={setBusy}
        onDone={novo => setEnviado(novo ? { file: novo, stamp: state.stamp ?? "" } : null)}
      />
      <form action={action}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="id" value={file.id} />
        <input type="hidden" name="storage_path" value={atual?.path ?? ""} />
        <input type="hidden" name="filename" value={atual?.filename ?? ""} />
        <button type="submit" className="portal-secondary" disabled={pending || busy || !atual}>
          {pending ? "Substituindo…" : busy ? "Enviando arquivo…" : "Substituir arquivo"}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
