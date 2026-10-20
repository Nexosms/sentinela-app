import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import {
  ArquivoEditor,
  NovoArquivoForm,
  PastaForm,
  ReuniaoForm,
} from "@/components/admin/portal/PortalForms";
import { EmptyNote, FileCard } from "@/components/portal/parts";
import { formatDateTime, todayInSaoPaulo } from "@/lib/admin/labels";
import { isNexoAdmin } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  FOLDER_CATEGORY,
  MATERIAL_CATEGORIES,
  categoryLabel,
  meetingStatusClass,
  meetingStatusLabel,
  monthRefLabel,
  parseMaterialFilters,
  portalAdminFolderPath,
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
    .eq("kind", "material")
    .is("folder_id", null);
  if (filters.categoria) materialQuery = materialQuery.eq("category", filters.categoria);
  const { data: materials } =
    aba === "materiais"
      ? await materialQuery
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
      : { data: null };

  // Pastas (campanhas mensais do CDN Conecta) e quantos arquivos cada uma tem.
  const mostraPastas = aba === "materiais" && (filters.categoria === "" || filters.categoria === FOLDER_CATEGORY);
  const { data: folders } = mostraPastas
    ? await supabase
        .from("portal_folders")
        .select("id, name, reference_month, is_published")
        .eq("org_id", orgId)
        .eq("category", FOLDER_CATEGORY)
        .order("reference_month", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: null };
  const { data: folderFiles } = mostraPastas
    ? await supabase.from("portal_files").select("folder_id").eq("org_id", orgId).not("folder_id", "is", null)
    : { data: null };
  const folderCount = new Map<string, number>();
  for (const row of folderFiles ?? []) {
    if (row.folder_id) folderCount.set(row.folder_id, (folderCount.get(row.folder_id) ?? 0) + 1);
  }
  const [anoHoje, mesHoje] = todayInSaoPaulo().split("-");

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

            {mostraPastas ? (
              <>
                <div className="list-head">
                  <span>Pastas · CDN Conecta</span>
                  <small>Uma por campanha mensal</small>
                </div>
                {(folders ?? []).length === 0 ? (
                  <EmptyNote
                    icon="▣"
                    title="Nenhuma pasta criada"
                    text="Crie a primeira abaixo (ex.: a campanha do mês) e envie os arquivos dentro dela."
                  />
                ) : (
                  <div className="portal-list">
                    {(folders ?? []).map(folder => (
                      <Link
                        key={folder.id}
                        className="portal-meeting-row"
                        href={portalAdminFolderPath(orgId, folder.id)}
                      >
                        <div>
                          <strong>▣ {folder.name}</strong>
                          <small>
                            {monthRefLabel(folder.reference_month)} · {folderCount.get(folder.id) ?? 0} arquivo
                            {(folderCount.get(folder.id) ?? 0) === 1 ? "" : "s"}
                          </small>
                        </div>
                        <span className={folder.is_published ? "risk baixo" : "risk moderado"}>
                          {folder.is_published ? "Visível" : "Rascunho"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                <PastaForm orgId={orgId} defaultMonth={String(Number(mesHoje))} defaultYear={anoHoje} />
                <div className="list-head">
                  <span>Materiais soltos</span>
                  <small>Arquivos fora de pasta</small>
                </div>
              </>
            ) : null}

            {(materials ?? []).length === 0 ? (
              <EmptyNote
                icon="▣"
                title="Nenhum material solto nesta categoria"
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
