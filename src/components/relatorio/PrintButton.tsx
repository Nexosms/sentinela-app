"use client";

/** "Baixar PDF": abre o diálogo de impressão do navegador (a folha A4 do relatório faz o resto). */
export default function PrintButton() {
  return (
    <button type="button" className="primary-button portal-link-button" onClick={() => window.print()}>
      Baixar PDF <span>↓</span>
    </button>
  );
}
