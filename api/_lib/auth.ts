import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Session } from '../../src/types/auth';
import { db } from './db.js';
import { ApiError, invalid } from './http.js';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const COOKIE = 'aquece_lar_sessao';
/** "Manter conectado": 30 dias. Sem ele, o cookie some ao fechar o navegador e a sessão vale no máximo 12 h. */
const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
const SHORT_SECONDS = 12 * 60 * 60;
const KEY_LENGTH = 64;

export const unauthorized = () => new ApiError(401, 'unauthorized', 'Sua sessão expirou. Entre novamente.');

/** Hash no formato `scrypt$<sal>$<hash>` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Hash de uma senha qualquer: e-mail inexistente leva o mesmo tempo que senha errada.
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readToken(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE) return value.join('=') || null;
  }
  return null;
}

/** Secure só fora do http://localhost do `npm run dev:api`. */
function cookie(value: string, maxAge: number | null, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const age = maxAge === null ? '' : `; Max-Age=${maxAge}`;
  return `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax${secure}${age}`;
}

/** Confere e-mail e senha e cria a sessão; devolve o usuário e o Set-Cookie. */
export async function login(request: Request, body: Record<string, unknown>): Promise<{ session: Session; setCookie: string }> {
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) throw invalid('Informe e-mail e senha.');

  const [user] = await db()`select id::text as id, email, name, password_hash from users where lower(email) = lower(${email})`;
  const ok = await verifyPassword(password, (user?.password_hash as string | undefined) ?? (await DUMMY_HASH));
  if (!user || !ok) throw new ApiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');

  const remember = body.remember === true;
  const seconds = remember ? REMEMBER_SECONDS : SHORT_SECONDS;
  const token = randomBytes(32).toString('base64url');
  await db()`
    insert into sessions (token_hash, user_id, expires_at)
    values (${tokenHash(token)}, ${user.id}, now() + make_interval(secs => ${seconds}))`;
  await db()`update users set last_login_at = now() where id = ${user.id}`;
  // Aproveita o login para limpar sessões vencidas.
  await db()`delete from sessions where expires_at < now()`;

  return {
    session: { email: user.email as string, name: user.name as string },
    setCookie: cookie(token, remember ? seconds : null, request),
  };
}

/** Quem fez a chamada: o usuário e a sessão (hash do token) do cookie. */
export interface Caller {
  id: string;
  tokenHash: string;
  session: Session;
}

/** Usuário da sessão do cookie; sem sessão válida, 401. */
export async function caller(request: Request): Promise<Caller> {
  const token = readToken(request);
  if (!token) throw unauthorized();
  const hash = tokenHash(token);
  const [row] = await db()`
    select u.id::text as id, u.email, u.name from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now()`;
  if (!row) throw unauthorized();
  return { id: row.id as string, tokenHash: hash, session: { email: row.email as string, name: row.name as string } };
}

export async function currentUser(request: Request): Promise<Session> {
  return (await caller(request)).session;
}

/** Apaga a sessão no banco e o cookie no navegador. */
export async function logout(request: Request): Promise<string> {
  const token = readToken(request);
  if (token) await db()`delete from sessions where token_hash = ${tokenHash(token)}`;
  return cookie('', 0, request);
}
