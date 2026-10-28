/** "Bom dia / Boa tarde / Boa noite" pela hora de Brasília, não pela do servidor. */
export function saudacao(agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(
      agora,
    ),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
