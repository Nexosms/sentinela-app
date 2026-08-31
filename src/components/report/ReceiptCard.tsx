"use client";

import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";

import type { Receipt } from "./wizardState";

/**
 * Tela de comprovante (_legacy, l. 141). É uma transição de estado dentro de
 * /relato, nunca uma URL: a chave é mostrada uma única vez e não pode viajar
 * em querystring, histórico do navegador ou Referer.
 */
export default function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const router = useRouter();

  function downloadReceipt() {
    const safeReceipt = [
      "SENTINELA — CANAL DE DENÚNCIAS",
      "Comprovante de acompanhamento",
      "",
      `Protocolo: ${receipt.protocol}`,
      `Chave de acompanhamento: ${receipt.secret}`,
      `Data de emissão: ${new Date().toLocaleString("pt-BR")}`,
      "Status inicial: Relato recebido",
      `Acompanhamento: ${location.origin}/acompanhar`,
      "",
      "Este comprovante não contém o conteúdo sensível do relato. Guarde-o em local seguro.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([safeReceipt], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `protocolo-sentinela-${receipt.protocol}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="wizard-shell">
      <header className="wizard-header">
        <Brand />
        <span>RELATO ENVIADO</span>
      </header>
      <section className="receipt-card">
        <span className="success-mark">✓</span>
        <span className="section-kicker">RECEBEMOS O SEU RELATO</span>
        <h1>Guarde estes dados com cuidado.</h1>
        <p>Por segurança, esta chave não será enviada por e-mail e não poderá ser recuperada.</p>
        <div className="credential">
          <small>PROTOCOLO</small>
          <strong>{receipt.protocol}</strong>
          <button type="button" onClick={() => navigator.clipboard?.writeText(receipt.protocol)}>
            Copiar
          </button>
        </div>
        <div className="credential">
          <small>CHAVE DE ACOMPANHAMENTO</small>
          <strong>{receipt.secret}</strong>
          <button type="button" onClick={() => navigator.clipboard?.writeText(receipt.secret)}>
            Copiar
          </button>
        </div>
        {/*
          Único desvio deliberado do JSX original. A regra `.download-receipt`
          no globals.css só tem margin-top e três !important sobre
          border-color/background/color — sem padding, min-height nem
          border-radius. Esses !important existem para vencer outra classe, e a
          única com essas declarações é `.secondary-button`. O protótipo
          esqueceu a classe base e o botão saía como um retângulo teal sem
          respiro. Manter o erro por fidelidade seria entregar um botão quebrado.
        */}
        <button
          type="button"
          className="secondary-button download-receipt"
          onClick={downloadReceipt}
        >
          ↓ Baixar protocolo
        </button>
        <div className="receipt-warning">
          <strong>Proteja seu acesso</strong>
          <span>
            Não compartilhe estes dados. Baixe o protocolo, faça uma captura de tela ou anote-os em
            local seguro.
          </span>
        </div>
        <button type="button" className="primary-button" onClick={() => router.push("/acompanhar")}>
          Acompanhar agora <span>→</span>
        </button>
      </section>
    </main>
  );
}
