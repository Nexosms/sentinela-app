import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Planos de ação" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Planos de ação"
      eyebrow="PREVENÇÃO E CONTROLE"
      copy="Medidas corretivas e preventivas, responsáveis, prazos e verificação de eficácia."
      phase="EM CONSTRUÇÃO · FASE 5"
    />
  );
}
