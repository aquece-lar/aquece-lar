import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { QuotesPage } from './QuotesPage';

function tabCount(status: string): number {
  const tab = screen.getByRole('button', { name: new RegExp(`^${status} · \\d+$`) });
  return Number(/(\d+)$/.exec(tab.textContent ?? '')![1]);
}

const cancelledCount = () => tabCount('Cancelado');

describe('cancelar em lote na lista', () => {
  it('cancela os marcados, que continuam na lista como cancelados', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Pendente · \d+$/ }));
    const pending = tabCount('Pendente');
    const cancelled = cancelledCount();
    expect(pending).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Cancelar (0)' })).toBeDisabled();

    const table = screen.getByRole('table');
    const boxes = within(table).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(boxes[0]!);
    await user.click(boxes[1]!);
    await user.click(screen.getByRole('button', { name: 'Cancelar (2)' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancelar orçamentos' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar 2' }));

    await waitFor(() => expect(tabCount('Pendente')).toBe(pending - 2));
    expect(cancelledCount()).toBe(cancelled + 2);
  });

  it('cancelar e apagar tira os marcados da lista', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Enviado · \d+$/ }));
    const sent = tabCount('Enviado');
    const cancelled = cancelledCount();

    const [first] = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    await user.click(screen.getByRole('button', { name: 'Cancelar e apagar (1)' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancelar e apagar' });
    await user.click(within(dialog).getByRole('button', { name: 'Apagar 1' }));

    await waitFor(() => expect(tabCount('Enviado')).toBe(sent - 1));
    expect(cancelledCount()).toBe(cancelled);
  });

  it('aprovados não ganham caixa', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Aprovado · \d+$/ }));
    expect(within(screen.getByRole('table')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancelar \(/ })).not.toBeInTheDocument();
  });
});

describe('excluir cancelados na lista', () => {
  it('com o filtro Cancelado, exclui só os marcados', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    const list = await screen.findByRole('region', { name: 'Lista de orçamentos' });

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

  it('reabre os marcados como pendentes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Cancelado · \d+$/ }));
    const cancelled = cancelledCount();
    const pending = tabCount('Pendente');
    expect(screen.getByRole('button', { name: 'Reabrir (0)' })).toBeDisabled();

    const [first] = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    await user.click(screen.getByRole('button', { name: 'Reabrir (1)' }));
    const dialog = screen.getByRole('dialog', { name: 'Reabrir orçamentos' });
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir 1' }));

    await waitFor(() => expect(cancelledCount()).toBe(cancelled - 1));
    expect(tabCount('Pendente')).toBe(pending + 1);
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
