import type { Notification } from '../../src/types/notifications';
import { buildNotifications } from '../../src/lib/notifications.js';
import type { Caller } from './auth.js';
import { db } from './db.js';
import { invalid } from './http.js';
import { quotesExpiringWithin } from './quotes.js';
import { getSettings } from './settings.js';

/** Todos os avisos do perfil, inclusive os que a pessoa já excluiu. */
async function allNotifications(me: Caller): Promise<Notification[]> {
  const days = (await getSettings()).quotes.expiryAlertDays;
  return buildNotifications(await quotesExpiringWithin(days, me.access), days);
}

/** Avisos de quem está conectado: orçamentos dele (ou de todos, conforme o perfil) vencendo, menos os excluídos. */
export async function listNotifications(me: Caller): Promise<Notification[]> {
  const [all, dismissed] = await Promise.all([
    allNotifications(me),
    db()`select notification_id from notification_dismissals where user_id = ${me.id}`,
  ]);
  const hidden = new Set(dismissed.map((row) => row.notification_id as string));
  return all.filter((n) => !hidden.has(n.id));
}

/** Exclui avisos do sininho de quem está conectado: `{ ids }` ou `{ all: true }` (todos os de agora). */
export async function dismissNotifications(body: Record<string, unknown>, me: Caller): Promise<{ dismissed: number }> {
  let ids: string[];
  if (body.all === true) {
    ids = (await allNotifications(me)).map((n) => n.id);
  } else {
    if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string') || body.ids.length > 500) {
      throw invalid('Informe os avisos a excluir.');
    }
    ids = body.ids as string[];
  }
  if (ids.length > 0) {
    await db()`
      insert into notification_dismissals (user_id, notification_id)
      select ${me.id}, unnest(${ids}::text[])
      on conflict do nothing`;
  }
  // Avisos são de no máximo alguns dias: o que tem mais de 90 já não aparece de novo.
  await db()`delete from notification_dismissals where created_at < now() - interval '90 days'`;
  return { dismissed: ids.length };
}
