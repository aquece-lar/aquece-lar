import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SellerForm } from './SellerForm';

const SELLER = {
  id: 'v1',
  name: 'Carlos Menezes',
  email: 'carlos@exemplo.com',
  phone: '',
  region: 'Serra',
  status: 'Ativo' as const,
  monthlyGoal: 250000,
  quotes: 0,
  amount: 0,
};

describe('SellerForm', () => {
  it('edita a meta mensal e aceita vazio como sem meta', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SellerForm initial={SELLER} busy={false} onSubmit={onSubmit} onCancel={() => {}} />);

    const goal = screen.getByRole('spinbutton', { name: /meta mensal/i });
    expect(goal).toHaveValue(250000);
    await user.clear(goal);
    await user.type(goal, '-5');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Informe um valor maior que zero, ou deixe vazio.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(goal);
    await user.type(goal, '320000');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Carlos Menezes', monthlyGoal: 320000 }));

    await user.clear(goal);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ monthlyGoal: null }));
  });
});
