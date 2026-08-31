import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Alfabeto base32 seguro para transcrição manual: sem I, L, O, U.
 * Igual ao usado por `app.random_code` no Postgres.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";

/** Parâmetros do KDF. Gravados junto do hash para permitir rehash-on-verify. */
const KDF = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

/**
 * Sorteia `n` caracteres do alfabeto sem viés de módulo.
 * 256 % 32 === 0, então `byte % 32` já seria uniforme; a rejeição fica como
 * proteção caso o alfabeto mude de tamanho um dia.
 */
function randomChars(n: number): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < n) {
    for (const byte of randomBytes(n * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === n) break;
    }
  }
  return out;
}

/**
 * Chave de acompanhamento: SEN-XXXXX-XXXXX-XXXXX.
 * 15 caracteres de um alfabeto de 32 = 75 bits.
 *
 * O protótipo gerava `SEN-` + 6 hexadecimais NO NAVEGADOR — 2^24 ≈ 16,7
 * milhões, força bruta trivial. Agora é gerada no servidor.
 */
export function generateSecret(): string {
  return `SEN-${randomChars(5)}-${randomChars(5)}-${randomChars(5)}`;
}

/**
 * Normaliza o que a pessoa digitou: maiúsculas, sem espaço nem hífen, e sem o
 * prefixo SEN. Quem retranscreve do comprovante sem os hífens continua entrando.
 */
export function normalizeSecret(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^SEN/, "");
}

function pepper(): string {
  const value = process.env.REPORT_SECRET_PEPPER;
  if (!value) throw new Error("REPORT_SECRET_PEPPER ausente. Ver .env.example.");
  return value;
}

/** Formato: scrypt$N=32768,r=8,p=1$<salt_b64>$<hash_b64> */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(normalizeSecret(secret) + pepper(), salt, KDF.keylen, KDF);
  return `scrypt$N=${KDF.N},r=${KDF.r},p=${KDF.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Comparação em tempo constante. Nunca lança por hash malformado: devolve
 * false, para que a rota de consulta trate tudo com a mesma resposta.
 */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  try {
    const [algo, params, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt") return false;
    const parsed = Object.fromEntries(
      params.split(",").map(pair => pair.split("=") as [string, string]),
    );
    const derived = await scrypt(
      normalizeSecret(secret) + pepper(),
      Buffer.from(saltB64, "base64"),
      Buffer.from(hashB64, "base64").length,
      {
        N: Number(parsed.N),
        r: Number(parsed.r),
        p: Number(parsed.p),
        maxmem: KDF.maxmem,
      },
    );
    const expected = Buffer.from(hashB64, "base64");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Hash descartável, contra um segredo fixo, para queimar o mesmo tempo de CPU
 * quando o protocolo não existe. Sem isto a latência da resposta denuncia
 * quais protocolos são reais.
 */
const DUMMY_HASH =
  "scrypt$N=32768,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  Buffer.alloc(64).toString("base64");

export async function burnVerifyTime(): Promise<void> {
  await verifySecret("SEN-00000-00000-00000", DUMMY_HASH);
}
