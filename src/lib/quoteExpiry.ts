import type { Quote } from '@/types/quotes';
import { parseISODate, toISODate } from './format.js';

/** `days`: quantos dias faltam (vencendo) ou já passaram (vencido). */
export type Expiry = { kind: 'expired'; days: number } | { kind: 'expiring'; days: number };

/** Só pendentes e enviados esperam resposta do cliente; aprovados e cancelados não vencem. */
export function isOpen(quote: Pick<Quote, 'status'>): boolean {
  return quote.status === 'Pendente' || quote.status === 'Enviado';
}

/**
 * Situação da validade de um orçamento em aberto: vencido depois do último dia
 * de validade, vencendo quando faltam até `alertDays` dias (0 = só no dia).
 */
export function quoteExpiry(
  quote: Pick<Quote, 'status' | 'validUntil'>,
  alertDays: number,
  today: string = toISODate(new Date()),
): Expiry | null {
  if (!isOpen(quote)) return null;
  const days = Math.round((parseISODate(quote.validUntil).getTime() - parseISODate(today).getTime()) / 86_400_000);
  if (days < 0) return { kind: 'expired', days: -days };
  if (days <= alertDays) return { kind: 'expiring', days };
  return null;
}

/** Versão curta para listas, no mesmo formato: "Venc. hoje", "Venc. 2d", "Vencido". */
export function expiryShortLabel(expiry: Expiry): string {
  if (expiry.kind === 'expired') return 'Vencido';
  return expiry.days === 0 ? 'Venc. hoje' : `Venc. ${expiry.days}d`;
}

export function expiryLabel(expiry: Expiry): string {
  if (expiry.kind === 'expired') return expiry.days === 1 ? 'Venceu ontem' : `Vencido há ${expiry.days} dias`;
  if (expiry.days === 0) return 'Vence hoje';
  return expiry.days === 1 ? 'Vence amanhã' : `Vence em ${expiry.days} dias`;
}
