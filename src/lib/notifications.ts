import type { Notification } from '@/types/notifications';
import type { Quote } from '@/types/quotes';
import { formatBRL, toISODate } from './format.js';
import { quoteExpiry } from './quoteExpiry.js';

/**
 * Avisos de orçamentos em aberto que vencem em até `alertDays` dias (o mesmo
 * aviso de vencimento do dashboard); os já vencidos não entram. Os mais
 * urgentes primeiro e, no mesmo dia, os de maior valor.
 */
export function buildNotifications(
  quotes: readonly Quote[],
  alertDays: number,
  today: string = toISODate(new Date()),
): Notification[] {
  return quotes
    .flatMap((quote) => {
      const expiry = quoteExpiry(quote, alertDays, today);
      return expiry?.kind === 'expiring' ? [{ quote, days: expiry.days }] : [];
    })
    .sort((a, b) => a.days - b.days || b.quote.amount - a.quote.amount)
    .map(({ quote, days }) => ({
      id: `quote-expiring-${quote.id}-${quote.validUntil}`,
      kind: 'quote_expiring' as const,
      title: `${quote.number} ${days === 0 ? 'vence hoje' : days === 1 ? 'vence amanhã' : `vence em ${days} dias`}`,
      message: `${quote.customer} · ${quote.seller} · ${formatBRL(quote.amount)}`,
      link: `/orcamentos/${quote.id}`,
      quote: {
        id: quote.id,
        number: quote.number,
        customer: quote.customer,
        seller: quote.seller,
        amount: quote.amount,
        validUntil: quote.validUntil,
        days,
      },
    }));
}
