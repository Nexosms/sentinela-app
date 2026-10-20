import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import MeetingShell from "@/components/portal/MeetingShell";

export const metadata: Metadata = { title: "Minhas Reuniões" };

export default function Page() {
  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Minhas Reuniões" />
      <MeetingShell
        detail={
          <section className="case-detail">
            <div className="placeholder">
              <span>◷</span>
              <small>REUNIÕES</small>
              <h2>Selecione uma reunião</h2>
              <p>
                Escolha uma reunião na lista para ver o resumo, as ações combinadas, a gravação e os
                arquivos compartilhados pela equipe Nexo.
              </p>
            </div>
          </section>
        }
      />
    </>
  );
}
