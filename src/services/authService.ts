import type { Session } from '@/types/auth';
import { fromMock } from './mockLatency';
import { ADMIN_ACCOUNT } from './mocks/authMock';

const STORAGE_KEY = 'aquece-lar:sessao';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Usuário ou senha incorretos.');
    this.name = 'InvalidCredentialsError';
  }
}

/** O usuário não diferencia maiúsculas; a senha, sim. */
export function login(username: string, password: string, signal?: AbortSignal): Promise<Session> {
  return fromMock(() => {
    if (username.trim().toLowerCase() !== ADMIN_ACCOUNT.username || password !== ADMIN_ACCOUNT.password) {
      throw new InvalidCredentialsError();
    }
    return { username: ADMIN_ACCOUNT.username, name: ADMIN_ACCOUNT.name };
  }, signal);
}

function isSession(value: unknown): value is Session {
  const session = value as Session | null;
  return typeof session?.username === 'string' && typeof session.name === 'string';
}

/** "Manter conectado" guarda no localStorage; sem ele, a sessão acaba ao fechar o navegador. */
export function readSession(): Session | null {
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

export function saveSession(session: Session, remember: boolean): void {
  clearSession();
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Não foi possível salvar a sessão', error);
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível apagar a sessão', error);
  }
}
