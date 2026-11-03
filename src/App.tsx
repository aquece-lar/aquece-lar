import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { CustomersPage } from '@/pages/CustomersPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { QuoteFormPage } from '@/pages/QuoteFormPage';
import { QuotesPage } from '@/pages/QuotesPage';
import { QuoteDetailPage } from '@/pages/QuoteDetailPage';
import { SellersPage } from '@/pages/SellersPage';
import { SettingsPage } from '@/pages/SettingsPage';

// Roteador de dados (e não <BrowserRouter>): é o que permite useBlocker no formulário de orçamento.
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="orcamentos/novo" element={<QuoteFormPage mode="new" />} />
        <Route path="orcamentos/:id/editar" element={<QuoteFormPage mode="edit" />} />
        <Route path="orcamentos/:id/duplicar" element={<QuoteFormPage mode="duplicate" />} />
        <Route path="orcamentos/:id/pdf" element={<QuoteDetailPage autoPrint />} />
        <Route path="orcamentos/:id" element={<QuoteDetailPage />} />
        <Route path="orcamentos" element={<QuotesPage />} />
        <Route
          path="vendedores"
          element={
            <RequirePermission permission="viewSellers">
              <SellersPage />
            </RequirePermission>
          }
        />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="linhas" element={<PlaceholderPage />} />
        <Route path="fluxogramas" element={<PlaceholderPage />} />
        <Route path="conversas" element={<PlaceholderPage />} />
        <Route path="equivalencias" element={<PlaceholderPage />} />
        <Route
          path="configuracoes"
          element={
            <RequirePermission permission="manageSystem">
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </>,
  ),
);

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
