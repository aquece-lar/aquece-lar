import type { Period, QuoteStatus } from '@/types/dashboard';
import type { Quote, QuoteDetail, QuoteDraft, QuoteEvent } from '@/types/quotes';
import { can, discountOverLimit } from '@/lib/access';
import { quoteTotals } from '@/lib/quoteTotals';
import { api, ApiError, USE_MOCKS } from './http';
import { InvalidPeriodError, inPeriod, validatePeriod } from './period';
import { fromMock } from './mockLatency';
import { mockAccess, mockOwnSeller } from './mockSession';
import { settingsSnapshot } from './settingsService';
import { buildHistory, buildQuoteDetail } from './mocks/quoteDetailMock';
import { QUOTES_MOCK } from './mocks/quotesMock';

/**
 * Modo fictício (testes): cópia em memória em que mudanças de status e
 * orçamentos novos valem até a página ser recarregada. O histórico parte do
 * status original do mock e recebe os novos eventos; os orçamentos criados
 * guardam os dados do formulário.
 */
let quotes = [...QUOTES_MOCK];
const history = new Map<string, QuoteEvent[]>(QUOTES_MOCK.map((q) => [q.id, buildHistory(q)]));
const drafts = new Map<string, QuoteDraft>();

export class QuoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Orçamento ${id} não encontrado.`);
    this.name = 'QuoteNotFoundError';
  }
}

/** Converte os erros da API nas classes que as telas já tratam. */
async function viaApi<T>(call: () => Promise<T>, id?: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'not_found' && id) throw new QuoteNotFoundError(id);
    if (error instanceof ApiError && error.code === 'invalid_period') throw new InvalidPeriodError(error.message);
    throw error;
  }
}

/**
 * Leitura direta da cópia em memória, para os outros serviços simulados
 * (dashboard e contagens de clientes e vendedores) calcularem sobre os mesmos
 * orçamentos. Com a API, esses números vêm prontos do servidor.
 */
export function quotesSnapshot(): readonly Quote[] {
  return quotes;
}

/** Mesmas regras da API (api/_lib/quotes.ts): em nome próprio e sem passar do desconto máximo sem permissão. */
function checkDraft(draft: QuoteDraft): void {
  const access = mockAccess();
  if (access.role === 'Vendedor' && draft.sellerInfo.name !== access.sellerName) {
    throw new ApiError(403, 'forbidden', 'O orçamento precisa ficar no seu nome.');
  }
  if (!can(access, 'exceedDiscount')) {
    const max = settingsSnapshot().quotes.maxDiscountPercent;
    const { subtotal, discount } = quoteTotals(draft.items, draft.discount);
    if (discountOverLimit(subtotal, discount, max)) {
      throw new ApiError(403, 'discount_over_limit', `O desconto passa do máximo de ${max}%. Peça a um gerente.`);
    }
  }
}

/** O vendedor só mexe nos próprios orçamentos; os de outros nem existem para quem só vê os seus. */
function ownQuote(id: string): Quote {
  const quote = quotes.find((q) => q.id === id);
  if (!quote) throw new QuoteNotFoundError(id);
  const access = mockAccess();
  if (access.role === 'Vendedor' && quote.seller !== access.sellerName) {
    if (mockOwnSeller() !== null) throw new QuoteNotFoundError(id);
    throw new ApiError(403, 'forbidden', 'Este orçamento é de outro vendedor.');
  }
  return quote;
}

/** Orçamentos criados no período, do mais recente para o mais antigo. */
export function listQuotes(period: Period, signal?: AbortSignal): Promise<Quote[]> {
  if (!USE_MOCKS) {
    const query = new URLSearchParams({ from: period.from, to: period.to });
    return viaApi(() => api<Quote[]>('GET', `/quotes?${query}`, undefined, signal));
  }
  return fromMock(() => {
    validatePeriod(period);
    const own = mockOwnSeller();
    return quotes
      .filter((q) => inPeriod(q.createdAt, period) && (own === null || q.seller === own))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, signal);
}

export function getQuote(id: string, signal?: AbortSignal): Promise<QuoteDetail> {
  if (!USE_MOCKS) return viaApi(() => api<QuoteDetail>('GET', `/quotes/${id}`, undefined, signal), id);
  return fromMock(() => {
    const quote = quotes.find((q) => q.id === id);
    const own = mockOwnSeller();
    if (!quote || (own !== null && quote.seller !== own)) throw new QuoteNotFoundError(id);
    const events = history.get(id) ?? [];
    const draft = drafts.get(id);
    return draft ? { ...quote, ...draft, history: events } : buildQuoteDetail(quote, events);
  }, signal);
}

/** Campos da listagem que derivam do formulário. */
function summarize(draft: QuoteDraft): Pick<Quote, 'customer' | 'seller' | 'amount' | 'validUntil'> {
  if (draft.items.length === 0) throw new Error('O orçamento precisa de ao menos um item.');
  const { total } = quoteTotals(draft.items, draft.discount);
  return { customer: draft.customerInfo.name, seller: draft.sellerInfo.name, amount: total, validUntil: draft.validUntil };
}

/**
 * Cria o orçamento como pendente, com o próximo número da sequência.
 * `note` é o primeiro evento do histórico (ex.: de qual orçamento foi copiado).
 */
export function createQuote(draft: QuoteDraft, note = 'Orçamento criado'): Promise<Quote> {
  if (!USE_MOCKS) return viaApi(() => api<Quote>('POST', '/quotes', { ...draft, note }));
  return fromMock(() => {
    checkDraft(draft);
    const next = Math.max(0, ...quotes.map((q) => Number(q.id) || 0)) + 1;
    const createdAt = new Date().toISOString();
    const quote: Quote = {
      id: String(next),
      number: `#${next}`,
      ...summarize(draft),
      status: 'Pendente',
      createdAt,
    };
    quotes = [quote, ...quotes];
    drafts.set(quote.id, draft);
    history.set(quote.id, [{ status: 'Pendente', at: createdAt, note }]);
    return quote;
  });
}

/** Só orçamentos pendentes podem ser editados; enviados ou fechados viram cópia. */
export function updateQuote(id: string, draft: QuoteDraft): Promise<Quote> {
  if (!USE_MOCKS) return viaApi(() => api<Quote>('PUT', `/quotes/${id}`, draft), id);
  return fromMock(() => {
    const current = ownQuote(id);
    if (current.status !== 'Pendente') throw new Error(`O orçamento ${current.number} não está mais pendente.`);
    checkDraft(draft);
    const updated: Quote = { ...current, ...summarize(draft) };
    quotes = quotes.map((q) => (q.id === id ? updated : q));
    drafts.set(id, draft);
    const events = history.get(id) ?? [];
    history.set(id, [...events, { status: 'Pendente', at: new Date().toISOString(), note: 'Orçamento editado' }]);
    return updated;
  });
}

const STATUS_NOTES: Record<QuoteStatus, string> = {
  Pendente: 'Voltou para pendente',
  Enviado: 'Enviado ao cliente',
  Aprovado: 'Aprovado pelo cliente',
  Cancelado: 'Orçamento cancelado',
};

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  if (!USE_MOCKS) {
    await viaApi(() => api<QuoteDetail>('POST', `/quotes/${id}/status`, { status }), id);
    return;
  }
  return fromMock(() => {
    ownQuote(id);
    quotes = quotes.map((q) => (q.id === id ? { ...q, status } : q));
    const events = history.get(id) ?? [];
    history.set(id, [...events, { status, at: new Date().toISOString(), note: STATUS_NOTES[status] }]);
  });
}
