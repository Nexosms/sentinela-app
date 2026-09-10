"use client";

import { createContext, useContext, type Dispatch, type ReactNode } from "react";

import type { CategoryOption } from "@/lib/report/catalog";

/**
 * PRIVACIDADE — DECISÃO DELIBERADA
 *
 * Não há autosave, sessionStorage nem localStorage neste fluxo. O formulário
 * carrega uma denúncia ainda não enviada que nomeia pessoas, e pode estar sendo
 * escrita num computador corporativo compartilhado. Um rascunho persistido
 * sobreviveria à aba fechada e ficaria legível para quem usar a máquina depois
 * — inclusive para a pessoa denunciada. O preço é perder o texto ao recarregar;
 * daí o guarda de `beforeunload` e a confirmação ao sair.
 *
 * Se algum dia isto mudar, terá de ser com criptografia por senha do
 * denunciante e expiração curta, nunca com um `useEffect` gravando estado bruto.
 */

export type PickedFileStatus = "pending" | "hashing" | "uploading" | "done" | "error";

export type PickedFile = {
  clientId: string;
  file: File;
  sha256?: string;
  path?: string;
  status: PickedFileStatus;
  /** 0–100. Grosso por etapa: hash e upload, que é o que o navegador expõe. */
  progress: number;
  error?: string;
};

export type Receipt = { protocol: string; secret: string };

export type WizardState = {
  step: number;
  // Etapa 0
  declarationAccepted: boolean;
  // Etapa 1
  mode: "anonymous" | "identified";
  identityName: string;
  identityContact: string;
  // Etapa 2
  relationship: string;
  periodText: string;
  location: string;
  accused: string;
  witnesses: string;
  recurrence: string;
  categoryIds: string[];
  categorySpecification: string;
  description: string;
  retaliation: boolean;
  urgent: boolean;
  // Etapa 3
  files: PickedFile[];
  /** Arquivos recusados na seleção. Nunca descartados em silêncio. */
  rejectedFiles: string[];
  uploadSessionId: string | null;
  uploading: boolean;
  // Transversal
  errors: Record<string, string>;
  submitError: string;
  sending: boolean;
  receipt: Receipt | null;
  leaving: boolean;
  dirty: boolean;
};

export const initialWizardState: WizardState = {
  step: 0,
  declarationAccepted: false,
  mode: "anonymous",
  identityName: "",
  identityContact: "",
  relationship: "",
  periodText: "",
  location: "",
  accused: "",
  witnesses: "",
  recurrence: "once",
  categoryIds: [],
  categorySpecification: "",
  description: "",
  retaliation: false,
  urgent: false,
  files: [],
  rejectedFiles: [],
  uploadSessionId: null,
  uploading: false,
  errors: {},
  submitError: "",
  sending: false,
  receipt: null,
  leaving: false,
  dirty: false,
};

/** Campos que o usuário edita, para o `update` genérico das etapas. */
export type FieldKey =
  | "declarationAccepted"
  | "mode"
  | "identityName"
  | "identityContact"
  | "relationship"
  | "periodText"
  | "location"
  | "accused"
  | "witnesses"
  | "recurrence"
  | "categorySpecification"
  | "description"
  | "retaliation"
  | "urgent";

export type WizardAction =
  | { type: "set"; field: FieldKey; value: WizardState[FieldKey] }
  | { type: "toggleCategory"; id: string }
  | { type: "clearError"; field: string }
  | { type: "setErrors"; errors: Record<string, string> }
  | { type: "goTo"; step: number }
  | { type: "addFiles"; files: PickedFile[]; rejected: string[] }
  | { type: "removeFile"; clientId: string }
  | { type: "dismissRejected" }
  | { type: "patchFile"; clientId: string; patch: Partial<PickedFile> }
  | { type: "uploadStart" }
  | { type: "uploadDone"; uploadSessionId: string | null }
  | { type: "sending"; sending: boolean }
  | { type: "submitError"; message: string }
  | { type: "receipt"; receipt: Receipt }
  | { type: "leaving"; leaving: boolean };

function clearKey(errors: Record<string, string>, field: string) {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "set":
      return {
        ...state,
        [action.field]: action.value,
        dirty: true,
        errors: clearKey(state.errors, action.field),
        submitError: "",
      };
    case "toggleCategory": {
      const selected = state.categoryIds.includes(action.id);
      return {
        ...state,
        categoryIds: selected
          ? state.categoryIds.filter(id => id !== action.id)
          : [...state.categoryIds, action.id],
        dirty: true,
        errors: clearKey(state.errors, "categoryIds"),
      };
    }
    case "clearError":
      return { ...state, errors: clearKey(state.errors, action.field) };
    case "setErrors":
      return { ...state, errors: action.errors };
    case "goTo":
      return { ...state, step: action.step, errors: {}, submitError: "" };
    case "addFiles":
      return {
        ...state,
        // Qualquer mudança na lista invalida a sessão de upload anterior.
        files: [...state.files, ...action.files].map(file =>
          file.status === "done" ? { ...file, status: "pending", progress: 0, path: undefined } : file,
        ),
        rejectedFiles: action.rejected,
        uploadSessionId: null,
        dirty: true,
        errors: clearKey(state.errors, "evidence"),
      };
    case "removeFile":
      return {
        ...state,
        files: state.files
          .filter(file => file.clientId !== action.clientId)
          .map(file =>
            file.status === "done" ? { ...file, status: "pending", progress: 0, path: undefined } : file,
          ),
        uploadSessionId: null,
        dirty: true,
      };
    case "dismissRejected":
      return { ...state, rejectedFiles: [] };
    case "patchFile":
      return {
        ...state,
        files: state.files.map(file =>
          file.clientId === action.clientId ? { ...file, ...action.patch } : file,
        ),
      };
    case "uploadStart":
      return { ...state, uploading: true, submitError: "" };
    case "uploadDone":
      return { ...state, uploading: false, uploadSessionId: action.uploadSessionId };
    case "sending":
      return { ...state, sending: action.sending };
    case "submitError":
      return { ...state, sending: false, submitError: action.message };
    case "receipt":
      return { ...state, sending: false, receipt: action.receipt, dirty: false };
    case "leaving":
      return { ...state, leaving: action.leaving };
    default:
      return state;
  }
}

export type CategoryGroup = { key: string; title: string; items: CategoryOption[] };

export type WizardContextValue = {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  /** Identificação institucional de quem opera o canal, para exibir na Etapa 0. */
  org: { name: string; cnpjFormatted: string | null };
  categories: CategoryOption[];
  categoryGroups: CategoryGroup[];
  /** Só as categorias marcadas que exigem detalhamento. */
  needsSpecification: boolean;
  update: (field: FieldKey, value: WizardState[FieldKey]) => void;
  clearError: (field: string) => void;
  toggleCategory: (id: string) => void;
  addFiles: (fileList: FileList | null) => void;
  removeFile: (clientId: string) => void;
  next: () => void;
  back: () => void;
  submit: () => void;
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({
  value,
  children,
}: {
  value: WizardContextValue;
  children: ReactNode;
}) {
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) throw new Error("useWizard precisa estar dentro de <WizardProvider>.");
  return context;
}
