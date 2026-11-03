import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toISODate } from '@/lib/format';
import type { Period } from '@/types/dashboard';
import type { QuoteDraft } from '@/types/quotes';
import { login, logout } from './authService';
import { getDashboard } from './dashboardService';
import { ApiError } from './http';
import { MANAGER_ACCOUNT, SELLER_ACCOUNT } from './mocks/authMock';
import { deleteCustomer, listCustomers, listSellers, saveCustomer, saveSeller } from './peopleService';
import { listProducts, saveProduct } from './productsService';
import { createQuote, getQuote, listQuotes, QuoteNotFoundError, updateQuoteStatus } from './quotesService';
import { getSettings, saveSettings } from './settingsService';
import { listUsers } from './usersService';

const YEAR: Period = (() => {
  const now = new Date();
  return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365)), to: toISODate(now) };
})();

function draft(seller: string, discount: QuoteDraft['discount'] = null): QuoteDraft {
  return {
    customerInfo: { name: 'Restaurante Brasa Viva', detail: '', phone: '' },
    sellerInfo: { name: seller, detail: '', phone: '' },
    items: [{ code: 'BLR-200', description: 'Boiler de acumulação 200 L', quantity: 1, unitPrice: 3790 }],
    validUntil: '2099-01-01',
    paymentTerms: '3x sem juros no cartão',
    discount,
    notes: '',
  };
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(async () => {
  await logout();
});

describe('vendedor (só o que é dele, sem passar do desconto)', () => {
  beforeEach(async () => {
    await login(SELLER_ACCOUNT.email, SELLER_ACCOUNT.password, false);
  });

  it('vê só os próprios orçamentos, clientes e cadastro de vendedor', async () => {
    const quotes = await listQuotes(YEAR);
    expect(quotes.length).toBeGreaterThan(0);
    expect(new Set(quotes.map((q) => q.seller))).toEqual(new Set(['Carlos Menezes']));

    const customers = await listCustomers();
    expect(customers.length).toBeGreaterThan(0);
    expect(customers.every((c) => c.seller === 'Carlos Menezes')).toBe(true);

    expect((await listSellers()).map((s) => s.name)).toEqual(['Carlos Menezes']);
  });

  it('orçamento de outro vendedor não existe para ele', async () => {
    // #1179 é do Rafael Bortolini; #1181 é do Carlos.
    await expect(getQuote('1179')).rejects.toBeInstanceOf(QuoteNotFoundError);
    await expect(updateQuoteStatus('1179', 'Cancelado')).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect((await getQuote('1181')).seller).toBe('Carlos Menezes');
  });

  it('dashboard só com os números dele', async () => {
    const data = await getDashboard(YEAR);
    expect(data.ranking.map((r) => r.name)).toEqual(['Carlos Menezes']);
    expect(data.recentQuotes.every((q) => q.seller === 'Carlos Menezes')).toBe(true);
  });

  it('cria orçamento só no próprio nome e sem passar do desconto máximo', async () => {
    expect((await rejection(createQuote(draft('Rafael Bortolini')))).status).toBe(403);
    const over = await rejection(createQuote(draft('Carlos Menezes', { type: 'percent', value: 15 })));
    expect(over.code).toBe('discount_over_limit');
    const ok = await createQuote(draft('Carlos Menezes', { type: 'percent', value: 10 }));
    expect(ok.seller).toBe('Carlos Menezes');
  });

  it('cadastra cliente no próprio nome, mas não exclui nem mexe no catálogo e no sistema', async () => {
    const saved = await saveCustomer({
      id: 'c-novo',
      name: 'Padaria Serrana',
      kind: 'PJ',
      document: '',
      phone: '',
      city: '',
      seller: 'Rafael Bortolini',
      quotes: 0,
      lastQuoteAt: null,
    });
    expect(saved.seller).toBe('Carlos Menezes');

    expect((await rejection(deleteCustomer('c-novo'))).status).toBe(403);
    const [product] = await listProducts();
    expect((await rejection(saveProduct({ ...product!, unitPrice: 1 }))).status).toBe(403);
    const [me] = await listSellers();
    expect((await rejection(saveSeller({ ...me!, monthlyGoal: 1 }))).status).toBe(403);
    expect((await rejection(saveSettings(await getSettings()))).status).toBe(403);
    expect((await rejection(listUsers())).status).toBe(403);
  });
});

describe('vendedor com as duas permissões', () => {
  it('vê os orçamentos de todos e passa do desconto máximo', async () => {
    await login(SELLER_ACCOUNT.email, SELLER_ACCOUNT.password, false);
    // A sessão fictícia guarda o perfil; aqui liberamos as duas permissões direto nela.
    const key = 'aquece-lar:sessao';
    const session = JSON.parse(window.sessionStorage.getItem(key)!);
    session.access = { ...session.access, seeAll: true, exceedDiscount: true };
    window.sessionStorage.setItem(key, JSON.stringify(session));

    const sellers = new Set((await listQuotes(YEAR)).map((q) => q.seller));
    expect(sellers.size).toBeGreaterThan(1);
    expect((await getQuote('1179')).seller).toBe('Rafael Bortolini');
    // Vê, mas não mexe no orçamento de outro vendedor.
    expect((await rejection(updateQuoteStatus('1179', 'Cancelado'))).status).toBe(403);
    const ok = await createQuote(draft('Carlos Menezes', { type: 'percent', value: 15 }));
    expect(ok.amount).toBe(3221.5);
  });
});

describe('gerente', () => {
  beforeEach(async () => {
    await login(MANAGER_ACCOUNT.email, MANAGER_ACCOUNT.password, false);
  });

  it('vê tudo e mexe no catálogo, mas não em usuários e configurações', async () => {
    expect(new Set((await listQuotes(YEAR)).map((q) => q.seller)).size).toBeGreaterThan(1);
    const [product] = await listProducts();
    await expect(saveProduct(product!)).resolves.toBeTruthy();
    expect((await rejection(saveSettings(await getSettings()))).status).toBe(403);
    expect((await rejection(listUsers())).status).toBe(403);
  });

  it('passa do desconto máximo', async () => {
    const ok = await createQuote(draft('Rafael Bortolini', { type: 'percent', value: 20 }));
    expect(ok.amount).toBe(3032);
  });
});
