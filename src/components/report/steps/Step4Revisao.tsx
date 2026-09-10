"use client";

import { useWizard } from "../wizardState";

export default function Step4Revisao() {
  const { state, categories } = useWizard();

  const selectedCategories = categories
    .filter(category => state.categoryIds.includes(category.id))
    .map(category => category.label)
    .join(" · ");

  return (
    <>
      <span className="section-kicker">REVISÃO</span>
      <h1>Revise antes de enviar.</h1>
      <p className="lead">
        Depois do envio, o relato original não poderá ser alterado. Complementações ficam registradas
        como novos eventos.
      </p>
      <div className="review-grid">
        <article>
          <small>MODALIDADE</small>
          <strong>{state.mode === "anonymous" ? "Anônima" : "Identificada e confidencial"}</strong>
        </article>
        <article>
          <small>CATEGORIAS</small>
          <strong>{selectedCategories || "Não classificadas"}</strong>
        </article>
        <article>
          <small>ANEXOS</small>
          <strong>{state.files.length} arquivo(s)</strong>
        </article>
        <article className="full">
          <small>RELATO</small>
          <p>{state.description || "Nenhuma descrição informada."}</p>
        </article>
      </div>
      <div className="privacy-note human-review">
        <b>Análise e decisão humanas</b>
        <p>
          Seu relato é analisado com atenção. As sugestões apresentadas pelo sistema servem apenas
          para apoiar a organização da triagem. A avaliação, classificação e qualquer decisão são
          realizadas por pessoas responsáveis e autorizadas.
        </p>
      </div>
    </>
  );
}
