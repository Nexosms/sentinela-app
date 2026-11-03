/**
 * Prazo vigente de um relato — puro, sem acesso a dados.
 *
 * `reports.due_at` guarda o prazo da etapa em que o relato está (migração 045): na triagem vale o
 * prazo da triagem; em apuração ou aguardando informação, o da apuração. Relato concluído ou
 * arquivado não tem mais prazo a cumprir, então nunca aparece como atrasado.
 */

import type { ReportStatus } from "@/lib/admin/labels";

export type EtapaDoPrazo = "triagem" | "apuracao" | "encerrado";

export function etapaDoPrazo(status: ReportStatus): EtapaDoPrazo {
  if (status === "em_triagem") return "triagem";
  if (status === "concluida" || status === "arquivada") return "encerrado";
  return "apuracao";
}

export const ROTULO_PRAZO: Record<EtapaDoPrazo, string> = {
  triagem: "Prazo da triagem",
  apuracao: "Prazo da apuração",
  encerrado: "Prazo (encerrado)",
};

/** Atrasado = caso aberto com o prazo da etapa já passado. */
export function prazoVencido(
  status: ReportStatus,
  dueAt: string | null,
  agora: Date = new Date(),
): boolean {
  return (
    etapaDoPrazo(status) !== "encerrado" &&
    dueAt !== null &&
    new Date(dueAt).getTime() < agora.getTime()
  );
}
