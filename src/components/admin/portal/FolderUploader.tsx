"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  registrarArquivoNaPasta,
  solicitarUpload,
} from "@/app/admin/clientes/[orgId]/portal/actions";
import { createClient } from "@/lib/supabase/client";
import { PORTAL_ACCEPT, PORTAL_BUCKET, PORTAL_MAX_BYTES, formatSize, resolveMime } from "@/lib/portal/files";

type Linha = {
  chave: string;
  nome: string;
  estado: "fila" | "enviando" | "ok" | "erro" | "ignorado";
  mensagem?: string;
};

/** Arquivos que o sistema operacional cria sozinho: nunca são "conteúdo" da pasta. */
const LIXO = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

/**
 * Envio em lote para uma pasta: vários arquivos de uma vez, ou a pasta inteira
 * do computador (o navegador entrega todos os arquivos de dentro dela, inclusive
 * os de subpastas — que entram todos na mesma pasta do portal, sem hierarquia).
 *
 * Cada arquivo sobe direto ao Storage e é registrado assim que termina, um de
 * cada vez; se a conexão cair no meio, o que já subiu fica salvo. O título nasce
 * do nome do arquivo e dá para ajustar depois, na lista da pasta.
 */
export default function FolderUploader({ orgId, folderId }: { orgId: string; folderId: string }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const arquivosRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);

  function atualizar(chave: string, mudanca: Partial<Linha>) {
    setLinhas(atuais => atuais.map(linha => (linha.chave === chave ? { ...linha, ...mudanca } : linha)));
  }

  async function enviar(files: File[]) {
    const lista = files.filter(file => !LIXO.has(file.name.toLowerCase()));
    if (lista.length === 0) return;
    if (lista.length > 200) {
      setLinhas([
        { chave: "limite", nome: "Muitos arquivos", estado: "erro", mensagem: "Envie no máximo 200 arquivos por vez." },
      ]);
      return;
    }

    const inicial: Linha[] = lista.map((file, index) => ({
      chave: `${index}-${file.name}`,
      nome: file.name,
      estado: "fila",
    }));
    setLinhas(inicial);
    setOcupado(true);
    const supabase = createClient();

    for (const [index, file] of lista.entries()) {
      const chave = inicial[index].chave;

      if (!resolveMime(file.name, file.type)) {
        atualizar(chave, { estado: "ignorado", mensagem: "tipo de arquivo não aceito" });
        continue;
      }
      if (file.size > PORTAL_MAX_BYTES) {
        atualizar(chave, { estado: "erro", mensagem: "acima de 2 GB" });
        continue;
      }

      atualizar(chave, { estado: "enviando" });
      try {
        const ticket = await solicitarUpload({
          orgId,
          kind: "material",
          filename: file.name,
          size: file.size,
          type: file.type,
        });
        if ("error" in ticket) {
          atualizar(chave, { estado: "erro", mensagem: ticket.error });
          continue;
        }
        const { error } = await supabase.storage
          .from(PORTAL_BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.mime });
        if (error) {
          console.error("[portal] upload em lote: %s", error.message);
          atualizar(chave, {
            estado: "erro",
            mensagem: "o envio falhou (confira o tamanho — o limite do projeto no Supabase também vale)",
          });
          continue;
        }
        const registro = await registrarArquivoNaPasta({
          orgId,
          folderId,
          path: ticket.path,
          filename: file.name,
        });
        if ("error" in registro) atualizar(chave, { estado: "erro", mensagem: registro.error });
        else atualizar(chave, { estado: "ok", mensagem: formatSize(file.size) });
      } catch (error) {
        console.error("[portal] upload em lote", error);
        atualizar(chave, { estado: "erro", mensagem: "o envio falhou" });
      }
    }

    setOcupado(false);
    if (arquivosRef.current) arquivosRef.current.value = "";
    if (pastaRef.current) pastaRef.current.value = "";
    router.refresh();
  }

  const concluidos = linhas.filter(linha => linha.estado === "ok").length;
  const falhas = linhas.filter(linha => linha.estado === "erro" || linha.estado === "ignorado").length;

  return (
    <div className="portal-upload">
      <div className="portal-bulk-pick">
        <label className="portal-bulk-button">
          Escolher arquivos
          <input
            ref={arquivosRef}
            type="file"
            multiple
            accept={PORTAL_ACCEPT}
            disabled={ocupado}
            onChange={event => void enviar(Array.from(event.target.files ?? []))}
          />
        </label>
        <label className="portal-bulk-button">
          Escolher pasta do computador
          <input
            ref={pastaRef}
            type="file"
            disabled={ocupado}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={event => void enviar(Array.from(event.target.files ?? []))}
          />
        </label>
      </div>
      <p className="portal-upload-status">
        Aceita PDF, Word, Excel, PowerPoint, imagens, áudio e vídeo. Os arquivos sobem um por vez e
        entram na pasta assim que terminam — não feche a página enquanto envia.
      </p>

      {linhas.length > 0 ? (
        <>
          <p className="portal-upload-status" role="status">
            {ocupado ? "Enviando… " : "Concluído. "}
            <strong>{concluidos}</strong> de {linhas.length} enviado{concluidos === 1 ? "" : "s"}
            {falhas > 0 ? ` · ${falhas} com problema` : ""}.
          </p>
          <ul className="portal-bulk-list">
            {linhas.map(linha => (
              <li key={linha.chave} className={linha.estado}>
                <span>
                  {linha.estado === "ok" ? "✓" : linha.estado === "enviando" ? "…" : linha.estado === "fila" ? "·" : "!"}
                </span>
                <strong>{linha.nome}</strong>
                {linha.mensagem ? <small>{linha.mensagem}</small> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
