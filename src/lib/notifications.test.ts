import { describe, expect, it } from 'vitest';
import type { Quote } from '@/types/quotes';
import { buildNotifications } from './notifications';

function quote(id: string, status: Quote['status'], validUntil: string, amount = 1000): Quote {
  return {
    id,
    number: `#${id}`,
    customer: `Cliente ${id}`,
    seller: 'Aline Costa',
    amount,
    status,
    createdAt: '2026-10-20T12:00:00.000Z',
    validUntil,
  };
}

describe('buildNotifications', () => {
  const today = '2026-11-06';

  it('avisa os em aberto que vencem até o prazo, mais urgentes e maiores primeiro', () => {
    const list = buildNotifications(
      [
        quote('1', 'Enviado', '2026-11-09'), // 3 dias: entra
        quote('2', 'Pendente', '2026-11-06', 500), // hoje
        quote('3', 'Enviado', '2026-11-06', 9000), // hoje, maior
        quote('4', 'Pendente', '2026-11-10'), // 4 dias: fora
        quote('5', 'Pendente', '2026-11-05'), // vencido: fora
        quote('6', 'Aprovado', '2026-11-07'), // aprovado: fora
        quote('7', 'Pendente', '2026-11-07'), // amanhã
      ],
      3,
      today,
    );
    expect(list.map((n) => n.title)).toEqual([
      '#3 vence hoje',
      '#2 vence hoje',
      '#7 vence amanhã',
      '#1 vence em 3 dias',
    ]);
  });

  it('monta texto, link e id estável', () => {
    const [n] = buildNotifications([quote('1142', 'Enviado', '2026-11-08', 30000)], 3, today);
    expect(n).toMatchObject({
      id: 'quote-expiring-1142-2026-11-08',
      kind: 'quote_expiring',
      link: '/orcamentos/1142',
      quote: { number: '#1142', days: 2, amount: 30000 },
    });
    expect(n!.message).toMatch(/^Cliente 1142 · Aline Costa · R\$\s30\.000,00$/);
  });
});
