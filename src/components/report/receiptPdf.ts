import type { Receipt } from "./wizardState";

type Rgb = [number, number, number];

const RED: Rgb = [216, 31, 24];
const INK: Rgb = [28, 25, 23];
const GRAY: Rgb = [120, 113, 108];
const MID: Rgb = [87, 83, 78];

/**
 * Comprovante em PDF. É o que a pessoa guarda ou imprime, então segue a identidade da tela
 * (faixa, logo, cartões de protocolo e chave) em vez de texto solto. Só fontes padrão do jsPDF
 * (Helvetica/Courier): o glifo "—" não existe nelas e some do PDF, por isso hífen simples.
 * O PDF não carrega nada do conteúdo do relato.
 */
export async function downloadReceiptPdf(receipt: Receipt, origin: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const CW = W - M * 2;
  const host = origin.replace(/^https?:\/\//, "");
  const trackUrl = `${origin}/acompanhar`;

  const rr = (x: number, y: number, w: number, h: number, r: number, style: string) =>
    doc.roundedRect(x, y, w, h, r, r, style);
  const fill = (c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);

  // faixa superior
  fill([252, 246, 241]);
  doc.rect(0, 0, W, 112, "F");
  fill(RED);
  doc.rect(0, 0, W, 5, "F");

  // logo: quadrado vermelho com fone de ouvido
  const lx = M;
  const ly = 30;
  const ls = 44;
  fill(RED);
  rr(lx, ly, ls, ls, 11, "F");
  stroke([255, 255, 255]);
  doc.setLineWidth(2.6);
  doc.setLineCap("round");
  doc.lines([[0, -15, 21, -15, 21, 0]], lx + 11.5, ly + 24, [1, 1], "S");
  fill([255, 255, 255]);
  rr(lx + 8.5, ly + 21, 5.5, 11, 2.4, "F");
  rr(lx + 30, ly + 21, 5.5, 11, 2.4, "F");

  color(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SENTINELA", lx + ls + 14, ly + 17);
  doc.setFont("courier", "normal");
  doc.setFontSize(6.6);
  color(GRAY);
  doc.text("PREVENÇÃO E GESTÃO DE RISCOS ORGANIZACIONAIS", lx + ls + 14, ly + 29);
  color(RED);
  doc.setFont("courier", "bold");
  doc.text("CANAL DE DENÚNCIAS", lx + ls + 14, ly + 39);

  const emitido = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  color(MID);
  doc.text("COMPROVANTE", W - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  color(GRAY);
  doc.text(`Emitido em ${emitido}`, W - M, 56, { align: "right" });

  // título
  let y = 150;
  color(RED);
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.text("RECEBEMOS O SEU RELATO", M, y);
  y += 26;
  color(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.text("Comprovante de acompanhamento", M, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  color(MID);
  doc.text("Guarde estes dados com cuidado. Com eles você acompanha o seu relato.", M, y);

  // cartões de credencial
  function credencial(label: string, value: string, top: number, destaque: boolean, etiqueta?: string) {
    const h = 74;
    fill(destaque ? [255, 243, 239] : [252, 250, 247]);
    stroke(destaque ? [226, 120, 110] : [221, 214, 207]);
    doc.setLineWidth(1.1);
    rr(M, top, CW, h, 12, "FD");
    color(GRAY);
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.text(label, M + 22, top + 24);
    if (etiqueta) {
      const tw = doc.getTextWidth(label) + 12;
      fill([253, 240, 213]);
      rr(M + 22 + tw, top + 14, 108, 14, 7, "F");
      color([146, 64, 14]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(etiqueta, M + 22 + tw + 54, top + 24, { align: "center" });
    }
    color(INK);
    doc.setFont("courier", "bold");
    doc.setFontSize(23);
    doc.text(value, M + 22, top + 55);
    return top + h;
  }
  y += 30;
  y = credencial("PROTOCOLO", receipt.protocol, y, false);
  y = credencial("CHAVE DE ACOMPANHAMENTO", receipt.secret, y + 14, true, "mostrada uma única vez");

  // status e link
  y += 26;
  const colW = CW / 2;
  color(GRAY);
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.text("STATUS INICIAL", M, y);
  doc.text("ACOMPANHAMENTO", M + colW, y);
  y += 18;
  fill([227, 245, 234]);
  rr(M, y - 12, 92, 19, 9.5, "F");
  color([21, 128, 61]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Relato recebido", M + 46, y + 1, { align: "center" });
  color(RED);
  doc.setFontSize(10.5);
  doc.textWithLink(`${host}/acompanhar`, M + colW, y + 1, { url: trackUrl });

  // como acompanhar
  y += 44;
  stroke([232, 226, 219]);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 28;
  color(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Como acompanhar o seu relato", M, y);
  const passos: [string, string, string][] = [
    ["1", "Acesse a página de acompanhamento", `Abra ${host}/acompanhar no celular ou no computador.`],
    ["2", "Informe o protocolo e a chave", "Digite os dois códigos acima, exatamente como estão neste comprovante."],
    ["3", "Veja o andamento", "Consulte a situação do relato e as mensagens da equipe responsável."],
  ];
  y += 14;
  for (const [n, titulo, texto] of passos) {
    fill([255, 233, 227]);
    doc.circle(M + 12, y + 14, 12, "F");
    color(RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(n, M + 12, y + 18, { align: "center" });
    color(INK);
    doc.text(titulo, M + 36, y + 11);
    color(MID);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(texto, CW - 36), M + 36, y + 26);
    y += 46;
  }

  // aviso
  y += 6;
  fill([255, 250, 240]);
  stroke([226, 190, 140]);
  doc.setLineWidth(1);
  rr(M, y, CW, 66, 12, "FD");
  color([146, 64, 14]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Proteja seu acesso", M + 20, y + 23);
  color(MID);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);
  doc.text(
    doc.splitTextToSize(
      "Não compartilhe estes dados. A chave de acompanhamento não é enviada por e-mail e não pode ser recuperada: se for perdida, não será possível reaver o acesso.",
      CW - 40,
    ),
    M + 20,
    y + 39,
  );

  // rodapé
  stroke([232, 226, 219]);
  doc.line(M, 780, W - M, 780);
  color(GRAY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.8);
  doc.text("Este comprovante não contém o conteúdo sensível do relato. Guarde-o em local seguro.", M, 798);
  doc.setFont("courier", "bold");
  doc.setFontSize(7.5);
  doc.text("SENTINELA · CANAL DE DENÚNCIAS", W - M, 798, { align: "right" });

  doc.save(`protocolo-sentinela-${receipt.protocol}.pdf`);
}
