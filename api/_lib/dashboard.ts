import type { Access } from '../../src/types/auth';
import type { DashboardData, Period } from '../../src/types/dashboard';
import { buildDashboard } from '../../src/lib/dashboard.js';
import { previousPeriod } from '../../src/services/period.js';
import { checkPeriod, quotesForDashboard } from './quotes.js';
import { listSellers } from './sellers.js';
import { getSettings } from './settings.js';

/** Mesma regra do modo fictício (`src/lib/dashboard.ts`), sobre os orçamentos do banco. */
/** Vendedor que só vê o que é dele: só os seus orçamentos e ele sozinho no ranking. */
export async function getDashboard(period: Period, access: Access): Promise<DashboardData> {
  checkPeriod(period);
  const [quotes, sellers, settings] = await Promise.all([
    quotesForDashboard(previousPeriod(period).from, access),
    listSellers(access),
    getSettings(),
  ]);
  return buildDashboard(period, quotes, sellers, settings.quotes.expiryAlertDays);
}
