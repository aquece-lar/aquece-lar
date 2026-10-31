import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SellerRanking } from './SellerRanking';

describe('SellerRanking', () => {
  it('mostra o quanto da meta foi orçado e destaca quem bateu', () => {
    render(
      <MemoryRouter>
        <SellerRanking
          sellers={[
            { id: 'a', name: 'Ana', quotes: 3, amount: 50000, goal: 200000 },
            { id: 'b', name: 'Bruno', quotes: 9, amount: 240000, goal: 200000 },
            { id: 'c', name: 'Caio', quotes: 1, amount: 9000, goal: null },
          ]}
        />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByText('Bruno')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Meta batida: 120% da meta de R$ 200.000')).toBeInTheDocument();
    expect(within(items[1]!).getByText('25% da meta de R$ 200.000')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Sem meta definida')).toBeInTheDocument();
  });
});
