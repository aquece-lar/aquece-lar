import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getSettings } from '@/services/settingsService';
import { SettingsPage } from './SettingsPage';

async function renderPage() {
  const user = userEvent.setup();
  render(<SettingsPage />);
  await screen.findByRole('textbox', { name: /nome/i });
  return user;
}

describe('configurações', () => {
  it('só habilita salvar com alterações e grava os dados da empresa', async () => {
    const user = await renderPage();
    const save = screen.getByRole('button', { name: /salvar configurações/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'CNPJ' }), '12.345.678/0001-90');
    await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '(51) 3333-4444');
    expect(screen.getByText('Há alterações não salvas.')).toBeInTheDocument();
    await user.click(save);

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
    expect(save).toBeDisabled();
    const saved = await getSettings();
    expect(saved.company.document).toBe('12.345.678/0001-90');
    expect(saved.company.phone).toBe('(51) 3333-4444');
  });

  it('valida nome, CNPJ, e-mail e validade antes de salvar', async () => {
    const user = await renderPage();
    await user.clear(screen.getByRole('textbox', { name: /nome/i }));
    const cnpj = screen.getByRole('textbox', { name: 'CNPJ' });
    await user.clear(cnpj);
    await user.type(cnpj, '123');
    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'sem-arroba');
    const days = screen.getByRole('spinbutton', { name: /validade/i });
    await user.clear(days);
    await user.type(days, '0');
    const alert = screen.getByRole('spinbutton', { name: /aviso de vencimento/i });
    expect(alert).toHaveValue(3);
    await user.clear(alert);
    await user.click(screen.getByRole('button', { name: /salvar configurações/i }));

    expect(screen.getByText('Informe o nome da empresa.')).toBeInTheDocument();
    expect(screen.getByText('O CNPJ deve ter 14 dígitos.')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument();
    expect(screen.getByText('De 1 a 365 dias.')).toBeInTheDocument();
    expect(screen.getByText('De 0 a 60 dias.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Revise os campos destacados.');
    expect((await getSettings()).company.name).not.toBe('');
  });

  it('adiciona, torna padrão e remove condições de pagamento', async () => {
    const user = await renderPage();
    const list = () => within(screen.getByRole('group', { name: /condições de pagamento/i }));

    await user.click(screen.getByRole('button', { name: /adicionar condição/i }));
    await user.type(list().getByRole('textbox', { name: 'Condição 4' }), 'PIX com 10% de desconto');
    expect(list().getByText('Sugere 10% de desconto no orçamento.')).toBeInTheDocument();

    const rows = list().getAllByRole('listitem');
    await user.click(within(rows[3]!).getByRole('button', { name: 'Tornar padrão' }));
    expect(list().getByRole('textbox', { name: 'Condição 1' })).toHaveValue('PIX com 10% de desconto');

    await user.click(list().getByRole('button', { name: 'Remover condição 4' }));
    await user.click(screen.getByRole('button', { name: /salvar configurações/i }));
    await screen.findByText('Configurações salvas.');

    expect((await getSettings()).quotes.paymentTerms).toEqual([
      'PIX com 10% de desconto',
      'À vista com 5% de desconto',
      '3x sem juros no cartão',
    ]);
  });

  it('grava o rodapé do PDF e o desconto máximo, e avisa condição acima do limite', async () => {
    const user = await renderPage();
    const footer = screen.getByRole('textbox', { name: /rodapé do pdf/i });
    await user.type(footer, 'PIX: 12.345.678/0001-90{Enter}Garantia de 12 meses.');
    const limit = screen.getByRole('spinbutton', { name: /desconto máximo/i });
    expect(limit).toHaveValue(10);
    await user.clear(limit);
    await user.type(limit, '4');
    expect(screen.getByText(/sugere 5% de desconto no orçamento, acima do limite de 4%/i)).toBeInTheDocument();

    await user.clear(limit);
    await user.type(limit, '150');
    await user.click(screen.getByRole('button', { name: /salvar configurações/i }));
    expect(screen.getByText('De 0 a 100%, ou vazio para sem limite.')).toBeInTheDocument();

    await user.clear(limit);
    await user.click(screen.getByRole('button', { name: /salvar configurações/i }));
    await screen.findByText('Configurações salvas.');
    const saved = await getSettings();
    expect(saved.company.footer).toBe('PIX: 12.345.678/0001-90\nGarantia de 12 meses.');
    expect(saved.quotes.maxDiscountPercent).toBeNull();
  });

  it('descartar volta ao que está salvo', async () => {
    const user = await renderPage();
    const notes = screen.getByRole('textbox', { name: /observações/i });
    const before = (notes as HTMLTextAreaElement).value;
    await user.type(notes, ' Texto novo.');
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(notes).toHaveValue(before);
    expect(screen.getByRole('button', { name: /salvar configurações/i })).toBeDisabled();
  });
});
