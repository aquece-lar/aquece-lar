import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LoginPage } from './LoginPage';

function ProtectedStub({ label }: { label: string }) {
  const { logout } = useAuth();
  return (
    <>
      <p>{label}</p>
      <button type="button" onClick={logout}>
        Sair
      </button>
    </>
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <RequireAuth><ProtectedStub label="painel" /></RequireAuth> },
      { path: '/orcamentos', element: <RequireAuth><ProtectedStub label="lista de orçamentos" /></RequireAuth> },
    ],
    { initialEntries: [path] },
  );
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  );
  return { user, router };
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('LoginPage', () => {
  it('leva para o login quem não está conectado', async () => {
    renderAt('/orcamentos');
    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta' })).toBeInTheDocument();
    expect(screen.queryByText('lista de orçamentos')).not.toBeInTheDocument();
  });

  it('valida os campos ao sair deles e ao enviar', async () => {
    const { user } = renderAt('/login');
    await user.click(screen.getByLabelText('Usuário'));
    await user.tab();
    expect(screen.getByText('Informe seu usuário.')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuário')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Usuário'), 'admin');
    expect(screen.queryByText('Informe seu usuário.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveFocus();
  });

  it('recusa a senha errada', async () => {
    const { user } = renderAt('/login');
    await user.type(screen.getByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.');
    expect(window.localStorage.getItem('aquece-lar:sessao')).toBeNull();
    expect(window.sessionStorage.getItem('aquece-lar:sessao')).toBeNull();
  });

  it('entra com admin / admin@adm e volta para a página pedida', async () => {
    const { user, router } = renderAt('/orcamentos');
    await user.type(await screen.findByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), 'admin@adm');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('lista de orçamentos')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orcamentos');
    expect(window.localStorage.getItem('aquece-lar:sessao')).toContain('admin');

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Bem-vindo de volta' })).toBeInTheDocument();
    expect(window.localStorage.getItem('aquece-lar:sessao')).toBeNull();
  });

  it('sem "Manter conectado", guarda a sessão só até fechar o navegador', async () => {
    const { user } = renderAt('/login');
    await user.type(screen.getByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), 'admin@adm');
    await user.click(screen.getByRole('checkbox', { name: 'Manter conectado' }));
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('painel')).toBeInTheDocument();
    expect(window.localStorage.getItem('aquece-lar:sessao')).toBeNull();
    expect(window.sessionStorage.getItem('aquece-lar:sessao')).toContain('admin');
  });
});
