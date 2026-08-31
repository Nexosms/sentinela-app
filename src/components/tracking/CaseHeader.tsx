"use client";

import type { TrackedCase } from "@/lib/report/tracking";

/**
 * Cabeçalho do caso (_legacy, l. 151). O protocolo era o texto digitado no
 * formulário e o status era a string fixa "Em triagem"; agora os dois vêm do
 * registro real devolvido pelo servidor.
 */
export default function CaseHeader({ trackedCase }: { trackedCase: TrackedCase }) {
  return (
    <div className="case-safe-head">
      <div>
        <span className="section-kicker">PROTOCOLO</span>
        <h1>{trackedCase.protocol}</h1>
      </div>
      <span className="status-pill">{trackedCase.statusLabel}</span>
    </div>
  );
}
