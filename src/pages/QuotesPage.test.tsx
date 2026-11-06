import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QuotesPage } from './QuotesPage';

function cancelledCount(): number {
  const tab = screen.getByRole('button', { name: /^Cancelado · \d+$/ });
  return Number(/(\d+)$/.exec(tab.textContent ?? '')![1]);
}

describe('excluir cancelados na lista', () => {
  it('só com o filtro Cancelado aparecem as caixas; exclui só os marcados', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    const list = await screen.findByRole('region', { name: 'Lista de orçamentos' });
    expect(within(list).queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Cancelado · \d+$/ }));
    const before = cancelledCount();
    expect(before).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Excluir selecionados (0)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Excluir todos (${before})` })).toBeEnabled();

    const table = within(list).getByRole('table');
    const [first] = within(table).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    expect(screen.getByText('1 selecionado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir selecionados (1)' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir selecionados' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir 1' }));

    await waitFor(() => expect(cancelledCount()).toBe(before - 1));
    expect(screen.getByRole('button', { name: 'Excluir selecionados (0)' })).toBeDisabled();
  });

  it('a caixa do cabeçalho marca a página inteira', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Cancelado · \d+$/ }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('checkbox', { name: /^Selecionar #/ }).length;

    await user.click(within(table).getByRole('checkbox', { name: 'Selecionar todos desta página' }));
    expect(screen.getByRole('button', { name: `Excluir selecionados (${rows})` })).toBeEnabled();
  });
});
