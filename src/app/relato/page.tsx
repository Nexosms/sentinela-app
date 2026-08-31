import type { Metadata } from "next";

import ReportWizard from "@/components/report/ReportWizard";
import { loadReportCatalog } from "@/lib/report/catalog";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Fazer um relato",
  description:
    "Espaço seguro e confidencial para relatar situações, condutas ou condições relacionadas ao trabalho que precisam ser conhecidas e avaliadas, com respeito, proteção e possibilidade de anonimato.",
};

/** O catálogo (unidades e categorias) muda muito pouco; 5 minutos de cache
 *  evitam uma ida ao banco a cada abertura do formulário. */
export const revalidate = 300;

export default async function RelatoPage() {
  const catalog = await loadReportCatalog(publicEnv.defaultOrgSlug);

  return (
    <ReportWizard
      orgSlug={catalog.orgSlug}
      units={catalog.units}
      categories={catalog.categories}
    />
  );
}
