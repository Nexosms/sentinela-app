import { notFound } from "next/navigation";

import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  ACTION_STATUS,
  ACTION_STATUS_LABEL,
  MEETINGS_PATH,
  type MeetingTab,
} from "@/lib/portal/portal";
import { MeetingHeader, MeetingTabs, PortalPanel } from "./MeetingHeader";
import { ActionItem, FileCard, Recording } from "./parts";

/**
 * Página de uma reunião para o cliente: cabeçalho, abas e o painel da aba
 * aberta. Só leitura. A reunião precisa ser da empresa ativa E estar publicada;
 * ações, gravação e arquivos herdam isso (a RLS esconde os filhos de um
 * rascunho, e o filtro de organização abaixo é a segunda trava).
 */
export default async function MeetingDetail({ id, aba }: { id: string; aba: MeetingTab }) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("portal_meetings")
    .select("id, title, meeting_at, participants, status, summary, transcript")
    .eq("id", id)
    .eq("org_id", staff.orgId)
    .eq("is_published", true)
    .maybeSingle();
  if (!meeting) notFound();

  const [{ data: actions }, { data: files }] = await Promise.all([
    supabase
      .from("portal_meeting_actions")
      .select("id, description, owner_name, due_on, status")
      .eq("meeting_id", id)
      .eq("org_id", staff.orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("portal_files")
      .select("id, title, description, mime_type, size_bytes, published_at, filename, kind")
      .eq("meeting_id", id)
      .eq("org_id", staff.orgId)
      .order("created_at", { ascending: true }),
  ]);

  const acoes = actions ?? [];
  const gravacoes = (files ?? []).filter(file => file.kind === "recording");
  const arquivos = (files ?? []).filter(file => file.kind === "meeting_file");
  const base = `${MEETINGS_PATH}/${id}`;

  return (
    <section className="portal-page">
      <MeetingHeader
        backHref={MEETINGS_PATH}
        backLabel="Voltar"
        title={meeting.title}
        status={meeting.status}
        meetingAt={meeting.meeting_at}
        participants={meeting.participants}
      />

      <MeetingTabs
        base={base}
        active={aba}
        counts={{ acoes: acoes.length, gravacao: gravacoes.length, arquivos: arquivos.length }}
      />

      {aba === "resumo" ? (
        meeting.summary?.trim() ? (
          <PortalPanel>
            <p className="portal-text">{meeting.summary}</p>
          </PortalPanel>
        ) : (
          <PortalPanel empty="Resumo ainda não publicado para esta reunião." />
        )
      ) : null}

      {aba === "acoes" ? (
        acoes.length === 0 ? (
          <PortalPanel empty="Nenhuma ação registrada para esta reunião." />
        ) : (
          <PortalPanel>
            <p className="portal-summary-line">
              {ACTION_STATUS.map(status => (
                <span key={status}>
                  <b>{acoes.filter(item => item.status === status).length}</b>{" "}
                  {ACTION_STATUS_LABEL[status].toLowerCase()}
                </span>
              ))}
            </p>
            <div className="portal-list">
              {acoes.map(item => (
                <ActionItem key={item.id} item={item} />
              ))}
            </div>
          </PortalPanel>
        )
      ) : null}

      {aba === "transcricao" ? (
        meeting.transcript?.trim() ? (
          <PortalPanel>
            <p className="portal-text portal-transcript">{meeting.transcript}</p>
          </PortalPanel>
        ) : (
          <PortalPanel empty="Transcrição ainda não disponível para esta reunião." />
        )
      ) : null}

      {aba === "gravacao" ? (
        gravacoes.length === 0 ? (
          <PortalPanel empty="Sem gravação disponível para esta reunião." />
        ) : (
          <PortalPanel>
            <div className="portal-list">
              {gravacoes.map(file => (
                <Recording key={file.id} file={file} />
              ))}
            </div>
          </PortalPanel>
        )
      ) : null}

      {aba === "arquivos" ? (
        arquivos.length === 0 ? (
          <PortalPanel empty="Nenhum arquivo disponível para esta reunião." />
        ) : (
          <PortalPanel>
            <div className="portal-list">
              {arquivos.map(file => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          </PortalPanel>
        )
      ) : null}
    </section>
  );
}
