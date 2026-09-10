import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Protótipo Cloudflare, mantido só como referência do JSX durante o porte.
    "_legacy/**",
  ]),
  // O service role nunca pode sair de onde é permitido (ver plano, §Clientes Supabase).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/supabase/admin.ts",
      "src/app/api/public/**",
      "src/app/api/cron/**",
      "src/app/api/admin/invites/**",
      // Assinatura de URL do bucket privado `evidence`: a autorização já foi
      // provada pela RLS (open_evidence) e a trilha já foi gravada antes de a
      // chave entrar em cena. Ver o comentário no topo da rota.
      "src/app/api/admin/evidence/**",
      // Cadastro de empresa-cliente: criar organização e o primeiro
      // `org_members` dela é bootstrapping — não existe ainda org_id nem
      // admin para a RLS autorizar. Ver o comentário no topo de
      // admin/clientes/actions.ts.
      "src/app/admin/clientes/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/supabase/admin", "@/lib/supabase/admin"],
              message:
                "O cliente service-role só pode ser importado em api/public/**, api/cron/**, api/admin/invites e api/admin/evidence. Use @/lib/supabase/server (sob RLS).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
