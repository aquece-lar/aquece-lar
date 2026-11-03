/**
 * Única conta enquanto não há backend. A senha fica no código do front, então
 * o login separa o acesso mas não o protege de verdade: isso só com a API.
 */
export const ADMIN_ACCOUNT = {
  username: 'admin',
  password: 'admin@adm',
  name: 'Administrador',
} as const;
