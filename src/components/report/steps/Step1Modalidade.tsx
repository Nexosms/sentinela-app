"use client";

import { FieldError } from "../fields";
import { useWizard } from "../wizardState";

export default function Step1Modalidade() {
  const { state, update } = useWizard();
  const { errors } = state;

  return (
    <>
      <span className="section-kicker">MODALIDADE</span>
      <h1>Como você prefere fazer o relato?</h1>
      <p className="lead">
        A identidade, quando informada, fica separada do conteúdo do relato e exige permissão
        específica.
      </p>
      <div className="mode-grid">
        <button
          type="button"
          className={state.mode === "anonymous" ? "selected" : ""}
          onClick={() => update("mode", "anonymous")}
        >
          <span>◌</span>
          <h3>Anônimo</h3>
          <p>Nenhum nome, e-mail, telefone, IP ou identificador é solicitado.</p>
          <small>COMUNICAÇÃO POR CAIXA POSTAL</small>
        </button>
        <button
          type="button"
          className={state.mode === "identified" ? "selected" : ""}
          onClick={() => update("mode", "identified")}
        >
          <span>◇</span>
          <h3>Identificado e confidencial</h3>
          <p>Sua identidade é protegida e visível apenas para pessoas autorizadas.</p>
          <small>CONTATO OPCIONAL E CONTROLADO</small>
        </button>
      </div>
      {state.mode === "identified" && (
        <div className="field-grid two">
          <label className={errors.identityName ? "field-error" : ""}>
            Seu nome
            <input
              value={state.identityName}
              aria-invalid={!!errors.identityName}
              onChange={e => update("identityName", e.target.value)}
              placeholder="Nome completo"
            />
            <FieldError message={errors.identityName} />
          </label>
          <label>
            E-mail ou telefone
            <input
              value={state.identityContact}
              onChange={e => update("identityContact", e.target.value)}
              placeholder="Contato seguro"
            />
          </label>
        </div>
      )}
    </>
  );
}
