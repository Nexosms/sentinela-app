import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/evidence/[evidenceId]
 *
 * Redireciona (302) para uma URL assinada de 60 segundos do bucket privado
 * `evidence`, com `Content-Disposition: attachment`. Os bytes nunca passam por
 * esta origem e a URL nunca é pública.
 *
 * A ordem dos passos é o contrato de segurança desta rota:
 *   1. sessão;
 *   2. `open_evidence` — SECURITY INVOKER, portanto lê sob RLS: quem não pode
 *      ver a evidência recebe 42501. A mesma chamada grava `data_access_log`,
 *      `evidence_custody_events('acessada')` e a auditoria `evidence.downloaded`;
 *   3. só então a assinatura.
 * Sem trilha, sem download: se o passo 2 falhar, nada é assinado.
 *
 * SOBRE O SERVICE ROLE (exceção registrada em eslint.config.mjs): o bucket
 * `evidence` é privado e não tem NENHUMA policy em `storage.objects` — ausência
 * de policy é negação, então o cliente sob RLS não consegue assinar caminho
 * nenhum. O service role entra apenas no passo 3 e não decide nada: ele assina
 * um caminho que a RLS já autorizou e cuja leitura já foi registrada. Nenhuma
 * consulta de dados de staff é feita com ele aqui.
 */

/** Erro de privilégio insuficiente do Postgres, levantado por `open_evidence`. */
const INSUFFICIENT_PRIVILEGE = "42501";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
): Promise<Response> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { evidenceId } = await params;
  // Um id malformado viraria 22P02 no Postgres; responder 404 aqui evita
  // sujar a trilha com tentativa que nem chegou a ser uma consulta.
  if (!UUID.test(evidenceId)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_evidence", { p_evidence: evidenceId });

  if (error) {
    // "Existe, mas você não pode" já é vazamento: quem não tem acesso e quem
    // pediu um id inexistente recebem exatamente a mesma resposta.
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[evidence] open_evidence %s: %s", evidenceId, error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const evidence = data?.[0];
  if (!evidence) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { data: signed, error: signError } = await createAdminClient()
    .storage.from("evidence")
    // `download` é o que força Content-Disposition: attachment. Sem ele, um
    // SVG ou HTML enviado como evidência EXECUTA no navegador de quem revisa
    // o caso, na origem do Storage.
    .createSignedUrl(evidence.storage_path, 60, { download: evidence.filename });

  if (signError || !signed) {
    console.error("[evidence] assinatura %s: %s", evidenceId, signError?.message ?? "sem dados");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: signed.signedUrl,
      // A URL assinada é um segredo de 60 s: não pode ficar em cache nem
      // vazar para o destino seguinte pelo cabeçalho Referer.
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  });
}
