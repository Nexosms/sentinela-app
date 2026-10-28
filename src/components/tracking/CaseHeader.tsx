"use client";

import type { TrackedCase } from "@/lib/report/tracking";

/**
 * Cabeçalho do caso. O protocolo e o status vêm do registro real devolvido pelo servidor.
 * Concluído e arquivado ficam em verde (caso encerrado); os demais em âmbar (em andamento).
 */
export default function CaseHeader({ trackedCase }: { trackedCase: TrackedCase }) {
  const closed = trackedCase.status === "concluida" || trackedCase.status === "arquivada";
  return (
    <>
      <span className="wz-kicker">PROTOCOLO</span>
      <h1 className="wc-proto">{trackedCase.protocol}</h1>
      <span className={`wc-pill ${closed ? "ok" : ""}`}>
        <i aria-hidden="true" />
        {trackedCase.statusLabel}
      </span>
    </>
  );
}
