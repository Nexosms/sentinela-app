# Roteiro de entrega

Passos que **não** dá para fazer por migração — precisam do painel do Supabase ou de decisão
do cliente. Faça na ordem.

## 1. Limpar os dados de teste

Rode `scripts/limpeza-pre-entrega.sql` no SQL Editor, bloco a bloco.

Antes do bloco 3, copie a lista de `storage_path` que o bloco 2 imprime e apague esses objetos
em **Storage → evidence**. Apagar a linha do banco não apaga o arquivo; sem isso o bucket fica
com evidências órfãs de relatos que não existem mais.

Dados de teste conhecidos até o fim da Fase 4:

| O que | Identificador |
|---|---|
| Relatos | `NF53-VVZP-Z4MT`, `KA5V-6FGY-TY4P`, `H2MJ-5XM0-5FFQ` |
| Evidências | 3 arquivos `prova-teste*` no bucket `evidence` |
| Usuário | `teste.admin@sentinela.local` (senha `SenhaDeTeste!2026`) |

## 2. Fechar o cadastro aberto

**Authentication → Providers → Email**: desligue **Enable signup**.

O sistema é por convite. Enquanto o signup estiver aberto, qualquer pessoa cria conta — e
embora a RLS a deixe sem acesso a nada (sem vínculo em `org_members` ela cai em `/sem-acesso`),
é superfície que não precisa existir.

## 3. Ligar a proteção de senha vazada

**Authentication → Policies**: ligue **Leaked Password Protection**. É o único alerta de
segurança que o `get_advisors` ainda acusa, e só se resolve pelo painel.

## 4. Criar o primeiro administrador de verdade

**Não** insira em `auth.users` por SQL. Use a Admin API (`inviteUserByEmail`) ou
**Authentication → Users → Invite**.

Armadilha já paga: uma linha inserida à mão deixa `confirmation_token`, `recovery_token`,
`email_change_token_new` e `email_change` como `NULL`, e o GoTrue quebra o login inteiro com
`Database error querying schema` — o Go não converte `NULL` em `string`. Se precisar corrigir
uma linha existente, `update auth.users set confirmation_token = '' ...` (string vazia, não nulo).

> **Não há tela de convite ainda** (a rota `/api/admin/invites` é da Fase 7). Todo
> usuário novo, inclusive o segundo e o terceiro da equipe, entra pelo painel do
> Supabase e recebe o vínculo por SQL, como abaixo.

Depois de criar o usuário, dê-lhe o vínculo:

```sql
insert into public.org_members (user_id, org_id, role, status)
select u.id, o.id, 'admin', 'active'
  from auth.users u, public.organizations o
 where u.email = 'quem-vai-administrar@empresa.com.br';
```

## 5. Preencher os dados da empresa

> **A tela de Configurações ainda não existe** — é placeholder até a Fase 7. Hoje a
> organização está semeada como `legal_name = 'Razão social a definir'` e
> `trade_name = 'Organização'`, e esse nome aparece na barra lateral do painel. **Não
> entregue assim.** Até a tela existir, corrija por SQL:

```sql
update public.organizations
   set legal_name      = 'RAZÃO SOCIAL COMPLETA LTDA',
       trade_name      = 'Nome que aparece no painel',
       cnpj            = '00000000000000',
       sla_triagem_hours  = 72,    -- prazo para a primeira análise
       sla_apuracao_hours = 720,   -- prazo para concluir a apuração
       retention_months   = 60,    -- retenção de casos encerrados
       min_cell_size      = 5      -- supressão de célula pequena nos relatórios
 where slug = 'sentinela';

-- unidades: veja o que existe antes de mexer
select id, name, city, state from public.org_units;
```

`min_cell_size` merece atenção: é o limiar abaixo do qual um relatório esconde a
célula. Com 5, uma unidade com menos de 5 casos aparece como "—". Baixar esse número
aumenta o risco de reidentificar quem denunciou.

## 6. Variáveis de ambiente na Vercel

Copie de `.env.example`. Três precisam ser **geradas novas para produção**, e trocá-las depois
invalida o que já existe:

| Variável | Consequência de trocar depois |
|---|---|
| `REPORT_SECRET_PEPPER` | **toda chave de acompanhamento já entregue para de funcionar** |
| `IP_HASH_PEPPER` | os baldes de rate limit zeram (aceitável) |
| `REPORTER_SESSION_SECRET` | derruba as sessões de acompanhamento abertas (aceitável) |

`CRON_SECRET` protege as rotas de cron; use o mesmo valor no `vercel.json`.

## 7. Alertas de advisor que são intencionais

`get_advisors` acusa três coisas que **devem** continuar como estão — estão explicadas no
README, não "conserte" sem ler:

- `get_report_catalog` executável por `anon` — é o que mantém o service role fora da
  renderização da página pública.
- `verify_audit_chain` executável por `authenticated` — tem guarda de papel interna.
- `multiple_permissive_policies` em `profiles` — são as políticas `self` e `colleagues`,
  deliberadamente separadas.
