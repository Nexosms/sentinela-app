import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { FileCard } from "@/components/portal/parts";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { MATERIALS_PATH, categoryLabel, monthRefLabel } from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Materiais e Documentos" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Uma pasta de materiais (campanha mensal) vista pelo cliente. A pasta precisa
 * ser da empresa ativa E estar publicada; os arquivos herdam isso (a RLS esconde
 * os de uma pasta em rascunho, e o filtro de organização é a segunda trava).
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: folder } = await supabase
    .from("portal_folders")
    .select("id, name, category, reference_month, description")
    .eq("id", id)
    .eq("org_id", staff.orgId)
    .eq("is_published", true)
    .maybeSingle();
  if (!folder) notFound();

  const { data: files } = await supabase
    .from("portal_files")
    .select("id, title, description, mime_type, size_bytes, published_at, filename")
    .eq("folder_id", id)
    .eq("org_id", staff.orgId)
    .order("title", { ascending: true });
  const lista = files ?? [];

  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Materiais e Documentos" />
      <section className="portal-page">
        <header className="portal-hero">
          <Link className="portal-back" href={`${MATERIALS_PATH}?categoria=${folder.category}`}>
            <span aria-hidden="true">←</span> Voltar
          </Link>
          <div className="portal-hero-card">
            <div className="portal-hero-title">
              <h1>{folder.name}</h1>
              <span className="risk arquivada">{categoryLabel(folder.category)}</span>
            </div>
            <p className="portal-hero-meta">
              <span>
                <i aria-hidden="true">▦</i> {monthRefLabel(folder.reference_month)}
              </span>
              <span className="portal-sep" aria-hidden="true" />
              <span>
                {lista.length} arquivo{lista.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
        </header>

        {folder.description ? <p className="lead">{folder.description}</p> : null}

        {lista.length === 0 ? (
          <div className="portal-panel">
            <p className="portal-empty">Nenhum arquivo disponível nesta pasta.</p>
          </div>
        ) : (
          <div className="portal-list">
            {lista.map(file => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
