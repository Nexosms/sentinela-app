import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { ArquivoEditor, NovoArquivoForm, ReuniaoForm } from "@/components/admin/portal/PortalForms";
import { EmptyNote, FileCard } from "@/components/portal/parts";
import { formatDateTime } from "@/lib/admin/labels";
import { isNexoAdmin } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MATERIAL_CATEGORIES,
  categoryLabel,
  meetingStatusClass,
  meetingStatusLabel,
  parseMaterialFilters,
  portalAdminMeetingPath,
  portalAdminPath,
} from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Portal do cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Gestão do portal de UMA empresa-cliente: reuniões (com rascunhos) e
 * materiais. Só a equipe Nexo. A empresa vem da URL — nunca da organização
 * ativa no cookie — e todas as consultas filtram por ela explicitamente.
 */
export default async function PortalAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;

  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Portal do cliente" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Portal do cliente</h2>
        </div>
      </>
    );
  }
  if (!UUID.test(orgId)) notFound();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug, trade_name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  const aba = first(sp.aba) === "materiais" ? "materiais" : "reunioes";
  const base = portalAdminPath(orgId);
  const filters = parseMaterialFilters(sp);

  const { data: meetings } =
    aba === "reunioes"
      ? await supabase
          .from("portal_meetings")
          .select("id, title, meeting_at, status, is_published, participants")
          .eq("org_id", orgId)
          .order("meeting_at", { ascending: false })
      : { data: null };

  let materialQuery = supabase
    .from("portal_files")
    .select(
      "id, title, description, mime_type, size_bytes, published_at, filename, kind, category, is_published",
    )
    .eq("org_id", orgId)
    .eq("kind", "material");
  if (filters.categoria) materialQuery = materialQuery.eq("category", filters.categoria);
  const { data: materials } =
    aba === "materiais"
      ? await materialQuery
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
      : { data: null };

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title={`Portal · ${org.trade_name}`} />
      <section className="portal-page">
        <Link className="quiet-link" href={`/admin/clientes/${orgId}`}>
          ← Voltar para {org.trade_name}
        </Link>

        <div className="privacy-note">
          <b>Tudo aqui pertence a {org.trade_name}</b>
          <p>
            O que for cadastrado nesta tela só aparece no portal dessa empresa, e só depois de marcado
            como visível. Para ver como o cliente enxerga, entre na empresa e abra Minhas Reuniões ou
            Materiais e Documentos.
          </p>
        </div>

        <div className="detail-tabs">
          <Link href={base} className={aba === "reunioes" ? "active" : ""}>
            Reuniões
          </Link>
          <Link href={`${base}?aba=materiais`} className={aba === "materiais" ? "active" : ""}>
            Materiais e documentos
          </Link>
        </div>

        {aba === "reunioes" ? (
          <>
            <div className="list-head">
              <span>
                {(meetings ?? []).length} reunião{(meetings ?? []).length === 1 ? "" : "ões"}
              </span>
              <small>Mais recentes primeiro</small>
            </div>
            {(meetings ?? []).length === 0 ? (
              <EmptyNote
                icon="◷"
                title="Nenhuma reunião cadastrada"
                text="Cadastre a primeira abaixo. Ela só aparece para o cliente depois de marcada como visível."
              />
            ) : (
              <div className="portal-list">
                {(meetings ?? []).map(meeting => (
                  <Link
                    key={meeting.id}
                    className="portal-meeting-row"
                    href={portalAdminMeetingPath(orgId, meeting.id)}
                  >
                    <div>
                      <strong>{meeting.title}</strong>
                      <small>
                        {formatDateTime(meeting.meeting_at)}
                        {meeting.participants.length > 0
                          ? ` · ${meeting.participants.length} participante${meeting.participants.length === 1 ? "" : "s"}`
                          : ""}
                      </small>
                    </div>
                    <span className={meetingStatusClass(meeting.status)}>
                      {meetingStatusLabel(meeting.status)}
                    </span>
                    <span className={meeting.is_published ? "risk baixo" : "risk moderado"}>
                      {meeting.is_published ? "Visível" : "Rascunho"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <ReuniaoForm orgId={orgId} />
          </>
        ) : (
          <>
            <div className="detail-tabs portal-subtabs">
              <Link href={`${base}?aba=materiais`} className={filters.categoria === "" ? "active" : ""}>
                Todas
              </Link>
              {MATERIAL_CATEGORIES.map(category => (
                <Link
                  key={category.key}
                  href={`${base}?aba=materiais&categoria=${category.key}`}
                  className={filters.categoria === category.key ? "active" : ""}
                >
                  {category.short}
                </Link>
              ))}
            </div>

            {(materials ?? []).length === 0 ? (
              <EmptyNote
                icon="▣"
                title="Nenhum material nesta categoria"
                text="Use o formulário abaixo para publicar o primeiro arquivo."
              />
            ) : (
              <div className="portal-list">
                {(materials ?? []).map(material => (
                  <FileCard key={material.id} file={material}>
                    <div className="portal-badges">
                      <span className="risk arquivada">{categoryLabel(material.category ?? "")}</span>
                      <span className={material.is_published ? "risk baixo" : "risk moderado"}>
                        {material.is_published ? "Visível" : "Rascunho"}
                      </span>
                    </div>
                    <details className="portal-edit">
                      <summary>Editar, substituir ou excluir</summary>
                      <ArquivoEditor
                        orgId={orgId}
                        file={{
                          id: material.id,
                          kind: "material",
                          category: material.category,
                          title: material.title,
                          description: material.description,
                          publishedAt: material.published_at,
                          filename: material.filename,
                          mimeType: material.mime_type,
                          sizeBytes: material.size_bytes,
                          isPublished: material.is_published,
                        }}
                      />
                    </details>
                  </FileCard>
                ))}
              </div>
            )}

            <NovoArquivoForm
              orgId={orgId}
              kind="material"
              defaultCategory={filters.categoria}
              titulo="Novo material"
              dica="Escolha o arquivo, preencha título e categoria e publique. Aceita PDF, Word, Excel, PowerPoint, imagens, áudio e vídeo."
            />
          </>
        )}
      </section>
    </>
  );
}
