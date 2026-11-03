import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

/** Conexão HTTP com o Postgres (Neon) da integração da Vercel: `DATABASE_URL`. */
export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não definida.');
    client = neon(url);
  }
  return client;
}

/** Fuso do negócio: o "dia" de um orçamento é o dia em São Paulo. */
export const TZ = 'America/Sao_Paulo';

/** Dinheiro e números do Postgres chegam como texto; a API devolve número. */
export function num(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function iso(value: unknown): string {
  return new Date(value as string | Date).toISOString();
}

/** Código de violação de unicidade do Postgres. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint?: string };
  return e?.code === '23505' && (!constraint || e.constraint === constraint);
}
