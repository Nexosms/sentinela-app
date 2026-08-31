"use client";

import type { TimelineStep } from "@/lib/report/tracking";

/**
 * Linha do tempo (_legacy, l. 151). No protótipo os quatro degraus eram JSX
 * fixo, com "Hoje, 14:32" escrito no código. Aqui cada degrau vem de
 * `case.timeline`: o servidor projeta o histórico real sobre `TIMELINE_STEPS`
 * e já entrega `detail` formatado — a tela não reformata data nenhuma.
 */
export default function SafeTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="safe-timeline">
      {steps.map((step, index) => (
        <article key={step.key} className={step.done ? "done" : step.current ? "current" : ""}>
          <i>{step.done ? "✓" : index + 1}</i>
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        </article>
      ))}
    </div>
  );
}
