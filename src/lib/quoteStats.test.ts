import { describe, expect, it } from 'vitest';
import type { QuoteStatus } from '@/types/dashboard';
import type { Quote } from '@/types/quotes';
import { quoteStats } from './quoteStats';

function quote(status: QuoteStatus, amount: number): Quote {
  return {
    id: String(amount),
    number: `#${amount}`,
    customer: 'Ana',
    seller: 'Carlos Menezes',
    amount,
    status,
    createdAt: '2026-11-01T12:00:00.000Z',
    validUntil: '2026-11-20',
  };
}

describe('quoteStats', () => {
  it('soma total, aprovado e em aberto; a taxa conta só os já respondidos', () => {
    const stats = quoteStats([
      quote('Aprovado', 1000),
      quote('Aprovado', 3000),
      quote('Cancelado', 500),
      quote('Enviado', 200),
      quote('Pendente', 100),
    ]);
    expect(stats).toEqual({
      count: 5,
      total: 4800,
      approvedCount: 2,
      approvedTotal: 4000,
      openCount: 2,
      openTotal: 300,
      decided: 3,
      approvalRate: 67,
    });
  });

  it('sem nenhum respondido, a taxa fica vazia', () => {
    expect(quoteStats([quote('Pendente', 100)]).approvalRate).toBeNull();
    expect(quoteStats([]).approvalRate).toBeNull();
  });
});
