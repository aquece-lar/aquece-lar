import { buildNotifications } from '@/lib/notifications';
import type { Notification } from '@/types/notifications';
import { api, USE_MOCKS } from './http';
import { mockOwnSeller } from './mockSession';
import { quotesSnapshot } from './quotesService';
import { getSettings } from './settingsService';

/** Modo fictício: avisos excluídos até a página ser recarregada. */
const mockDismissed = new Set<string>();

async function mockAll(signal?: AbortSignal): Promise<Notification[]> {
  const settings = await getSettings(signal);
  const own = mockOwnSeller();
  const quotes = own === null ? quotesSnapshot() : quotesSnapshot().filter((q) => q.seller === own);
  return buildNotifications(quotes, settings.quotes.expiryAlertDays);
}

/** Avisos de quem está conectado, menos os excluídos: pela API, ou no modo fictício com a mesma regra de `src/lib/notifications.ts`. */
export async function listNotifications(signal?: AbortSignal): Promise<Notification[]> {
  if (!USE_MOCKS) return api<Notification[]>('GET', '/notifications', undefined, signal);
  return (await mockAll(signal)).filter((n) => !mockDismissed.has(n.id));
}

/** Tira avisos do sininho de quem está conectado: os `ids` escolhidos, ou `'all'` para todos os de agora. */
export async function dismissNotifications(ids: readonly string[] | 'all'): Promise<void> {
  const body = ids === 'all' ? { all: true } : { ids };
  if (!USE_MOCKS) {
    await api<{ dismissed: number }>('DELETE', '/notifications', body);
    return;
  }
  for (const n of ids === 'all' ? await mockAll() : ids.map((id) => ({ id }))) mockDismissed.add(n.id);
}

const SEEN_KEY = 'aquece-lar:avisos-vistos';

/** Avisos já vistos neste navegador, por usuário (só serve para o contador do sininho). */
export function readSeen(email: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY}:${email}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Guarda só os ids que ainda existem, para a lista não crescer para sempre. */
export function saveSeen(email: string, ids: readonly string[]): void {
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${email}`, JSON.stringify(ids));
  } catch {
    // Sem armazenamento (ex.: navegação privada): o contador só não lembra o que foi visto.
  }
}
