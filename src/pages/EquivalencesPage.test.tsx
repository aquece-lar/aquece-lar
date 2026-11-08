import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { listEquivalences } from '@/services/equivalencesService';
import { EquivalencesPage } from './EquivalencesPage';

function setup() {
  const user = userEvent.setup();
  render(<EquivalencesPage />);
  return { user };
}

describe('EquivalencesPage', () => {
  it('lista os termos e filtra por tipo e busca', async () => {
    const { user } = setup();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('“REU-1002”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outras marcas' }));
    expect(within(table).getAllByRole('row')).toHaveLength(3); // cabeçalho + Rinnai + Komeco

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.type(screen.getByRole('searchbox'), 'piscina');
    expect(within(table).getAllByRole('row')).toHaveLength(3); // cabeçalho + 2 termos do PIS-AQ3
  });

  it('a caixa "Testar" mostra o produto que a frase cita', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.type(screen.getByRole('textbox', { name: 'Frase do cliente' }), 'tem o KO-33 da Komeco?');
    const results = screen.getByRole('list', { name: 'Produtos encontrados' });
    expect(within(results).getByText('AQG-33P')).toBeInTheDocument();
    expect(within(results).getByText('por “KO 33”')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Frase do cliente' }));
    await user.type(screen.getByRole('textbox', { name: 'Frase do cliente' }), 'lareira de canto');
    expect(screen.getByText(/Nenhum produto encontrado/)).toBeInTheDocument();
  });

  it('cadastra uma equivalência nova', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /nova equivalência/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /^Termo/ }), 'lareira de canto');
    await user.type(within(dialog).getByRole('combobox'), 'LRL-900');
    await user.click(await within(document.body).findByRole('option', { name: /LRL-900/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(screen.getByRole('table')).findByText('“lareira de canto”')).toBeInTheDocument();
    expect((await listEquivalences()).find((e) => e.term === 'lareira de canto')?.productCode).toBe('LRL-900');
  });
});
