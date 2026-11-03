import type { Access } from '@/types/auth';

/**
 * Contas dos dados fictícios (testes e VITE_USE_MOCKS=true), uma por perfil,
 * para experimentar as permissões. Com a API, as contas ficam no banco: veja
 * `npm run user:save` no README.
 */
export interface MockAccount {
  email: string;
  password: string;
  name: string;
  access: Access;
}

export const ADMIN_ACCOUNT: MockAccount = {
  email: 'admin@aquecelar.com.br',
  password: 'admin@adm',
  name: 'Administrador',
  access: { role: 'Administrador', sellerId: null, sellerName: null, seeAll: true, exceedDiscount: true },
};

export const MANAGER_ACCOUNT: MockAccount = {
  email: 'gerente@aquecelar.com.br',
  password: 'gerente@adm',
  name: 'Gerente Comercial',
  access: { role: 'Gerente', sellerId: null, sellerName: null, seeAll: true, exceedDiscount: true },
};

/** Ligado ao vendedor Carlos Menezes (v1); vê só o que é dele e não passa do desconto máximo. */
export const SELLER_ACCOUNT: MockAccount = {
  email: 'carlos.menezes@aquecelar.com.br',
  password: 'vendedor@1',
  name: 'Carlos Menezes',
  access: { role: 'Vendedor', sellerId: 'v1', sellerName: 'Carlos Menezes', seeAll: false, exceedDiscount: false },
};

export const MOCK_ACCOUNTS: MockAccount[] = [ADMIN_ACCOUNT, MANAGER_ACCOUNT, SELLER_ACCOUNT];
