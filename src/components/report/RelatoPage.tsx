import { notFound } from "next/navigation";

import ReportWizard from "@/components/report/ReportWizard";
import { loadReportCatalog } from "@/lib/report/catalog";

/**
 * Compartilhado por `/relato` (organização padrão, ambiente demo da Nexo) e
 * `/relato/[orgSlug]` (link de cada empresa-cliente) — mesma lógica de
 * carregar o catálogo e decidir 404, só a origem do slug muda.
 */
export default async function RelatoPage({ orgSlug }: { orgSlug?: string }) {
  const catalog = await loadReportCatalog(orgSlug);
  if (!catalog) notFound();

  return (
    <ReportWizard
      orgSlug={catalog.orgSlug}
      orgName={catalog.orgName}
      orgCnpjFormatted={catalog.orgCnpjFormatted}
      categories={catalog.categories}
    />
  );
}
