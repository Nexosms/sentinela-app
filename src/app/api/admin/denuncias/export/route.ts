import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import {
  MODE_LABEL,
  RISK_LABEL,
  STATUS_LABEL,
  type ReportStatus,
  type RiskLevel,
} from "@/lib/admin/labels";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/denuncias/export?q=&status=&risk=&unidade=&responsavel=
 *
 * CSV de gestão da caixa de entrada, com os MESMOS filtros da tela.
 *
 * Duas regras que definem esta rota:
 *   - a consulta roda sob RLS, então o arquivo nunca contém uma linha que quem
 *     exporta já não pudesse ver na tela;
 *   - as colunas são de gestão. `description`, `accused`, `witnesses`,
 *     `closure_summary` e qualquer campo de `report_identities` ficam de fora
 *     de propósito: uma planilha vaza por e-mail, pen drive e anexo de WhatsApp
 *     de um jeito que o painel não vaza. Exportar o dossiê inteiro seria criar
 *     uma cópia do caso fora de todo controle de acesso.
 */

const STATUS_VALUES = Object.keys(STATUS_LABEL) as ReportStatus[];
const RISK_VALUES = Object.keys(RISK_LABEL) as RiskLevel[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Filtros = {
  q: string | null;
  status: ReportStatus[];
  risk: RiskLevel[];
  unidade: string | null;
  responsavel: string | null;
  caixa: "ativas" | "arquivadas";
};

/** Aceita `status=a&status=b` e `status=a,b`; descarta o que não é do enum. */
function multi<T extends string>(url: URL, key: string, allowed: readonly T[]): T[] {
  const raw = url.searchParams.getAll(key).flatMap(v => v.split(","));
  return raw.map(v => v.trim()).filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function parseFiltros(url: URL): Filtros {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const unidade = url.searchParams.get("unidade")?.trim() ?? "";
  const responsavel = url.searchParams.get("responsavel")?.trim() ?? "";

  return {
    q: q.length > 0 ? q.slice(0, 120) : null,
    status: multi(url, "status", STATUS_VALUES),
    risk: multi(url, "risk", RISK_VALUES),
    // "nenhum" é o único valor não-uuid aceito: sem unidade / sem responsável.
    unidade: unidade === "nenhum" || UUID.test(unidade) ? unidade : null,
    responsavel: responsavel === "nenhum" || UUID.test(responsavel) ? responsavel : null,
    caixa: url.searchParams.get("caixa") === "arquivadas" ? "arquivadas" : "ativas",
  };
}

/** Escapa um campo para CSV: aspas dobradas e sempre entre aspas. */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function diasEmAberto(createdAt: string, closedAt: string | null): number {
  const fim = closedAt ? new Date(closedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((fim - new Date(createdAt).getTime()) / 86_400_000));
}

const DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function dataBr(iso: string | null): string {
  return iso ? DATA.format(new Date(iso)) : "";
}

export async function GET(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const staff = await getStaffContext();
  const filtros = parseFiltros(new URL(request.url));
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select(
      `id, protocol, status, risk, mode, created_at, due_at, closed_at,
       org_units(name),
       profiles!reports_assigned_to_fkey(full_name),
       report_categories(categories(label_pt))`,
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  // Mesma regra da tela: "Arquivadas" só mostra arquivada; "Ativas" nunca mostra.
  if (filtros.caixa === "arquivadas") {
    query = query.eq("status", "arquivada");
  } else {
    query = query.neq("status", "arquivada");
    if (filtros.status.length > 0) query = query.in("status", filtros.status);
  }
  if (filtros.risk.length > 0) query = query.in("risk", filtros.risk);
  if (filtros.unidade === "nenhum") query = query.is("org_unit_id", null);
  else if (filtros.unidade) query = query.eq("org_unit_id", filtros.unidade);
  if (filtros.responsavel === "nenhum") query = query.is("assigned_to", null);
  else if (filtros.responsavel) query = query.eq("assigned_to", filtros.responsavel);
  // A busca livre olha o corpo do relato, mas o corpo não vai para o arquivo:
  // filtrar por um texto não é o mesmo que exportá-lo.
  if (filtros.q) {
    const termo = filtros.q.replace(/[%,()]/g, " ");
    query = query.or(`protocol.ilike.%${termo}%,description.ilike.%${termo}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[export] consulta: %s", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const linhas = data ?? [];
  const header = [
    "Protocolo",
    "Status",
    "Risco",
    "Modalidade",
    "Unidade",
    "Categorias",
    "Responsável",
    "Criado em",
    "Prazo",
    "Dias em aberto",
  ];

  const csv = [
    header.map(cell).join(";"),
    ...linhas.map(r =>
      [
        cell(r.protocol),
        cell(STATUS_LABEL[r.status]),
        cell(RISK_LABEL[r.risk]),
        cell(MODE_LABEL[r.mode]),
        cell(r.org_units?.name ?? "Não informada"),
        cell(
          r.report_categories
            .map(rc => rc.categories?.label_pt)
            .filter((v): v is string => Boolean(v))
            .join(" | "),
        ),
        cell(r.profiles?.full_name ?? "Sem responsável"),
        cell(dataBr(r.created_at)),
        cell(dataBr(r.due_at)),
        cell(diasEmAberto(r.created_at, r.closed_at)),
      ].join(";"),
    ),
  ].join("\r\n") + "\r\n";

  // `record_export` (migração 023) grava a linha em `report_exports` E o evento
  // `export.generated` na MESMA transação. Não troque por um insert direto:
  // `app.write_audit` vive no schema `app`, que o PostgREST não expõe, então o
  // insert sozinho deixaria a exportação sem trilha.
  //
  // Registro ANTES da resposta, e bloqueante: exportação sem trilha não sai.
  // O CSV já está na memória, mas entregá-lo sem registro criaria uma cópia da
  // caixa de entrada que ninguém consegue rastrear depois.
  const { error: registroError } = await supabase.rpc("record_export", {
    p_org: staff.orgId,
    p_kind: "inbox_csv",
    p_format: "csv",
    p_filters: filtros as unknown as Json,
    p_row_count: linhas.length,
    p_includes_identity: false,
  });

  if (registroError) {
    console.error("[export] record_export: %s", registroError.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const carimbo = new Date().toISOString().slice(0, 10);

  return new Response(
    // BOM: sem ele o Excel pt-BR lê o arquivo como Latin-1 e "Denúncia" vira
    // "DenÃºncia".
    "﻿" + csv,
    {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="denuncias-${carimbo}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
