import { defineConfig } from "@playwright/test";

/**
 * Testes de API do canal público. Rodam contra o `next dev` real e o Supabase
 * real: o que precisa ser provado aqui (nota interna que não vaza, 401 idêntico
 * para protocolo inexistente e chave errada) depende do banco de verdade, e um
 * mock só provaria que o mock está certo. Exigem `.env.local` preenchido.
 *
 * O Next 16 recusa um segundo `next dev` no mesmo diretório, então o padrão é
 * REUTILIZAR o servidor que já estiver de pé em :3000. Para apontar para outra
 * porta, `E2E_BASE_URL=http://localhost:3200 npm test`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
