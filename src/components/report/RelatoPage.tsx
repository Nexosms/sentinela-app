import { notFound } from "next/navigation";

import ReportWizard from "@/components/report/ReportWizard";
import { loadReportCatalog } from "@/lib/report/catalog";

/**
 * `/relato/[orgSlug]`: link de cada empresa-cliente. O slug é sempre explícito;
 * não existe empresa padrão, para ninguém registrar um relato na empresa errada
 * sem perceber. Slug inexistente ou organização inativa vira 404.
 */
export default async function RelatoPage({ orgSlug }: { orgSlug: string }) {
  const catalog = await loadReportCatalog(orgSlug);
  if (!catalog) notFound();

  return (
    <ReportWizard
      orgSlug={catalog.orgSlug}
      orgName={catalog.orgName}
      companyName={catalog.companyName}
      orgCnpjFormatted={catalog.orgCnpjFormatted}
      categories={catalog.categories}
    />
  );
}
