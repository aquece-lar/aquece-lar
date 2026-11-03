import { describe, expect, it } from 'vitest';
import type { Access, Role } from '@/types/auth';
import { can, discountOverLimit, FULL_ACCESS, onlyOwn, type Permission } from './access';

function access(role: Role, extra: Partial<Access> = {}): Access {
  return { role, sellerId: role === 'Vendedor' ? 'v1' : null, sellerName: null, seeAll: false, exceedDiscount: false, ...extra };
}

const PERMISSIONS: Permission[] = ['manageSystem', 'manageCatalog', 'viewSellers', 'deleteRecords', 'seeAll', 'exceedDiscount'];

function allowed(a: Access): Permission[] {
  return PERMISSIONS.filter((p) => can(a, p));
}

describe('can', () => {
  it('administrador pode tudo', () => {
    expect(allowed(FULL_ACCESS)).toEqual(PERMISSIONS);
  });

  it('gerente pode tudo, menos usuários e configurações', () => {
    expect(allowed(access('Gerente'))).toEqual(PERMISSIONS.filter((p) => p !== 'manageSystem'));
  });

  it('vendedor só faz o básico, e as duas permissões são liberadas uma a uma', () => {
    expect(allowed(access('Vendedor'))).toEqual([]);
    expect(allowed(access('Vendedor', { seeAll: true }))).toEqual(['seeAll']);
    expect(allowed(access('Vendedor', { exceedDiscount: true }))).toEqual(['exceedDiscount']);
  });

  it('as permissões de vendedor não restringem gerente nem administrador', () => {
    expect(onlyOwn(access('Gerente', { seeAll: false }))).toBe(false);
    expect(onlyOwn(access('Vendedor'))).toBe(true);
    expect(onlyOwn(access('Vendedor', { seeAll: true }))).toBe(false);
  });
});

describe('discountOverLimit', () => {
  it('compara o desconto efetivo em % do subtotal', () => {
    expect(discountOverLimit(1000, 100, 10)).toBe(false);
    expect(discountOverLimit(1000, 100.1, 10)).toBe(true);
    // Desconto em R$ que dá 13,19% de 3.790.
    expect(discountOverLimit(3790, 500, 10)).toBe(true);
  });

  it('sem limite ou sem itens, nunca passa', () => {
    expect(discountOverLimit(1000, 900, null)).toBe(false);
    expect(discountOverLimit(0, 0, 10)).toBe(false);
  });
});
