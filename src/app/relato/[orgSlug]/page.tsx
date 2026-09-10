import type { Metadata } from "next";

import RelatoPage from "@/components/report/RelatoPage";

export const metadata: Metadata = {
  title: "Fazer um relato",
  description:
    "Espaço seguro e confidencial para relatar situações, condutas ou condições relacionadas ao trabalho que precisam ser conhecidas e avaliadas, com respeito, proteção e possibilidade de anonimato.",
};

/** O catálogo (categorias) muda muito pouco; 5 minutos de cache
 *  evitam uma ida ao banco a cada abertura do formulário. */
export const revalidate = 300;

/** Link exclusivo de cada empresa-cliente. Slug inexistente ou organização
 *  inativa vira 404 — ver `notFound()` em `RelatoPage`. */
export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <RelatoPage orgSlug={orgSlug} />;
}
