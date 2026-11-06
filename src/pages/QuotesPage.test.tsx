import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QuotesPage } from './QuotesPage';

function tabCount(status: string): number {
  const tab = screen.getByRole('button', { name: new RegExp(`^${status} · \\d+$`) });
  return Number(/(\d+)$/.exec(tab.textContent ?? '')![1]);
}

const cancelledCount = () => tabCount('Cancelado');

describe('exportar', () => {
  it('baixa a lista filtrada numa planilha', async () => {
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:planilha';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Aprovado · \d+$/ }));
    const approved = tabCount('Aprovado');

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^orcamentos_\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}_aprovados\.csv$/);
    const lines = (await blobs[0]!.text()).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Nº;Cliente;Vendedor;Status;Valor (R$);Criado em;Validade');
    expect(lines).toHaveLength(approved + 1);
    expect(lines.slice(1).every((line) => line.includes(';Aprovado;'))).toBe(true);
    click.mockRestore();
  });
});

/** As ações em lote aparecem no lugar dos títulos da tabela, só com algo marcado. */
function head() {
  return within(screen.getByRole('table')).getAllByRole('rowgroup')[0]!;
}

describe('cancelar em lote na lista', () => {
  it('sem nada marcado não há ações; cancela os marcados, que continuam como cancelados', async () => {
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
    expect(within(head()).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

    const boxes = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(boxes[0]!);
    await user.click(boxes[1]!);
    expect(within(head()).getByText('2 selecionados')).toBeInTheDocument();
    await user.click(within(head()).getByRole('button', { name: 'Cancelar' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancelar orçamentos' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar 2' }));

    await waitFor(() => expect(tabCount('Pendente')).toBe(pending - 2));
    expect(cancelledCount()).toBe(cancelled + 2);
    expect(within(head()).getByText('Nº')).toBeInTheDocument();
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
    await user.click(within(head()).getByRole('button', { name: 'Cancelar e apagar' }));
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
  });
});

describe('cancelados na lista', () => {
  it('exclui só os marcados', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Cancelado · \d+$/ }));
    const before = cancelledCount();
    expect(before).toBeGreaterThan(1);

    const [first] = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    expect(within(head()).getByText('1 selecionado')).toBeInTheDocument();
    await user.click(within(head()).getByRole('button', { name: 'Excluir' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir cancelados' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir 1' }));

    await waitFor(() => expect(cancelledCount()).toBe(before - 1));
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

    const [first] = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    await user.click(within(head()).getByRole('button', { name: 'Reabrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Reabrir orçamentos' });
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir 1' }));

    await waitFor(() => expect(cancelledCount()).toBe(cancelled - 1));
    expect(tabCount('Pendente')).toBe(pending + 1);
  });

  it('a caixa do cabeçalho marca a página inteira, e "Limpar seleção" desmarca', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Pendente · \d+$/ }));
    const rows = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ }).length;

    await user.click(within(head()).getByRole('checkbox', { name: 'Selecionar todos desta página' }));
    expect(within(head()).getByText(`${rows} selecionados`)).toBeInTheDocument();
    // Se a página não tem todos, "Selecionar todos" completa; aí aparece "Limpar seleção".
    const all = within(head()).queryByRole('button', { name: /^Selecionar todos os \d+$/ });
    if (all) await user.click(all);
    await user.click(within(head()).getByRole('button', { name: 'Limpar seleção' }));
    expect(within(head()).queryByText(/selecionados$/)).not.toBeInTheDocument();
    expect(within(head()).getByText('Nº')).toBeInTheDocument();
  });

  it('"Selecionar todos" pega a lista inteira, de todas as páginas, e exclui tudo', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', { name: 'Lista de orçamentos' });
    await user.click(screen.getByRole('button', { name: /^Cancelado · \d+$/ }));
    const before = cancelledCount();

    const [first] = within(screen.getByRole('table')).getAllByRole('checkbox', { name: /^Selecionar #/ });
    await user.click(first!);
    await user.click(within(head()).getByRole('button', { name: `Selecionar todos os ${before}` }));
    expect(within(head()).getByText(`${before} selecionados`)).toBeInTheDocument();
    await user.click(within(head()).getByRole('button', { name: 'Excluir' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir cancelados' });
    await user.click(within(dialog).getByRole('button', { name: `Excluir ${before}` }));

    await waitFor(() => expect(cancelledCount()).toBe(0));
  });
});
