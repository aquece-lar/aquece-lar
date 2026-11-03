import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { login, logout } from '@/services/authService';
import { MANAGER_ACCOUNT, SELLER_ACCOUNT, type MockAccount } from '@/services/mocks/authMock';
import { ProductsPage } from './ProductsPage';
import { QuoteFormPage } from './QuoteFormPage';

/** Entra com a conta fictícia antes de montar: o AuthProvider lê a sessão salva. */
async function renderAs(account: MockAccount, path: string, routes: Array<{ path: string; element: ReactNode }>) {
  await login(account.email, account.password, false);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

const sidebar = <Sidebar collapsed={false} mobileOpen={false} onToggleCollapsed={() => {}} onCloseMobile={() => {}} />;

afterEach(async () => {
  await logout();
});

describe('menu e telas conforme o perfil', () => {
  it('vendedor não vê Vendedores nem Configurações; gerente só não vê Configurações', async () => {
    await renderAs(SELLER_ACCOUNT, '/', [{ path: '/', element: sidebar }]);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('link', { name: /orçamentos/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /vendedores/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /configurações/i })).not.toBeInTheDocument();
    expect(screen.getByText('Vendedor')).toBeInTheDocument();
  });

  it('gerente vê Vendedores, mas não Configurações', async () => {
    await renderAs(MANAGER_ACCOUNT, '/', [{ path: '/', element: sidebar }]);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('link', { name: /vendedores/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /configurações/i })).not.toBeInTheDocument();
  });

  it('link direto para uma tela proibida volta para o dashboard', async () => {
    const { router } = await renderAs(SELLER_ACCOUNT, '/configuracoes', [
      { path: '/', element: <p>dashboard</p> },
      {
        path: '/configuracoes',
        element: (
          <RequirePermission permission="manageSystem">
            <p>configurações</p>
          </RequirePermission>
        ),
      },
    ]);
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('vendedor consulta produtos sem poder cadastrar, editar ou excluir', async () => {
    await renderAs(SELLER_ACCOUNT, '/produtos', [{ path: '/produtos', element: <ProductsPage /> }]);
    expect(await screen.findAllByText('AQG-20D')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /novo produto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ações de/i })).not.toBeInTheDocument();
  });
});

describe('orçamento feito por vendedor', () => {
  async function openForm() {
    const result = await renderAs(SELLER_ACCOUNT, '/orcamentos/novo', [
      { path: '/orcamentos/novo', element: <QuoteFormPage mode="new" /> },
      { path: '/orcamentos/:id', element: <p>detalhe</p> },
    ]);
    await screen.findByRole('combobox', { name: /cliente/i });
    return result;
  }

  it('fica no nome dele, sem campo para trocar o vendedor', async () => {
    await openForm();
    expect(screen.queryByRole('combobox', { name: /vendedor/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vendedor' }).closest('section')).toHaveTextContent('Carlos Menezes');
  });

  it('não salva com desconto acima do máximo e não oferece "salvar mesmo assim"', async () => {
    const { user } = await openForm();
    const customer = screen.getByRole('combobox', { name: /cliente/i });
    await user.type(customer, 'brasa');
    await user.keyboard('{Enter}');
    await user.type(screen.getByRole('combobox', { name: 'Produto' }), 'boiler');
    await user.keyboard('{Enter}');

    const discount = screen.getByRole('spinbutton', { name: 'Desconto' });
    await user.clear(discount);
    await user.type(discount, '15');
    expect(screen.getByText(/acima do limite de 10%.*Só um gerente pode liberar/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /salvar orçamento/i }));
    expect(screen.getByText('Acima do máximo de 10%. Peça a um gerente para liberar.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Desconto acima do limite' })).not.toBeInTheDocument();
    expect(screen.queryByText('detalhe')).not.toBeInTheDocument();
  });
});
