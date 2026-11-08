import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from './Combobox';

const OPTIONS: ComboboxOption[] = [
  { id: 'c1', name: 'Restaurante Brasa Viva', hint: 'Caxias do Sul' },
  { id: 'c2', name: 'Patrícia Lima', hint: 'Caxias do Sul' },
  { id: 'c3', name: 'Pousada Recanto da Serra', hint: 'Canela' },
];

function Harness({ initial = '', onCreate }: { initial?: string; onCreate?: (text: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="campo">Cliente</label>
      <Combobox id="campo" options={OPTIONS} value={value} onChange={setValue} placeholder="Escolha" onCreate={onCreate} />
      <output data-testid="valor">{value}</output>
      <button type="button">fora</button>
    </>
  );
}

function setup(props?: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  return { user, input: screen.getByRole('combobox', { name: 'Cliente' }) };
}

describe('Combobox', () => {
  it('abre a lista completa ao clicar', async () => {
    const { user, input } = setup();
    await user.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('filtra sem diferenciar acento e também pela linha secundária', async () => {
    const { user, input } = setup();
    await user.type(input, 'patricia');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Patrícia Lima')]);

    await user.clear(input);
    await user.type(input, 'canela');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Pousada Recanto da Serra'),
    ]);
  });

  it('escolhe com as setas e Enter', async () => {
    const { user, input } = setup();
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('c2');
    expect(input).toHaveValue('Patrícia Lima');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ao sair: nome exato escolhe, texto sem correspondência volta ao escolhido', async () => {
    const { user, input } = setup({ initial: 'c1' });

    await user.clear(input);
    await user.type(input, 'pousada recanto da serra');
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.getByTestId('valor')).toHaveTextContent('c3');

    await user.clear(input);
    await user.type(input, 'xyz');
    expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(input).toHaveValue('Pousada Recanto da Serra');
    expect(screen.getByTestId('valor')).toHaveTextContent('c3');
  });

  it('apagar o texto limpa a escolha', async () => {
    const { user, input } = setup({ initial: 'c1' });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.getByTestId('valor')).toBeEmptyDOMElement();
  });

  it('oferece cadastrar o texto digitado quando não há nome igual', async () => {
    const onCreate = vi.fn();
    const { user, input } = setup({ onCreate });

    await user.type(input, 'Padaria Serrana');
    await user.click(screen.getByRole('option', { name: /Cadastrar “Padaria Serrana”/ }));
    expect(onCreate).toHaveBeenCalledWith('Padaria Serrana');

    // Com um nome que já existe, não oferece cadastro.
    await user.clear(input);
    await user.type(input, 'Patrícia Lima');
    expect(screen.queryByRole('option', { name: /Cadastrar/ })).not.toBeInTheDocument();
  });

  it('chega ao "Cadastrar" pelo teclado', async () => {
    const onCreate = vi.fn();
    const { user, input } = setup({ onCreate });
    await user.type(input, 'Brasa Nova');
    await user.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledWith('Brasa Nova');
  });

  it('acha também pelas palavras-chave, que não aparecem na lista', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="produto">Produto</label>
        <Combobox
          id="produto"
          options={[
            { id: 'AQG-20D', name: 'AQG-20D · Aquecedor a gás digital', keywords: ['aquecedor 20 litros'] },
            { id: 'BLR-200', name: 'BLR-200 · Boiler 200 L' },
          ]}
          value=""
          onChange={() => {}}
          placeholder="Escolha"
        />
      </>,
    );
    await user.type(screen.getByRole('combobox', { name: 'Produto' }), '20 litros');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['AQG-20D · Aquecedor a gás digital']);
  });
});

