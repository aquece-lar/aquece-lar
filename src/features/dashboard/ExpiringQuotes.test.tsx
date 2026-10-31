import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { toISODate } from '@/lib/format';
import type { ExpirySummary, RecentQuote } from '@/types/dashboard';
import { ExpiringQuotes } from './ExpiringQuotes';

function inDays(days: number): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

function quote(id: string, validIn: number): RecentQuote {
  return {
    id,
    number: `#${id}`,
    customer: `Cliente ${id}`,
    seller: 'Ana',
    amount: 1000,
    status: 'Enviado',
    createdAt: new Date().toISOString(),
    validUntil: inDays(validIn),
  };
}

function renderBlock(expiry: ExpirySummary) {
  return render(
    <MemoryRouter>
      <ExpiringQuotes expiry={expiry} />
    </MemoryRouter>,
  );
}

describe('ExpiringQuotes', () => {
  it('lista os que vencem, com selo e link, e conta os vencidos', () => {
    renderBlock({ alertDays: 3, expiring: [quote('10', 0), quote('11', 2)], expired: 4 });
    expect(screen.getByRole('heading', { name: '2 orçamentos vencem nos próximos 3 dias' })).toBeInTheDocument();
    expect(screen.getByText('Vence hoje')).toBeInTheDocument();
    expect(screen.getByText('Vence em 2 dias')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /#10/ })).toHaveAttribute('href', '/orcamentos/10');
    expect(screen.getByText(/4 orçamentos já venceram sem resposta/)).toBeInTheDocument();
  });

  it('mostra até 6 e avisa quantos ficaram de fora', () => {
    const many = Array.from({ length: 8 }, (_, i) => quote(String(20 + i), 1));
    renderBlock({ alertDays: 1, expiring: many, expired: 0 });
    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(screen.getByText(/E mais 2 vencendo/)).toBeInTheDocument();
  });

  it('não aparece quando não há nada para cobrar', () => {
    const { container } = renderBlock({ alertDays: 3, expiring: [], expired: 0 });
    expect(container).toBeEmptyDOMElement();
  });
});
