import { describe, expect, it } from 'vitest';
import { toISODate } from '@/lib/format';
import { quoteTotals } from '@/lib/quoteTotals';
import type { QuoteDraft } from '@/types/quotes';
import {
  cancelQuotes,
  createQuote,
  deleteCancelledQuotes,
  deleteQuote,
  getQuote,
  listQuotes,
  QuoteNotFoundError,
  quotesSnapshot,
  updateQuote,
  updateQuoteStatus,
} from './quotesService';

// Os mocks andam com o relógio; os últimos 366 dias cobrem todos eles.
const now = new Date();
const YEAR = {
  from: toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365)),
  to: toISODate(now),
};

function draft(overrides: Partial<QuoteDraft> = {}): QuoteDraft {
  return {
    customerInfo: { name: 'Cliente Teste', detail: '', phone: '' },
    sellerInfo: { name: 'Carlos Menezes', detail: '', phone: '' },
    items: [
      { code: 'BLR-200', description: 'Boiler de acumulação 200 L', quantity: 2, unitPrice: 3790 },
      { code: 'SRV-INS', description: 'Serviço de instalação e teste', quantity: 1, unitPrice: 650 },
    ],
    validUntil: '2030-01-01',
    paymentTerms: 'À vista com 5% de desconto',
    discount: { type: 'percent', value: 5 },
    notes: '',
    ...overrides,
  };
}

describe('mocks de orçamentos', () => {
  it('itens e desconto de cada orçamento fecham no valor da lista', async () => {
    const quotes = await listQuotes(YEAR);
    expect(quotes.length).toBeGreaterThan(50);
    const details = await Promise.all(quotes.map((q) => getQuote(q.id)));
    for (const [index, detail] of details.entries()) {
      expect(quoteTotals(detail.items, detail.discount).total, detail.number).toBe(quotes[index]?.amount);
    }
    // A condição "à vista com 5%" vira desconto de fato nos mocks.
    expect(details.some((d) => d.discount?.type === 'percent' && d.discount.value === 5)).toBe(true);
  });
});

describe('createQuote', () => {
  it('cria pendente, com o próximo número e o total já com desconto', async () => {
    const before = await listQuotes(YEAR);
    const highest = Math.max(...before.map((q) => Number(q.id)));

    const quote = await createQuote(draft());

    expect(quote.id).toBe(String(highest + 1));
    expect(quote.number).toBe(`#${highest + 1}`);
    expect(quote.status).toBe('Pendente');
    expect(quote.amount).toBe(7818.5); // (2 × 3790 + 650) − 5%

    const detail = await getQuote(quote.id);
    expect(detail.customerInfo.name).toBe('Cliente Teste');
    expect(detail.discount).toEqual({ type: 'percent', value: 5 });
    expect(detail.history.map((e) => e.note)).toEqual(['Orçamento criado']);

    const after = await listQuotes(YEAR);
    expect(after[0]?.id).toBe(quote.id);
  });

  it('registra de onde veio uma cópia', async () => {
    const quote = await createQuote(draft(), 'Criado a partir do orçamento #1179');
    const detail = await getQuote(quote.id);
    expect(detail.history[0]?.note).toBe('Criado a partir do orçamento #1179');
  });

  it('recusa orçamento sem itens', async () => {
    await expect(createQuote(draft({ items: [] }))).rejects.toThrow('ao menos um item');
  });
});

describe('updateQuote', () => {
  it('altera um pendente, recalcula o total e registra no histórico', async () => {
    const quote = await createQuote(draft());
    const updated = await updateQuote(quote.id, draft({ discount: null, customerInfo: { name: 'Outro', detail: '', phone: '' } }));

    expect(updated.amount).toBe(8230);
    expect(updated.customer).toBe('Outro');
    const detail = await getQuote(quote.id);
    expect(detail.history.map((e) => e.note)).toEqual(['Orçamento criado', 'Orçamento editado']);
    // Sem ninguém conectado nos testes, quem faz é o administrador.
    expect(detail.history.map((e) => e.by)).toEqual(['Administrador', 'Administrador']);
    expect(detail.history[1]!.detail).toBe(
      'cliente: Cliente Teste → Outro; desconto: 5% → sem desconto; total: R$ 7.818,50 → R$ 8.230,00',
    );
  });

  it('recusa editar um orçamento que não está pendente', async () => {
    const quote = await createQuote(draft());
    await updateQuoteStatus(quote.id, 'Enviado');
    await expect(updateQuote(quote.id, draft())).rejects.toThrow('não está mais pendente');
  });

  it('avisa quando o orçamento não existe', async () => {
    await expect(updateQuote('999999', draft())).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});

describe('excluir orçamentos', () => {
  it('apaga um cancelado, com o histórico, e recusa os de outro status', async () => {
    await deleteQuote('1175');
    await expect(getQuote('1175')).rejects.toBeInstanceOf(QuoteNotFoundError);

    const pending = quotesSnapshot().find((q) => q.status === 'Pendente')!;
    await expect(deleteQuote(pending.id)).rejects.toThrow('Só orçamentos cancelados podem ser excluídos.');
    expect(quotesSnapshot().some((q) => q.id === pending.id)).toBe(true);
  });

  it('em lote, apaga só os cancelados', async () => {
    const cancelled = quotesSnapshot().filter((q) => q.status === 'Cancelado').slice(0, 2);
    const approved = quotesSnapshot().find((q) => q.status === 'Aprovado')!;
    const deleted = await deleteCancelledQuotes([...cancelled.map((q) => q.id), approved.id]);
    expect(deleted).toBe(2);
    expect(quotesSnapshot().some((q) => q.id === approved.id)).toBe(true);
    expect(quotesSnapshot().some((q) => cancelled.some((c) => c.id === q.id))).toBe(false);
  });

  it('cancela em lote só pendentes e enviados; com remove, já apaga', async () => {
    const pending = quotesSnapshot().find((q) => q.status === 'Pendente')!;
    const sent = quotesSnapshot().find((q) => q.status === 'Enviado')!;
    const approved = quotesSnapshot().find((q) => q.status === 'Aprovado')!;
    expect(await cancelQuotes([pending.id, approved.id])).toBe(1);
    expect(quotesSnapshot().find((q) => q.id === pending.id)!.status).toBe('Cancelado');
    expect(quotesSnapshot().find((q) => q.id === approved.id)!.status).toBe('Aprovado');

    expect(await cancelQuotes([sent.id, pending.id], { remove: true })).toBe(1);
    expect(quotesSnapshot().some((q) => q.id === sent.id)).toBe(false);
    expect(quotesSnapshot().some((q) => q.id === pending.id)).toBe(true);
  });
});
