import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { quoteStats } from '@/lib/quoteStats';
import { formatBRLRounded } from '@/lib/format';
import { quotesSnapshot } from '@/services/quotesService';
import { CustomerProfilePage } from './CustomerProfilePage';
import { SellerProfilePage } from './SellerProfilePage';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/clientes/:id', element: <CustomerProfilePage /> },
      { path: '/vendedores/:id', element: <SellerProfilePage /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe('ficha do cliente', () => {
  it('mostra os dados, os números e os orçamentos, sem repetir a coluna do cliente', async () => {
    renderAt('/clientes/c1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Restaurante Brasa Viva' })).toBeInTheDocument();
    expect(screen.getByText(/12\.345\.678\/0001-90 · \(54\) 3222-1840 · Caxias do Sul · Vendedor: Carlos Menezes/)).toBeInTheDocument();

    const own = quotesSnapshot().filter((q) => q.customer === 'Restaurante Brasa Viva');
    const stats = quoteStats(own);
    const table = await screen.findByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Cliente' })).not.toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(own.length + 1);
    expect(screen.getByText(formatBRLRounded(stats.approvedTotal), { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Último contato')).toBeInTheDocument();
  });

  it('avisa quando o cliente não existe', async () => {
    renderAt('/clientes/nao-existe');
    expect(await screen.findByRole('heading', { name: 'Cliente não encontrado' })).toBeInTheDocument();
  });
});

describe('ficha do vendedor', () => {
  it('lista os orçamentos dele, sem a coluna do vendedor', async () => {
    renderAt('/vendedores/v2');
    expect(await screen.findByRole('heading', { level: 1, name: 'Patrícia Lima' })).toBeInTheDocument();
    const table = await screen.findByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Vendedor' })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Cliente' })).toBeInTheDocument();
  });
});
