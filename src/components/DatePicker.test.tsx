import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('mostra a data formatada e seleciona um dia', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-10" onChange={onChange} aria-label="Data" />);
    const trigger = screen.getByRole('button', { name: 'Data' });
    expect(trigger).toHaveTextContent('10/10/2026');

    await userEvent.click(trigger);
    expect(screen.getByText(/outubro de 2026/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /, 15 de outubro de 2026/i }));
    expect(onChange).toHaveBeenCalledWith('2026-10-15');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('desabilita dias fora do intervalo e navega entre meses', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-10-10" min="2026-10-05" onChange={onChange} aria-label="Data" />);
    await userEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('button', { name: /, 3 de outubro de 2026/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByText(/novembro de 2026/i)).toBeInTheDocument();
  });
});
