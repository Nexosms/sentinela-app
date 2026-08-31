/**
 * Contrato da tela de acompanhamento. Compartilhado entre as rotas públicas e
 * a interface do denunciante.
 *
 * No protótipo esta tela era 100% falsa: a linha do tempo tinha datas fixas
 * ("Hoje, 14:32"), a mensagem da empresa era texto escrito no código, e o
 * botão "Enviar resposta" só mudava estado local — nada era persistido, e o
 * `status` e as `messages` que a API já devolvia eram descartados.
 */

import type { Database } from "@/lib/supabase/database.types";

export type ReportStatus = Database["public"]["Enums"]["report_status"];
export type MessageAuthor = Database["public"]["Enums"]["message_author"];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  em_triagem: "Em triagem",
  em_apuracao: "Em apuração",
  aguardando_informacao: "Aguardando informação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

/**
 * A escada canônica que o design desenha. O protótipo a tinha fixa no JSX;
 * aqui ela é a referência contra a qual o histórico real é projetado.
 * `aguardando_informacao` não é um degrau próprio — é uma pausa dentro da
 * apuração, e aparece como estado do degrau 3.
 */
export const TIMELINE_STEPS = [
  { key: "recebido",    label: "Relato recebido",  hint: "Seu relato foi registrado com segurança." },
  { key: "em_triagem",  label: "Em triagem",       hint: "A equipe está verificando as informações iniciais." },
  { key: "em_apuracao", label: "Em apuração",      hint: "Próxima etapa." },
  { key: "conclusao",   label: "Conclusão segura", hint: "Você receberá uma comunicação compatível." },
] as const;

export type TimelineStepKey = (typeof TIMELINE_STEPS)[number]["key"];

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  /** Texto sob o degrau: data real quando já aconteceu, orientação quando não. */
  detail: string;
  done: boolean;
  current: boolean;
};

export type TrackedMessage = {
  id: string;
  authorType: MessageAuthor;
  body: string;
  createdAt: string;
};

export type TrackedEvidence = {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  /** `false` enquanto a verificação de integridade no servidor não terminou. */
  verified: boolean;
};

export type TrackedCase = {
  protocol: string;
  status: ReportStatus;
  statusLabel: string;
  receivedAt: string;
  updatedAt: string;
  /** Só é preenchido quando a organização publicou o desfecho ao denunciante. */
  closureSummary: string | null;
  timeline: TimelineStep[];
  messages: TrackedMessage[];
  evidence: TrackedEvidence[];
  /** Falso quando o caso está concluído ou arquivado. */
  canReply: boolean;
};

/**
 * Mensagem única para "protocolo não existe" e "chave errada". O 404
 * `"Protocolo não encontrado"` do protótipo era um oráculo de enumeração.
 */
export const TRACK_DENIED =
  "Protocolo ou chave não encontrados. Confira os dados e tente novamente.";

export const TRACK_UNAVAILABLE =
  "A consulta está temporariamente indisponível. Tente novamente em alguns minutos.";
