import type { DailyPoint, DashboardData, ExpirySummary, Kpi, Period, SellerRank } from '@/types/dashboard';
import type { Seller } from '@/types/people';
import type { Quote } from '@/types/quotes';
import { formatBRLRounded, parseISODate, toISODate } from '@/lib/format';
import { quoteExpiry } from '@/lib/quoteExpiry';
import { inPeriod, previousPeriod, prorateMonthly } from '../period';

const RECENT_COUNT = 10;

function percentDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '—';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function countDelta(current: number, previous: number): string {
  const diff = current - previous;
  return `${diff > 0 ? '+' : ''}${diff}`;
}

function sum(quotes: readonly Quote[]): number {
  return quotes.reduce((total, q) => total + q.amount, 0);
}

function buildDaily(period: Period, quotes: readonly Quote[]): DailyPoint[] {
  const today = toISODate(new Date());
  const byDay = new Map<string, Quote[]>();
  for (const quote of quotes) {
    const day = toISODate(new Date(quote.createdAt));
    byDay.set(day, [...(byDay.get(day) ?? []), quote]);
  }

  const points: DailyPoint[] = [];
  const cursor = parseISODate(period.from);
  const end = parseISODate(period.to);
  while (cursor <= end) {
    const date = toISODate(cursor);
    const dayQuotes = byDay.get(date) ?? [];
    points.push({ date, quantity: dayQuotes.length, amount: sum(dayQuotes), partial: date === today });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

/**
 * Simula o que a API vai calcular: tudo sai dos mesmos orçamentos da
 * listagem, então um orçamento novo aparece no dashboard na hora.
 */
function buildExpiry(allQuotes: readonly Quote[], alertDays: number): ExpirySummary {
  const expiring: Quote[] = [];
  let expired = 0;
  for (const quote of allQuotes) {
    const expiry = quoteExpiry(quote, alertDays);
    if (expiry?.kind === 'expiring') expiring.push(quote);
    else if (expiry?.kind === 'expired') expired++;
  }
  expiring.sort((a, b) => a.validUntil.localeCompare(b.validUntil) || b.amount - a.amount);
  return { alertDays, expiring, expired };
}

export function buildDashboard(
  period: Period,
  allQuotes: readonly Quote[],
  sellers: Seller[],
  alertDays: number,
): DashboardData {
  const current = allQuotes.filter((q) => inPeriod(q.createdAt, period));
  const previous = allQuotes.filter((q) => inPeriod(q.createdAt, previousPeriod(period)));
  const customers = new Set(current.map((q) => q.customer)).size;
  const previousCustomers = new Set(previous.map((q) => q.customer)).size;
  const active = sellers.filter((s) => s.status === 'Ativo');

  const kpis: Kpi[] = [
    {
      id: 'orcamentos',
      label: 'Total de orçamentos',
      icon: 'file',
      value: String(current.length),
      delta: percentDelta(current.length, previous.length),
      note: 'vs. período anterior',
    },
    {
      id: 'valor',
      label: 'Valor total',
      icon: 'dollar',
      value: formatBRLRounded(sum(current)),
      delta: percentDelta(sum(current), sum(previous)),
      note: 'vs. período anterior',
    },
    {
      id: 'clientes',
      label: 'Clientes atendidos',
      icon: 'users',
      value: String(customers),
      delta: countDelta(customers, previousCustomers),
      note: 'vs. período anterior',
    },
    {
      id: 'vendedores',
      label: 'Vendedores ativos',
      icon: 'user',
      value: String(active.length),
      delta: `${active.length} de ${sellers.length}`,
      note: 'cadastrados',
    },
  ];

  const ranking: SellerRank[] = active.map((seller) => {
    const own = current.filter((q) => q.seller === seller.name);
    const goal = seller.monthlyGoal === null ? null : prorateMonthly(seller.monthlyGoal, period);
    return { id: seller.id, name: seller.name, quotes: own.length, amount: sum(own), goal };
  });

  const recentQuotes = [...current]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_COUNT);

  return { kpis, daily: buildDaily(period, current), ranking, recentQuotes, expiry: buildExpiry(allQuotes, alertDays) };
}
