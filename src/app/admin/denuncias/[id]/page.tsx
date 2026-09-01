import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import CaseDetail from "@/components/admin/inbox/CaseDetail";
import InboxShell from "@/components/admin/inbox/InboxShell";
import { parseFilters, type SearchParams } from "@/lib/admin/inbox";

export const metadata: Metadata = { title: "Denúncias" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, resolved] = await Promise.all([params, searchParams]);
  // Id malformado nunca chega ao Postgres: 22P02 viraria erro 500 em vez de 404.
  if (!UUID.test(id)) notFound();
  const filters = parseFilters(resolved);

  return (
    <>
      <AdminTopbar eyebrow="CAIXA DE ENTRADA" title="Denúncias" />
      <InboxShell
        filters={filters}
        selectedId={id}
        detail={<CaseDetail id={id} filters={filters} />}
      />
    </>
  );
}
