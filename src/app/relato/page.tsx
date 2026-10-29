import type { Metadata } from "next";

import RelatoSemEmpresa from "@/components/report/RelatoSemEmpresa";

export const metadata: Metadata = {
  title: "Fazer um relato",
  description: "Use o link enviado pela sua empresa para fazer um relato com segurança e confidencialidade.",
};

/** Sem empresa no endereço não há formulário: cada empresa-cliente usa `/relato/<slug>`
 *  (o demo da Nexo é `/relato/sentinela`). A tela lembra a empresa da aba ou pede o link. */
export default function Page() {
  return <RelatoSemEmpresa />;
}
