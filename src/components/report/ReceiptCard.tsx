"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";
import { Alert, ArrowRight, Check, Copy, Download, ExitIcon, Lock } from "@/components/public/icons";

import { downloadReceiptPdf } from "./receiptPdf";
import type { Receipt } from "./wizardState";
import "./wizard.css";

const steps = ["Orientações", "Modalidade", "O que aconteceu", "Evidências", "Revisão"];

type Field = "protocol" | "secret";

function CopyButton({
  label,
  done,
  onCopy,
}: {
  label: string;
  done: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      className={`wz-copy ${done ? "done" : ""}`}
      onClick={onCopy}
      aria-label={done ? `${label} copiado` : `Copiar ${label}`}
    >
      {done ? <Check size={17} /> : <Copy size={17} />}
      <span>{done ? "Copiado" : "Copiar"}</span>
    </button>
  );
}

/**
 * Tela de comprovante. É uma transição de estado dentro de /relato, nunca uma URL: a chave é
 * mostrada uma única vez e não pode viajar em querystring, histórico do navegador ou Referer.
 */
export default function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const router = useRouter();
  const [copied, setCopied] = useState<Field | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy(field: Field) {
    try {
      await navigator.clipboard.writeText(receipt[field]);
    } catch {
      // Sem permissão de área de transferência: o valor continua visível para copiar à mão.
      return;
    }
    setCopied(field);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  }

  async function downloadReceipt() {
    setPdfError(false);
    try {
      await downloadReceiptPdf(receipt, location.origin);
    } catch {
      setPdfError(true);
    }
  }

  return (
    <main className="wz">
      <header className="wz-header">
        <Brand />
        <span className="wz-stepchip">
          <Lock size={15} /> RELATO ENVIADO
        </span>
        <span className="wz-exit wz-ghost" aria-hidden="true">
          <ExitIcon size={18} /> Sair
        </span>
      </header>
      <nav
        className="wz-progress"
        aria-label="Todas as etapas concluídas"
        style={{ "--wz-fill": "80%" } as CSSProperties}
      >
        <ol>
          {steps.map(label => (
            <li key={label} className="done">
              <i>
                <Check size={18} />
              </i>
              <b>{label}</b>
            </li>
          ))}
        </ol>
      </nav>
      <p className="wz-step-m">
        Relato <b>enviado</b>
      </p>
      <div className="wz-receipt-wrap">
        <section className="wz-card wz-receipt">
          <span className="wz-success" aria-hidden="true">
            <i />
            <i />
            <b>
              <Check size={34} />
            </b>
          </span>
          <span className="wz-kicker wz-center">RECEBEMOS O SEU RELATO</span>
          <h1 className="wz-center">Guarde estes dados com cuidado.</h1>
          <p className="wz-lead wz-center">
            Por segurança, esta chave não será enviada por e-mail e não poderá ser recuperada.
          </p>

          <div className="wz-cred">
            <div className="wz-cred-in">
              <small>PROTOCOLO</small>
              <strong>{receipt.protocol}</strong>
            </div>
            <CopyButton label="protocolo" done={copied === "protocol"} onCopy={() => void copy("protocol")} />
          </div>
          <div className="wz-cred key">
            <div className="wz-cred-in">
              <small>
                CHAVE DE ACOMPANHAMENTO <em>mostrada uma única vez</em>
              </small>
              <strong>{receipt.secret}</strong>
            </div>
            <CopyButton
              label="chave de acompanhamento"
              done={copied === "secret"}
              onCopy={() => void copy("secret")}
            />
          </div>
          <span className="wz-sr" role="status" aria-live="polite">
            {copied ? "Copiado para a área de transferência." : ""}
          </span>

          <button type="button" className="wz-download" onClick={() => void downloadReceipt()}>
            <Download size={19} /> Baixar protocolo em PDF
          </button>
          {pdfError ? (
            <p className="wz-rejected" role="alert">
              <Alert size={18} />
              <span>
                Não foi possível gerar o PDF agora. Copie o protocolo e a chave acima, ou faça uma captura
                de tela.
              </span>
            </p>
          ) : null}

          <div className="wz-warn">
            <Alert size={19} />
            <div>
              <b>Proteja seu acesso</b>
              <p>
                Não compartilhe estes dados. Baixe o protocolo, faça uma captura de tela ou anote-os em
                local seguro.
              </p>
            </div>
          </div>

          <div className="wz-actions wz-actions-end">
            <button type="button" className="wz-continue" onClick={() => router.push("/acompanhar")}>
              Acompanhar agora
              <span className="wz-seta">
                <ArrowRight />
              </span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
