import type { Access } from '../../src/types/auth';
import type { Customer, CustomerKind } from '../../src/types/people';
import { onlyOwn } from '../../src/lib/access.js';
import { forbidden } from './auth.js';
import { db, iso, num } from './db.js';
import { ApiError, invalid, notFound, oneOf, text } from './http.js';
import { sellerIdByName } from './sellers.js';

const KINDS: readonly CustomerKind[] = ['PF', 'PJ'];

/** Clientes com o nome do vendedor responsável, total de orçamentos e data do último. */
const SELECT = `
  select c.id::text as id, c.name, c.kind, c.document, c.phone, c.city,
         coalesce(s.name, '') as seller, count(q.id) as quotes, max(q.created_at) as last_quote_at
  from customers c
  left join sellers s on s.id = c.seller_id
  left join quotes q on q.customer_id = c.id`;

function toCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as CustomerKind,
    document: row.document as string,
    phone: row.phone as string,
    city: row.city as string,
    seller: row.seller as string,
    quotes: num(row.quotes),
    lastQuoteAt: row.last_quote_at ? iso(row.last_quote_at) : null,
  };
}

/** Vendedor que só vê o que é dele recebe só os clientes ligados ao seu cadastro. */
export async function listCustomers(access: Access): Promise<Customer[]> {
  const own = onlyOwn(access) ? (access.sellerId ?? '0') : null;
  const rows = await db().query(
    `${SELECT} where ($1::bigint is null or c.seller_id = $1::bigint)
     group by c.id, s.name order by c.created_at desc, c.id`,
    [own],
  );
  return rows.map(toCustomer);
}

/** Vendedor responsável pelo cliente (id), ou `null`. */
export async function customerSellerId(id: string): Promise<string | null> {
  const [row] = await db()`select seller_id::text as seller_id from customers where id = ${id}`;
  return (row?.seller_id as string | null | undefined) ?? null;
}

async function getCustomer(id: string): Promise<Customer> {
  const rows = await db().query(`${SELECT} where c.id = $1 group by c.id, s.name`, [id]);
  if (!rows[0]) throw notFound('Cliente');
  return toCustomer(rows[0]);
}

async function readCustomer(body: Record<string, unknown>, access: Access) {
  const kind = oneOf(body, 'kind', 'Tipo de cliente inválido.', KINDS);
  const document = text(body, 'document', 'O documento', { max: 30 });
  const digits = document.replace(/\D/g, '').length;
  if (digits > 0 && digits !== (kind === 'PJ' ? 14 : 11)) {
    throw invalid(kind === 'PJ' ? 'O CNPJ deve ter 14 dígitos.' : 'O CPF deve ter 11 dígitos.');
  }
  const sellerName = text(body, 'seller', 'O vendedor', { max: 120 });
  // O vendedor cadastra clientes sempre no próprio nome.
  const sellerId = access.role === 'Vendedor' ? access.sellerId : await sellerIdByName(sellerName);
  if (sellerName && !sellerId) throw invalid('Vendedor não encontrado.');
  return {
    name: text(body, 'name', 'O nome', { min: 3, max: 160 }),
    kind,
    document,
    phone: text(body, 'phone', 'O telefone', { max: 30 }),
    city: text(body, 'city', 'A cidade', { max: 80 }),
    sellerId,
  };
}

export async function createCustomer(body: Record<string, unknown>, access: Access): Promise<Customer> {
  const c = await readCustomer(body, access);
  const [row] = await db()`
    insert into customers (name, kind, document, phone, city, seller_id)
    values (${c.name}, ${c.kind}, ${c.document}, ${c.phone}, ${c.city}, ${c.sellerId})
    returning id::text as id`;
  return getCustomer(row!.id as string);
}

export async function updateCustomer(id: string, body: Record<string, unknown>, access: Access): Promise<Customer> {
  if (access.role === 'Vendedor' && (await customerSellerId(id)) !== access.sellerId) {
    throw forbidden('Este cliente é de outro vendedor.');
  }
  const c = await readCustomer(body, access);
  const rows = await db()`
    update customers set name = ${c.name}, kind = ${c.kind}, document = ${c.document}, phone = ${c.phone},
      city = ${c.city}, seller_id = ${c.sellerId}
    where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Cliente');
  return getCustomer(id);
}

export async function deleteCustomer(id: string): Promise<void> {
  const [used] = await db()`select exists (select 1 from quotes where customer_id = ${id}) as used`;
  if (used?.used) throw new ApiError(409, 'customer_in_use', 'Este cliente tem orçamentos e não pode ser excluído.');
  const rows = await db()`delete from customers where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Cliente');
}

/** Id do cliente pelo nome (o orçamento ainda referencia por nome); `null` se não houver. */
export async function customerIdByName(name: string): Promise<string | null> {
  const [row] = await db()`select id::text as id from customers where name = ${name} order by id limit 1`;
  return (row?.id as string | undefined) ?? null;
}
