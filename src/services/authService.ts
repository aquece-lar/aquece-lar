import type { Session } from '@/types/auth';
import { api, ApiError, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { ADMIN_ACCOUNT } from './mocks/authMock';

/** Só nos dados fictícios a sessão fica no navegador; com a API, ela é um cookie HttpOnly. */
const STORAGE_KEY = 'aquece-lar:sessao';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('E-mail ou senha incorretos.');
    this.name = 'InvalidCredentialsError';
  }
}

/** O e-mail não diferencia maiúsculas; a senha, sim. "Manter conectado" vira `remember`. */
export async function login(email: string, password: string, remember: boolean, signal?: AbortSignal): Promise<Session> {
  if (USE_MOCKS) {
    const session = await fromMock(() => {
      if (email.trim().toLowerCase() !== ADMIN_ACCOUNT.email || password !== ADMIN_ACCOUNT.password) {
        throw new InvalidCredentialsError();
      }
      return { email: ADMIN_ACCOUNT.email, name: ADMIN_ACCOUNT.name };
    }, signal);
    saveMockSession(session, remember);
    return session;
  }
  try {
    return await api<Session>('POST', '/auth/login', { email: email.trim(), password, remember }, signal);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'invalid_credentials') throw new InvalidCredentialsError();
    throw error;
  }
}

/** Sessão atual, ou `null` se ninguém estiver conectado. */
export async function currentSession(signal?: AbortSignal): Promise<Session | null> {
  if (USE_MOCKS) return readMockSession();
  try {
    return await api<Session>('GET', '/auth/me', undefined, signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function logout(): Promise<void> {
  if (USE_MOCKS) {
    clearMockSession();
    return;
  }
  await api<void>('POST', '/auth/logout');
}

function isSession(value: unknown): value is Session {
  const session = value as Session | null;
  return typeof session?.email === 'string' && typeof session.name === 'string';
}

function readMockSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Não foi possível ler a sessão salva', error);
    return null;
  }
}

/** "Manter conectado" guarda no localStorage; sem ele, a sessão acaba ao fechar o navegador. */
function saveMockSession(session: Session, remember: boolean): void {
  clearMockSession();
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Não foi possível salvar a sessão', error);
  }
}

function clearMockSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível apagar a sessão', error);
  }
}
