import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  gerarRelatorioMensal,
  gravarRascunho,
  listarEmpresasCliente,
  publicarSnapshot,
} from "@/lib/admin/relatorioMensal";
import { MONTHLY_KIND, isMes, limitesDoMes, mesAnteriorAoAtual } from "@/lib/admin/relatorioMensalTipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/relatorio-mensal — dias 1 a 3 de cada mês, 07:00 em Brasília (vercel.json).
 *
 * Gera, para cada empresa-cliente ativa, o relatório do MÊS ANTERIOR e já o
 * LIBERA ao cliente (decisão da Nexo: sem conferência prévia; ela pode ocultar
 * depois em /admin/clientes/relatorios). Roda também nos dias 2 e 3 porque a
 * Vercel não repete um disparo que falhou — e rodar de novo é inofensivo: quem
 * já tem relatório do mês (rascunho ou publicado) é pulado. Um rascunho que a
 * Nexo deixou guardado à mão, portanto, NÃO é publicado pelo cron.
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
  let publicados = 0;
  let pulados = 0;
  const falhas: string[] = [];
  const falhasAoLiberar: string[] = [];

  for (const empresa of empresas) {
    if (jaTem.has(empresa.id)) {
      pulados += 1;
      continue;
    }
    try {
      const metrics = await gerarRelatorioMensal(admin, empresa.id, mes);
      const gravado = await gravarRascunho(admin, empresa.id, metrics, null);
      if (!gravado.ok) {
        if (gravado.motivo === "publicado") pulados += 1;
        else falhas.push(empresa.id);
        continue;
      }
      gerados += 1;
      // Libera ao cliente na hora; se a liberação falhar o rascunho fica e a
      // Nexo libera à mão (ou o disparo do dia seguinte o pula, pois já existe).
      if (gravado.criado && (await publicarSnapshot(admin, gravado.id, empresa.id))) publicados += 1;
      else if (gravado.criado) falhasAoLiberar.push(empresa.id);
    } catch (error) {
      console.error("[cron] relatorio-mensal %s: %s", empresa.id, error instanceof Error ? error.message : error);
      falhas.push(empresa.id);
    }
  }

  return Response.json({
    mes,
    empresas: empresas.length,
    gerados,
    publicados,
    pulados,
    falhas: falhas.length,
    empresasComFalha: falhas,
    empresasSemLiberar: falhasAoLiberar,
  });
}
