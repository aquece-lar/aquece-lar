import type { DashboardData, Period } from '@/types/dashboard';
import { buildDashboard } from '@/lib/dashboard';
import { api, USE_MOCKS } from './http';
import { mockOwnSeller } from './mockSession';
import { listSellers } from './peopleService';
import { validatePeriod } from './period';
import { quotesSnapshot } from './quotesService';
import { getSettings } from './settingsService';

export { InvalidPeriodError } from './period';

/**
 * Retorna os dados do dashboard para o período, calculados sobre os mesmos
 * orçamentos da listagem: pela API, ou localmente no modo fictício (testes),
 * com a mesma regra de `src/lib/dashboard.ts`.
 */
export async function getDashboard(period: Period, signal?: AbortSignal): Promise<DashboardData> {
  validatePeriod(period);
  if (!USE_MOCKS) {
    const query = new URLSearchParams({ from: period.from, to: period.to });
    return api<DashboardData>('GET', `/dashboard?${query}`, undefined, signal);
  }
  const [sellers, settings] = await Promise.all([listSellers(signal), getSettings(signal)]);
  // Vendedor que só vê o que é dele: só os seus orçamentos (e ele sozinho no ranking, via listSellers).
  const own = mockOwnSeller();
  const quotes = own === null ? quotesSnapshot() : quotesSnapshot().filter((q) => q.seller === own);
  return buildDashboard(period, quotes, sellers, settings.quotes.expiryAlertDays);
}
