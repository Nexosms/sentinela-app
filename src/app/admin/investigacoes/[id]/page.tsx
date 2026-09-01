import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import InvestigationDetail from "@/components/admin/investigacoes/InvestigationDetail";
import InvestigationShell from "@/components/admin/investigacoes/InvestigationShell";
import {
  UUID,
  parseInvestigationFilters,
  type SearchParams,
} from "@/lib/admin/investigacoes";

export const metadata: Metadata = { title: "Investigações" };

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
  const filters = parseInvestigationFilters(resolved);

  return (
    <>
      <AdminTopbar eyebrow="APURAÇÃO" title="Investigações" />
      <InvestigationShell
        filters={filters}
        selectedId={id}
        detail={<InvestigationDetail id={id} filters={filters} />}
      />
    </>
  );
}
