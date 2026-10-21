import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isNexoAdmin } from "@/lib/org/context";
import { listarEmpresasCliente } from "@/lib/admin/relatorioMensal";
import {
  MONTHLY_KIND,
  isMes,
  limitesDoMes,
  mesAnteriorAoAtual,
  mesPorExtenso,
  monthlyMetricsSchema,
  somarMeses,
} from "@/lib/admin/relatorioMensalTipos";

import {
  gerarFaltantes,
  gerarRelatorio,
  liberarRelatorio,
  liberarTodos,
  ocultarRelatorio,
} from "./actions";

export const metadata: Metadata = { title: "Relatórios mensais dos clientes" };

function aviso(codigo: string | undefined): { texto: string; erro: boolean } | null {
  if (!codigo) return null;
  const fixos: Record<string, [string, boolean]> = {
    gerado: ["Rascunho gerado. Confira e libere quando estiver tudo certo.", false],
    liberado: ["Relatório liberado: o cliente já pode abrir.", false],
    ocultado: ["Relatório ocultado: o cliente não o vê mais.", false],
    "ja-publicado": ["Este relatório já está liberado. Oculte-o antes de gerar de novo.", true],
    negado: ["Só a equipe Nexo pode gerenciar os relatórios.", true],
    sessao: ["Sessão expirada. Entre novamente.", true],
    erro: ["Não foi possível concluir. Tente novamente.", true],
  };
  if (fixos[codigo]) return { texto: fixos[codigo][0], erro: fixos[codigo][1] };
  const gerados = codigo.match(/^gerados-(\d+)(?:-falhas-(\d+))?$/);
  if (gerados) {
    const falhas = Number(gerados[2] ?? 0);
    return {
      texto: `${gerados[1]} rascunho(s) gerado(s)${falhas ? `; ${falhas} empresa(s) falharam — tente de novo` : "."}`,
      erro: falhas > 0,
    };
  }
  const liberados = codigo.match(/^liberados-(\d+)$/);
  if (liberados) return { texto: `${liberados[1]} relatório(s) liberado(s) aos clientes.`, erro: false };
  return null;
}

/**
 * Painel da equipe Nexo: para o mês escolhido, uma linha por empresa-cliente
 * com o estado (sem relatório / rascunho / liberado) e as ações. O rascunho é
 * gerado pelo cron no dia 1º, ou aqui, na hora; nada chega ao cliente antes de
 * "Liberar".
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Relatórios mensais" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Relatórios mensais</h2>
          <p>A geração e a liberação dos relatórios dos clientes é exclusiva de quem administra a organização Sentinela.</p>
        </div>
      </>
    );
  }

  const params = await searchParams;
  const pedido = typeof params.mes === "string" ? params.mes : "";
  const padrao = mesAnteriorAoAtual();
  const mes = isMes(pedido) ? pedido : padrao;
  const mensagem = aviso(typeof params.aviso === "string" ? params.aviso : undefined);
  const { inicio, fim } = limitesDoMes(mes);

  const empresas = await listarEmpresasCliente(createAdminClient());
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_snapshots")
    .select("org_id, is_published, metrics")
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim);
  const porEmpresa = new Map((data ?? []).map(linha => [linha.org_id, linha]));

  const ativas = empresas.filter(empresa => empresa.ativa);
  const faltam = ativas.filter(empresa => !porEmpresa.has(empresa.id)).length;
  const rascunhos = (data ?? []).filter(linha => !linha.is_published).length;
  const meses = Array.from({ length: 13 }, (_, i) => somarMeses(padrao, -i));

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title="Relatórios mensais" />
      <section className="form-card">
        <span className="section-kicker">RELATÓRIO MENSAL DOS CLIENTES</span>
        <h1>Confira e libere o relatório de cada empresa.</h1>
        <p className="lead">
          No dia 1º de cada mês o sistema prepara um rascunho por empresa. O cliente só vê depois que você
          liberar. Só indicadores — nenhum relato individual entra.
        </p>

        {mensagem ? (
          <p className={mensagem.erro ? "mr-notice erro" : "mr-notice"} role="status">
            {mensagem.texto}
          </p>
        ) : null}

        <form className="inbox-tools" method="get">
          <label className="searchbox">
            <span>Mês</span>
            <select name="mes" defaultValue={mes}>
              {meses.map(opcao => (
                <option key={opcao} value={opcao}>
                  {mesPorExtenso(opcao)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Ver</button>
        </form>

        <div className="case-actions">
          {faltam > 0 ? (
            <form action={gerarFaltantes}>
              <input type="hidden" name="mes" value={mes} />
              <button type="submit">Gerar os {faltam} que faltam</button>
            </form>
          ) : null}
          {rascunhos > 0 ? (
            <form action={liberarTodos}>
              <input type="hidden" name="mes" value={mes} />
              <button type="submit" className="primary-button">
                Liberar os {rascunhos} rascunho{rascunhos === 1 ? "" : "s"}
              </button>
            </form>
          ) : null}
        </div>

        <table className="mr-admin-table">
          <thead>
            <tr>
              <th>EMPRESA</th>
              <th>RELATOS</th>
              <th>ESTADO</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(empresa => {
              const linha = porEmpresa.get(empresa.id);
              const metrics = linha ? monthlyMetricsSchema.safeParse(linha.metrics) : null;
              const estado = !linha ? "nenhum" : linha.is_published ? "publicado" : "rascunho";
              return (
                <tr key={empresa.id}>
                  <td>
                    {empresa.nome}
                    {empresa.ativa ? null : " (desativada)"}
                  </td>
                  <td>{metrics?.success ? metrics.data.atual.total : "—"}</td>
                  <td>
                    <span className={`mr-estado ${estado}`}>
                      {estado === "nenhum" ? "sem relatório" : estado === "publicado" ? "liberado" : "rascunho"}
                    </span>
                  </td>
                  <td>
                    {linha ? (
                      <Link className="mr-mini" href={`/admin/clientes/relatorios/${empresa.id}/${mes}`}>
                        Ver
                      </Link>
                    ) : null}
                    {estado !== "publicado" ? (
                      <form action={gerarRelatorio}>
                        <input type="hidden" name="mes" value={mes} />
                        <input type="hidden" name="orgId" value={empresa.id} />
                        <button type="submit" className="mr-mini">
                          {linha ? "Gerar de novo" : "Gerar"}
                        </button>
                      </form>
                    ) : null}
                    {estado === "rascunho" ? (
                      <form action={liberarRelatorio}>
                        <input type="hidden" name="mes" value={mes} />
                        <input type="hidden" name="orgId" value={empresa.id} />
                        <button type="submit" className="mr-mini primario">
                          Liberar
                        </button>
                      </form>
                    ) : null}
                    {estado === "publicado" ? (
                      <form action={ocultarRelatorio}>
                        <input type="hidden" name="mes" value={mes} />
                        <input type="hidden" name="orgId" value={empresa.id} />
                        <button type="submit" className="mr-mini">
                          Ocultar
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
