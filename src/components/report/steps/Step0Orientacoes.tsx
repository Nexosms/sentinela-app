"use client";

import { Alert, Building, Check, Heart, ShieldCheck } from "@/components/public/icons";

import { FieldError } from "../fields";
import { useWizard } from "../wizardState";

export default function Step0Orientacoes() {
  const { state, org, update, clearError } = useWizard();
  const { errors } = state;

  return (
    <>
      <span className="wz-kicker">ANTES DE COMEÇAR</span>
      <h1>Um espaço para falar com segurança.</h1>
      <p className="wz-lead">
        Leia estas orientações. Elas explicam o que esperar deste canal e ajudam a proteger você e as
        pessoas envolvidas.
      </p>
      <p className="wz-org">
        <Building size={18} />
        <span>
          Este canal é operado por <strong>{org.name}</strong>
          {org.cnpjFormatted ? ` · CNPJ ${org.cnpjFormatted}` : ""}.
        </span>
      </p>
      <div className="wz-guides">
        <article className="wz-guide">
          <span className="wz-ico wz-t-red">
            <Heart size={22} />
          </span>
          <h3>Você não precisa classificar juridicamente</h3>
          <p>Descreva o que viveu ou presenciou. A equipe de triagem fará a classificação adequada.</p>
        </article>
        <article className="wz-guide">
          <span className="wz-ico wz-t-green">
            <ShieldCheck size={22} />
          </span>
          <h3>Relatos de boa-fé não devem gerar retaliação</h3>
          <p>Ameaças ou retaliações também podem ser informadas e recebem atenção prioritária.</p>
        </article>
        <article className="wz-guide">
          <span className="wz-ico wz-t-amber">
            <Alert size={22} />
          </span>
          <h3>Este não é um serviço de emergência</h3>
          <p>Em risco imediato, procure o 190, 192 ou uma rede de apoio de confiança.</p>
        </article>
      </div>
      <label className={`wz-decl ${errors.declarationAccepted ? "field-error" : ""}`}>
        <input
          type="checkbox"
          required
          checked={state.declarationAccepted}
          onChange={event => {
            update("declarationAccepted", event.target.checked);
            clearError("declarationAccepted");
          }}
        />
        <span className="wz-cx" aria-hidden="true">
          <Check size={16} />
        </span>
        <span className="wz-decl-text">
          Declaro que as informações apresentadas correspondem, de boa-fé, ao que vivenciei,
          presenciei ou tenho conhecimento, conforme minha percepção e as informações de que disponho
          neste momento. Também li e compreendi as orientações e a política de privacidade.
        </span>
      </label>
      <FieldError message={errors.declarationAccepted} />
    </>
  );
}
