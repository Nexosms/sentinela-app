import { z } from "zod";

/**
 * Fonte única de validação, usada no cliente e no servidor. No protótipo o
 * cliente validava 8 campos e o servidor checava, por conta própria, apenas
 * `secret.length >= 6 && description.length >= 20`.
 */

export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/pdf", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg", "audio/mp4", "audio/ogg",
  "video/mp4", "video/webm",
] as const;

export const RELATIONSHIPS = [
  { value: "colaborador",       label: "Colaborador(a)" },
  { value: "ex_colaborador",    label: "Ex-colaborador(a)" },
  { value: "prestador",         label: "Prestador(a) / terceiro(a)" },
  { value: "fornecedor",        label: "Fornecedor(a)" },
  { value: "cliente_visitante", label: "Cliente ou visitante" },
] as const;

export const RECURRENCES = [
  { value: "once",      label: "Aconteceu uma vez" },
  { value: "recurring", label: "Acontece repetidamente" },
  { value: "ongoing",   label: "Está acontecendo agora" },
  { value: "unknown",   label: "Não sei informar" },
] as const;

/**
 * Explicação de cada categoria do relato, uma frase objetiva por `code`
 * (`categories.code` no banco — ver `CategoryOption` em `lib/report/catalog.ts`).
 * Mostrada pelo "i" ao lado de cada opção em Step2OQueAconteceu. Categorias
 * criadas depois (por organização) simplesmente não têm entrada aqui — o "i"
 * some nesse caso, em vez de mostrar um texto genérico sem sentido.
 */
export const CATEGORY_INFO: Record<string, string> = {
  assedio_moral:
    "Humilhação, ridicularização ou hostilidade repetida no ambiente de trabalho, capaz de abalar a dignidade ou a saúde da pessoa.",
  assedio_sexual:
    "Investida, comentário ou contato de natureza sexual não consentido, ou uso de posição hierárquica para obter favor sexual.",
  discriminacao:
    "Tratamento desigual por motivo de gênero, raça, idade, religião, orientação sexual, deficiência ou outra característica pessoal.",
  outra_violencia:
    "Qualquer violência ou conduta inadequada relacionada ao trabalho que não se encaixe nas opções acima — descreva no campo de especificação.",
  retaliacao:
    "Prejuízo, ameaça ou tratamento desfavorável sofrido por já ter relatado ou denunciado algo antes.",
  outra_conduta:
    "Uma conduta inadequada que não é bem uma violência, mas ainda assim precisa ser relatada — descreva no campo de especificação.",
  sobrecarga:
    "Volume de trabalho, prazos ou ritmo além do que é possível sustentar com qualidade e saúde.",
  subcarga:
    "Falta de tarefas, tempo ocioso excessivo ou subaproveitamento das suas capacidades no trabalho.",
  baixa_autonomia:
    "Pouca ou nenhuma liberdade para decidir como, quando ou em que ordem realizar as próprias tarefas.",
  falta_suporte:
    "Ausência de ajuda de colegas, liderança ou da organização quando você precisa para realizar o trabalho.",
  ambiguidade_papel:
    "Não fica claro o que se espera de você, quais são suas responsabilidades ou a quem você responde.",
  falta_reconhecimento:
    "Esforço ou bom desempenho que não recebem retorno, valorização ou recompensa proporcional.",
  injustica_organizacional:
    "Sensação de que as regras, decisões ou oportunidades não são aplicadas de forma justa e igual para todos.",
  gestao_mudancas:
    "Mudanças na empresa (reestruturação, novos processos, etc.) feitas sem comunicação clara ou preparo suficiente.",
  relacionamentos_conflituosos:
    "Conflitos, hostilidade ou relações desgastadas com colegas, liderança ou subordinados.",
  comunicacao:
    "Informações que não chegam, chegam tarde ou de forma confusa, prejudicando o trabalho.",
  trabalho_isolado:
    "Isolamento social ou profissional por trabalhar sozinho, à distância ou sem contato regular com a equipe.",
  evento_traumatico:
    "Assalto, acidente grave, ameaça ou outra situação chocante vivida ou testemunhada por causa do trabalho.",
  outro_fator:
    "Um fator relacionado a como o trabalho é organizado que não está nas opções acima — descreva no campo de especificação.",
};

const trimmed = (max: number) => z.string().trim().max(max);

/** Metadados de um arquivo, declarados pelo cliente. Os valores reais são
 *  relidos do Storage no servidor — nunca se confia nestes números. */
export const evidenceMetaSchema = z.object({
  clientId: z.string().min(1).max(64),
  name: trimmed(255).min(1, "Arquivo sem nome."),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "Arquivo acima de 15 MB."),
  mime: z.enum(ALLOWED_MIME, { message: "Tipo de arquivo não aceito." }),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "Hash inválido.").optional(),
});

export const uploadedEvidenceSchema = evidenceMetaSchema.extend({
  path: z.string().min(1).max(400),
});

/** Etapa 0 — Orientações */
export const step0Schema = z.object({
  declarationAccepted: z.literal(true, {
    message: "Confirme a declaração de boa-fé para continuar.",
  }),
});

/** Etapa 1 — Modalidade */
export const step1Schema = z
  .object({
    mode: z.enum(["anonymous", "identified"]),
    identityName: trimmed(200).optional(),
    identityContact: trimmed(200).optional(),
  })
  .refine(
    data =>
      data.mode !== "identified" ||
      Boolean(data.identityName?.length || data.identityContact?.length),
    {
      message: "No relato identificado, informe ao menos o nome ou um contato.",
      path: ["identityName"],
    },
  );

/** Etapa 2 — O que aconteceu */
export const step2Schema = z.object({
  relationship: z.enum(RELATIONSHIPS.map(r => r.value) as [string, ...string[]], {
    message: "Selecione sua relação com a organização.",
  }),
  periodText: trimmed(200).min(1, "Informe a data ou o período da ocorrência."),
  location: trimmed(300).optional(),
  accused: trimmed(300).min(1, 'Informe a pessoa, função ou escreva "não identificado".'),
  witnesses: trimmed(300).optional(),
  recurrence: z.enum(RECURRENCES.map(r => r.value) as [string, ...string[]]),
  categoryIds: z.array(z.uuid()).min(1, "Selecione ao menos uma opção."),
  categorySpecification: trimmed(500).optional(),
  description: z
    .string()
    .trim()
    .min(20, "Descreva o ocorrido com pelo menos 20 caracteres.")
    .max(20000, "Descrição muito longa."),
  retaliation: z.boolean(),
  urgent: z.boolean(),
});

/** Etapa 3 — Evidências */
export const step3Schema = z.object({
  evidence: z.array(uploadedEvidenceSchema).max(MAX_FILES, "No máximo 6 arquivos."),
});

/** Corpo de POST /api/public/reports */
export const submitReportSchema = z.object({
  orgSlug: z.string().min(1).max(40),
  // Sem isto, uma resposta perdida deixa o relato inalcançável para sempre:
  // a chave só existia naquela resposta.
  idempotencyKey: z.uuid(),
  uploadSessionId: z.uuid().optional(),
  ...step0Schema.shape,
  ...step3Schema.shape,
}).and(step1Schema).and(step2Schema);

export type SubmitReportInput = z.infer<typeof submitReportSchema>;
export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>;
export type UploadedEvidence = z.infer<typeof uploadedEvidenceSchema>;

/** Corpo de POST /api/public/evidence/upload-url */
export const uploadUrlRequestSchema = z.object({
  orgSlug: z.string().min(1).max(40),
  files: z.array(evidenceMetaSchema.omit({ sha256: true })).min(1).max(MAX_FILES),
});

/** Corpo de POST /api/public/track */
export const trackRequestSchema = z.object({
  protocol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-HJ-KM-NP-TV-Z0-9]{4}-?[A-HJ-KM-NP-TV-Z0-9]{4}-?[A-HJ-KM-NP-TV-Z0-9]{4}$/,
      "Protocolo inválido.",
    ),
  secret: z.string().trim().min(6).max(120),
});

/** Corpo de POST /api/public/messages */
export const reporterMessageSchema = z.object({
  body: z.string().trim().min(1, "Escreva uma mensagem.").max(10000),
});

/** Mapeia erros do zod para { campo: mensagem }, no formato que as classes
 *  `.field-error` do design system já esperam. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
