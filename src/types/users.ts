import type { Access, Role } from './auth';

/** Quem pode entrar no sistema, com o perfil e as permissões (veja `src/lib/access.ts`). */
export interface User extends Access {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** Último login (ISO), ou `null` se nunca entrou. */
  lastLoginAt: string | null;
  /** É quem está conectado agora. */
  isCurrent: boolean;
}

/**
 * Ao editar, `password` vazio mantém a senha atual. `sellerId`, `seeAll` e
 * `exceedDiscount` só valem no perfil Vendedor.
 */
export interface UserDraft {
  name: string;
  email: string;
  password: string;
  role: Role;
  sellerId: string | null;
  seeAll: boolean;
  exceedDiscount: boolean;
}

export const MIN_PASSWORD = 8;
