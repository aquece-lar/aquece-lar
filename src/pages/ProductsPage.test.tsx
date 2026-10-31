import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { listProducts } from '@/services/productsService';
import { ProductsPage } from './ProductsPage';

function setup() {
  const user = userEvent.setup();
  render(<ProductsPage />);
  return { user };
}

/** A lista tem tabela (desktop) e cartões (celular); a tabela basta para os testes. */
function table() {
  return screen.getByRole('table');
}

describe('ProductsPage', () => {
  it('lista os produtos e filtra por status e busca', async () => {
    const { user } = setup();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(within(table()).getByText('Boiler de acumulação 200 L')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inativos' }));
    expect(within(table()).getByText('Aquecedor a gás mecânico 15 L/min')).toBeInTheDocument();
    expect(within(table()).queryByText('Boiler de acumulação 200 L')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.type(screen.getByRole('searchbox'), 'lareira');
    expect(within(table()).getAllByRole('row')).toHaveLength(3); // cabeçalho + 2 lareiras
  });

  it('cadastra um produto novo com o código em maiúsculas', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /novo produto/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Novo produto' });
    await user.type(within(dialog).getByRole('textbox', { name: /código/i }), 'flt-01');
    await user.type(within(dialog).getByRole('textbox', { name: /descrição/i }), 'Filtro de água para aquecedor');
    await user.click(within(dialog).getByRole('combobox', { name: 'Categoria' }));
    await user.click(screen.getByRole('option', { name: 'Acessórios' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: /preço/i }), '89.9');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(table()).findByText('Filtro de água para aquecedor')).toBeInTheDocument();
    expect(within(table()).getByText('FLT-01')).toBeInTheDocument();
    expect(within(table()).getByText('R$ 89,90')).toBeInTheDocument();
    const saved = (await listProducts()).find((p) => p.code === 'FLT-01');
    expect(saved).toMatchObject({ category: 'Acessórios', unitPrice: 89.9, status: 'Ativo' });
  });

  it('valida os campos e acusa código já usado antes de salvar', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /novo produto/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo produto' });

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('Informe o código.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe a descrição.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe um preço maior que zero.')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /código/i }), 'blr-200');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('Já existe um produto com este código.')).toBeInTheDocument();
  });

  it('edita o preço de um produto', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.click(within(table()).getByRole('button', { name: 'Ações de Válvula de segurança para gás' }));
    await user.click(screen.getByRole('menuitem', { name: /editar/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar produto' });
    const price = within(dialog).getByRole('spinbutton', { name: /preço/i });
    await user.clear(price);
    await user.type(price, '210');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(table()).findByText('R$ 210,00')).toBeInTheDocument();
  });

  it('ao inativar um produto, ele vai para o fim da lista', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    const firstRow = () => within(table()).getAllByRole('row')[1];
    const lastRow = () => within(table()).getAllByRole('row').at(-1);
    expect(firstRow()).toHaveTextContent('Ativo');

    await user.click(within(table()).getByRole('button', { name: 'Ações de Boiler de acumulação 200 L' }));
    await user.click(screen.getByRole('menuitem', { name: /editar/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar produto' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Inativo' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(lastRow()).toHaveTextContent('Boiler de acumulação 200 L'));
    expect(lastRow()).toHaveTextContent('Inativo');
  });

  it('exclui um produto depois de confirmar', async () => {
    const { user } = setup();
    await screen.findByRole('table');
    await user.click(within(table()).getByRole('button', { name: 'Ações de Lareira a lenha 70 cm (linha antiga)' }));
    await user.click(screen.getByRole('menuitem', { name: /excluir/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Excluir produto' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(within(table()).queryByText('Lareira a lenha 70 cm (linha antiga)')).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
