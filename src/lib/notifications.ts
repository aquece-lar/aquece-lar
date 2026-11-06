import type { Notification } from '@/types/notifications';
import type { Quote } from '@/types/quotes';
import { formatBRL, parseISODate, toISODate } from './format.js';
import { quoteExpiry } from './quoteExpiry.js';

/** Enviados esperando resposta: em quantos dias lembrar (0 desliga) e o dia do último envio de cada um. */
export interface FollowUp {
  days: number;
  /** Id do orçamento → dia (YYYY-MM-DD) em que foi enviado pela última vez. */
  sentOn: ReadonlyMap<string, string>;
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

function quoteData(quote: Quote, days: number): Notification['quote'] {
  return {
    id: quote.id,
    number: quote.number,
    customer: quote.customer,
    seller: quote.seller,
    amount: quote.amount,
    validUntil: quote.validUntil,
    days,
  };
}

/**
 * Avisos de quem está conectado:
 * - orçamentos em aberto que vencem em até `alertDays` dias (o mesmo aviso de
 *   vencimento do dashboard; os já vencidos não entram), os mais urgentes primeiro;
 * - depois, enviados sem resposta há `followUp.days` dias ou mais (sem os que já
 *   estão vencendo ou vencidos), os mais antigos primeiro.
 * No mesmo dia, os de maior valor primeiro.
 */
export function buildNotifications(
  quotes: readonly Quote[],
  alertDays: number,
  today: string = toISODate(new Date()),
  followUp?: FollowUp,
): Notification[] {
  return [...expiring(quotes, alertDays, today), ...followUps(quotes, alertDays, today, followUp)];
}

function followUps(quotes: readonly Quote[], alertDays: number, today: string, followUp?: FollowUp): Notification[] {
  if (!followUp || followUp.days <= 0) return [];
  return quotes
    .flatMap((quote) => {
      const sentOn = followUp.sentOn.get(quote.id);
      if (quote.status !== 'Enviado' || !sentOn || quoteExpiry(quote, alertDays, today)) return [];
      const days = daysBetween(sentOn, today);
      return days >= followUp.days ? [{ quote, days, sentOn }] : [];
    })
    .sort((a, b) => b.days - a.days || b.quote.amount - a.quote.amount)
    .map(({ quote, days, sentOn }) => ({
      // Reenviar o orçamento gera um aviso novo.
      id: `quote-follow-up-${quote.id}-${sentOn}`,
      kind: 'quote_follow_up' as const,
      title: `${quote.number} sem resposta há ${days} ${days === 1 ? 'dia' : 'dias'}`,
      message: `${quote.customer} · ${quote.seller} · ${formatBRL(quote.amount)}`,
      link: `/orcamentos/${quote.id}`,
      quote: quoteData(quote, days),
    }));
}

function expiring(quotes: readonly Quote[], alertDays: number, today: string): Notification[] {
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
      quote: quoteData(quote, days),
    }));
}
