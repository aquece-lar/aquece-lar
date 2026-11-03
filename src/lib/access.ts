import type { Access } from '@/types/auth';

/** Acesso total: administrador. Também é o que vale nos testes sem ninguém conectado. */
export const FULL_ACCESS: Access = {
  role: 'Administrador',
  sellerId: null,
  sellerName: null,
  seeAll: true,
  exceedDiscount: true,
};

/**
 * Tudo que muda conforme o perfil. A API confere as mesmas regras em cada rota;
 * o front usa para esconder menus e botões.
 */
export type Permission =
  /** Usuários e Configurações (dados da empresa, padrões, limites). */
  | 'manageSystem'
  /** Cadastrar, editar e excluir vendedores e produtos. */
  | 'manageCatalog'
  /** Ver a tela de vendedores (metas e valores de cada um). */
  | 'viewSellers'
  /** Excluir clientes. */
  | 'deleteRecords'
  /** Ver orçamentos, clientes e dashboard de todos os vendedores. */
  | 'seeAll'
  /** Salvar desconto acima do máximo das configurações. */
  | 'exceedDiscount';

export function can(access: Access, permission: Permission): boolean {
  const { role } = access;
  switch (permission) {
    case 'manageSystem':
      return role === 'Administrador';
    case 'manageCatalog':
    case 'viewSellers':
    case 'deleteRecords':
      return role !== 'Vendedor';
    case 'seeAll':
      return role !== 'Vendedor' || access.seeAll;
    case 'exceedDiscount':
      return role !== 'Vendedor' || access.exceedDiscount;
  }
}

/** Vendedor que só vê o que é dele: os orçamentos e clientes com o seu cadastro de vendedor. */
export function onlyOwn(access: Access): boolean {
  return !can(access, 'seeAll');
}

/**
 * Desconto efetivo em % do subtotal, comparado ao máximo das configurações
 * (`null` = sem limite). Mesma conta no formulário e na API.
 */
export function discountOverLimit(subtotal: number, discount: number, maxPercent: number | null): boolean {
  if (maxPercent === null || subtotal <= 0) return false;
  const percent = Math.round((discount / subtotal) * 10_000) / 100;
  return percent > maxPercent;
}
