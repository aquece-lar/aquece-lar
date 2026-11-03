/**
 * Cria as tabelas no Postgres de DATABASE_URL (idempotente).
 *   npm run db:migrate
 */
import { db } from '../api/_lib/db.js';
import { SCHEMA } from '../api/_lib/schema.js';

for (const statement of SCHEMA) {
  await db().query(statement);
}
console.log(`Esquema aplicado (${SCHEMA.length} comandos).`);
