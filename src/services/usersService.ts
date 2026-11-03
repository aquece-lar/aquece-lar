import type { User, UserDraft } from '@/types/users';
import { api, ApiError, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { ADMIN_ACCOUNT } from './mocks/authMock';

/** Modo fictício (testes): só a conta fictícia, que é quem está conectado. */
let users: User[] = [
  {
    id: '1',
    name: ADMIN_ACCOUNT.name,
    email: ADMIN_ACCOUNT.email,
    createdAt: '2026-01-05T12:00:00.000Z',
    lastLoginAt: null,
    isCurrent: true,
  },
];

function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message);
}

function emailTaken(email: string, exceptId?: string): boolean {
  return users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email.toLowerCase());
}

export function listUsers(signal?: AbortSignal): Promise<User[]> {
  if (!USE_MOCKS) return api<User[]>('GET', '/users', undefined, signal);
  return fromMock(() => [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), signal);
}

export function createUser(draft: UserDraft): Promise<User> {
  if (!USE_MOCKS) return api<User>('POST', '/users', draft);
  return fromMock(() => {
    if (emailTaken(draft.email)) throw conflict('duplicate_email', `Já existe um usuário com o e-mail ${draft.email}.`);
    const user: User = {
      id: String(Date.now()),
      name: draft.name,
      email: draft.email,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      isCurrent: false,
    };
    users = [...users, user];
    return user;
  });
}

/** `password` vazio mantém a senha atual. */
export function updateUser(id: string, draft: UserDraft): Promise<User> {
  if (!USE_MOCKS) return api<User>('PUT', `/users/${id}`, draft);
  return fromMock(() => {
    if (emailTaken(draft.email, id)) throw conflict('duplicate_email', `Já existe um usuário com o e-mail ${draft.email}.`);
    users = users.map((u) => (u.id === id ? { ...u, name: draft.name, email: draft.email } : u));
    return users.find((u) => u.id === id)!;
  });
}

export function deleteUser(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/users/${id}`);
  return fromMock(() => {
    if (users.find((u) => u.id === id)?.isCurrent) {
      throw conflict('cannot_delete_self', 'Você não pode excluir a sua própria conta.');
    }
    users = users.filter((u) => u.id !== id);
  });
}
