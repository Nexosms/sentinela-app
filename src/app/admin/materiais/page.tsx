import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { IconChevronRight, IconFolder, IconSearch } from "@/components/admin/shell/AdminIcons";
import { FileCard } from "@/components/portal/parts";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MATERIALS_PATH,
  MATERIAL_CATEGORIES,
  folderPath,
  materialsHref,
  monthRefLabel,
  parseMaterialFilters,
} from "@/lib/portal/portal";

export const metadata: Metadata = { title: "Materiais e Documentos" };

/** Sem acento e sem caixa, para a busca achar "campanha" em "Campánha". */
function fold(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Biblioteca de materiais da empresa ativa, por categoria, com busca por
 * título/descrição (GET puro, sem JavaScript). Pastas (campanhas mensais do CDN
 * Conecta) aparecem como cartões; os arquivos de dentro só aparecem na busca ou
 * ao abrir a pasta. Duas travas explícitas além da RLS: organização ativa e
 * "publicado" — a Nexo está em toda empresa e vê rascunho por RLS, então só o
 * filtro daqui mostra o portal como o cliente o vê.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseMaterialFilters(await searchParams);
  const staff = await getStaffContext();
  const supabase = await createClient();

  // Pastas publicadas da empresa (na categoria escolhida, se houver).
  let folderQuery = supabase
    .from("portal_folders")
    .select("id, name, category, reference_month")
    .eq("org_id", staff.orgId)
    .eq("is_published", true);
  if (filters.categoria) folderQuery = folderQuery.eq("category", filters.categoria);
  const { data: folderRows } = await folderQuery
    .order("reference_month", { ascending: false })
    .order("created_at", { ascending: false });
  const todasPastas = folderRows ?? [];
  const pastaIds = todasPastas.map(folder => folder.id);
  const nomeDaPasta = new Map(todasPastas.map(folder => [folder.id, folder.name]));

  const { data: contagem } =
    pastaIds.length > 0
      ? await supabase.from("portal_files").select("folder_id").eq("org_id", staff.orgId).in("folder_id", pastaIds)
      : { data: [] };
  const arquivosPorPasta = new Map<string, number>();
  for (const row of contagem ?? []) {
    if (row.folder_id) arquivosPorPasta.set(row.folder_id, (arquivosPorPasta.get(row.folder_id) ?? 0) + 1);
  }

  // Arquivos soltos; na busca, também os de dentro das pastas publicadas.
  let query = supabase
    .from("portal_files")
    .select("id, title, description, mime_type, size_bytes, published_at, filename, category, folder_id, is_published")
    .eq("org_id", staff.orgId)
    .eq("kind", "material");
  if (filters.categoria) query = query.eq("category", filters.categoria);
  if (filters.q) {
    query =
      pastaIds.length > 0
        ? query.or(`folder_id.is.null,folder_id.in.(${pastaIds.join(",")})`)
        : query.is("folder_id", null);
    // `filters.q` já passou por `sanitizeQuery`: sem vírgula, ponto nem parêntese,
    // que é a gramática do `.or()` do PostgREST.
    query = query.or(`title.ilike.*${filters.q}*,description.ilike.*${filters.q}*`);
  } else {
    query = query.is("folder_id", null);
  }
  const { data } = await query
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  // Solto: precisa estar publicado. Dentro de pasta: a pasta precisa estar publicada.
  const materials = (data ?? []).filter(material =>
    material.folder_id ? nomeDaPasta.has(material.folder_id) : material.is_published,
  );

  const pastas = filters.q ? todasPastas.filter(folder => fold(folder.name).includes(fold(filters.q))) : todasPastas;

  const visiveis = filters.categoria
    ? MATERIAL_CATEGORIES.filter(category => category.key === filters.categoria)
    : MATERIAL_CATEGORIES;
  const selecionada = MATERIAL_CATEGORIES.find(category => category.key === filters.categoria);
  const vazio = materials.length === 0 && pastas.length === 0;

  // Contagem de cada categoria no que o cliente de fato vê (independe do filtro da tela): arquivo solto
  // publicado ou arquivo de pasta publicada.
  const [{ data: pastasPublicadas }, { data: todosArquivos }] = await Promise.all([
    supabase.from("portal_folders").select("id").eq("org_id", staff.orgId).eq("is_published", true),
    supabase
      .from("portal_files")
      .select("category, folder_id, is_published")
      .eq("org_id", staff.orgId)
      .eq("kind", "material"),
  ]);
  const idsPublicados = new Set((pastasPublicadas ?? []).map(folder => folder.id));
  const porCategoria = new Map<string, number>();
  let totalGeral = 0;
  for (const arquivo of todosArquivos ?? []) {
    const visivel = arquivo.folder_id ? idsPublicados.has(arquivo.folder_id) : arquivo.is_published;
    if (!visivel) continue;
    totalGeral += 1;
    if (arquivo.category) porCategoria.set(arquivo.category, (porCategoria.get(arquivo.category) ?? 0) + 1);
  }

  return (
    <>
      <AdminTopbar eyebrow="PORTAL" title="Materiais e Documentos" />
      <div className="mt-wrap">
        <div className="mt-barra">
          <form className="mt-busca" method="get">
            {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
            <label>
              <span className="ad-sr">Buscar material</span>
              <IconSearch size={18} />
              <input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Buscar material ou pasta por nome ou descrição"
                aria-label="Buscar material"
              />
            </label>
            <button type="submit" className="mt-b">
              Buscar
            </button>
            {filters.q ? (
              <Link className="mt-limpar" href={materialsHref(MATERIALS_PATH, filters, { q: "" })}>
                Limpar busca
              </Link>
            ) : null}
          </form>
          <nav className="mt-chips" aria-label="Categorias">
            <Link
              href={materialsHref(MATERIALS_PATH, filters, { categoria: "" })}
              className={filters.categoria === "" ? "on" : ""}
              aria-current={filters.categoria === "" ? "true" : undefined}
            >
              Todos <b>{totalGeral}</b>
            </Link>
            {MATERIAL_CATEGORIES.map(category => (
              <Link
                key={category.key}
                href={materialsHref(MATERIALS_PATH, filters, { categoria: category.key })}
                className={filters.categoria === category.key ? "on" : ""}
                aria-current={filters.categoria === category.key ? "true" : undefined}
              >
                {category.short} <b>{porCategoria.get(category.key) ?? 0}</b>
              </Link>
            ))}
          </nav>
        </div>

        {selecionada ? <p className="mt-lead">{selecionada.description}</p> : null}

        {vazio ? (
          <div className="ad-empty">
            <span className="ad-ico" aria-hidden="true">
              <IconFolder size={24} />
            </span>
            <small>PORTAL</small>
            <h2>{filters.q ? "Nada encontrado para esta busca" : "Nenhum material disponível"}</h2>
            <p>
              {filters.q
                ? "Tente outras palavras ou limpe a busca."
                : "A equipe Nexo publica aqui os materiais de treinamento, do CDN Conecta e os cartazes de divulgação."}
            </p>
          </div>
        ) : (
          visiveis.map(category => {
            const doGrupo = materials.filter(material => material.category === category.key);
            const pastasDoGrupo = pastas.filter(folder => folder.category === category.key);
            if (doGrupo.length === 0 && pastasDoGrupo.length === 0) return null;
            return (
              <section key={category.key} className="mt-sec">
                <div className="mt-cab">
                  <div>
                    <small>{category.short.toUpperCase()}</small>
                    <h2>{category.label}</h2>
                  </div>
                  <span className="mt-n">
                    {pastasDoGrupo.length > 0
                      ? `${pastasDoGrupo.length} pasta${pastasDoGrupo.length === 1 ? "" : "s"} · `
                      : ""}
                    {doGrupo.length} arquivo{doGrupo.length === 1 ? "" : "s"}
                  </span>
                </div>
                {pastasDoGrupo.length > 0 ? (
                  <div className="mt-pastas">
                    {pastasDoGrupo.map(folder => {
                      const total = arquivosPorPasta.get(folder.id) ?? 0;
                      return (
                        <Link key={folder.id} className="mt-pasta" href={folderPath(folder.id)}>
                          <span className="mt-pi" aria-hidden="true">
                            <IconFolder size={24} />
                          </span>
                          <div>
                            <strong>{folder.name}</strong>
                            <small>
                              {monthRefLabel(folder.reference_month)} · {total} arquivo{total === 1 ? "" : "s"}
                            </small>
                          </div>
                          <IconChevronRight />
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
                {doGrupo.length > 0 ? (
                  <div className="mt-grid">
                    {doGrupo.map(material => (
                      <FileCard key={material.id} file={material}>
                        {material.folder_id ? (
                          <div className="portal-badges">
                            <span className="risk arquivada">{nomeDaPasta.get(material.folder_id)}</span>
                          </div>
                        ) : null}
                      </FileCard>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
