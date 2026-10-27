"use client";

import { ArrowLeft, ArrowRight } from "@/components/public/icons";

/**
 * Confirmação de saída, dentro da página.
 *
 * Não é `window.confirm`: o diálogo nativo é um retângulo de sistema sem
 * nenhuma relação com o canal, aparece igual ao de um site malicioso e, em
 * várias plataformas, some sozinho. Aqui a pergunta é feita com o mesmo
 * vocabulário visual do resto do relato (botões `.wz-*`).
 */
export default function LeaveConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="privacy-note" role="alertdialog" aria-label="Sair e descartar o relato">
      <b>Sair e descartar este relato?</b>
      <p>
        O que você escreveu ainda não foi enviado e não fica guardado neste computador — nem em
        rascunho, nem no navegador. Se sair agora, o relato será descartado e não poderá ser
        recuperado.
      </p>
      <div className="wz-actions">
        <button type="button" className="wz-back" onClick={onCancel}>
          <ArrowLeft size={18} /> Continuar o relato
        </button>
        <button type="button" className="wz-continue" onClick={onConfirm}>
          Sair e descartar
          <span className="wz-seta">
            <ArrowRight />
          </span>
        </button>
      </div>
    </div>
  );
}
