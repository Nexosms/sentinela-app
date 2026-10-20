import type { ReactNode } from "react";
import Link from "next/link";

import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/admin/labels";
import { MEETINGS_PATH, meetingStatusClass, meetingStatusLabel } from "@/lib/portal/portal";

/**
 * Casca de "Minhas Reuniões": lista à esquerda (da mais recente para a mais
 * antiga), o que a rota mandar à direita. Mesmo vocabulário de CSS de
 * Investigações (`.inbox-layout`, `.case-list`).
 *
 * Duas travas, e as duas são deste arquivo, não da RLS:
 *  - `.eq("org_id", staff.orgId)`: `app.current_org_ids()` autoriza por TODO
 *    vínculo ativo, e a equipe Nexo está em toda empresa — sem o filtro, a lista
 *    misturaria clientes;
 *  - `.eq("is_published", true)`: rascunho nunca aparece aqui, nem para a Nexo
 *    (a Nexo vê e edita rascunhos em /admin/clientes/<empresa>/portal).
 */
export default async function MeetingShell({
  selectedId,
  detail,
}: {
  selectedId?: string;
  detail: ReactNode;
}) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("portal_meetings")
    .select("id, title, meeting_at, status, participants")
    .eq("org_id", staff.orgId)
    .eq("is_published", true)
    .order("meeting_at", { ascending: false })
    .limit(200);

  const list = meetings ?? [];

  return (
    <div className="inbox">
      <div className="inbox-layout portal-layout">
        <section className="case-list">
          <div className="list-head">
            <span>
              {list.length} reunião{list.length === 1 ? "" : "ões"}
            </span>
            <small>Mais recentes primeiro</small>
          </div>
          {list.map(meeting => (
            <Link
              key={meeting.id}
              href={`${MEETINGS_PATH}/${meeting.id}`}
              className={meeting.id === selectedId ? "active" : ""}
            >
              <div className="case-row-top">
                <code>{formatDate(meeting.meeting_at)}</code>
                <span className={meetingStatusClass(meeting.status)}>
                  {meetingStatusLabel(meeting.status)}
                </span>
              </div>
              <strong>{meeting.title}</strong>
              <small>
                {meeting.participants.length > 0
                  ? `${meeting.participants.length} participante${meeting.participants.length === 1 ? "" : "s"}`
                  : "Sem participantes informados"}
              </small>
            </Link>
          ))}
          {list.length === 0 ? (
            <div className="list-head">
              <span>Nenhuma reunião disponível</span>
              <small>A equipe Nexo publica aqui as reuniões realizadas</small>
            </div>
          ) : null}
        </section>

        {detail}
      </div>
    </div>
  );
}
