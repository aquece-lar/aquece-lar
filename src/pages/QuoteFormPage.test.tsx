import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { saveProduct } from '@/services/productsService';
import { getQuote } from '@/services/quotesService';
import { getSettings, saveSettings } from '@/services/settingsService';
import { formatDate, toISODate } from '@/lib/format';
import { QuoteFormPage } from './QuoteFormPage';

function DetailStub() {
  const { id } = useParams();
  return <p>detalhe {id}</p>;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/orcamentos', element: <p>lista</p> },
      { path: '/orcamentos/novo', element: <QuoteFormPage mode="new" /> },
      { path: '/orcamentos/:id/editar', element: <QuoteFormPage mode="edit" /> },
      { path: '/orcamentos/:id/duplicar', element: <QuoteFormPage mode="duplicate" /> },
      { path: '/orcamentos/:id', element: <DetailStub /> },
    ],
    { initialEntries: [path] },
  );
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { user, router };
}

/** Espera os cadastros e o catálogo carregarem (o campo de cliente só aparece com tudo pronto). */
async function customerField() {
  return screen.findByRole('combobox', { name: /cliente/i });
}

async function choose(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
  await user.keyboard('{Enter}');
}

describe('novo orçamento', () => {
  it('preenche, sugere vendedor e desconto, salva e abre o detalhe', async () => {
    const { user } = renderAt('/orcamentos/novo');

    await choose(user, await customerField(), 'brasa');
    expect(screen.getByRole('combobox', { name: /vendedor/i })).toHaveValue('Carlos Menezes');

    await choose(user, screen.getByRole('combobox', { name: 'Produto' }), 'boiler');
    // Preço de tabela 3.790 com os 5% da condição padrão.
    expect(screen.getByText('R$ 3.600,50')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));

    const detail = await screen.findByText(/^detalhe \d+$/);
    const id = detail.textContent?.replace('detalhe ', '') ?? '';
    const saved = await getQuote(id);
    expect(saved.customer).toBe('Restaurante Brasa Viva');
    expect(saved.seller).toBe('Carlos Menezes');
    expect(saved.items).toEqual([
      { code: 'BLR-200', description: 'Boiler de acumulação 200 L', quantity: 1, unitPrice: 3790 },
    ]);
    expect(saved.discount).toEqual({ type: 'percent', value: 5 });
    expect(saved.amount).toBe(3600.5);
  });

  it('mostra os erros de cada campo ao salvar vazio', async () => {
    const { user } = renderAt('/orcamentos/novo');
    await customerField();
    await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));

    expect(screen.getByText('Escolha o cliente.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o vendedor.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o produto.')).toBeInTheDocument();
    expect(screen.getByText('Valor inválido.')).toBeInTheDocument();
  });

  it('troca de condição de pagamento tira e devolve o desconto sugerido', async () => {
    const { user } = renderAt('/orcamentos/novo');
    await customerField();
    const discount = screen.getByRole('spinbutton', { name: 'Desconto' });
    const payment = screen.getByRole('combobox', { name: 'Pagamento' });

    expect(discount).toHaveValue(5);
    await user.click(payment);
    await user.click(screen.getByRole('option', { name: '3x sem juros no cartão' }));
    expect(discount).toHaveValue(null);
    await user.click(payment);
    await user.click(screen.getByRole('option', { name: 'À vista com 5% de desconto' }));
    expect(discount).toHaveValue(5);

    // Desconto digitado à mão não é tocado pela troca.
    await user.clear(discount);
    await user.type(discount, '8');
    await user.click(payment);
    await user.click(screen.getByRole('option', { name: '3x sem juros no cartão' }));
    expect(discount).toHaveValue(8);
  });

  it('cadastra um cliente novo pela busca e já o escolhe', async () => {
    const { user } = renderAt('/orcamentos/novo');
    const field = await customerField();

    await user.type(field, 'Padaria Teste');
    await user.click(screen.getByRole('option', { name: /Cadastrar “Padaria Teste”/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Novo cliente' });
    expect(within(dialog).getByRole('textbox', { name: /nome/i })).toHaveValue('Padaria Teste');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('PT'); // iniciais no cartão do cliente
    expect(field).toHaveValue('Padaria Teste');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('catálogo vindo do cadastro de produtos', () => {
  it('oferece um produto recém-cadastrado e esconde os inativos', async () => {
    await saveProduct({
      id: 'p-teste',
      code: 'TRM-01',
      description: 'Termostato digital de parede',
      category: 'Acessórios',
      unitPrice: 320,
      status: 'Ativo',
    });
    const { user } = renderAt('/orcamentos/novo');
    await customerField();
    const product = screen.getByRole('combobox', { name: 'Produto' });

    await user.type(product, 'termostato');
    expect(screen.getByRole('option', { name: /TRM-01 · Termostato digital de parede/ })).toBeInTheDocument();

    await user.clear(product);
    await user.type(product, 'AQG-15M'); // inativo no cadastro
    expect(screen.queryByRole('option', { name: /AQG-15M/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument();
  });
});

describe('aviso de alterações não salvas', () => {
  it('sai direto quando nada foi alterado', async () => {
    const { user } = renderAt('/orcamentos/novo');
    await customerField();
    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    expect(await screen.findByText('lista')).toBeInTheDocument();
  });

  it('pergunta antes de sair com alterações e respeita a resposta', async () => {
    const { user } = renderAt('/orcamentos/novo');
    await customerField();
    await user.type(screen.getByRole('textbox', { name: 'Observações' }), ' Urgente.');

    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Descartar alterações?' });
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novo orçamento' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar e sair' }));
    expect(await screen.findByText('lista')).toBeInTheDocument();
  });
});

describe('editar e duplicar', () => {
  it('abre a edição de um pendente com os dados do orçamento', async () => {
    renderAt('/orcamentos/1181/editar');
    expect(await customerField()).toHaveValue('Restaurante Brasa Viva');
    expect(screen.getByRole('heading', { name: 'Editar orçamento #1181' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
  });

  it('não deixa editar um orçamento aprovado e oferece a cópia', async () => {
    renderAt('/orcamentos/1179/editar');
    expect(await screen.findByRole('heading', { name: 'Este orçamento não pode ser editado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /duplicar/i })).toHaveAttribute('href', '/orcamentos/1179/duplicar');
  });

  it('duplicar cria um orçamento novo e mantém o original', async () => {
    const original = await getQuote('1179');
    const { user } = renderAt('/orcamentos/1179/duplicar');
    await customerField();
    await user.click(screen.getByRole('button', { name: /criar cópia/i }));

    const detail = await screen.findByText(/^detalhe \d+$/);
    const id = detail.textContent?.replace('detalhe ', '') ?? '';
    expect(id).not.toBe('1179');
    const copy = await getQuote(id);
    expect(copy.status).toBe('Pendente');
    expect(copy.amount).toBe(original.amount);
    expect(copy.history[0]?.note).toBe('Criado a partir do orçamento #1179');
    expect((await getQuote('1179')).status).toBe(original.status);
  });
});

describe('padrões vindos das configurações', () => {
  it('orçamento novo usa validade, condições e observações configuradas', async () => {
    const original = await getSettings();
    await saveSettings({
      ...original,
      quotes: {
        validDays: 30,
        paymentTerms: ['PIX com 10% de desconto', 'Boleto 30 dias'],
        notes: 'Frete incluso.',
        maxDiscountPercent: null,
      },
    });
    try {
      const { user } = renderAt('/orcamentos/novo');
      await customerField();

      const now = new Date();
      const expected = formatDate(toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)));
      expect(screen.getByRole('button', { name: /validade/i })).toHaveTextContent(expected);
      expect(screen.getByRole('spinbutton', { name: 'Desconto' })).toHaveValue(10);
      expect(screen.getByRole('textbox', { name: /observações/i })).toHaveValue('Frete incluso.');

      const payment = screen.getByRole('combobox', { name: 'Pagamento' });
      expect(payment).toHaveTextContent('PIX com 10% de desconto');
      await user.click(payment);
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'PIX com 10% de desconto',
        'Boleto 30 dias',
      ]);
    } finally {
      await saveSettings(original);
    }
  });
});

describe('limite de desconto das configurações', () => {
  it('avisa e pede confirmação acima do limite, em % ou em R$', async () => {
    const { user } = renderAt('/orcamentos/novo');
    await choose(user, await customerField(), 'brasa');
    await choose(user, screen.getByRole('combobox', { name: 'Produto' }), 'boiler');

    // R$ 500 sobre 3.790 dá 13,19%, acima dos 10% padrão.
    const discount = screen.getByRole('spinbutton', { name: 'Desconto' });
    await user.click(screen.getByRole('button', { name: 'R$' }));
    await user.clear(discount);
    await user.type(discount, '500');
    expect(screen.getByText(/desconto de 13,19%, acima do limite de 10%/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '%' }));
    await user.clear(discount);
    await user.type(discount, '10');
    expect(screen.queryByText(/acima do limite/i)).not.toBeInTheDocument();

    await user.clear(discount);
    await user.type(discount, '15');
    await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Desconto acima do limite' });
    await user.click(within(dialog).getByRole('button', { name: 'Revisar desconto' }));
    expect(screen.queryByRole('dialog', { name: 'Desconto acima do limite' })).not.toBeInTheDocument();
    expect(discount).toHaveValue(15);

    await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Desconto acima do limite' })).getByRole('button', {
        name: 'Salvar mesmo assim',
      }),
    );
    const detail = await screen.findByText(/^detalhe \d+$/);
    const saved = await getQuote(detail.textContent?.replace('detalhe ', '') ?? '');
    expect(saved.discount).toEqual({ type: 'percent', value: 15 });
  });

  it('sem limite configurado salva direto', async () => {
    const original = await getSettings();
    await saveSettings({ ...original, quotes: { ...original.quotes, maxDiscountPercent: null } });
    try {
      const { user } = renderAt('/orcamentos/novo');
      await choose(user, await customerField(), 'brasa');
      await choose(user, screen.getByRole('combobox', { name: 'Produto' }), 'boiler');
      const discount = screen.getByRole('spinbutton', { name: 'Desconto' });
      await user.clear(discount);
      await user.type(discount, '40');
      await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));
      expect(await screen.findByText(/^detalhe \d+$/)).toBeInTheDocument();
    } finally {
      await saveSettings(original);
    }
  });
});
