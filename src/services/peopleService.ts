import type { Customer, Seller } from '@/types/people';
import type { Quote } from '@/types/quotes';
import { api, isSavedId, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { CUSTOMERS_MOCK, SELLERS_MOCK } from './mocks/peopleMock';
import { quotesSnapshot } from './quotesService';

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
  return fromMock(() => sellers.map((s) => withMonthStats(s, quotesSnapshot())), signal);
}

export function saveSeller(seller: Seller): Promise<Seller> {
  if (!USE_MOCKS) {
    const { id, name, email, phone, region, status, monthlyGoal } = seller;
    const body = { name, email, phone, region, status, monthlyGoal };
    return isSavedId(id) ? api<Seller>('PUT', `/sellers/${id}`, body) : api<Seller>('POST', '/sellers', body);
  }
  return fromMock(() => {
    sellers = upsert(sellers, seller);
    return seller;
  });
}

export function deleteSeller(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/sellers/${id}`);
  return fromMock(() => {
    sellers = sellers.filter((s) => s.id !== id);
  });
}

export function listCustomers(signal?: AbortSignal): Promise<Customer[]> {
  if (!USE_MOCKS) return api<Customer[]>('GET', '/customers', undefined, signal);
  return fromMock(() => customers.map((c) => withQuoteStats(c, quotesSnapshot())), signal);
}

export function saveCustomer(customer: Customer): Promise<Customer> {
  if (!USE_MOCKS) {
    const { id, name, kind, document, phone, city, seller } = customer;
    const body = { name, kind, document, phone, city, seller };
    return isSavedId(id) ? api<Customer>('PUT', `/customers/${id}`, body) : api<Customer>('POST', '/customers', body);
  }
  return fromMock(() => {
    customers = upsert(customers, customer);
    return customer;
  });
}

export function deleteCustomer(id: string): Promise<void> {
  if (!USE_MOCKS) return api<void>('DELETE', `/customers/${id}`);
  return fromMock(() => {
    customers = customers.filter((c) => c.id !== id);
  });
}
