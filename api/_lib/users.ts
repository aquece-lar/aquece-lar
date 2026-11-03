import { MIN_PASSWORD, type User } from '../../src/types/users.js';
import { hashPassword, type Caller } from './auth.js';
import { db, iso, isUniqueViolation } from './db.js';
import { ApiError, invalid, notFound, text } from './http.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toUser(row: Record<string, unknown>, me: Caller): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    createdAt: iso(row.created_at),
    lastLoginAt: row.last_login_at ? iso(row.last_login_at) : null,
    isCurrent: row.id === me.id,
  };
}

const SELECT = `select id::text as id, name, email, created_at, last_login_at from users`;

export async function listUsers(me: Caller): Promise<User[]> {
  const rows = await db().query(`${SELECT} order by lower(name), id`);
  return rows.map((row) => toUser(row, me));
}

async function getUser(id: string, me: Caller): Promise<User> {
  const rows = await db().query(`${SELECT} where id = $1`, [id]);
  if (!rows[0]) throw notFound('Usuário');
  return toUser(rows[0], me);
}

/** Na criação a senha é obrigatória; na edição, vazia mantém a atual. */
function readUser(body: Record<string, unknown>, requirePassword: boolean) {
  const email = text(body, 'email', 'O e-mail', { min: 1, max: 160 });
  if (!EMAIL.test(email)) throw invalid('Informe um e-mail válido.');
  const password = typeof body.password === 'string' ? body.password : '';
  if ((requirePassword || password) && password.length < MIN_PASSWORD) {
    throw invalid(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  }
  if (password.length > 128) throw invalid('A senha pode ter no máximo 128 caracteres.');
  return { name: text(body, 'name', 'O nome', { min: 3, max: 120 }), email, password };
}

function duplicate(email: string) {
  return new ApiError(409, 'duplicate_email', `Já existe um usuário com o e-mail ${email}.`);
}

export async function createUser(body: Record<string, unknown>, me: Caller): Promise<User> {
  const u = readUser(body, true);
  try {
    const [row] = await db()`
      insert into users (name, email, password_hash) values (${u.name}, ${u.email}, ${await hashPassword(u.password)})
      returning id::text as id`;
    return getUser(row!.id as string, me);
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_key')) throw duplicate(u.email);
    throw error;
  }
}

export async function updateUser(id: string, body: Record<string, unknown>, me: Caller): Promise<User> {
  const u = readUser(body, false);
  try {
    const rows = await db()`
      update users set name = ${u.name}, email = ${u.email} where id = ${id} returning id`;
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
  const rows = await db()`delete from users where id = ${id} returning id`;
  if (!rows[0]) throw notFound('Usuário');
}
