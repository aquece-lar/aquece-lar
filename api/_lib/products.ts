import type { Product, ProductCategory, ProductStatus } from '../../src/types/products';
import { db, isUniqueViolation, num } from './db.js';
import { ApiError, invalid, money, notFound, oneOf, text } from './http.js';

const CATEGORIES: readonly ProductCategory[] = ['Aquecedores a gás', 'Boilers', 'Lareiras', 'Piscina', 'Acessórios', 'Serviços'];
const STATUSES: readonly ProductStatus[] = ['Ativo', 'Inativo'];
const MAX_PHOTOS = 8;

const SELECT = `select id::text as id, code, description, category, unit_price, status, photos from products`;

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    code: row.code as string,
    description: row.description as string,
    category: row.category as ProductCategory,
    unitPrice: num(row.unit_price),
    status: row.status as ProductStatus,
    photos: row.photos as string[],
  };
}

/** Ativos primeiro (novos no topo), depois os inativos (recém-inativados no fim). */
export async function listProducts(): Promise<Product[]> {
  const rows = await db().query(
    `${SELECT} order by status = 'Inativo', case when status = 'Ativo' then created_at end desc, inactivated_at, id`,
  );
  return rows.map(toProduct);
}

export async function getProduct(id: string): Promise<Product> {
  const rows = await db().query(`${SELECT} where id = $1`, [id]);
  if (!rows[0]) throw notFound('Produto');
  return toProduct(rows[0]);
}

function readProduct(body: Record<string, unknown>) {
  const photos = body.photos ?? [];
  if (!Array.isArray(photos) || photos.some((p) => typeof p !== 'string') || photos.length > MAX_PHOTOS) {
    throw invalid(`Envie no máximo ${MAX_PHOTOS} fotos.`);
  }
  return {
    code: text(body, 'code', 'O código', { min: 1, max: 40 }).toUpperCase(),
    description: text(body, 'description', 'A descrição', { min: 3, max: 200 }),
    category: oneOf(body, 'category', 'Categoria inválida.', CATEGORIES),
    unitPrice: money(body.unitPrice, 'O preço')!,
    status: oneOf(body, 'status', 'Status inválido.', STATUSES),
    photos: JSON.stringify(photos),
  };
}

function duplicate(code: string) {
  return new ApiError(409, 'duplicate_product_code', `Já existe um produto com o código ${code}.`);
}

export async function createProduct(body: Record<string, unknown>): Promise<Product> {
  const p = readProduct(body);
  try {
    const [row] = await db()`
      insert into products (code, description, category, unit_price, status, photos, inactivated_at)
      values (${p.code}, ${p.description}, ${p.category}, ${p.unitPrice}, ${p.status}, ${p.photos}::jsonb,
        case when ${p.status} = 'Inativo' then now() end)
      returning id::text as id`;
    return getProduct(row!.id as string);
  } catch (error) {
    if (isUniqueViolation(error, 'products_code_key')) throw duplicate(p.code);
    throw error;
  }
}

export async function updateProduct(id: string, body: Record<string, unknown>): Promise<Product> {
  const p = readProduct(body);
  try {
    // inactivated_at marca quando ficou inativo (vai para o fim da lista); some ao reativar.
    const rows = await db()`
      update products set code = ${p.code}, description = ${p.description}, category = ${p.category},
        unit_price = ${p.unitPrice}, photos = ${p.photos}::jsonb,
        inactivated_at = case when ${p.status} = 'Ativo' then null
                              when status = 'Inativo' then inactivated_at else now() end,
        status = ${p.status}
      where id = ${id} returning id`;
    if (!rows[0]) throw notFound('Produto');
  } catch (error) {
    if (isUniqueViolation(error, 'products_code_key')) throw duplicate(p.code);
    throw error;
  }
  return getProduct(id);
}

/** Orçamentos guardam cópia dos itens, então excluir um produto não os afeta. */
export async function deleteProduct(id: string): Promise<void> {
  const rows = await db()`delete from products where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Produto');
}
