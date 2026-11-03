import { createHash } from 'node:crypto';
import { db } from './db.js';
import { SCHEMA } from './schema.js';

/** Muda sempre que o SCHEMA muda: é o que diz se o banco já está em dia. */
const VERSION = createHash('sha256').update(SCHEMA.join('\n;\n')).digest('hex').slice(0, 16);

let ready: Promise<void> | null = null;

/**
 * Aplica o SCHEMA (idempotente) uma vez por instância da função, e só se o
 * banco ainda não estiver nesta versão. Assim um deploy com colunas novas não
 * depende de alguém lembrar do `npm run db:migrate`. Nos acessos seguintes,
 * custa uma consulta na primeira chamada de cada instância.
 */
export function ensureSchema(): Promise<void> {
  ready ??= apply().catch((error: unknown) => {
    // Falhou (ex.: duas instâncias alterando juntas): a próxima chamada tenta de novo.
    ready = null;
    throw error;
  });
  return ready;
}

async function apply(): Promise<void> {
  try {
    const [row] = await db()`select version from schema_meta where id = 1`;
    if (row?.version === VERSION) return;
  } catch {
    // Banco anterior a este controle: ainda sem a tabela schema_meta.
  }
  for (const statement of SCHEMA) await db().query(statement);
  await db()`create table if not exists schema_meta (id smallint primary key check (id = 1), version text not null)`;
  await db()`
    insert into schema_meta (id, version) values (1, ${VERSION})
    on conflict (id) do update set version = excluded.version`;
}
