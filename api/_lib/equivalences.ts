import { MAX_TERM, type Equivalence } from '../../src/types/equivalences.js';
import { normalizeTerm } from '../../src/lib/equivalence.js';
import { db, isUniqueViolation } from './db.js';
import { ApiError, invalid, notFound, text } from './http.js';

/** Com o produto como está agora no cadastro. */
const SELECT = `
  select e.id::text as id, e.term, e.brand, e.product_id::text as product_id,
         p.code as product_code, p.description as product_description, p.status as product_status
  from equivalences e join products p on p.id = e.product_id`;

function toEquivalence(row: Record<string, unknown>): Equivalence {
  return {
    id: row.id as string,
    term: row.term as string,
    productId: row.product_id as string,
    productCode: row.product_code as string,
    productDescription: row.product_description as string,
    productActive: row.product_status === 'Ativo',
    brand: row.brand as string,
  };
}

/** Em ordem alfabética do termo. */
export async function listEquivalences(): Promise<Equivalence[]> {
  const rows = await db().query(`${SELECT} order by lower(e.term), e.id`);
  return rows.map(toEquivalence);
}

export async function getEquivalence(id: string): Promise<Equivalence> {
  const rows = await db().query(`${SELECT} where e.id = $1`, [id]);
  if (!rows[0]) throw notFound('Equivalência');
  return toEquivalence(rows[0]);
}

async function readEquivalence(body: Record<string, unknown>) {
  const term = text(body, 'term', 'O termo', { min: 1, max: MAX_TERM });
  const productId = body.productId;
  if (typeof productId !== 'string' || !/^\d+$/.test(productId)) throw invalid('Escolha o produto.');
  const [product] = await db()`select id from products where id = ${productId}`;
  if (!product) throw invalid('Produto não encontrado.');
  return {
    term,
    // Chave da unicidade: o mesmo termo, escrito de outro jeito, não aponta duas vezes para o mesmo produto.
    normalized: normalizeTerm(term),
    productId,
    brand: text(body, 'brand', 'A marca', { max: 80 }),
  };
}

function duplicate(term: string) {
  return new ApiError(409, 'duplicate_equivalence', `"${term}" já aponta para este produto.`);
}

export async function createEquivalence(body: Record<string, unknown>): Promise<Equivalence> {
  const e = await readEquivalence(body);
  try {
    const [row] = await db()`
      insert into equivalences (term, normalized, product_id, brand)
      values (${e.term}, ${e.normalized}, ${e.productId}, ${e.brand})
      returning id::text as id`;
    return getEquivalence(row!.id as string);
  } catch (error) {
    if (isUniqueViolation(error, 'equivalences_term_key')) throw duplicate(e.term);
    throw error;
  }
}

export async function updateEquivalence(id: string, body: Record<string, unknown>): Promise<Equivalence> {
  const e = await readEquivalence(body);
  try {
    const rows = await db()`
      update equivalences set term = ${e.term}, normalized = ${e.normalized}, product_id = ${e.productId},
        brand = ${e.brand}
      where id = ${id} returning id`;
    if (!rows[0]) throw notFound('Equivalência');
  } catch (error) {
    if (isUniqueViolation(error, 'equivalences_term_key')) throw duplicate(e.term);
    throw error;
  }
  return getEquivalence(id);
}

export async function deleteEquivalence(id: string): Promise<void> {
  const rows = await db()`delete from equivalences where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Equivalência');
}
