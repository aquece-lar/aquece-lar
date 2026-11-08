import type { Customer, QuoteHistory, Seller } from '@/types/people';
import type { Quote } from '@/types/quotes';
import { api, ApiError, isSavedId, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { mockAccess, mockEnsure, mockOwnSeller } from './mockSession';
import { CUSTOMERS_MOCK, SELLERS_MOCK } from './mocks/peopleMock';
import { quoteEventsSnapshot, quotesSnapshot } from './quotesService';

/**
 * Modo fictício (testes): cópias em memória dos mocks, que valem até a página
 * ser recarregada. As contagens de orçamentos (`quotes`, `amount`,
 * `lastQuoteAt`) são sempre recalculadas na listagem, como a API faz.
 */
let sellers = [...SELLERS_MOCK];
let customers = [...CUSTOMERS_MOCK];

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}`;
}

/** Orçamentos e valor do vendedor no mês corrente, calculados sobre os orçamentos. */
function withMonthStats(seller: Seller, quotes: readonly Quote[]): Seller {
  const now = new Date();
  const own = quotes.filter((q) => {
    const created = new Date(q.createdAt);
    return q.seller === seller.name && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  });
  return { ...seller, quotes: own.length, amount: own.reduce((total, q) => total + q.amount, 0) };
}

/** Total de orçamentos do cliente e data do último, calculados sobre os orçamentos. */
function withQuoteStats(customer: Customer, quotes: readonly Quote[]): Customer {
  const own = quotes.filter((q) => q.customer === customer.name);
  const last = own.reduce<string | null>((latest, q) => (!latest || q.createdAt > latest ? q.createdAt : latest), null);
  return { ...customer, quotes: own.length, lastQuoteAt: last };
}

export function listSellers(signal?: AbortSignal): Promise<Seller[]> {
  if (!USE_MOCKS) return api<Seller[]>('GET', '/sellers', undefined, signal);
  return fromMock(() => {
    // Vendedor que só vê o que é dele recebe só o próprio cadastro, como na API.
    const own = mockOwnSeller();
    return sellers.filter((s) => own === null || s.name === own).map((s) => withMonthStats(s, quotesSnapshot()));
  }, signal);
}

export function saveSeller(seller: Seller): Promise<Seller> {
  if (!USE_MOCKS) {
    const { id, name, email, phone, region, status, monthlyGoal } = seller;
    const body = { name, email, phone, region, status, monthlyGoal };
    return isSavedId(id) ? api<Seller>('PUT', `/sellers/${id}`, body) : api<Seller>('POST', '/sellers', body);
  }
  return fromMock(() => {
    mockEnsure('manageCatalog');
    sellers = upsert(sellers, seller);
    return seller;
  });
}

export function deleteSeller(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/sellers/${id}`);
  return fromMock(() => {
    mockEnsure('manageCatalog');
    sellers = sellers.filter((s) => s.id !== id);
  });
}

export function listCustomers(signal?: AbortSignal): Promise<Customer[]> {
  if (!USE_MOCKS) return api<Customer[]>('GET', '/customers', undefined, signal);
  return fromMock(() => {
    const own = mockOwnSeller();
    return customers.filter((c) => own === null || c.seller === own).map((c) => withQuoteStats(c, quotesSnapshot()));
  }, signal);
}

export function saveCustomer(customer: Customer): Promise<Customer> {
  if (!USE_MOCKS) {
    const { id, name, kind, document, phone, city, seller } = customer;
    const body = { name, kind, document, phone, city, seller };
    return isSavedId(id) ? api<Customer>('PUT', `/customers/${id}`, body) : api<Customer>('POST', '/customers', body);
  }
  return fromMock(() => {
    // O vendedor cadastra no próprio nome e só edita os clientes dele (como em api/_lib/customers.ts).
    const access = mockAccess();
    let saved = customer;
    if (access.role === 'Vendedor') {
      const current = customers.find((c) => c.id === customer.id);
      if (current && current.seller !== access.sellerName) {
        throw new ApiError(403, 'forbidden', 'Este cliente é de outro vendedor.');
      }
      saved = { ...customer, seller: access.sellerName ?? '' };
    }
    customers = upsert(customers, saved);
    return saved;
  });
}

export function deleteCustomer(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/customers/${id}`);
  return fromMock(() => {
    mockEnsure('deleteRecords');
    customers = customers.filter((c) => c.id !== id);
  });
}

/** Orçamentos (mais recentes primeiro) e data do último passo, no modo fictício; liga por nome, como os mocks. */
function mockHistory(belongs: (quote: Quote) => boolean): QuoteHistory {
  const own = mockOwnSeller();
  const list = quotesSnapshot()
    .filter((q) => belongs(q) && (own === null || q.seller === own))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const ids = new Set(list.map((q) => q.id));
  const lastActivityAt = quoteEventsSnapshot()
    .filter(({ quote }) => ids.has(quote.id))
    .reduce<string | null>((latest, { event }) => (!latest || event.at > latest ? event.at : latest), null);
  return { quotes: list, lastActivityAt };
}

/** Ficha do cliente. O vendedor que só vê o que é dele abre só os próprios clientes (os outros: 404). */
export function customerHistory(id: string, signal?: AbortSignal): Promise<QuoteHistory> {
  if (!USE_MOCKS) return api<QuoteHistory>('GET', `/customers/${id}/quotes`, undefined, signal);
  return fromMock(() => {
    const own = mockOwnSeller();
    const customer = customers.find((c) => c.id === id);
    if (!customer || (own !== null && customer.seller !== own)) {
      throw new ApiError(404, 'not_found', 'Cliente não encontrado.');
    }
    return mockHistory((q) => q.customer === customer.name);
  }, signal);
}

/** Ficha do vendedor; só para quem pode ver a tela de vendedores. */
export function sellerHistory(id: string, signal?: AbortSignal): Promise<QuoteHistory> {
  if (!USE_MOCKS) return api<QuoteHistory>('GET', `/sellers/${id}/quotes`, undefined, signal);
  return fromMock(() => {
    mockEnsure('viewSellers');
    const seller = sellers.find((x) => x.id === id);
    if (!seller) throw new ApiError(404, 'not_found', 'Vendedor não encontrado.');
    return mockHistory((q) => q.seller === seller.name);
  }, signal);
}
