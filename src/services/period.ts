import { parseISODate, toISODate } from '@/lib/format';
import type { Period } from '@/types/dashboard';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 366;

export class InvalidPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPeriodError';
  }
}

export function validatePeriod(period: Period): void {
  if (!ISO_DATE.test(period.from) || !ISO_DATE.test(period.to)) {
    throw new InvalidPeriodError('Informe datas válidas.');
  }
  const from = parseISODate(period.from);
  const to = parseISODate(period.to);
  if (from > to) {
    throw new InvalidPeriodError('A data inicial deve ser anterior ou igual à data final.');
  }
  if (periodDays(period) > MAX_PERIOD_DAYS) {
    throw new InvalidPeriodError(`O período não pode ultrapassar ${MAX_PERIOD_DAYS} dias.`);
  }
}

/** Quantidade de dias do período, contando os dois extremos. */
export function periodDays(period: Period): number {
  const from = parseISODate(period.from);
  const to = parseISODate(period.to);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** Período de mesmo tamanho imediatamente anterior, para comparação. */
export function previousPeriod(period: Period): Period {
  const days = periodDays(period);
  const from = parseISODate(period.from);
  return {
    from: toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() - days)),
    to: toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1)),
  };
}

/** Se a data/hora ISO cai no período, pelo dia local. */
export function inPeriod(iso: string, period: Period): boolean {
  const day = toISODate(new Date(iso));
  return day >= period.from && day <= period.to;
}

/**
 * Parte de um valor mensal (ex.: meta) que cabe no período: cada dia vale
 * 1/(dias do seu mês). Um mês cheio dá o valor inteiro; meio mês, metade.
 */
export function prorateMonthly(monthly: number, period: Period): number {
  const from = parseISODate(period.from);
  let share = 0;
  for (let i = 0; i < periodDays(period); i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    share += 1 / new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  }
  return Math.round(monthly * share);
}
