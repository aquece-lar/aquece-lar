import { can, FULL_ACCESS, onlyOwn, type Permission } from '@/lib/access';
import type { Access, Session } from '@/types/auth';
import { ApiError } from './http';

/**
 * Sessão dos dados fictícios, guardada no navegador (com a API, ela é um
 * cookie HttpOnly). Os serviços simulados leem daqui o perfil para aplicar as
 * mesmas regras da API.
 */
const STORAGE_KEY = 'aquece-lar:sessao';

function isSession(value: unknown): value is Session {
  const session = value as Session | null;
  return typeof session?.email === 'string' && typeof session.name === 'string' && typeof session.access?.role === 'string';
}

export function readMockSession(): Session | null {
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
export function saveMockSession(session: Session, remember: boolean): void {
  clearMockSession();
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('Não foi possível salvar a sessão', error);
  }
}

export function clearMockSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Não foi possível apagar a sessão', error);
  }
}

/** Perfil de quem está conectado; sem ninguém (testes de tela), acesso total. */
export function mockAccess(): Access {
  return readMockSession()?.access ?? FULL_ACCESS;
}

/** Nome de quem está conectado, para o histórico; sem ninguém (testes de tela), o administrador. */
export function mockUserName(): string {
  return readMockSession()?.name ?? 'Administrador';
}

/** Mesmo 403 da API quando o perfil não pode. */
export function mockEnsure(permission: Permission, message = 'Seu perfil não tem permissão para isso.'): void {
  if (!can(mockAccess(), permission)) throw new ApiError(403, 'forbidden', message);
}

/** Nome do vendedor de quem só vê o que é dele (os mocks ligam por nome); `null` = vê tudo. */
export function mockOwnSeller(): string | null {
  const access = mockAccess();
  return onlyOwn(access) ? (access.sellerName ?? '') : null;
}
