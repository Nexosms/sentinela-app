import type { Metadata } from "next";

import TrackingScreen from "@/components/tracking/TrackingScreen";

export const metadata: Metadata = {
  title: "Acompanhar protocolo",
  description:
    "Consulte com segurança o andamento de um relato usando o protocolo e a chave de acompanhamento entregues no envio.",
  // A tela expõe o conteúdo de um caso: não pode ser indexada nem seguida.
  robots: { index: false, follow: false },
};

/**
 * NÃO EXISTE — e não deve existir — uma rota `/acompanhar/[protocolo]`.
 *
 * Um protocolo em URL vaza em três lugares fora do nosso controle: o histórico
 * do navegador (máquina compartilhada, sincronização de conta), o cabeçalho
 * `Referer` de qualquer link que a pessoa abra a partir daqui, e os logs de
 * acesso do servidor/CDN. O caso é renderizado DENTRO de /acompanhar depois de
 * um POST, como transição de estado — a URL nunca muda. Mesma decisão do
 * comprovante em /relato (ver ReceiptCard).
 */
export default function AcompanharPage() {
  return <TrackingScreen />;
}
