"use client";

import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";

import type { Receipt } from "./wizardState";

/**
 * Tela de comprovante (protótipo `ReportChannel.tsx`, l. 141). É uma transição de estado dentro de
 * /relato, nunca uma URL: a chave é mostrada uma única vez e não pode viajar
 * em querystring, histórico do navegador ou Referer.
 */
export default function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const router = useRouter();

  async function downloadReceipt() {
    // PDF, não .txt: o comprovante é para o denunciante guardar/imprimir, e um
    // arquivo de texto puro abre em qualquer editor e perde a formatação — o
    // pedido explícito foi por um PDF de verdade.
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 56;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    // Hífen simples, não travessão "—": a fonte padrão do jsPDF (Helvetica) não
    // tem esse glifo e o descarta silenciosamente do PDF gerado.
    doc.text("SENTINELA - CANAL DE DENÚNCIAS", margin, y);
    y += 22;
    doc.setFontSize(12);
    doc.text("Comprovante de acompanhamento", margin, y);
    y += 32;

    function field(label: string, value: string) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(label, margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.text(value, margin, y);
      y += 28;
    }

    field("PROTOCOLO", receipt.protocol);
    field("CHAVE DE ACOMPANHAMENTO", receipt.secret);
    field("DATA DE EMISSÃO", new Date().toLocaleString("pt-BR"));
    field("STATUS INICIAL", "Relato recebido");
    field("ACOMPANHAMENTO", `${location.origin}/acompanhar`);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(
      doc.splitTextToSize(
        "Este comprovante não contém o conteúdo sensível do relato. Guarde-o em local seguro.",
        515,
      ),
      margin,
      y,
    );

    doc.save(`protocolo-sentinela-${receipt.protocol}.pdf`);
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
