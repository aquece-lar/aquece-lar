import type { Access } from '../../src/types/auth';
import type { Seller, SellerStatus } from '../../src/types/people';
import { onlyOwn } from '../../src/lib/access.js';
import { db, num, TZ } from './db.js';
import { ApiError, invalid, money, notFound, oneOf, text } from './http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: readonly SellerStatus[] = ['Ativo', 'Inativo'];

/** Vendedores com orçamentos e valor do mês corrente (em São Paulo). */
const SELECT = `
  select s.id::text as id, s.name, s.email, s.phone, s.region, s.status, s.monthly_goal,
         count(q.id) as quotes, coalesce(sum(q.amount), 0) as amount
  from sellers s
  left join quotes q on q.seller_id = s.id
    and date_trunc('month', q.created_at at time zone '${TZ}') = date_trunc('month', now() at time zone '${TZ}')`;

function toSeller(row: Record<string, unknown>): Seller {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string,
    region: row.region as string,
    status: row.status as SellerStatus,
    monthlyGoal: row.monthly_goal === null ? null : num(row.monthly_goal),
    quotes: num(row.quotes),
    amount: num(row.amount),
  };
}

/** Vendedor que só vê o que é dele recebe só o próprio cadastro (metas e valores são de cada um). */
export async function listSellers(access: Access): Promise<Seller[]> {
  const own = onlyOwn(access) ? (access.sellerId ?? '0') : null;
  const rows = await db().query(
    `${SELECT} where ($1::bigint is null or s.id = $1::bigint) group by s.id order by s.created_at desc, s.id`,
    [own],
  );
  return rows.map(toSeller);
}

async function getSeller(id: string): Promise<Seller> {
  const rows = await db().query(`${SELECT} where s.id = $1 group by s.id`, [id]);
  if (!rows[0]) throw notFound('Vendedor');
  return toSeller(rows[0]);
}

function readSeller(body: Record<string, unknown>) {
  const email = text(body, 'email', 'O e-mail', { min: 1, max: 160 });
  if (!EMAIL.test(email)) throw invalid('Informe um e-mail válido.');
  return {
    name: text(body, 'name', 'O nome', { min: 3, max: 120 }),
    email,
    phone: text(body, 'phone', 'O telefone', { max: 30 }),
    region: text(body, 'region', 'A região', { max: 80 }),
    status: oneOf(body, 'status', 'Status inválido.', STATUSES),
    monthlyGoal: money(body.monthlyGoal ?? null, 'A meta mensal', { nullable: true }),
  };
}

export async function createSeller(body: Record<string, unknown>): Promise<Seller> {
  const s = readSeller(body);
  const [row] = await db()`
    insert into sellers (name, email, phone, region, status, monthly_goal)
    values (${s.name}, ${s.email}, ${s.phone}, ${s.region}, ${s.status}, ${s.monthlyGoal})
    returning id::text as id`;
  return getSeller(row!.id as string);
}

export async function updateSeller(id: string, body: Record<string, unknown>): Promise<Seller> {
  const s = readSeller(body);
  const rows = await db()`
    update sellers set name = ${s.name}, email = ${s.email}, phone = ${s.phone}, region = ${s.region},
      status = ${s.status}, monthly_goal = ${s.monthlyGoal}
    where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Vendedor');
  return getSeller(id);
}

export async function deleteSeller(id: string): Promise<void> {
  const [used] = await db()`select exists (select 1 from quotes where seller_id = ${id}) as used`;
  if (used?.used) throw new ApiError(409, 'seller_in_use', 'Este vendedor tem orçamentos. Inative-o em vez de excluir.');
  const rows = await db()`delete from sellers where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Vendedor');
}

/** Id do vendedor pelo nome (o front ainda referencia por nome); `null` se não houver. */
export async function sellerIdByName(name: string): Promise<string | null> {
  if (!name) return null;
  const [row] = await db()`select id::text as id from sellers where name = ${name} order by id limit 1`;
  return (row?.id as string | undefined) ?? null;
}
