import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserMenu } from './UserMenu';

const SESSION_KEY = 'aquece-lar:sessao';

afterEach(() => window.localStorage.clear());

describe('UserMenu', () => {
  it('abre com nome e e-mail, fecha no Esc e sai pelo "Sair"', async () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email: 'luis@exemplo.com', name: 'Luis Poletto' }));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <UserMenu />
      </AuthProvider>,
    );

    const button = await screen.findByRole('button', { name: 'Menu de Luis Poletto' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(screen.getByRole('menu')).toHaveTextContent('luis@exemplo.com');
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));
    await waitFor(() => expect(window.localStorage.getItem(SESSION_KEY)).toBeNull());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('fecha ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>fora</p>
        <UserMenu />
      </>,
    );
    await user.click(screen.getByRole('button', { name: /Menu de/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByText('fora'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
