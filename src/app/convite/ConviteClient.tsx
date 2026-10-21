"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

/**
 * Primeiro acesso pelo link de convite.
 *
 * Três formatos de link precisam funcionar, porque o Supabase usa um ou outro
 * conforme o template de e-mail e a versão do GoTrue:
 *
 *  1. `#access_token=…&refresh_token=…`  — fluxo implícito, o padrão de um link
 *     gerado pelo servidor. O fragmento NUNCA chega ao servidor, e é por isso
 *     que esta tela é cliente.
 *  2. `?token_hash=…&type=invite|recovery` — template novo, verificado aqui.
 *  3. `?code=…` — PKCE.
 *
 * Depois da sessão, a senha: o login deste painel é por e-mail e senha
 * (`signInWithPassword`), então uma pessoa que entrasse só pelo link ficaria
 * sem como voltar amanhã.
 *
 * Por último a ativação do vínculo (`/api/admin/invites/accept`), que é o que
 * tira a pessoa de /sem-acesso. Ver o comentário daquela rota para o porquê de
 * a ativação ser no primeiro acesso e não na mão do administrador.
 *
 * `modo="redefinicao"` serve a /redefinir-senha ("esqueci minha senha"): o
 * mesmo link e o mesmo formulário, mas SEM a ativação do vínculo — redefinir a
 * senha não concede acesso a ninguém — e, depois de salvar, encerra as outras
 * sessões da conta.
 */

const MIN_SENHA = 10;

type Fase = "verificando" | "senha" | "salvando" | "erro";

export default function ConviteClient({ modo = "convite" }: { modo?: "convite" | "redefinicao" }) {
  const redefinicao = modo === "redefinicao";
  const caminho = redefinicao ? "/redefinir-senha" : "/convite";
  const pedirOutro = redefinicao
    ? "Links de redefinição valem por tempo limitado e servem uma vez só — peça um novo em “Esqueci minha senha”."
    : "Links de convite valem por tempo limitado e servem uma vez só — peça um novo a quem administra o canal.";
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("verificando");
  const [erro, setErro] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const rodou = useRef(false);

  useEffect(() => {
    // O React 19 monta duas vezes em desenvolvimento; consumir o token duas
    // vezes falharia na segunda, porque ele serve uma vez só.
    if (rodou.current) return;
    rodou.current = true;

    void (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      const erroDoLink = hash.get("error_description") ?? url.searchParams.get("error_description");
      if (erroDoLink) {
        setErro(`O link não pôde ser usado: ${erroDoLink}. ${pedirOutro}`);
        setFase("erro");
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const tokenHash = url.searchParams.get("token_hash");
      const tipo = url.searchParams.get("type");
      const code = url.searchParams.get("code");

      let falha: string | null = null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        falha = error?.message ?? null;
      } else if (tokenHash && (tipo === "invite" || tipo === "recovery" || tipo === "magiclink")) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
        falha = error?.message ?? null;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        falha = error?.message ?? null;
      } else {
        // Sem token nenhum: ou a pessoa digitou a URL, ou já tem sessão viva.
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          setErro(
            redefinicao
              ? "Este endereço só funciona a partir do link enviado por e-mail. Peça um novo em “Esqueci minha senha”."
              : "Este endereço só funciona a partir do link de convite. Se você já tem senha, entre pela tela de acesso.",
          );
          setFase("erro");
          return;
        }
      }

      if (falha) {
        setErro(`O link não pôde ser usado: ${falha}. ${pedirOutro}`);
        setFase("erro");
        return;
      }

      // O token não pode ficar no histórico do navegador nem no `Referer`.
      window.history.replaceState(null, "", caminho);

      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      setFase("senha");
    })();
    // `modo` é fixo por página e o efeito consome um token de uso único: roda uma vez só (ver `rodou`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function definirSenha(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const senha = String(formData.get("password") ?? "");
    const confirmacao = String(formData.get("confirm") ?? "");

    if (senha.length < MIN_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setErro("");
    setFase("salvando");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro(`Não foi possível salvar a senha: ${error.message}`);
      setFase("senha");
      return;
    }

    if (redefinicao) {
      // Quem tinha uma sessão aberta com a senha antiga (ou a roubou) perde o acesso.
      await supabase.auth.signOut({ scope: "others" });
      router.replace("/admin");
      router.refresh();
      return;
    }

    // Ativa o vínculo. Um erro aqui não invalida a senha já salva: a pessoa
    // entra e cai em /sem-acesso, onde a instrução é procurar o administrador.
    const resposta = await fetch("/api/admin/invites/accept", { method: "POST" });
    if (!resposta.ok) {
      setErro(
        "A senha foi salva, mas o seu acesso ainda não pôde ser liberado. Avise quem administra o canal — a liberação leva um clique na tela de Equipe.",
      );
      setFase("senha");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <section className="track-card">
      <span className="section-kicker">{redefinicao ? "REDEFINIÇÃO DE SENHA" : "CONVITE"}</span>
      <h1>{redefinicao ? "Crie uma nova senha." : "Defina a sua senha."}</h1>

      {fase === "verificando" ? (
        <p>{redefinicao ? "Conferindo o link…" : "Conferindo o link do convite…"}</p>
      ) : fase === "erro" ? (
        <>
          <div className="form-error">{erro}</div>
          <p>
            <Link className="quiet-link" href={redefinicao ? "/esqueci-senha" : "/login"}>
              {redefinicao ? "Pedir um novo link" : "Ir para a tela de acesso"}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p>
            {redefinicao ? (
              <>
                {email ? (
                  <>
                    Conta <strong>{email}</strong>.{" "}
                  </>
                ) : null}
                Escolha uma nova senha para entrar no painel. As outras sessões abertas com a senha
                antiga serão encerradas.
              </>
            ) : (
              <>
                {email ? (
                  <>
                    Você foi convidado como <strong>{email}</strong>.{" "}
                  </>
                ) : null}
                Defina uma senha para entrar no painel. É por ela que você volta nas próximas vezes — o
                link do convite serve uma vez só.
              </>
            )}
          </p>
          <div className="privacy-note">
            <b>O que você vai ver do outro lado</b>
            <p>
              O painel contém denúncias reais, com relatos de assédio e dados de quem trabalha na
              organização. Use uma senha longa e exclusiva, e não a compartilhe: cada acesso a dado
              identificável fica registrado na trilha de auditoria com o seu nome.
            </p>
          </div>
          <form onSubmit={definirSenha}>
            <label>
              Nova senha
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_SENHA}
                required
              />
            </label>
            <label>
              Repita a senha
              <input name="confirm" type="password" autoComplete="new-password" required />
            </label>
            {erro ? <div className="form-error">{erro}</div> : null}
            <button className="primary-button" type="submit" disabled={fase === "salvando"}>
              {fase === "salvando" ? "Salvando…" : redefinicao ? "Salvar nova senha e entrar" : "Definir senha e entrar"} <span>→</span>
            </button>
          </form>
        </>
      )}
    </section>
  );
}
