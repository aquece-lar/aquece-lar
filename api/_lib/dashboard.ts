import type { DashboardData, Period } from '../../src/types/dashboard';
import { buildDashboard } from '../../src/lib/dashboard.js';
import { previousPeriod } from '../../src/services/period.js';
import { checkPeriod, quotesForDashboard } from './quotes.js';
import { listSellers } from './sellers.js';
import { getSettings } from './settings.js';

/** Mesma regra do modo fictício (`src/lib/dashboard.ts`), sobre os orçamentos do banco. */
export async function getDashboard(period: Period): Promise<DashboardData> {
  checkPeriod(period);
  const [quotes, sellers, settings] = await Promise.all([
    quotesForDashboard(previousPeriod(period).from),
    listSellers(),
    getSettings(),
  ]);
  return buildDashboard(period, quotes, sellers, settings.quotes.expiryAlertDays);
}
