import Link from "next/link";

import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { sanitizeQuery } from "@/lib/admin/investigacoes";
import {
  MEETINGS_PATH,
  meetingStatusClass,
  meetingStatusLabel,
  monthLabel,
} from "@/lib/portal/portal";
import { shortDate } from "./MeetingHeader";

/**
 * "Minhas Reuniões": as reuniões publicadas da empresa ativa, da mais recente
 * para a mais antiga, agrupadas por mês. Cada uma abre na própria página.
 *
 * Duas travas, as duas deste arquivo e não da RLS:
 *  - `.eq("org_id", staff.orgId)`: `app.current_org_ids()` autoriza por TODO
 *    vínculo ativo, e a equipe Nexo está em toda empresa — sem o filtro, a lista
 *    misturaria clientes;
 *  - `.eq("is_published", true)`: rascunho nunca aparece aqui, nem para a Nexo
 *    (ela vê e edita rascunhos em /admin/clientes/<empresa>/portal).
 */
export default async function MeetingList({ q }: { q: string }) {
  const staff = await getStaffContext();
  const supabase = await createClient();
  const termo = sanitizeQuery(q);

  let query = supabase
    .from("portal_meetings")
    .select("id, title, meeting_at, status, participants")
    .eq("org_id", staff.orgId)
    .eq("is_published", true);
  if (termo) query = query.ilike("title", `%${termo}%`);
  const { data } = await query.order("meeting_at", { ascending: false }).limit(300);
  const meetings = data ?? [];

  // O array já vem em ordem decrescente; agrupar mantém a ordem dentro de cada mês.
  const groups: { label: string; items: typeof meetings }[] = [];
  for (const meeting of meetings) {
    const label = monthLabel(meeting.meeting_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(meeting);
    else groups.push({ label, items: [meeting] });
  }

  return (
    <section className="portal-page">
      <form className="inbox-tools" method="get">
        <div className="searchbox">
          ⌕{" "}
          <input
            name="q"
            type="search"
            defaultValue={termo}
            placeholder="Buscar reunião pelo título"
            aria-label="Buscar reunião"
          />
        </div>
        <button type="submit">Buscar</button>
        {termo ? (
          <Link className="portal-clear" href={MEETINGS_PATH}>
            Limpar busca
          </Link>
        ) : null}
      </form>

      {meetings.length === 0 ? (
        <div className="portal-panel">
          <p className="portal-empty">
            {termo
              ? "Nenhuma reunião encontrada para esta busca."
              : "Nenhuma reunião disponível ainda. A equipe Nexo publica aqui as reuniões realizadas."}
          </p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.label} className="portal-group">
            <h2 className="portal-month">{group.label}</h2>
            <div className="portal-list">
              {group.items.map(meeting => {
                const date = shortDate(meeting.meeting_at);
                return (
                  <Link key={meeting.id} className="portal-meeting-card" href={`${MEETINGS_PATH}/${meeting.id}`}>
                    <span className="portal-date" aria-hidden="true">
                      <b>{date.day}</b>
                      <small>{date.month}</small>
                    </span>
                    <div className="portal-meeting-card-body">
                      <strong>{meeting.title}</strong>
                      <small>
                        {meeting.participants.length > 0
                          ? meeting.participants.join(", ")
                          : "Sem participantes informados"}
                      </small>
                    </div>
                    <span className={meetingStatusClass(meeting.status)}>
                      {meetingStatusLabel(meeting.status)}
                    </span>
                    <span className="portal-chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
