import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { gerarRelatorioMensal, gravarRascunho, listarEmpresasCliente } from "@/lib/admin/relatorioMensal";
import { MONTHLY_KIND, isMes, limitesDoMes, mesAnteriorAoAtual } from "@/lib/admin/relatorioMensalTipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/relatorio-mensal — dia 1º de cada mês, 07:00 em Brasília (vercel.json).
 *
 * Gera, para cada empresa-cliente ativa, o relatório do MÊS ANTERIOR como
 * RASCUNHO. Nada chega ao cliente daqui: a equipe Nexo confere e libera em
 * /admin/clientes/relatorios. Rodar de novo é inofensivo — quem já tem relatório
 * do mês (rascunho ou publicado) é pulado.
 *
 * `?mes=AAAA-MM` refaz um mês específico (útil após uma falha); sem ele vale o
 * mês anterior ao corrente em São Paulo.
 *
 * Uma empresa por vez, e o erro de uma não derruba as outras.
 */

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const pedido = new URL(request.url).searchParams.get("mes") ?? "";
  const mes = isMes(pedido) ? pedido : mesAnteriorAoAtual();
  const { inicio, fim } = limitesDoMes(mes);

  const admin = createAdminClient();
  const empresas = (await listarEmpresasCliente(admin)).filter(empresa => empresa.ativa);

  const { data: existentes, error: existentesError } = await admin
    .from("report_snapshots")
    .select("org_id")
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim);
  if (existentesError) {
    console.error("[cron] relatorio-mensal (existentes): %s", existentesError.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  const jaTem = new Set((existentes ?? []).map(linha => linha.org_id));

  let gerados = 0;
  let pulados = 0;
  const falhas: string[] = [];

  for (const empresa of empresas) {
    if (jaTem.has(empresa.id)) {
      pulados += 1;
      continue;
    }
    try {
      const metrics = await gerarRelatorioMensal(admin, empresa.id, mes);
      const gravado = await gravarRascunho(admin, empresa.id, metrics, null);
      if (gravado.ok) gerados += 1;
      else if (gravado.motivo === "publicado") pulados += 1;
      else falhas.push(empresa.id);
    } catch (error) {
      console.error("[cron] relatorio-mensal %s: %s", empresa.id, error instanceof Error ? error.message : error);
      falhas.push(empresa.id);
    }
  }

  return Response.json({
    mes,
    empresas: empresas.length,
    gerados,
    pulados,
    falhas: falhas.length,
    empresasComFalha: falhas,
  });
}
