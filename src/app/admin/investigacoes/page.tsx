import type { Metadata } from "next";
import ModulePlaceholder from "@/components/admin/ModulePlaceholder";

export const metadata: Metadata = { title: "Investigações" };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Investigações"
      eyebrow="APURAÇÃO"
      copy="Plano de apuração, declaração de impedimento, entrevistas, cadeia de custódia e conclusão com dupla assinatura."
      phase="EM CONSTRUÇÃO · FASE 5"
    />
  );
}
