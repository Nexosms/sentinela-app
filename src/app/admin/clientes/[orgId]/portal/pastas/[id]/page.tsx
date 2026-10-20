import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import FolderUploader from "@/components/admin/portal/FolderUploader";
import { ArquivoEditor, ExcluirForm, PastaForm } from "@/components/admin/portal/PortalForms";
import { EmptyNote, FileCard } from "@/components/portal/parts";
import { todayInSaoPaulo } from "@/lib/admin/labels";
import { isNexoAdmin } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel, monthRefLabel, portalAdminPath } from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Pasta do portal" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uma pasta de materiais (campanha mensal) da empresa: dados, arquivos e envio em lote. Só a equipe Nexo. */
export default async function PortalAdminFolderPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;

  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Pasta" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Pasta</h2>
        </div>
      </>
    );
  }
  if (!UUID.test(orgId) || !UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("portal_folders")
    .select("id, name, category, reference_month, description, is_published, organizations(trade_name)")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!folder) notFound();

  const { data: files } = await supabase
    .from("portal_files")
    .select("id, title, description, mime_type, size_bytes, published_at, filename, kind, category, is_published")
    .eq("folder_id", id)
    .eq("org_id", orgId)
    .order("title", { ascending: true });

  const empresa = folder.organizations?.trade_name ?? "empresa";
  const [anoHoje, mesHoje] = todayInSaoPaulo().split("-");
  const voltar = `${portalAdminPath(orgId)}?aba=materiais&categoria=${folder.category}`;

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title={`Portal · ${empresa}`} />
      <section className="portal-page">
        <header className="portal-hero">
          <Link className="portal-back" href={voltar}>
            <span aria-hidden="true">←</span> Voltar para {categoryLabel(folder.category)}
          </Link>
          <div className="portal-hero-card">
            <div className="portal-hero-title">
              <h1>{folder.name}</h1>
              <span className={folder.is_published ? "risk baixo" : "risk moderado"}>
                {folder.is_published ? "Visível ao cliente" : "Rascunho"}
              </span>
            </div>
            <p className="portal-hero-meta">
              <span>
                <i aria-hidden="true">▦</i> {monthRefLabel(folder.reference_month)}
              </span>
              <span className="portal-sep" aria-hidden="true" />
              <span>
                {(files ?? []).length} arquivo{(files ?? []).length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </header>

        <div className="message-box">
          <div className="message-head">
            <span>⤒</span>
            <div>
              <strong>Enviar arquivos para a pasta</strong>
              <small>Vários arquivos de uma vez, ou a pasta inteira do computador.</small>
            </div>
          </div>
          <FolderUploader orgId={orgId} folderId={id} />
        </div>

        <div className="list-head">
          <span>Arquivos da pasta</span>
          <small>Em ordem alfabética</small>
        </div>
        {(files ?? []).length === 0 ? (
          <EmptyNote icon="▣" title="Pasta vazia" text="Envie os arquivos da campanha acima." />
        ) : (
          <div className="portal-list">
            {(files ?? []).map(file => (
              <FileCard key={file.id} file={file}>
                <details className="portal-edit">
                  <summary>Editar, substituir ou excluir</summary>
                  <ArquivoEditor
                    orgId={orgId}
                    file={{
                      id: file.id,
                      kind: "material",
                      category: file.category,
                      title: file.title,
                      description: file.description,
                      publishedAt: file.published_at,
                      filename: file.filename,
                      mimeType: file.mime_type,
                      sizeBytes: file.size_bytes,
                      isPublished: file.is_published,
                      inFolder: true,
                    }}
                  />
                </details>
              </FileCard>
            ))}
          </div>
        )}

        <PastaForm
          orgId={orgId}
          defaultMonth={String(Number(mesHoje))}
          defaultYear={anoHoje}
          folder={{
            id: folder.id,
            name: folder.name,
            referenceMonth: folder.reference_month,
            description: folder.description,
            isPublished: folder.is_published,
          }}
        />
        <div className="portal-danger-zone">
          <small>Excluir apaga a pasta e todos os arquivos dentro dela.</small>
          <ExcluirForm orgId={orgId} id={folder.id} tipo="pasta" />
        </div>
      </section>
    </>
  );
}
