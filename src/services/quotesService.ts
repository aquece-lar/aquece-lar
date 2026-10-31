import type { Period, QuoteStatus } from '@/types/dashboard';
import type { Quote, QuoteDetail, QuoteDraft, QuoteEvent } from '@/types/quotes';
import { quoteTotals } from '@/lib/quoteTotals';
import { inPeriod, validatePeriod } from './period';
import { fromMock } from './mockLatency';
import { buildHistory, buildQuoteDetail } from './mocks/quoteDetailMock';
import { QUOTES_MOCK } from './mocks/quotesMock';

/**
 * Cópia em memória: mudanças de status e orçamentos novos valem até a página
 * ser recarregada. O histórico parte do status original do mock e recebe os
 * novos eventos; os orçamentos criados guardam os dados do formulário.
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

/**
 * Leitura direta da cópia em memória, para os outros serviços simulados
 * (dashboard e contagens de clientes e vendedores) calcularem sobre os mesmos
 * orçamentos. Com a API, esses números vêm prontos do servidor.
 */
export function quotesSnapshot(): readonly Quote[] {
  return quotes;
}

/** Orçamentos criados no período, do mais recente para o mais antigo. */
export function listQuotes(period: Period, signal?: AbortSignal): Promise<Quote[]> {
  return fromMock(() => {
    validatePeriod(period);
    return quotes
      .filter((q) => inPeriod(q.createdAt, period))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, signal);
}

export function getQuote(id: string, signal?: AbortSignal): Promise<QuoteDetail> {
  return fromMock(() => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote) throw new QuoteNotFoundError(id);
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
  return fromMock(() => {
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
  return fromMock(() => {
    const current = quotes.find((q) => q.id === id);
    if (!current) throw new QuoteNotFoundError(id);
    if (current.status !== 'Pendente') throw new Error(`O orçamento ${current.number} não está mais pendente.`);
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

export function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  return fromMock(() => {
    if (!quotes.some((q) => q.id === id)) throw new QuoteNotFoundError(id);
    quotes = quotes.map((q) => (q.id === id ? { ...q, status } : q));
    const events = history.get(id) ?? [];
    history.set(id, [...events, { status, at: new Date().toISOString(), note: STATUS_NOTES[status] }]);
  });
}
