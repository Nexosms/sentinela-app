import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { EmptyNote, FileCard } from "@/components/portal/parts";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MATERIALS_PATH,
  MATERIAL_CATEGORIES,
  materialsHref,
  parseMaterialFilters,
} from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Materiais e Documentos" };

/**
 * Biblioteca de materiais da empresa ativa, por categoria, com busca por
 * título/descrição (GET puro, sem JavaScript). Duas travas explícitas além da
 * RLS: organização ativa e `is_published` — a Nexo está em toda empresa e vê
 * rascunhos por RLS, então só o filtro daqui mostra o portal como o cliente o vê.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMaterialFilters(await searchParams);
  const staff = await getStaffContext();
  const supabase = await createClient();

  let query = supabase
    .from("portal_files")
    .select("id, title, description, mime_type, size_bytes, published_at, filename, category")
    .eq("org_id", staff.orgId)
    .eq("kind", "material")
    .eq("is_published", true);
  if (filters.categoria) query = query.eq("category", filters.categoria);
  // `filters.q` já passou por `sanitizeQuery`: sem vírgula, ponto nem parêntese,
  // que é a gramática do `.or()` do PostgREST.
  if (filters.q) query = query.or(`title.ilike.*${filters.q}*,description.ilike.*${filters.q}*`);

  const { data } = await query
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  const materials = data ?? [];

  const visiveis = filters.categoria
    ? MATERIAL_CATEGORIES.filter(category => category.key === filters.categoria)
    : MATERIAL_CATEGORIES;
  const selecionada = MATERIAL_CATEGORIES.find(category => category.key === filters.categoria);

  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Materiais e Documentos" />
      <section className="portal-page">
        <form className="inbox-tools" method="get">
          {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
          <div className="searchbox">
            ⌕{" "}
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Buscar material por título ou descrição"
              aria-label="Buscar material"
            />
          </div>
          <button type="submit">Buscar</button>
          {filters.q ? (
            <Link className="portal-clear" href={materialsHref(MATERIALS_PATH, filters, { q: "" })}>
              Limpar busca
            </Link>
          ) : null}
        </form>

        <div className="detail-tabs">
          <Link href={materialsHref(MATERIALS_PATH, filters, { categoria: "" })} className={filters.categoria === "" ? "active" : ""}>
            Todos
          </Link>
          {MATERIAL_CATEGORIES.map(category => (
            <Link
              key={category.key}
              href={materialsHref(MATERIALS_PATH, filters, { categoria: category.key })}
              className={filters.categoria === category.key ? "active" : ""}
            >
              {category.short}
            </Link>
          ))}
        </div>

        {selecionada ? <p className="lead">{selecionada.description}</p> : null}

        {materials.length === 0 ? (
          <EmptyNote
            icon="▣"
            title={filters.q ? "Nada encontrado para esta busca" : "Nenhum material disponível"}
            text={
              filters.q
                ? "Tente outras palavras ou limpe a busca."
                : "A equipe Nexo publica aqui os materiais de treinamento, do CDN Conecta e os cartazes de divulgação."
            }
          />
        ) : (
          visiveis.map(category => {
            const doGrupo = materials.filter(material => material.category === category.key);
            if (doGrupo.length === 0) return null;
            return (
              <div key={category.key} className="portal-group">
                {filters.categoria ? null : (
                  <div className="list-head">
                    <span>{category.label}</span>
                    <small>
                      {doGrupo.length} arquivo{doGrupo.length === 1 ? "" : "s"}
                    </small>
                  </div>
                )}
                <div className="portal-list">
                  {doGrupo.map(material => (
                    <FileCard key={material.id} file={material} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
