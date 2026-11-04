import type { Quote, QuoteDetail, QuoteEvent, QuoteItem } from '@/types/quotes';
import { quoteTotals } from '@/lib/quoteTotals';
import { DEFAULT_NOTES, PAYMENT_TERMS, termDiscount } from '@/config/quotes';
import { PRODUCTS_MOCK } from './productsMock';

/** Os orçamentos gerados usam só produtos ativos, sempre na mesma ordem. */
const CATALOG = PRODUCTS_MOCK.filter((p) => p.status === 'Ativo');
import { CUSTOMERS_MOCK, SELLERS_MOCK } from './peopleMock';

/** Nunca no futuro: um orçamento de ontem não pode ter sido aprovado "amanhã". */
function hoursAfter(iso: string, hours: number): string {
  return new Date(Math.min(Date.parse(iso) + hours * 3_600_000, Date.now())).toISOString();
}

/**
 * Subtotal que, com o percentual de desconto, fecha exatamente no valor do mock.
 * Procura alguns centavos em volta da divisão por causa dos arredondamentos.
 */
function subtotalFor(amount: number, percent: number): number | null {
  const guess = Math.round((amount / (1 - percent / 100)) * 100);
  for (const delta of [0, 1, -1, 2, -2, 3, -3]) {
    const subtotal = (guess + delta) / 100;
    if (quoteTotals([{ quantity: 1, unitPrice: subtotal }], { type: 'percent', value: percent }).total === amount) {
      return subtotal;
    }
  }
  return null;
}

/** Itens determinísticos cuja soma fecha exatamente em `subtotal`. */
function buildItems(quote: Quote, subtotal: number): QuoteItem[] {
  const seed = Number(quote.id) || 0;
  const count = 2 + (seed % 3);
  const picked = Array.from({ length: count }, (_, i) => CATALOG[(seed * 7 + i * 4) % CATALOG.length]!);
  // O preço de tabela serve só de peso: o valor final vem do total do mock.
  const weights = picked.map((p, i) => p.unitPrice * (i === 0 ? 2 : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  let used = 0;
  return picked.map(({ code, description }, i) => {
    const last = i === picked.length - 1;
    const quantity = last ? 1 : 1 + ((seed + i) % 2);
    const lineTotal = last
      ? Math.round((subtotal - used) * 100) / 100
      : Math.round(((weights[i]! / weightSum) * subtotal) / quantity) * quantity;
    used += lineTotal;
    return { code, description, quantity, unitPrice: lineTotal / quantity };
  });
}

/** Histórico coerente com o status original do orçamento; cada passo feito pelo próprio vendedor. */
export function buildHistory(quote: Quote): QuoteEvent[] {
  const by = quote.seller;
  const events: QuoteEvent[] = [{ status: 'Pendente', at: quote.createdAt, note: 'Orçamento criado', by, detail: '' }];
  if (quote.status === 'Enviado' || quote.status === 'Aprovado') {
    events.push({ status: 'Enviado', at: hoursAfter(quote.createdAt, 2), note: 'Enviado ao cliente por WhatsApp', by, detail: '' });
  }
  if (quote.status === 'Aprovado') {
    events.push({ status: 'Aprovado', at: hoursAfter(quote.createdAt, 30), note: 'Aprovado pelo cliente', by, detail: '' });
  }
  if (quote.status === 'Cancelado') {
    events.push({ status: 'Cancelado', at: hoursAfter(quote.createdAt, 26), note: 'Cliente desistiu da compra', by, detail: '' });
  }
  return events;
}

export function buildQuoteDetail(quote: Quote, history: QuoteEvent[]): QuoteDetail {
  const customer = CUSTOMERS_MOCK.find((c) => c.name === quote.customer);
  const seller = SELLERS_MOCK.find((s) => s.name === quote.seller);
  const seed = Number(quote.id) || 0;
  const paymentTerms = PAYMENT_TERMS[seed % PAYMENT_TERMS.length]!;
  // Condição com desconto: os itens somam mais e o desconto traz de volta ao valor do mock.
  const percent = termDiscount(paymentTerms);
  const subtotal = percent ? subtotalFor(quote.amount, percent) : null;
  const discount = percent && subtotal ? { type: 'percent' as const, value: percent } : null;

  return {
    ...quote,
    customerInfo: {
      name: quote.customer,
      detail: customer?.document ?? '',
      phone: customer?.phone ?? '',
      city: customer?.city,
    },
    sellerInfo: {
      name: quote.seller,
      detail: seller?.email ?? '',
      phone: seller?.phone ?? '',
    },
    items: buildItems(quote, subtotal ?? quote.amount),
    paymentTerms,
    discount,
    notes: DEFAULT_NOTES,
    history,
  };
}
