import Link from "next/link";

/**
 * Paginação de lista em `.inbox-tools`. Genérica de propósito: recebe só o
 * número da página, o total e uma função que sabe montar o href — nada de
 * filtro, tabela ou rota entra aqui.
 *
 * O botão do meio é `<button disabled>` e não texto solto porque
 * `.inbox-tools>:is(button,a)` é quem desenha a caixa.
 */
export default function Pager({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;

  return (
    <div className="inbox-tools">
      {page > 1 ? <Link href={hrefFor(page - 1)}>← Anterior</Link> : null}
      <button type="button" disabled>
        Página {page} de {pages}
      </button>
      {page < pages ? <Link href={hrefFor(page + 1)}>Próxima →</Link> : null}
    </div>
  );
}
