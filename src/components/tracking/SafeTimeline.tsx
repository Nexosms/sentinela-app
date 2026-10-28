"use client";

import { Check } from "@/components/public/icons";
import type { TimelineStep } from "@/lib/report/tracking";

/**
 * Linha do tempo. Cada degrau vem de `case.timeline`: o servidor projeta o histórico real sobre
 * `TIMELINE_STEPS` e já entrega `detail` formatado — a tela não reformata data nenhuma.
 */
export default function SafeTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="wc-tl" aria-label="Andamento do caso">
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={step.done ? "done" : step.current ? "current" : ""}
          aria-current={step.current ? "step" : undefined}
        >
          <i aria-hidden="true">{step.done ? <Check size={17} /> : index + 1}</i>
          <div>
            <b>{step.label}</b>
            <small>{step.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
