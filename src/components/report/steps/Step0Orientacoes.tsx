"use client";

import { FieldError } from "../fields";
import { useWizard } from "../wizardState";

export default function Step0Orientacoes() {
  const { state, update, clearError } = useWizard();
  const { errors } = state;

  return (
    <>
      <span className="section-kicker">ANTES DE COMEÇAR</span>
      <h1>Um espaço para falar com segurança.</h1>
      <p className="lead">
        Leia estas orientações. Elas explicam o que esperar deste canal e ajudam a proteger você e as
        pessoas envolvidas.
      </p>
      <div className="guidance-list">
        <article>
          <span>♡</span>
          <div>
            <h3>Você não precisa classificar juridicamente</h3>
            <p>Descreva o que viveu ou presenciou. A equipe de triagem fará a classificação adequada.</p>
          </div>
        </article>
        <article>
          <span>◌</span>
          <div>
            <h3>Relatos de boa-fé não devem gerar retaliação</h3>
            <p>Ameaças ou retaliações também podem ser informadas e recebem atenção prioritária.</p>
          </div>
        </article>
        <article>
          <span>⌁</span>
          <div>
            <h3>Este não é um serviço de emergência</h3>
            <p>Em risco imediato, procure o 190, 192 ou uma rede de apoio de confiança.</p>
          </div>
        </article>
      </div>
      <label className={`check-row ${errors.declarationAccepted ? "field-error" : ""}`}>
        <input
          type="checkbox"
          required
          checked={state.declarationAccepted}
          onChange={event => {
            update("declarationAccepted", event.target.checked);
            clearError("declarationAccepted");
          }}
        />{" "}
        <span>
          Declaro que as informações apresentadas correspondem, de boa-fé, ao que vivenciei,
          presenciei ou tenho conhecimento, conforme minha percepção e as informações de que disponho
          neste momento. Também li e compreendi as orientações e a política de privacidade.
        </span>
      </label>
      <FieldError message={errors.declarationAccepted} />
    </>
  );
}
