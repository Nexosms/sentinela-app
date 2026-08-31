import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Denúncias" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Denúncias"
      eyebrow="CAIXA DE ENTRADA"
      copy="Triagem, atribuição, mensagens com o denunciante e download de evidências."
      phase="EM CONSTRUÇÃO · FASE 4"
    />
  );
}
