import type { Session } from '@/types/auth';
import { api, ApiError, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { clearMockSession, readMockSession, saveMockSession } from './mockSession';
import { MOCK_ACCOUNTS } from './mocks/authMock';

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
      const account = MOCK_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
      if (!account || password !== account.password) throw new InvalidCredentialsError();
      return { email: account.email, name: account.name, access: account.access };
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
