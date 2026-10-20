import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { PORTAL_BUCKET, canPreview } from "@/lib/portal/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/files/<id>            → baixa o arquivo
 * GET /api/portal/files/<id>?inline=1   → abre no navegador (player, imagem, PDF)
 *
 * Mesmo desenho de `api/admin/evidence/[evidenceId]`:
 *   1. a autorização é da RLS — `open_portal_file` é SECURITY INVOKER, então só
 *      devolve linha para quem enxerga o arquivo (membro da empresa dona, e só
 *      se estiver publicado; a Nexo enxerga tudo). Vazio = 404, sem distinguir
 *      "não existe" de "não é seu";
 *   2. o bucket `portal` é privado e sem policies em `storage.objects`, então o
 *      service role entra só para assinar a URL, depois de a RLS ter autorizado;
 *   3. os bytes nunca passam por esta função — é um 302 para o Storage.
 *
 * `inline` só vale para tipos que o navegador abre sem executar nada (vídeo,
 * áudio, imagem raster, PDF); o resto sempre baixa. Download usa URL de 60 s; o
 * inline usa 1 h, porque o `<video>` continua pedindo trechos (seek) com a URL
 * que recebeu no redirecionamento, e ela não pode vencer no meio da reunião.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INLINE_TTL_SECONDS = 60 * 60;
const DOWNLOAD_TTL_SECONDS = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_portal_file", { p_file: id });
  if (error) {
    console.error("[portal] open_portal_file: %s", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  const file = data?.[0];
  if (!file) return new Response(null, { status: 404 });

  const inline = new URL(request.url).searchParams.get("inline") === "1" && canPreview(file.mime_type);

  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(PORTAL_BUCKET)
    .createSignedUrl(
      file.storage_path,
      inline ? INLINE_TTL_SECONDS : DOWNLOAD_TTL_SECONDS,
      inline ? undefined : { download: file.filename },
    );
  if (signError || !signed?.signedUrl) {
    console.error("[portal] createSignedUrl: %s", signError?.message ?? "sem url");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: signed.signedUrl,
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  });
}
