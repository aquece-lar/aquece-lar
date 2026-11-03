export type Role = 'Administrador' | 'Gerente' | 'Vendedor';

export const ROLES: readonly Role[] = ['Administrador', 'Gerente', 'Vendedor'];

/**
 * O que o usuário pode fazer. Administrador e gerente sempre veem tudo e podem
 * passar do desconto máximo; para o vendedor, as duas coisas são liberadas uma a uma.
 */
export interface Access {
  role: Role;
  /** Cadastro de vendedor ligado ao usuário; obrigatório no perfil Vendedor. */
  sellerId: string | null;
  sellerName: string | null;
  /** Vendedor que vê orçamentos, clientes e o dashboard de todos (sem isso, só os dele). */
  seeAll: boolean;
  /** Vendedor que pode salvar orçamento com desconto acima do máximo das configurações. */
  exceedDiscount: boolean;
}

/** Quem está conectado: vem da API (cookie de sessão) ou da conta fictícia nos testes. */
export interface Session {
  email: string;
  name: string;
  access: Access;
}
