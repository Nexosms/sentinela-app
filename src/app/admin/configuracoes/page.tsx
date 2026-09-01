import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Configurações"
      eyebrow="ORGANIZAÇÃO"
      copy="Dados da organização, unidades, taxonomia de categorias e gestão da equipe por convite."
      phase="EM CONSTRUÇÃO · FASE 7"
    />
  );
}
