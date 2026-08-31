import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Relatórios"
      eyebrow="INDICADORES"
      copy="Panorama do canal, tempos e SLA, desfechos, retaliação e inventário de riscos psicossociais para a CIPA."
      phase="EM CONSTRUÇÃO · FASE 6"
    />
  );
}
