import type { Access } from '../../src/types/auth';
import type { Notification } from '../../src/types/notifications';
import { buildNotifications } from '../../src/lib/notifications.js';
import { quotesExpiringWithin } from './quotes.js';
import { getSettings } from './settings.js';

/** Avisos de quem está conectado: orçamentos dele (ou de todos, conforme o perfil) vencendo. */
export async function listNotifications(access: Access): Promise<Notification[]> {
  const days = (await getSettings()).quotes.expiryAlertDays;
  return buildNotifications(await quotesExpiringWithin(days, access), days);
}
