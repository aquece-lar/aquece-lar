import type { DashboardData, Period } from '@/types/dashboard';
import { buildDashboard } from './mocks/dashboardMock';
import { listSellers } from './peopleService';
import { validatePeriod } from './period';
import { quotesSnapshot } from './quotesService';
import { getSettings } from './settingsService';

export { InvalidPeriodError } from './period';

/**
 * Retorna os dados do dashboard para o período, calculados sobre os mesmos
 * orçamentos da listagem. Enquanto não houver backend, o cálculo é local; a
 * assinatura já é assíncrona e cancelável para a troca por uma chamada HTTP.
 */
export async function getDashboard(period: Period, signal?: AbortSignal): Promise<DashboardData> {
  validatePeriod(period);
  const [sellers, settings] = await Promise.all([listSellers(signal), getSettings(signal)]);
  return buildDashboard(period, quotesSnapshot(), sellers, settings.quotes.expiryAlertDays);
}
