import type { Period, QuoteStatus } from '@/types/dashboard';
import type { Quote, QuoteDetail, QuoteDraft, QuoteEvent } from '@/types/quotes';
import { can, discountOverLimit } from '@/lib/access';
import { describeQuoteChanges } from '@/lib/changes';
import { quoteTotals } from '@/lib/quoteTotals';
import { api, ApiError, USE_MOCKS } from './http';
import { InvalidPeriodError, inPeriod, validatePeriod } from './period';
import { fromMock } from './mockLatency';
import { mockAccess, mockEnsure, mockOwnSeller, mockUserName } from './mockSession';
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

/** Todos os eventos, para o histórico geral do modo fictício (Configurações → Histórico). */
export function quoteEventsSnapshot(): { quote: Quote; event: QuoteEvent; index: number }[] {
  return quotes.flatMap((quote) => (history.get(quote.id) ?? []).map((event, index) => ({ quote, event, index })));
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
    history.set(quote.id, [{ status: 'Pendente', at: createdAt, note, by: mockUserName(), detail: '' }]);
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
    const before = drafts.get(id) ?? buildQuoteDetail(current, []);
    const detail = describeQuoteChanges(before, draft);
    const updated: Quote = { ...current, ...summarize(draft) };
    quotes = quotes.map((q) => (q.id === id ? updated : q));
    drafts.set(id, draft);
    const events = history.get(id) ?? [];
    history.set(id, [...events, { status: 'Pendente', at: new Date().toISOString(), note: 'Orçamento editado', by: mockUserName(), detail }]);
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
    history.set(id, [...events, { status, at: new Date().toISOString(), note: STATUS_NOTES[status], by: mockUserName(), detail: '' }]);
  });
}

/** Apaga de vez um orçamento cancelado (com o histórico dele). Outro status: recusado. */
export async function deleteQuote(id: string): Promise<void> {
  if (!USE_MOCKS) {
    await viaApi(() => api<void>('DELETE', `/quotes/${id}`), id);
    return;
  }
  return fromMock(() => {
    mockEnsure('deleteRecords');
    if (ownQuote(id).status !== 'Cancelado') {
      throw new ApiError(409, 'quote_not_deletable', 'Só orçamentos cancelados podem ser excluídos.');
    }
    quotes = quotes.filter((q) => q.id !== id);
    history.delete(id);
  });
}

const CANCELLABLE: readonly QuoteStatus[] = ['Pendente', 'Enviado'];

/**
 * Cancela os pendentes e enviados entre `ids` (os outros ficam), ou com `remove` já apaga de vez.
 * Devolve quantos foram cancelados.
 */
export async function cancelQuotes(ids: readonly string[], { remove = false } = {}): Promise<number> {
  if (!USE_MOCKS) {
    return (await api<{ cancelled: number }>('POST', '/quotes/cancel', { ids, delete: remove })).cancelled;
  }
  return fromMock(() => {
    if (remove) mockEnsure('deleteRecords');
    const access = mockAccess();
    const hit = new Set(
      quotes
        .filter((q) => ids.includes(q.id) && CANCELLABLE.includes(q.status))
        .filter((q) => access.role !== 'Vendedor' || q.seller === access.sellerName)
        .map((q) => q.id),
    );
    if (remove) {
      quotes = quotes.filter((q) => !hit.has(q.id));
      for (const id of hit) history.delete(id);
    } else {
      const at = new Date().toISOString();
      quotes = quotes.map((q) => (hit.has(q.id) ? { ...q, status: 'Cancelado' } : q));
      for (const id of hit) {
        history.set(id, [...(history.get(id) ?? []), { status: 'Cancelado', at, note: STATUS_NOTES.Cancelado, by: mockUserName(), detail: '' }]);
      }
    }
    return hit.size;
  });
}

/** Apaga de vez os cancelados entre `ids` (os de outro status ficam); devolve quantos saíram. */
export async function deleteCancelledQuotes(ids: readonly string[]): Promise<number> {
  if (!USE_MOCKS) return (await api<{ deleted: number }>('DELETE', '/quotes', { ids })).deleted;
  return fromMock(() => {
    mockEnsure('deleteRecords');
    const gone = new Set(quotes.filter((q) => ids.includes(q.id) && q.status === 'Cancelado').map((q) => q.id));
    quotes = quotes.filter((q) => !gone.has(q.id));
    for (const id of gone) history.delete(id);
    return gone.size;
  });
}
