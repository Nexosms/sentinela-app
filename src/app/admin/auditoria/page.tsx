import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Auditoria" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Auditoria"
      eyebrow="TRILHA IMUTÁVEL"
      copy="Registro de acessos, visualizações, alterações e exportações, com verificação da cadeia de hash."
      phase="EM CONSTRUÇÃO · FASE 7"
    />
  );
}
