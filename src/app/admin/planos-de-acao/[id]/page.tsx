import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import PlanDetail from "@/components/admin/planos/PlanDetail";
import PlanShell from "@/components/admin/planos/PlanShell";
import { UUID, parsePlanFilters, type SearchParams } from "@/lib/admin/planos";

export const metadata: Metadata = { title: "Planos de ação" };

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
  const filters = parsePlanFilters(resolved);

  return (
    <>
      <AdminTopbar eyebrow="PREVENÇÃO E CONTROLE" title="Planos de ação" />
      <PlanShell
        filters={filters}
        selectedId={id}
        detail={<PlanDetail id={id} filters={filters} />}
      />
    </>
  );
}
