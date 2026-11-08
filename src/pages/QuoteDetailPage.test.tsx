import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '@/services/settingsService';
import { QuoteDetailPage } from './QuoteDetailPage';

function renderQuote(id: string) {
  const router = createMemoryRouter([{ path: '/orcamentos/:id', element: <QuoteDetailPage /> }], {
    initialEntries: [`/orcamentos/${id}`],
  });
  render(<RouterProvider router={router} />);
}

describe('PDF do orçamento', () => {
  it('leva o cabeçalho e o rodapé da empresa, sem os campos vazios', async () => {
    const original = await getSettings();
    await saveSettings({
      ...original,
      company: {
        ...original.company,
        document: '12.345.678/0001-90',
        phone: '(51) 3333-4444',
        footer: 'PIX: 12.345.678/0001-90\nGarantia de 12 meses.',
      },
    });

    renderQuote('1181');
    await screen.findByRole('heading', { name: /orçamento #1181/i });

    const header = await screen.findByRole('banner');
    expect(header).toHaveAttribute('data-print-only');
    expect(header).toHaveTextContent('Aquece Lar');
    expect(header).toHaveTextContent('CNPJ 12.345.678/0001-90');
    expect(header).toHaveTextContent('(51) 3333-4444');
    expect(header.textContent).not.toContain('·');

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-print-only');
    expect(footer.textContent).toBe('PIX: 12.345.678/0001-90\nGarantia de 12 meses.');
  });
});

describe('excluir orçamento', () => {
  it('cancelado tem "Excluir", que pede confirmação e volta para a lista', async () => {
    const router = createMemoryRouter(
      [
        { path: '/orcamentos/:id', element: <QuoteDetailPage /> },
        { path: '/orcamentos', element: <p>lista</p> },
      ],
      { initialEntries: ['/orcamentos/1175'] },
    );
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir orçamento' }));
    expect(await screen.findByText('lista')).toBeInTheDocument();
  });

  it('pendente não tem "Excluir"', async () => {
    renderQuote('1181');
    expect(await screen.findByRole('button', { name: 'Marcar como enviado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });
});

describe('enviar por WhatsApp', () => {
  it('abre o WhatsApp do cliente com a mensagem das configurações e marca como enviado', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const original = await getSettings();
    await saveSettings({ ...original, quotes: { ...original.quotes, whatsappMessage: 'Oi {cliente}, orçamento {numero}: {total}' } });

    renderQuote('1181');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Enviar por WhatsApp' }));

    const url = new URL(open.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://wa.me/555432221840');
    expect(url.searchParams.get('text')).toMatch(/^Oi Restaurante Brasa Viva, orçamento #1181: R\$ /);
    expect(await screen.findByText('Enviado ao cliente por WhatsApp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar por WhatsApp' })).toBeInTheDocument();
    open.mockRestore();
    await saveSettings(original);
  });
});
