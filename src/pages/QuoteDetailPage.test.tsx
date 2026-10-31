import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
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
