import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import InboxShell from "@/components/admin/inbox/InboxShell";
import { parseFilters, type SearchParams } from "@/lib/admin/inbox";

export const metadata: Metadata = { title: "Denúncias" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <AdminTopbar eyebrow="CAIXA DE ENTRADA" title="Denúncias" />
      <InboxShell
        filters={filters}
        detail={
          <section className="case-detail">
            <div className="placeholder">
              <span>◇</span>
              <small>CAIXA DE ENTRADA</small>
              <h2>Selecione um caso</h2>
              <p>
                Escolha um relato na lista à esquerda para ver o relato original, a linha do tempo,
                as evidências e as mensagens trocadas.
              </p>
            </div>
          </section>
        }
      />
    </>
  );
}
