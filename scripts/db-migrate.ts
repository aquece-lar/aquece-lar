/**
 * Cria as tabelas no Postgres de DATABASE_URL (idempotente). A API também faz
 * isso sozinha no primeiro acesso depois de um deploy (api/_lib/migrate.ts).
 *   npm run db:migrate
 */
import { ensureSchema } from '../api/_lib/migrate.js';
import { SCHEMA } from '../api/_lib/schema.js';

await ensureSchema();
console.log(`Esquema em dia (${SCHEMA.length} comandos).`);
