import Link from "next/link";
import { notFound } from "next/navigation";

import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/admin/labels";
import {
  ACTION_STATUS,
  ACTION_STATUS_LABEL,
  MEETINGS_PATH,
  MEETING_TABS,
  meetingStatusClass,
  meetingStatusLabel,
  meetingTabHref,
  type MeetingTab,
} from "@/lib/portal/portal";
import { ActionItem, EmptyNote, FileCard, Recording } from "./parts";

/**
 * Detalhe de uma reunião para o cliente: resumo, ações, gravação e arquivos.
 * Só leitura. A reunião precisa ser da empresa ativa E estar publicada; ações,
 * gravação e arquivos herdam isso (a RLS esconde os filhos de um rascunho, e o
 * filtro de organização abaixo é a segunda trava).
 */
export default async function MeetingDetail({ id, aba }: { id: string; aba: MeetingTab }) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("portal_meetings")
    .select("id, title, meeting_at, participants, status, summary")
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
  const counts: Record<MeetingTab, number> = {
    resumo: 0,
    acoes: acoes.length,
    gravacao: gravacoes.length,
    arquivos: arquivos.length,
  };

  return (
    <section className="case-detail">
      <div className="detail-head">
        <div>
          <h2>{meeting.title}</h2>
          <span>{formatDateTime(meeting.meeting_at)}</span>
          {meeting.participants.length > 0 ? (
            <ul className="portal-chips" aria-label="Participantes">
              {meeting.participants.map(name => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <span className={meetingStatusClass(meeting.status)}>{meetingStatusLabel(meeting.status)}</span>
      </div>

      <div className="detail-tabs">
        {MEETING_TABS.map(tab => (
          <Link key={tab.key} href={meetingTabHref(base, tab.key)} className={aba === tab.key ? "active" : ""}>
            {tab.label}
            {counts[tab.key] > 0 ? <b>{counts[tab.key]}</b> : null}
          </Link>
        ))}
      </div>

      {aba === "resumo" ? (
        meeting.summary?.trim() ? (
          <article className="portal-prose">
            <small>RESUMO DA REUNIÃO</small>
            <p>{meeting.summary}</p>
          </article>
        ) : (
          <EmptyNote icon="◷" title="Resumo ainda não publicado" text="A equipe Nexo ainda não registrou o resumo desta reunião." />
        )
      ) : null}

      {aba === "acoes" ? (
        acoes.length === 0 ? (
          <EmptyNote icon="✓" title="Nenhuma ação registrada" text="Esta reunião não teve encaminhamentos registrados." />
        ) : (
          <>
            <p className="portal-summary-line">
              {ACTION_STATUS.map(status => {
                const total = acoes.filter(item => item.status === status).length;
                return (
                  <span key={status}>
                    <b>{total}</b> {ACTION_STATUS_LABEL[status].toLowerCase()}
                  </span>
                );
              })}
            </p>
            <div className="portal-list">
              {acoes.map(item => (
                <ActionItem key={item.id} item={item} />
              ))}
            </div>
          </>
        )
      ) : null}

      {aba === "gravacao" ? (
        gravacoes.length === 0 ? (
          <EmptyNote icon="▶" title="Sem gravação" text="Nenhuma gravação foi anexada a esta reunião." />
        ) : (
          <div className="portal-list">
            {gravacoes.map(file => (
              <Recording key={file.id} file={file} />
            ))}
          </div>
        )
      ) : null}

      {aba === "arquivos" ? (
        arquivos.length === 0 ? (
          <EmptyNote icon="▧" title="Sem arquivos" text="Nenhum documento foi anexado a esta reunião." />
        ) : (
          <div className="portal-list">
            {arquivos.map(file => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
