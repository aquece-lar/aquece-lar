import { describe, expect, it } from 'vitest';
import { formatBRLRounded, toISODate } from '@/lib/format';
import type { Period } from '@/types/dashboard';
import { getDashboard, InvalidPeriodError } from './dashboardService';
import { quoteExpiry } from '@/lib/quoteExpiry';
import { prorateMonthly } from './period';
import { createQuote, listQuotes } from './quotesService';
import { getSettings, saveSettings } from './settingsService';

function lastDays(days: number): Period {
  const now = new Date();
  return {
    from: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))),
    to: toISODate(now),
  };
}

function kpi(data: Awaited<ReturnType<typeof getDashboard>>, id: string) {
  return data.kpis.find((k) => k.id === id);
}

describe('getDashboard', () => {
  it('bate com a lista de orçamentos do mesmo período', async () => {
    const period = lastDays(30);
    const [data, quotes] = await Promise.all([getDashboard(period), listQuotes(period)]);
    const total = quotes.reduce((sum, q) => sum + q.amount, 0);

    expect(quotes.length).toBeGreaterThan(30); // o mês nunca fica vazio
    expect(kpi(data, 'orcamentos')?.value).toBe(String(quotes.length));
    expect(kpi(data, 'valor')?.value).toBe(formatBRLRounded(total));
    expect(kpi(data, 'clientes')?.value).toBe(String(new Set(quotes.map((q) => q.customer)).size));

    expect(data.daily).toHaveLength(30);
    expect(data.daily.reduce((sum, d) => sum + d.quantity, 0)).toBe(quotes.length);
    expect(data.daily.at(-1)?.partial).toBe(true);
    expect(data.ranking.reduce((sum, r) => sum + r.quotes, 0)).toBe(quotes.length);
    expect(data.recentQuotes.map((q) => q.id)).toEqual(quotes.slice(0, 10).map((q) => q.id));
  });

  it('um orçamento novo entra no total, no dia de hoje, no ranking e nos recentes', async () => {
    const period = lastDays(7);
    const before = await getDashboard(period);

    const quote = await createQuote({
      customerInfo: { name: 'Restaurante Brasa Viva', detail: '', phone: '' },
      sellerInfo: { name: 'Carlos Menezes', detail: '', phone: '' },
      items: [{ code: 'BLR-200', description: 'Boiler de acumulação 200 L', quantity: 1, unitPrice: 3790 }],
      validUntil: '2099-01-01',
      paymentTerms: '3x sem juros no cartão',
      discount: null,
      notes: '',
    });
    const after = await getDashboard(period);

    expect(Number(kpi(after, 'orcamentos')?.value)).toBe(Number(kpi(before, 'orcamentos')?.value) + 1);
    expect(after.daily.at(-1)?.quantity).toBe((before.daily.at(-1)?.quantity ?? 0) + 1);
    expect(after.daily.at(-1)?.amount).toBe((before.daily.at(-1)?.amount ?? 0) + 3790);
    const carlos = (data: typeof after) => data.ranking.find((r) => r.name === 'Carlos Menezes');
    expect(carlos(after)?.quotes).toBe((carlos(before)?.quotes ?? 0) + 1);
    expect(after.recentQuotes[0]?.id).toBe(quote.id);
  });

  it('conta os vendedores ativos do cadastro', async () => {
    const data = await getDashboard(lastDays(30));
    expect(kpi(data, 'vendedores')).toMatchObject({ value: '6', delta: '6 de 8' });
  });

  it('recusa período inválido', async () => {
    await expect(getDashboard({ from: '2026-10-10', to: '2026-10-01' })).rejects.toBeInstanceOf(InvalidPeriodError);
  });
});

describe('metas no ranking', () => {
  it('no mês cheio a meta é a mensal; em meio mês, proporcional', async () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const month: Period = {
      from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISODate(new Date(now.getFullYear(), now.getMonth(), lastDay)),
    };
    const firstHalf: Period = { from: month.from, to: toISODate(new Date(now.getFullYear(), now.getMonth(), 15)) };

    const [full, half] = await Promise.all([getDashboard(month), getDashboard(firstHalf)]);
    const rafael = (data: typeof full) => data.ranking.find((r) => r.name === 'Rafael Bortolini');
    expect(rafael(full)?.goal).toBe(380000);
    expect(rafael(half)?.goal).toBe(Math.round((380000 * 15) / lastDay));
    expect(full.ranking.find((r) => r.name === 'Diego Ferraz')?.goal).toBeNull();
  });

  it('prorateMonthly soma a fração de cada mês tocado', () => {
    expect(prorateMonthly(31000, { from: '2026-10-01', to: '2026-10-31' })).toBe(31000);
    expect(prorateMonthly(30000, { from: '2026-10-31', to: '2026-11-01' })).toBe(Math.round(30000 / 31 + 1000));
  });
});

describe('orçamentos vencendo', () => {
  it('lista os abertos que vencem dentro do aviso e conta os vencidos', async () => {
    const all = await listQuotes(lastDays(366));
    const data = await getDashboard(lastDays(7));
    const { alertDays, expiring, expired } = data.expiry;
    expect(alertDays).toBe(3);

    const expected = all.filter((q) => quoteExpiry(q, 3)?.kind === 'expiring');
    expect(expected.length).toBeGreaterThan(0);
    expect(expiring.map((q) => q.id).sort()).toEqual(expected.map((q) => q.id).sort());
    expect(expiring.map((q) => q.validUntil)).toEqual([...expiring.map((q) => q.validUntil)].sort());
    expect(expired).toBe(all.filter((q) => quoteExpiry(q, 3)?.kind === 'expired').length);
  });

  it('segue o aviso das configurações', async () => {
    const original = await getSettings();
    try {
      await saveSettings({ ...original, quotes: { ...original.quotes, expiryAlertDays: 10 } });
      const wide = await getDashboard(lastDays(7));
      await saveSettings({ ...original, quotes: { ...original.quotes, expiryAlertDays: 0 } });
      const today = await getDashboard(lastDays(7));
      expect(wide.expiry.alertDays).toBe(10);
      expect(wide.expiry.expiring.length).toBeGreaterThan(today.expiry.expiring.length);
      expect(today.expiry.expiring.every((q) => q.validUntil === toISODate(new Date()))).toBe(true);
    } finally {
      await saveSettings(original);
    }
  });
});
