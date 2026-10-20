import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import {
  AcaoForm,
  ArquivoEditor,
  ExcluirForm,
  NovoArquivoForm,
  ReuniaoForm,
  TranscricaoForm,
} from "@/components/admin/portal/PortalForms";
import { MeetingHeader, MeetingTabs } from "@/components/portal/MeetingHeader";
import { ActionItem, EmptyNote, FileCard, Recording } from "@/components/portal/parts";
import { isNexoAdmin } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  asFileKind,
  parseMeetingTab,
  portalAdminMeetingPath,
  portalAdminPath,
} from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Reunião do portal" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FILE_COLUMNS =
  "id, title, description, mime_type, size_bytes, published_at, filename, kind, category, is_published";

/** Uma reunião da empresa, editável: resumo, ações, gravação e arquivos. Só a equipe Nexo. */
export default async function PortalAdminMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId, id } = await params;
  const sp = await searchParams;

  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Reunião" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Reunião</h2>
        </div>
      </>
    );
  }
  if (!UUID.test(orgId) || !UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("portal_meetings")
    .select(
      "id, title, meeting_at, participants, status, summary, transcript, is_published, organizations(trade_name)",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!meeting) notFound();

  const aba = parseMeetingTab(sp.aba);
  const base = portalAdminMeetingPath(orgId, id);

  const { data: actions } =
    aba === "acoes"
      ? await supabase
          .from("portal_meeting_actions")
          .select("id, description, owner_name, due_on, status")
          .eq("meeting_id", id)
          .eq("org_id", orgId)
          .order("created_at", { ascending: true })
      : { data: null };

  const kind = aba === "gravacao" ? "recording" : "meeting_file";
  const { data: files } =
    aba === "gravacao" || aba === "arquivos"
      ? await supabase
          .from("portal_files")
          .select(FILE_COLUMNS)
          .eq("meeting_id", id)
          .eq("org_id", orgId)
          .eq("kind", kind)
          .order("created_at", { ascending: true })
      : { data: null };

  const empresa = meeting.organizations?.trade_name ?? "empresa";

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title={`Portal · ${empresa}`} />
      <section className="portal-page">
        <MeetingHeader
          backHref={portalAdminPath(orgId)}
          backLabel={`Voltar para as reuniões de ${empresa}`}
          title={meeting.title}
          status={meeting.status}
          meetingAt={meeting.meeting_at}
          participants={meeting.participants}
          extra={
            <span className={meeting.is_published ? "risk baixo" : "risk moderado"}>
              {meeting.is_published ? "Visível ao cliente" : "Rascunho"}
            </span>
          }
        />

        <MeetingTabs base={base} active={aba} />

        {aba === "resumo" ? (
          <>
            <ReuniaoForm
              orgId={orgId}
              meeting={{
                id: meeting.id,
                title: meeting.title,
                meetingAt: meeting.meeting_at,
                participants: meeting.participants,
                status: meeting.status,
                summary: meeting.summary,
                isPublished: meeting.is_published,
              }}
            />
            <div className="portal-danger-zone">
              <small>Excluir apaga também as ações, a gravação e os arquivos desta reunião.</small>
              <ExcluirForm orgId={orgId} id={meeting.id} tipo="reuniao" />
            </div>
          </>
        ) : null}

        {aba === "acoes" ? (
          <>
            {(actions ?? []).length === 0 ? (
              <EmptyNote icon="✓" title="Nenhuma ação registrada" text="Registre abaixo os encaminhamentos definidos na reunião." />
            ) : (
              <div className="portal-list">
                {(actions ?? []).map(item => (
                  <ActionItem key={item.id} item={item}>
                    <details className="portal-edit">
                      <summary>Editar ou excluir</summary>
                      <AcaoForm
                        orgId={orgId}
                        meetingId={id}
                        item={{
                          id: item.id,
                          description: item.description,
                          ownerName: item.owner_name,
                          dueOn: item.due_on,
                          status: item.status,
                        }}
                      />
                      <ExcluirForm orgId={orgId} id={item.id} tipo="acao" />
                    </details>
                  </ActionItem>
                ))}
              </div>
            )}
            <div className="message-box">
              <div className="message-head">
                <span>✓</span>
                <div>
                  <strong>Nova ação</strong>
                  <small>Descrição, responsável, prazo e status.</small>
                </div>
              </div>
              <AcaoForm orgId={orgId} meetingId={id} />
            </div>
          </>
        ) : null}

        {aba === "transcricao" ? (
          <TranscricaoForm orgId={orgId} meetingId={id} transcript={meeting.transcript} />
        ) : null}

        {aba === "gravacao" || aba === "arquivos" ? (
          <>
            {(files ?? []).length === 0 ? (
              <EmptyNote
                icon={aba === "gravacao" ? "▶" : "▧"}
                title={aba === "gravacao" ? "Nenhuma gravação anexada" : "Nenhum arquivo anexado"}
                text="Use o formulário abaixo para enviar."
              />
            ) : (
              <div className="portal-list">
                {(files ?? []).map(file => {
                  const editor = (
                    <details className="portal-edit">
                      <summary>Editar, substituir ou excluir</summary>
                      <ArquivoEditor
                        orgId={orgId}
                        file={{
                          id: file.id,
                          kind: asFileKind(file.kind),
                          category: file.category,
                          title: file.title,
                          description: file.description,
                          publishedAt: file.published_at,
                          filename: file.filename,
                          mimeType: file.mime_type,
                          sizeBytes: file.size_bytes,
                          isPublished: file.is_published,
                        }}
                      />
                    </details>
                  );
                  return aba === "gravacao" ? (
                    <Recording key={file.id} file={file}>
                      {editor}
                    </Recording>
                  ) : (
                    <FileCard key={file.id} file={file}>
                      {editor}
                    </FileCard>
                  );
                })}
              </div>
            )}
            <NovoArquivoForm
              orgId={orgId}
              kind={kind}
              meetingId={id}
              titulo={aba === "gravacao" ? "Nova gravação" : "Novo arquivo da reunião"}
              dica={
                aba === "gravacao"
                  ? "Vídeo ou áudio da reunião. Toca direto no portal quando o formato é compatível (MP4 e WebM são os mais seguros)."
                  : "Atas, apresentações, planilhas e outros materiais ligados a esta reunião."
              }
            />
          </>
        ) : null}
      </section>
    </>
  );
}
