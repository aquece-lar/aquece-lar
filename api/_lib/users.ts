import { ROLES, type Role } from '../../src/types/auth.js';
import { MIN_PASSWORD, type User } from '../../src/types/users.js';
import { ACCESS_COLUMNS, ACCESS_JOIN, hashPassword, toAccess, type Caller } from './auth.js';
import { db, iso, isUniqueViolation } from './db.js';
import { ApiError, invalid, notFound, oneOf, text } from './http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toUser(row: Record<string, unknown>, me: Caller): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    createdAt: iso(row.created_at),
    lastLoginAt: row.last_login_at ? iso(row.last_login_at) : null,
    isCurrent: row.id === me.id,
    ...toAccess(row),
  };
}

const SELECT = `select u.id::text as id, u.name, u.email, u.created_at, u.last_login_at, ${ACCESS_COLUMNS}
  from users u ${ACCESS_JOIN}`;

export async function listUsers(me: Caller): Promise<User[]> {
  const rows = await db().query(`${SELECT} order by lower(u.name), u.id`);
  return rows.map((row) => toUser(row, me));
}

async function getUser(id: string, me: Caller): Promise<User> {
  const rows = await db().query(`${SELECT} where u.id = $1`, [id]);
  if (!rows[0]) throw notFound('Usuário');
  return toUser(rows[0], me);
}

/**
 * Na criação a senha é obrigatória; na edição, vazia mantém a atual. O vendedor
 * precisa estar ligado a um cadastro de vendedor; nos outros perfis, as
 * permissões de vendedor ficam desligadas (eles já veem tudo).
 */
async function readUser(body: Record<string, unknown>, requirePassword: boolean) {
  const email = text(body, 'email', 'O e-mail', { min: 1, max: 160 });
  if (!EMAIL.test(email)) throw invalid('Informe um e-mail válido.');
  const password = typeof body.password === 'string' ? body.password : '';
  if ((requirePassword || password) && password.length < MIN_PASSWORD) {
    throw invalid(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  }
  if (password.length > 128) throw invalid('A senha pode ter no máximo 128 caracteres.');
  const role = oneOf(body, 'role', 'Perfil inválido.', ROLES);
  const isSeller = role === 'Vendedor';
  let sellerId: string | null = null;
  if (isSeller) {
    const raw = body.sellerId;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw invalid('Escolha o vendedor ligado a este usuário.');
    const [seller] = await db()`select id::text as id from sellers where id = ${raw}`;
    if (!seller) throw invalid('Vendedor não encontrado.');
    sellerId = seller.id as string;
  }
  return {
    name: text(body, 'name', 'O nome', { min: 3, max: 120 }),
    email,
    password,
    role,
    sellerId,
    seeAll: isSeller && body.seeAll === true,
    exceedDiscount: isSeller && body.exceedDiscount === true,
  };
}

function duplicate(email: string) {
  return new ApiError(409, 'duplicate_email', `Já existe um usuário com o e-mail ${email}.`);
}

/** Sempre sobra ao menos um administrador: sem ele, ninguém mexe em usuários e configurações. */
async function ensureAnotherAdmin(id: string): Promise<void> {
  const [row] = await db()`select count(*)::int as n from users where role = 'Administrador' and id <> ${id}`;
  if (!row || (row.n as number) === 0) {
    throw new ApiError(409, 'last_admin', 'É preciso manter ao menos um administrador.');
  }
}

export async function createUser(body: Record<string, unknown>, me: Caller): Promise<User> {
  const u = await readUser(body, true);
  try {
    const [row] = await db()`
      insert into users (name, email, password_hash, role, seller_id, see_all, exceed_discount)
      values (${u.name}, ${u.email}, ${await hashPassword(u.password)}, ${u.role}, ${u.sellerId}, ${u.seeAll},
        ${u.exceedDiscount})
      returning id::text as id`;
    return getUser(row!.id as string, me);
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_key')) throw duplicate(u.email);
    throw error;
  }
}

export async function updateUser(id: string, body: Record<string, unknown>, me: Caller): Promise<User> {
  const u = await readUser(body, false);
  const [current] = await db()`select role from users where id = ${id}`;
  if (!current) throw notFound('Usuário');
  if (id === me.id && u.role !== me.access.role) {
    throw new ApiError(409, 'cannot_change_own_role', 'Você não pode mudar o seu próprio perfil.');
  }
  if ((current.role as Role) === 'Administrador' && u.role !== 'Administrador') await ensureAnotherAdmin(id);
  try {
    const rows = await db()`
      update users set name = ${u.name}, email = ${u.email}, role = ${u.role}, seller_id = ${u.sellerId},
        see_all = ${u.seeAll}, exceed_discount = ${u.exceedDiscount}
      where id = ${id} returning id`;
    if (!rows[0]) throw notFound('Usuário');
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_key')) throw duplicate(u.email);
    throw error;
  }
  if (u.password) {
    await db()`update users set password_hash = ${await hashPassword(u.password)} where id = ${id}`;
    // Senha nova derruba as sessões abertas, menos a de quem está trocando.
    await db()`delete from sessions where user_id = ${id} and token_hash <> ${me.tokenHash}`;
  }
  return getUser(id, me);
}

export async function deleteUser(id: string, me: Caller): Promise<void> {
  if (id === me.id) throw new ApiError(409, 'cannot_delete_self', 'Você não pode excluir a sua própria conta.');
  const [current] = await db()`select role from users where id = ${id}`;
  if (!current) throw notFound('Usuário');
  if ((current.role as Role) === 'Administrador') await ensureAnotherAdmin(id);
  await db()`delete from users where id = ${id}`;
}
