import { describe, expect, it } from 'vitest';
import type { QuoteDraft } from '@/types/quotes';
import { SETTINGS_MOCK } from '@/services/mocks/settingsMock';
import { describeQuoteChanges, describeSettingsChanges, describeUserChanges, type UserSnapshot } from './changes';

const QUOTE: QuoteDraft = {
  customerInfo: { name: 'Ana', detail: '', phone: '' },
  sellerInfo: { name: 'Carlos Menezes', detail: '', phone: '' },
  items: [{ code: 'A', description: 'Boiler', quantity: 1, unitPrice: 1000 }],
  validUntil: '2030-01-10',
  paymentTerms: 'À vista',
  discount: null,
  notes: '',
};

describe('describeQuoteChanges', () => {
  it('lista desconto, total, itens e validade que mudaram', () => {
    const after: QuoteDraft = {
      ...QUOTE,
      items: [...QUOTE.items, { code: 'B', description: 'Instalação', quantity: 1, unitPrice: 200 }],
      discount: { type: 'percent', value: 10 },
      validUntil: '2030-01-20',
      notes: 'Entrega em 5 dias',
    };
    expect(describeQuoteChanges(QUOTE, after)).toBe(
      'itens: 1 item → 2 itens; desconto: sem desconto → 10%; total: R$ 1.000,00 → R$ 1.080,00; ' +
        'validade: 10/01/2030 → 20/01/2030; observações alteradas',
    );
  });

  it('desconto em reais e nada mais', () => {
    expect(describeQuoteChanges(QUOTE, { ...QUOTE, discount: { type: 'amount', value: 50 } })).toBe(
      'desconto: sem desconto → R$ 50,00; total: R$ 1.000,00 → R$ 950,00',
    );
  });

  it('sem mudança, texto vazio (mesmo com as chaves dos itens em outra ordem)', () => {
    const reordered = { ...QUOTE, items: [{ unitPrice: 1000, quantity: 1, description: 'Boiler', code: 'A' }] };
    expect(describeQuoteChanges(QUOTE, reordered)).toBe('');
  });
});

describe('describeSettingsChanges', () => {
  it('mostra limites e padrões que mudaram; textos longos só dizem que mudaram', () => {
    const after = structuredClone(SETTINGS_MOCK);
    after.quotes.maxDiscountPercent = null;
    after.quotes.expiryAlertDays = 1;
    after.company.footer = 'PIX: 123';
    expect(describeSettingsChanges(SETTINGS_MOCK, after)).toBe(
      'rodapé do PDF alterado; desconto máximo: 10% → sem limite; aviso de vencimento: 3 dias → 1 dia',
    );
    expect(describeSettingsChanges(SETTINGS_MOCK, structuredClone(SETTINGS_MOCK))).toBe('');
  });
});

describe('describeUserChanges', () => {
  it('perfil, permissões e senha', () => {
    const before: UserSnapshot = {
      name: 'Ana',
      email: 'ana@x.com',
      role: 'Gerente',
      sellerId: null,
      sellerName: null,
      seeAll: false,
      exceedDiscount: false,
    };
    const after: UserSnapshot = { ...before, role: 'Vendedor', sellerId: 'v1', sellerName: 'Carlos Menezes', seeAll: true };
    expect(describeUserChanges(before, after, true)).toBe(
      'perfil: Gerente → Vendedor; vendedor ligado: — → Carlos Menezes; vê de todos: não → sim; senha trocada',
    );
  });
});
