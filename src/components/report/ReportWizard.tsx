"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";
import type { CategoryOption } from "@/lib/report/catalog";
import {
  fieldErrors,
  step0Schema,
  step1Schema,
  step2Schema,
  type SubmitReportInput,
} from "@/lib/report/schema";

import LeaveConfirm from "./LeaveConfirm";
import ReceiptCard from "./ReceiptCard";
import Step0Orientacoes from "./steps/Step0Orientacoes";
import Step1Modalidade from "./steps/Step1Modalidade";
import Step2OQueAconteceu from "./steps/Step2OQueAconteceu";
import Step3Evidencias from "./steps/Step3Evidencias";
import Step4Revisao from "./steps/Step4Revisao";
import {
  submitReport as postReport,
  uploadEvidence,
  validatePickedFiles,
  type UploadedEvidenceItem,
} from "./UploadClient";
import {
  initialWizardState,
  WizardProvider,
  wizardReducer,
  type CategoryGroup,
  type FieldKey,
  type WizardContextValue,
  type WizardState,
} from "./wizardState";

const steps = ["Orientações", "Modalidade", "O que aconteceu", "Evidências", "Revisão"];

const GROUP_TITLES: Record<string, string> = {
  violencia_conduta: "Grupo A — Violências e condutas",
  organizacao_trabalho: "Grupo B — Organização e condições do trabalho",
};
const GROUP_ORDER = ["violencia_conduta", "organizacao_trabalho"];

/**
 * Único nó com estado do fluxo de relato.
 *
 * O protótipo passava 12 props para o wizard e teria passado mais de 20 depois
 * de unidades, categorias, upload e erros por campo virem do servidor. Aqui o
 * estado vive num `useReducer` e chega às etapas por contexto.
 *
 * Nada é persistido: ver a nota de privacidade em `wizardState.tsx`.
 */
export default function ReportWizard({
  orgSlug,
  orgName,
  orgCnpjFormatted,
  categories,
}: {
  orgSlug: string;
  orgName: string;
  orgCnpjFormatted: string | null;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  /** Estável entre tentativas: uma resposta perdida não pode virar dois relatos. */
  const idempotencyKey = useRef<string>("");
  const uploadedRef = useRef<UploadedEvidenceItem[]>([]);

  const categoryGroups = useMemo<CategoryGroup[]>(
    () =>
      GROUP_ORDER.map(key => ({
        key,
        title: GROUP_TITLES[key],
        items: categories.filter(category => category.groupKey === key),
      })).filter(group => group.items.length > 0),
    [categories],
  );

  const needsSpecification = useMemo(
    () =>
      categories.some(
        category => category.requiresSpecification && state.categoryIds.includes(category.id),
      ),
    [categories, state.categoryIds],
  );

  // Guarda de saída acidental. Só enquanto há algo escrito e nada enviado.
  useEffect(() => {
    if (!state.dirty || state.receipt) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty, state.receipt]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step, state.receipt]);

  const update = useCallback((field: FieldKey, value: WizardState[FieldKey]) => {
    dispatch({ type: "set", field, value });
  }, []);

  const clearError = useCallback((field: string) => {
    dispatch({ type: "clearError", field });
  }, []);

  const toggleCategory = useCallback((id: string) => {
    dispatch({ type: "toggleCategory", id });
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      const incoming = Array.from(fileList ?? []);
      if (!incoming.length) return;
      const { accepted, rejected } = validatePickedFiles(incoming, state.files.length);
      dispatch({
        type: "addFiles",
        files: accepted.map(file => ({
          clientId: crypto.randomUUID(),
          file,
          status: "pending" as const,
          progress: 0,
        })),
        rejected: rejected.map(item => `${item.name} (${item.reason})`),
      });
    },
    [state.files.length],
  );

  const removeFile = useCallback((clientId: string) => {
    dispatch({ type: "removeFile", clientId });
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    if (state.step === 0) {
      const result = step0Schema.safeParse({ declarationAccepted: state.declarationAccepted });
      if (!result.success) {
        dispatch({ type: "setErrors", errors: fieldErrors(result.error) });
        return false;
      }
      return true;
    }

    if (state.step === 1) {
      const result = step1Schema.safeParse({
        mode: state.mode,
        identityName: state.identityName,
        identityContact: state.identityContact,
      });
      if (!result.success) {
        dispatch({ type: "setErrors", errors: fieldErrors(result.error) });
        return false;
      }
      return true;
    }

    if (state.step === 2) {
      const result = step2Schema.safeParse({
        relationship: state.relationship,
        periodText: state.periodText,
        location: state.location,
        accused: state.accused,
        witnesses: state.witnesses,
        recurrence: state.recurrence,
        categoryIds: state.categoryIds,
        categorySpecification: state.categorySpecification,
        description: state.description,
        retaliation: state.retaliation,
        urgent: state.urgent,
      });
      const errors = result.success ? {} : fieldErrors(result.error);
      // O schema não sabe quais categorias exigem detalhamento — isso vem da
      // coluna `requires_specification` do catálogo, não do texto do rótulo.
      if (needsSpecification && !state.categorySpecification.trim()) {
        errors.categorySpecification ??= "Especifique a opção selecionada.";
      }
      if (Object.keys(errors).length) {
        dispatch({ type: "setErrors", errors });
        return false;
      }
      return true;
    }

    return true;
  }, [state, needsSpecification]);

  /** Sobe os anexos ainda pendentes e devolve a lista completa já no Storage. */
  const ensureUploaded = useCallback(async (): Promise<{
    uploadSessionId: string | null;
    evidence: UploadedEvidenceItem[];
  }> => {
    if (!state.files.length) {
      uploadedRef.current = [];
      return { uploadSessionId: null, evidence: [] };
    }
    if (state.uploadSessionId && uploadedRef.current.length === state.files.length) {
      return { uploadSessionId: state.uploadSessionId, evidence: uploadedRef.current };
    }

    dispatch({ type: "uploadStart" });
    try {
      const result = await uploadEvidence(
        orgSlug,
        state.files.map(file => ({ clientId: file.clientId, file: file.file })),
        (clientId, progress, note) => {
          dispatch({
            type: "patchFile",
            clientId,
            patch: {
              progress,
              status: note === "done" ? "done" : note === "uploading" ? "uploading" : "hashing",
            },
          });
        },
      );
      for (const item of result.evidence) {
        dispatch({
          type: "patchFile",
          clientId: item.clientId,
          patch: { status: "done", progress: 100, sha256: item.sha256, path: item.path },
        });
      }
      uploadedRef.current = result.evidence;
      dispatch({ type: "uploadDone", uploadSessionId: result.uploadSessionId });
      return { uploadSessionId: result.uploadSessionId, evidence: result.evidence };
    } catch (error) {
      dispatch({ type: "uploadDone", uploadSessionId: null });
      for (const file of state.files) {
        if (file.status !== "done") {
          dispatch({ type: "patchFile", clientId: file.clientId, patch: { status: "error" } });
        }
      }
      throw error;
    }
  }, [orgSlug, state.files, state.uploadSessionId]);

  const next = useCallback(() => {
    if (!validateCurrentStep()) return;
    if (state.step === 3) {
      void (async () => {
        try {
          await ensureUploaded();
          dispatch({ type: "goTo", step: 4 });
        } catch (error) {
          dispatch({
            type: "submitError",
            message: error instanceof Error ? error.message : "Falha ao enviar os anexos.",
          });
        }
      })();
      return;
    }
    dispatch({ type: "goTo", step: Math.min(4, state.step + 1) });
  }, [state.step, validateCurrentStep, ensureUploaded]);

  const leave = useCallback(() => {
    if (!state.dirty) {
      router.push("/");
      return;
    }
    dispatch({ type: "leaving", leaving: true });
  }, [state.dirty, router]);

  const back = useCallback(() => {
    if (state.step === 0) {
      leave();
      return;
    }
    dispatch({ type: "goTo", step: Math.max(0, state.step - 1) });
  }, [state.step, leave]);

  const submit = useCallback(() => {
    if (state.sending) return;
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    dispatch({ type: "sending", sending: true });

    void (async () => {
      try {
        const { uploadSessionId, evidence } = await ensureUploaded();
        const body: SubmitReportInput = {
          orgSlug,
          idempotencyKey: idempotencyKey.current,
          ...(uploadSessionId ? { uploadSessionId } : {}),
          declarationAccepted: true,
          mode: state.mode,
          identityName: state.mode === "identified" ? state.identityName : undefined,
          identityContact: state.mode === "identified" ? state.identityContact : undefined,
          relationship: state.relationship,
          periodText: state.periodText,
          location: state.location,
          accused: state.accused,
          witnesses: state.witnesses,
          recurrence: state.recurrence,
          categoryIds: state.categoryIds,
          categorySpecification: state.categorySpecification,
          description: state.description,
          retaliation: state.retaliation,
          urgent: state.urgent,
          evidence,
        };
        const receipt = await postReport(body);
        dispatch({
          type: "receipt",
          receipt: { protocol: receipt.protocol, secret: receipt.secret },
        });
      } catch (error) {
        dispatch({
          type: "submitError",
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível registrar o relato agora. Nenhum protocolo foi gerado. Tente novamente em instantes.",
        });
      }
    })();
  }, [orgSlug, state, ensureUploaded]);

  const contextValue: WizardContextValue = useMemo(
    () => ({
      state,
      dispatch,
      org: { name: orgName, cnpjFormatted: orgCnpjFormatted },
      categories,
      categoryGroups,
      needsSpecification,
      update,
      clearError,
      toggleCategory,
      addFiles,
      removeFile,
      next,
      back,
      submit,
    }),
    [
      state,
      orgName,
      orgCnpjFormatted,
      categories,
      categoryGroups,
      needsSpecification,
      update,
      clearError,
      toggleCategory,
      addFiles,
      removeFile,
      next,
      back,
      submit,
    ],
  );

  if (state.receipt) return <ReceiptCard receipt={state.receipt} />;

  const busy = state.sending || state.uploading;

  return (
    <WizardProvider value={contextValue}>
      <main className="wizard-shell">
        <header className="wizard-header">
          <Brand
            onClick={event => {
              event.preventDefault();
              leave();
            }}
          />
          <span>RELATO SEGURO · ETAPA {state.step + 1} DE 5</span>
          <button type="button" className="quiet-link" onClick={leave}>
            Sair
          </button>
        </header>
        <div className="wizard-progress" aria-label={`Etapa ${state.step + 1} de 5`}>
          {steps.map((label, index) => (
            <span key={label} className={index <= state.step ? "active" : ""}>
              <i>{index < state.step ? "✓" : index + 1}</i>
              <b>{label}</b>
            </span>
          ))}
        </div>
        <section className="form-card">
          {state.leaving ? (
            <LeaveConfirm
              onCancel={() => dispatch({ type: "leaving", leaving: false })}
              onConfirm={() => router.push("/")}
            />
          ) : (
            <>
              {state.step === 0 && <Step0Orientacoes />}
              {state.step === 1 && <Step1Modalidade />}
              {state.step === 2 && <Step2OQueAconteceu />}
              {state.step === 3 && <Step3Evidencias />}
              {state.step === 4 && <Step4Revisao />}
              {state.submitError && <div className="form-error">{state.submitError}</div>}
              <div className="wizard-actions">
                <button type="button" className="back-button" onClick={back}>
                  ← {state.step === 0 ? "Voltar ao início" : "Voltar"}
                </button>
                {state.step < 4 ? (
                  <button type="button" className="primary-button" onClick={next} disabled={busy}>
                    {state.uploading ? "Enviando anexos…" : "Continuar"} <span>→</span>
                  </button>
                ) : (
                  <button type="button" className="primary-button" onClick={submit} disabled={busy}>
                    {state.sending ? "Enviando com segurança…" : "Confirmar e enviar"} <span>→</span>
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </WizardProvider>
  );
}
