"use client";

import { Check, EyeOff, Lock, UserCheck } from "@/components/public/icons";

import { FieldError } from "../fields";
import { useWizard } from "../wizardState";

/**
 * Etapa "Modalidade". As duas opções são botões de rádio de verdade (escondidos
 * visualmente): teclado (setas) e leitores de tela funcionam sem código extra.
 * Os campos de identificação ficam sempre no DOM e se recolhem com animação; a
 * versão recolhida é `inert`, para o Tab não cair em campo invisível.
 */
export default function Step1Modalidade() {
  const { state, update } = useWizard();
  const { errors } = state;
  const identified = state.mode === "identified";

  return (
    <>
      <span className="wz-kicker">MODALIDADE</span>
      <h1>Como você prefere fazer o relato?</h1>
      <p className="wz-lead">
        A identidade, quando informada, fica separada do conteúdo do relato e exige permissão
        específica.
      </p>

      <div className="wz-modos" role="radiogroup" aria-label="Modalidade do relato">
        <label className={`wz-modo ${identified ? "" : "sel"}`}>
          <input
            type="radio"
            name="modalidade"
            value="anonymous"
            checked={!identified}
            onChange={() => update("mode", "anonymous")}
          />
          <span className="wz-modo-mark" aria-hidden="true">
            <Check size={16} />
          </span>
          <span className="wz-mi wz-t-red" aria-hidden="true">
            <EyeOff size={24} />
          </span>
          <span className="wz-modo-title">Anônimo</span>
          <span className="wz-modo-text">
            Nenhum nome, e-mail, telefone, IP ou identificador é solicitado.
          </span>
          <span className="wz-modo-tag">COMUNICAÇÃO POR CAIXA POSTAL</span>
        </label>

        <label className={`wz-modo ${identified ? "sel" : ""}`}>
          <input
            type="radio"
            name="modalidade"
            value="identified"
            checked={identified}
            onChange={() => update("mode", "identified")}
          />
          <span className="wz-modo-mark" aria-hidden="true">
            <Check size={16} />
          </span>
          <span className="wz-mi wz-t-green" aria-hidden="true">
            <UserCheck size={24} />
          </span>
          <span className="wz-modo-title">Identificado e confidencial</span>
          <span className="wz-modo-text">
            Sua identidade é protegida e visível apenas para pessoas autorizadas.
          </span>
          <span className="wz-modo-tag">CONTATO OPCIONAL E CONTROLADO</span>
        </label>
      </div>

      <div className={`wz-ident ${identified ? "" : "closed"}`} aria-hidden={!identified} inert={!identified}>
        <div className="wz-ident-in">
          <div className="wz-fields">
            <label className={errors.identityName ? "field-error" : ""}>
              Seu nome
              <input
                className="wz-input"
                value={state.identityName}
                aria-invalid={!!errors.identityName}
                onChange={e => update("identityName", e.target.value)}
                placeholder="Nome completo"
                autoComplete="off"
              />
            </label>
            <label>
              E-mail ou telefone
              <input
                className="wz-input"
                value={state.identityContact}
                onChange={e => update("identityContact", e.target.value)}
                placeholder="Contato seguro"
                autoComplete="off"
              />
            </label>
          </div>
          <p className="wz-hint">Preencha ao menos um dos dois campos.</p>
          <FieldError message={errors.identityName} />
          <p className="wz-sigilo">
            <Lock size={18} />
            <span>
              Sua identidade fica separada do conteúdo do relato. Quem a acessa precisa de permissão
              específica, e cada acesso fica registrado.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
