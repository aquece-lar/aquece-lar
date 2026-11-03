/** Quem pode entrar no sistema. Por enquanto todos têm acesso total. */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** Último login (ISO), ou `null` se nunca entrou. */
  lastLoginAt: string | null;
  /** É quem está conectado agora. */
  isCurrent: boolean;
}

/** Ao editar, `password` vazio mantém a senha atual. */
export interface UserDraft {
  name: string;
  email: string;
  password: string;
}

export const MIN_PASSWORD = 8;
