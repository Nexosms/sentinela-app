"use client";

import { useMemo, useRef, useState } from "react";

import {
  copiarParaEmpresa,
  limparPublicacao,
  solicitarUploadPublicacao,
  versaoDoServidor,
} from "@/app/admin/clientes/publicar/actions";
import { createClient } from "@/lib/supabase/client";
import {
  PORTAL_ACCEPT,
  PORTAL_BUCKET,
  PORTAL_MAX_BYTES,
  formatSize,
  resolveMime,
} from "@/lib/portal/files";
import { MATERIAL_CATEGORIES, MONTH_NAMES } from "@/lib/portal/portal";

export type Empresa = { id: string; name: string; doc: string };

type Estado = { s: "fila" | "enviando" | "ok" | "erro"; m?: string };

const LIXO = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const MAX_ARQUIVOS = 50;
/** Cópias simultâneas: cada uma é uma chamada curta ao servidor, para empresas diferentes. */
const SIMULTANEAS = 4;

/** Sem acento e sem caixa, para "natalia" achar "Natália". */
function fold(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function semExtensao(nome: string): string {
  return nome.replace(/\.[^.]+$/, "");
}

/**
 * Publicar o mesmo arquivo para várias empresas, escolhidas uma a uma.
 *
 * O arquivo sobe UMA vez para uma área temporária; depois o servidor copia para
 * cada empresa marcada (uma chamada por empresa e por arquivo, para nenhuma
 * passar do tempo de uma função da Vercel). Se alguma empresa falhar, os
 * arquivos temporários ficam guardados e dá para tentar de novo só nas que
 * falharam, sem reenviar. Dois modos: material solto, ou pasta de campanha
 * mensal do CDN Conecta (rodar de novo com o mesmo nome e mês acrescenta
 * arquivos à pasta que já existe na empresa).
 */
export default function PublicarForm({
  empresas,
  defaultMonth,
  defaultYear,
  versao,
}: {
  empresas: Empresa[];
  /** "1".."12" e o ano de hoje, calculados no servidor. */
  defaultMonth: string;
  defaultYear: string;
  /** Versão do site que montou esta página; o servidor precisa ser da mesma. */
  versao: string;
}) {
  const [modo, setModo] = useState<"material" | "pasta">("material");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [ignorados, setIgnorados] = useState(0);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [visivel, setVisivel] = useState(true);
  const [pastaNome, setPastaNome] = useState("");
  const [pastaMes, setPastaMes] = useState(defaultMonth);
  const [pastaAno, setPastaAno] = useState(defaultYear);
  const [pastaDescricao, setPastaDescricao] = useState("");

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  const [fase, setFase] = useState<"edicao" | "rodando" | "fim">("edicao");
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [erroGeral, setErroGeral] = useState("");
  const temporarios = useRef<(string | null)[]>([]);
  const [orgsAlvo, setOrgsAlvo] = useState<string[]>([]);

  const filtradas = useMemo(() => {
    const termo = fold(busca);
    const digitos = busca.replace(/\D/g, "");
    return empresas.filter(
      empresa =>
        termo === "" ||
        fold(empresa.name).includes(termo) ||
        (digitos.length >= 3 && empresa.doc.replace(/\D/g, "").includes(digitos)),
    );
  }, [empresas, busca]);

  function alternar(id: string) {
    setSelecionadas(atual => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function escolherArquivos(lista: File[]) {
    const uteis = lista.filter(file => !LIXO.has(file.name.toLowerCase()));
    const aceitos = uteis.filter(file => resolveMime(file.name, file.type));
    setIgnorados(uteis.length - aceitos.length);
    const finais = modo === "material" ? aceitos.slice(0, 1) : aceitos.slice(0, MAX_ARQUIVOS);
    setArquivos(finais);
    if (modo === "material" && finais[0] && !title.trim()) setTitle(semExtensao(finais[0].name));
  }

  const pronto =
    arquivos.length > 0 &&
    selecionadas.size > 0 &&
    (modo === "material" ? category !== "" && title.trim() !== "" : pastaNome.trim().length >= 2 && pastaAno !== "");

  function chave(indice: number, orgId: string) {
    return `${indice}|${orgId}`;
  }

  async function executar(repetir: boolean) {
    setErroGeral("");

    // Aba aberta antes de uma atualização do site fala com o código antigo (e repete
    // erros já corrigidos). Compara a versão da página com a do servidor antes de
    // enviar qualquer byte.
    try {
      const servidor = await versaoDoServidor();
      if (servidor !== versao) {
        setErroGeral(
          `Esta página está desatualizada (página: ${versao}, servidor: ${servidor}). Recarregue com Ctrl+F5 e tente de novo.`,
        );
        return;
      }
    } catch {
      setErroGeral("Não foi possível falar com o servidor. Recarregue a página com Ctrl+F5 e tente de novo.");
      return;
    }

    setFase("rodando");
    const supabase = createClient();
    const orgs = repetir ? orgsAlvo : Array.from(selecionadas);
    setOrgsAlvo(orgs);

    // Espelho local do estado: o React só atualiza no próximo render, e o resumo do fim precisa dele.
    const resultado: Record<string, Estado> = repetir ? { ...estado } : {};
    const marcar = (k: string, e: Estado) => {
      resultado[k] = e;
      setEstado(atual => ({ ...atual, [k]: e }));
    };

    // 1) Cada arquivo sobe uma única vez para a área temporária.
    for (const [indice, file] of arquivos.entries()) {
      if (temporarios.current[indice]) continue;
      const falhar = (mensagem: string) => {
        for (const orgId of orgs) marcar(chave(indice, orgId), { s: "erro", m: mensagem });
      };
      try {
        const ticket = await solicitarUploadPublicacao({ filename: file.name, size: file.size, type: file.type });
        if ("error" in ticket) {
          falhar(ticket.error);
          continue;
        }
        const { error } = await supabase.storage
          .from(PORTAL_BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.mime });
        if (error) {
          console.error("[publicar] upload: %s", error.message);
          falhar("o envio falhou (o limite de tamanho do projeto no Supabase também vale)");
          continue;
        }
        temporarios.current[indice] = ticket.path;
      } catch (error) {
        console.error("[publicar] upload", error);
        falhar("o envio falhou");
      }
    }

    // 2) Uma cópia por empresa e por arquivo, poucas ao mesmo tempo.
    const alvos: { indice: number; orgId: string }[] = [];
    for (const [indice] of arquivos.entries()) {
      if (!temporarios.current[indice]) continue;
      for (const orgId of orgs) {
        if (repetir && resultado[chave(indice, orgId)]?.s === "ok") continue;
        alvos.push({ indice, orgId });
        marcar(chave(indice, orgId), { s: "fila" });
      }
    }

    let proximo = 0;
    async function trabalhador() {
      while (proximo < alvos.length) {
        const { indice, orgId } = alvos[proximo++];
        const k = chave(indice, orgId);
        marcar(k, { s: "enviando" });
        try {
          const res = await copiarParaEmpresa({
            orgId,
            stagingPath: temporarios.current[indice] as string,
            filename: arquivos[indice].name,
            modo,
            category,
            title,
            description,
            publishedAt,
            isPublished: visivel,
            pasta:
              modo === "pasta"
                ? { name: pastaNome, month: pastaMes, year: pastaAno, description: pastaDescricao }
                : undefined,
          });
          marcar(k, "error" in res ? { s: "erro", m: res.error } : { s: "ok" });
        } catch (error) {
          console.error("[publicar] copiar", error);
          marcar(k, { s: "erro", m: "falha de conexão" });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, alvos.length) }, trabalhador));

    // 3) Tudo certo: apaga os temporários. Com falhas, eles ficam para a nova tentativa.
    const falhas = Object.values(resultado).filter(item => item.s === "erro").length;
    if (falhas === 0) {
      const paths = temporarios.current.filter((path): path is string => Boolean(path));
      const limpeza = await limparPublicacao(paths);
      if ("error" in limpeza) console.error("[publicar] limpeza: %s", limpeza.error);
      temporarios.current = [];
    }
    setFase("fim");
  }

  async function descartar() {
    const paths = temporarios.current.filter((path): path is string => Boolean(path));
    await limparPublicacao(paths);
    temporarios.current = [];
    setEstado({});
    setFase("edicao");
  }

  function confirmarEPublicar() {
    const nomeModo = modo === "pasta" ? `na pasta "${pastaNome}"` : "como material";
    const ok = window.confirm(
      `Publicar ${arquivos.length} arquivo${arquivos.length === 1 ? "" : "s"} ${nomeModo} para ${selecionadas.size} empresa${selecionadas.size === 1 ? "" : "s"}?`,
    );
    if (ok) void executar(false);
  }

  const orgsDoRelatorio = empresas.filter(empresa => orgsAlvo.includes(empresa.id));
  const total = Object.keys(estado).length;
  const concluidas = Object.values(estado).filter(item => item.s === "ok").length;
  const falhas = Object.values(estado).filter(item => item.s === "erro").length;

  function resumoDaEmpresa(orgId: string): { icone: string; texto: string; classe: string } {
    const itens = arquivos.map((_, indice) => estado[chave(indice, orgId)]).filter(Boolean) as Estado[];
    const erro = itens.find(item => item.s === "erro");
    if (erro) return { icone: "!", texto: erro.m ?? "falhou", classe: "erro" };
    if (itens.length > 0 && itens.every(item => item.s === "ok")) return { icone: "✓", texto: "publicado", classe: "ok" };
    if (itens.some(item => item.s === "enviando")) return { icone: "…", texto: "copiando", classe: "enviando" };
    return { icone: "·", texto: "na fila", classe: "fila" };
  }

  if (fase !== "edicao") {
    return (
      <div className="message-box">
        <div className="message-head">
          <span>⤒</span>
          <div>
            <strong>{fase === "rodando" ? "Publicando…" : falhas > 0 ? "Concluído com problemas" : "Publicação concluída"}</strong>
            <small>
              {concluidas} de {total} cópia{total === 1 ? "" : "s"} feita{concluidas === 1 ? "" : "s"}
              {falhas > 0 ? ` · ${falhas} com problema` : ""}.
              {fase === "rodando" ? " Não feche a página." : ""}
            </small>
          </div>
        </div>

        <ul className="portal-bulk-list">
          {orgsDoRelatorio.map(empresa => {
            const resumo = resumoDaEmpresa(empresa.id);
            return (
              <li key={empresa.id} className={resumo.classe}>
                <span>{resumo.icone}</span>
                <strong>{empresa.name}</strong>
                <small>{resumo.texto}</small>
              </li>
            );
          })}
        </ul>

        {fase === "fim" ? (
          <div className="case-actions">
            {falhas > 0 ? (
              <>
                <button type="button" className="portal-secondary" onClick={() => void descartar()}>
                  Descartar e começar de novo
                </button>
                <button type="button" className="primary-button" onClick={() => void executar(true)}>
                  Tentar de novo nas que falharam <span>→</span>
                </button>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={() => window.location.reload()}>
                Publicar outro <span>→</span>
              </button>
            )}
          </div>
        ) : null}
        {erroGeral ? <span className="field-error-message">{erroGeral}</span> : null}
      </div>
    );
  }

  return (
    <>
      <div className="message-box">
        <div className="message-head">
          <span>①</span>
          <div>
            <strong>O que publicar</strong>
            <small>O arquivo sobe uma vez e cada empresa marcada recebe a sua própria cópia.</small>
          </div>
        </div>

        <div className="portal-mode" role="radiogroup" aria-label="Forma de publicação">
          <label className={modo === "material" ? "ativo" : ""}>
            <input
              type="radio"
              name="modo"
              checked={modo === "material"}
              onChange={() => {
                setModo("material");
                setArquivos([]);
                setIgnorados(0);
              }}
            />
            <strong>Material solto</strong>
            <small>Um arquivo, em qualquer categoria.</small>
          </label>
          <label className={modo === "pasta" ? "ativo" : ""}>
            <input
              type="radio"
              name="modo"
              checked={modo === "pasta"}
              onChange={() => {
                setModo("pasta");
                setArquivos([]);
                setIgnorados(0);
              }}
            />
            <strong>Pasta do CDN Conecta</strong>
            <small>Vários arquivos numa campanha mensal.</small>
          </label>
        </div>

        <div className="portal-upload">
          {modo === "material" ? (
            <label className="portal-upload-pick">
              <span>Escolher arquivo</span>
              <input
                type="file"
                accept={PORTAL_ACCEPT}
                onChange={event => escolherArquivos(Array.from(event.target.files ?? []))}
              />
            </label>
          ) : (
            <div className="portal-bulk-pick">
              <label className="portal-bulk-button">
                Escolher arquivos
                <input
                  type="file"
                  multiple
                  accept={PORTAL_ACCEPT}
                  onChange={event => escolherArquivos(Array.from(event.target.files ?? []))}
                />
              </label>
              <label className="portal-bulk-button">
                Escolher pasta do computador
                <input
                  type="file"
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  onChange={event => escolherArquivos(Array.from(event.target.files ?? []))}
                />
              </label>
            </div>
          )}
          {arquivos.length > 0 ? (
            <p className="portal-upload-status ok" role="status">
              ✓ {arquivos.length} arquivo{arquivos.length === 1 ? "" : "s"} selecionado
              {arquivos.length === 1 ? "" : "s"} (
              {formatSize(arquivos.reduce((soma, file) => soma + file.size, 0))}).
              {arquivos.some(file => file.size > PORTAL_MAX_BYTES) ? " Há arquivo acima de 2 GB." : ""}
            </p>
          ) : null}
          {ignorados > 0 ? (
            <p className="portal-upload-status">
              {ignorados} arquivo{ignorados === 1 ? "" : "s"} de tipo não aceito {ignorados === 1 ? "foi ignorado" : "foram ignorados"}.
            </p>
          ) : null}
        </div>

        {modo === "material" ? (
          <>
            <div className="field-grid two">
              <label>
                Título
                <input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} />
              </label>
              <label>
                Categoria
                <select value={category} onChange={event => setCategory(event.target.value)}>
                  <option value="">Escolha</option>
                  {MATERIAL_CATEGORIES.map(item => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data de publicação
                <input type="date" value={publishedAt} onChange={event => setPublishedAt(event.target.value)} />
              </label>
            </div>
            <label className="wide-field">
              Descrição
              <textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} />
            </label>
          </>
        ) : (
          <>
            <div className="field-grid two">
              <label>
                Nome da pasta
                <input
                  value={pastaNome}
                  onChange={event => setPastaNome(event.target.value)}
                  maxLength={200}
                  placeholder="Ex.: Campanha de outubro"
                />
              </label>
              <label>
                Mês de referência
                <select value={pastaMes} onChange={event => setPastaMes(event.target.value)}>
                  {MONTH_NAMES.map((nome, indice) => (
                    <option key={nome} value={String(indice + 1)}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ano
                <input
                  type="number"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  value={pastaAno}
                  onChange={event => setPastaAno(event.target.value)}
                />
              </label>
            </div>
            <label className="wide-field">
              Descrição da pasta
              <textarea rows={2} value={pastaDescricao} onChange={event => setPastaDescricao(event.target.value)} />
            </label>
            <p className="portal-upload-status">
              Se a empresa já tiver uma pasta com o mesmo nome e mês, os arquivos entram nela em vez de
              criar outra.
            </p>
          </>
        )}

        <label className="check-row">
          <input type="checkbox" checked={visivel} onChange={event => setVisivel(event.target.checked)} />
          <span>
            Visível no portal do cliente
            {modo === "pasta" ? " (vale para pastas novas; uma pasta que já existe mantém a visibilidade dela)" : ""}
          </span>
        </label>
      </div>

      <div className="message-box">
        <div className="message-head">
          <span>②</span>
          <div>
            <strong>Para quais empresas</strong>
            <small>Marque só as que devem receber. Nenhuma vem marcada.</small>
          </div>
        </div>

        <div className="portal-pick-tools">
          <input
            type="search"
            className="tenant-search portal-pick-search"
            placeholder="Buscar empresa pelo nome ou documento…"
            aria-label="Buscar empresa"
            value={busca}
            onChange={event => setBusca(event.target.value)}
          />
          <button
            type="button"
            className="portal-secondary"
            onClick={() => setSelecionadas(atual => new Set([...atual, ...filtradas.map(empresa => empresa.id)]))}
          >
            Marcar as {busca ? "filtradas" : "todas"}
          </button>
          <button type="button" className="portal-secondary" onClick={() => setSelecionadas(new Set())}>
            Limpar
          </button>
        </div>

        <p className="portal-upload-status" role="status">
          <strong>{selecionadas.size}</strong> de {empresas.length} empresa{empresas.length === 1 ? "" : "s"} marcada
          {selecionadas.size === 1 ? "" : "s"}.
        </p>

        <ul className="portal-pick-list">
          {filtradas.map(empresa => (
            <li key={empresa.id}>
              <label className={selecionadas.has(empresa.id) ? "marcada" : ""}>
                <input
                  type="checkbox"
                  checked={selecionadas.has(empresa.id)}
                  onChange={() => alternar(empresa.id)}
                />
                <span>
                  <strong>{empresa.name}</strong>
                  {empresa.doc ? <small>{empresa.doc}</small> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {filtradas.length === 0 ? <p className="portal-upload-status">Nenhuma empresa encontrada.</p> : null}

        <button type="button" className="primary-button" disabled={!pronto} onClick={confirmarEPublicar}>
          Publicar em {selecionadas.size} empresa{selecionadas.size === 1 ? "" : "s"} <span>→</span>
        </button>
        {erroGeral ? <span className="field-error-message">{erroGeral}</span> : null}
        {!pronto ? (
          <small className="portal-upload-status">
            Falta: {arquivos.length === 0 ? "escolher o arquivo" : selecionadas.size === 0 ? "marcar ao menos uma empresa" : "preencher os dados acima"}.
          </small>
        ) : null}
        <small className="portal-upload-status">Versão da página: {versao}</small>
      </div>
    </>
  );
}
