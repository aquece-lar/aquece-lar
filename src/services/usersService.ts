import type { User, UserDraft } from '@/types/users';
import { describeUserChanges } from '@/lib/changes';
import { api, ApiError, USE_MOCKS } from './http';
import { recordMockActivity } from './mockActivity';
import { fromMock } from './mockLatency';
import { mockAccess, mockEnsure, readMockSession } from './mockSession';
import { MOCK_ACCOUNTS } from './mocks/authMock';
import { SELLERS_MOCK } from './mocks/peopleMock';

/** Modo fictício (testes): as contas fictícias, uma por perfil. `isCurrent` sai da sessão. */
let users: Omit<User, 'isCurrent'>[] = MOCK_ACCOUNTS.map((account, i) => ({
  id: String(i + 1),
  name: account.name,
  email: account.email,
  createdAt: '2026-01-05T12:00:00.000Z',
  lastLoginAt: null,
  ...account.access,
}));

/** Quem está conectado; sem sessão (testes de tela), a conta de administrador. */
function currentEmail(): string {
  return readMockSession()?.email ?? MOCK_ACCOUNTS[0]!.email;
}

function withCurrent(user: Omit<User, 'isCurrent'>): User {
  return { ...user, isCurrent: user.email.toLowerCase() === currentEmail().toLowerCase() };
}

function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message);
}

function emailTaken(email: string, exceptId?: string): boolean {
  return users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email.toLowerCase());
}

/** Mesmas regras da API (api/_lib/users.ts): vendedor ligado a um cadastro; o resto, sem permissões de vendedor. */
function fromDraft(draft: UserDraft) {
  const isSeller = draft.role === 'Vendedor';
  const seller = isSeller ? SELLERS_MOCK.find((s) => s.id === draft.sellerId) : undefined;
  if (isSeller && !seller) throw new ApiError(400, 'validation', 'Escolha o vendedor ligado a este usuário.');
  return {
    name: draft.name,
    email: draft.email,
    role: draft.role,
    sellerId: seller?.id ?? null,
    sellerName: seller?.name ?? null,
    seeAll: isSeller && draft.seeAll,
    exceedDiscount: isSeller && draft.exceedDiscount,
  };
}

function ensureAnotherAdmin(id: string): void {
  if (!users.some((u) => u.id !== id && u.role === 'Administrador')) {
    throw conflict('last_admin', 'É preciso manter ao menos um administrador.');
  }
}

export function listUsers(signal?: AbortSignal): Promise<User[]> {
  if (!USE_MOCKS) return api<User[]>('GET', '/users', undefined, signal);
  return fromMock(() => {
    mockEnsure('manageSystem');
    return users.map(withCurrent).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, signal);
}

export function createUser(draft: UserDraft): Promise<User> {
  if (!USE_MOCKS) return api<User>('POST', '/users', draft);
  return fromMock(() => {
    mockEnsure('manageSystem');
    if (emailTaken(draft.email)) throw conflict('duplicate_email', `Já existe um usuário com o e-mail ${draft.email}.`);
    const user = { id: String(Date.now()), createdAt: new Date().toISOString(), lastLoginAt: null, ...fromDraft(draft) };
    users = [...users, user];
    recordMockActivity('Usuários', `Usuário ${user.name} criado`, `perfil: ${user.role}`);
    return withCurrent(user);
  });
}

/** `password` vazio mantém a senha atual. */
export function updateUser(id: string, draft: UserDraft): Promise<User> {
  if (!USE_MOCKS) return api<User>('PUT', `/users/${id}`, draft);
  return fromMock(() => {
    mockEnsure('manageSystem');
    const current = users.find((u) => u.id === id);
    if (!current) throw new ApiError(404, 'not_found', 'Usuário não encontrado.');
    if (emailTaken(draft.email, id)) throw conflict('duplicate_email', `Já existe um usuário com o e-mail ${draft.email}.`);
    if (withCurrent(current).isCurrent && draft.role !== mockAccess().role) {
      throw conflict('cannot_change_own_role', 'Você não pode mudar o seu próprio perfil.');
    }
    if (current.role === 'Administrador' && draft.role !== 'Administrador') ensureAnotherAdmin(id);
    const updated = { ...current, ...fromDraft(draft) };
    users = users.map((u) => (u.id === id ? updated : u));
    const detail = describeUserChanges(current, updated, Boolean(draft.password));
    if (detail) recordMockActivity('Usuários', `Usuário ${updated.name} editado`, detail);
    return withCurrent(updated);
  });
}

export function deleteUser(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/users/${id}`);
  return fromMock(() => {
    mockEnsure('manageSystem');
    const current = users.find((u) => u.id === id);
    if (!current) throw new ApiError(404, 'not_found', 'Usuário não encontrado.');
    if (withCurrent(current).isCurrent) throw conflict('cannot_delete_self', 'Você não pode excluir a sua própria conta.');
    if (current.role === 'Administrador') ensureAnotherAdmin(id);
    users = users.filter((u) => u.id !== id);
    recordMockActivity('Usuários', `Usuário ${current.name} excluído`);
  });
}
