import "server-only";

import type { AdminClient } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import {
  STATUS_LABEL,
  TIMELINE_STEPS,
  type ReportStatus,
  type TimelineStep,
  type TrackedCase,
  type TrackedEvidence,
  type TrackedMessage,
} from "@/lib/report/tracking";

/**
 * Monta o `TrackedCase` a partir das linhas reais do relato.
 *
 * Tudo o que a tela de acompanhamento mostra nasce aqui, e é aqui que estão os
 * filtros que impedem vazamento para o denunciante: notas internas da equipe,
 * desfecho ainda não publicado e `storage_path` das evidências nunca saem
 * desta função.
 */

/** Colunas do relato necessárias para montar o caso. */
export const TRACK_REPORT_COLUMNS =
  "id, org_id, protocol, status, created_at, updated_at, closed_at, closure_summary, closure_disclosed_at";

export type TrackReportRow = {
  id: string;
  org_id: string;
  protocol: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closure_summary: string | null;
  closure_disclosed_at: string | null;
};

const CLOSED_STATUSES: ReportStatus[] = ["concluida", "arquivada"];

export function isClosed(status: ReportStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "31/08/2026 às 14:32" — sempre no fuso de Brasília, nunca no do servidor. */
export function formatDateTime(iso: string): string {
  return DATE_FORMAT.format(new Date(iso)).replace(", ", " às ");
}

type HistoryRow = {
  created_at: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
};

type MessageRow = {
  id: string;
  author_type: Database["public"]["Enums"]["message_author"];
  body: string;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  sha256_verified: string | null;
};

/**
 * Projeta o histórico real de status sobre os quatro degraus do desenho.
 *
 * O protótipo desenhava a escada com datas fixas no JSX ("Hoje, 14:32"). Aqui
 * cada degrau responde a `report_status_history`: quando entrou, e se já saiu.
 * `aguardando_informacao` não é um degrau — é uma pausa dentro da apuração, e
 * aparece como estado do degrau 3.
 */
export function buildTimeline(
  report: TrackReportRow,
  history: HistoryRow[],
): TimelineStep[] {
  const enteredAt = (status: ReportStatus): string | null =>
    history.find(h => h.to_status === status)?.created_at ?? null;
  const leftAt = (status: ReportStatus): string | null =>
    history.find(h => h.from_status === status)?.created_at ?? null;

  const status = report.status;
  const waiting = status === "aguardando_informacao";

  return TIMELINE_STEPS.map(({ key, label, hint }): TimelineStep => {
    switch (key) {
      case "recebido":
        // O relato existe: este degrau é sempre cumprido, e a data é a da linha.
        return {
          key,
          label,
          detail: formatDateTime(report.created_at),
          done: true,
          current: false,
        };

      case "em_triagem": {
        // A triagem começa no INSERT (o trigger grava to_status = em_triagem).
        const entered = enteredAt("em_triagem") ?? report.created_at;
        const current = status === "em_triagem";
        const done = !current && leftAt("em_triagem") !== null;
        return {
          key,
          label,
          detail: done || current ? formatDateTime(entered) : hint,
          done,
          current,
        };
      }

      case "em_apuracao": {
        const entered = enteredAt("em_apuracao");
        const current = status === "em_apuracao" || waiting;
        const done = !current && leftAt("em_apuracao") !== null;
        let detail: string = hint;
        if (waiting) {
          detail = "A equipe aguarda uma informação sua para seguir com a apuração.";
        } else if (entered && (done || current)) {
          detail = formatDateTime(entered);
        }
        return { key, label, detail, done, current };
      }

      case "conclusao": {
        const done = report.closed_at !== null;
        return {
          key,
          label,
          detail: done ? formatDateTime(report.closed_at as string) : hint,
          done,
          current: false,
        };
      }
    }
  });
}

/**
 * Lê mensagens, evidências e histórico e devolve o contrato da tela.
 *
 * `internal = true` NUNCA entra: são as anotações que a equipe escreve entre si
 * sobre o caso e, frequentemente, sobre a pessoa que denunciou. Este é o filtro
 * mais importante de todo o fluxo público.
 */
export async function buildTrackedCase(
  supabase: AdminClient,
  report: TrackReportRow,
): Promise<TrackedCase> {
  const [historyResult, messagesResult, evidenceResult] = await Promise.all([
    supabase
      .from("report_status_history")
      .select("created_at, from_status, to_status")
      .eq("report_id", report.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("report_messages")
      .select("id, author_type, body, created_at")
      .eq("report_id", report.id)
      .eq("internal", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("report_evidence")
      .select("id, filename, size_bytes, created_at, sha256_verified")
      .eq("report_id", report.id)
      .order("created_at", { ascending: true }),
  ]);

  if (historyResult.error) {
    throw new Error(`histórico: ${historyResult.error.message}`);
  }
  if (messagesResult.error) {
    throw new Error(`mensagens: ${messagesResult.error.message}`);
  }
  if (evidenceResult.error) {
    throw new Error(`evidências: ${evidenceResult.error.message}`);
  }

  const messages: TrackedMessage[] = (messagesResult.data as MessageRow[]).map(m => ({
    id: m.id,
    authorType: m.author_type,
    body: m.body,
    createdAt: m.created_at,
  }));

  // Marca como lidas as mensagens da equipe que a pessoa está vendo agora. Não
  // é crítico: falhar aqui não pode derrubar a consulta.
  const unreadFromStaff = (messagesResult.data as MessageRow[]).some(
    m => m.author_type !== "reporter",
  );
  if (unreadFromStaff) {
    const { error } = await supabase
      .from("report_messages")
      .update({ read_by_reporter_at: new Date().toISOString() })
      .eq("report_id", report.id)
      .eq("internal", false)
      .neq("author_type", "reporter")
      .is("read_by_reporter_at", null);
    if (error) console.error("[track] marcação de leitura: %s", error.message);
  }

  const evidence: TrackedEvidence[] = (evidenceResult.data as EvidenceRow[]).map(e => ({
    id: e.id,
    filename: e.filename,
    sizeBytes: e.size_bytes,
    createdAt: e.created_at,
    // `storage_path` não sai daqui: com ele o cliente pediria uma URL assinada
    // do objeto de qualquer relato.
    verified: e.sha256_verified !== null,
  }));

  return {
    protocol: report.protocol,
    status: report.status,
    statusLabel: STATUS_LABEL[report.status],
    receivedAt: report.created_at,
    updatedAt: report.updated_at,
    // Um desfecho que a organização ainda não decidiu publicar é trabalho
    // interno: só vai para a pessoa depois de `closure_disclosed_at`.
    closureSummary: report.closure_disclosed_at ? report.closure_summary : null,
    timeline: buildTimeline(report, historyResult.data as HistoryRow[]),
    messages,
    evidence,
    canReply: !isClosed(report.status),
  };
}
