"use client";

import { useState } from "react";

import { solicitarUpload } from "@/app/admin/clientes/[orgId]/portal/actions";
import { createClient } from "@/lib/supabase/client";
import {
  PORTAL_ACCEPT,
  PORTAL_BUCKET,
  PORTAL_MAX_BYTES,
  formatSize,
} from "@/lib/portal/files";

export type UploadedFile = { path: string; filename: string; mime: string; size: number };

/**
 * Seletor de arquivo com envio imediato, direto ao Storage.
 *
 * O arquivo escolhido sobe assim que é selecionado: pede um caminho + token à
 * server action (`solicitarUpload`, só metadados) e envia os bytes com
 * `uploadToSignedUrl` — nunca por uma função da Vercel, cujo corpo é limitado a
 * 4,5 MB. Quando termina, avisa o formulário pai (`onDone`), que grava
 * `storage_path`/`filename` nos campos ocultos e libera o botão de salvar.
 *
 * Não há barra de progresso: o envio é um único PUT e o cliente do Supabase não
 * expõe progresso nele. Para gravações de GB numa conexão ruim, o próximo passo
 * seria upload resumível (TUS).
 */
export default function UploadField({
  orgId,
  kind,
  accept,
  label,
  onBusy,
  onDone,
}: {
  orgId: string;
  kind: "recording" | "meeting_file" | "material";
  accept?: string;
  label: string;
  onBusy: (busy: boolean) => void;
  onDone: (file: UploadedFile | null) => void;
}) {
  const [status, setStatus] = useState<
    { fase: "vazio" } | { fase: "enviando"; nome: string } | { fase: "pronto"; nome: string; tamanho: number } | { fase: "erro"; mensagem: string }
  >({ fase: "vazio" });

  async function aoEscolher(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    onDone(null);
    if (file.size > PORTAL_MAX_BYTES) {
      setStatus({ fase: "erro", mensagem: "Arquivo acima do limite de 2 GB." });
      return;
    }

    setStatus({ fase: "enviando", nome: file.name });
    onBusy(true);
    try {
      const ticket = await solicitarUpload({
        orgId,
        kind,
        filename: file.name,
        size: file.size,
        type: file.type,
      });
      if ("error" in ticket) {
        setStatus({ fase: "erro", mensagem: ticket.error });
        return;
      }

      const { error } = await createClient()
        .storage.from(PORTAL_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.mime });
      if (error) {
        console.error("[portal] upload: %s", error.message);
        setStatus({
          fase: "erro",
          mensagem:
            "O envio falhou. Confira a conexão e o tamanho do arquivo (o limite do projeto no Supabase também vale) e tente de novo.",
        });
        return;
      }

      onDone({ path: ticket.path, filename: file.name, mime: ticket.mime, size: file.size });
      setStatus({ fase: "pronto", nome: file.name, tamanho: file.size });
    } catch (error) {
      console.error("[portal] upload", error);
      setStatus({ fase: "erro", mensagem: "O envio falhou. Tente novamente." });
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="portal-upload">
      <label className="portal-upload-pick">
        <span>{label}</span>
        <input type="file" accept={accept ?? PORTAL_ACCEPT} onChange={aoEscolher} />
      </label>
      {status.fase === "enviando" ? (
        <p className="portal-upload-status" role="status">
          Enviando <strong>{status.nome}</strong>… não feche esta página.
        </p>
      ) : null}
      {status.fase === "pronto" ? (
        <p className="portal-upload-status ok" role="status">
          ✓ <strong>{status.nome}</strong> ({formatSize(status.tamanho)}) enviado. Falta salvar.
        </p>
      ) : null}
      {status.fase === "erro" ? (
        <p className="portal-upload-status erro" role="alert">
          {status.mensagem}
        </p>
      ) : null}
    </div>
  );
}
