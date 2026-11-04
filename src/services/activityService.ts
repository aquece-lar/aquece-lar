import { ACTIVITY_LIMIT, type Activity, type ActivityArea } from '@/types/activity';
import { api, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { mockActivitySnapshot } from './mockActivity';
import { mockEnsure } from './mockSession';
import { quoteEventsSnapshot } from './quotesService';


/** Histórico de alterações, do mais recente para o mais antigo; só administrador. `area` vazia = todas. */
export function listActivity(area: ActivityArea | null, signal?: AbortSignal): Promise<Activity[]> {
  if (!USE_MOCKS) {
    const query = area ? `?${new URLSearchParams({ area })}` : '';
    return api<Activity[]>('GET', `/activity${query}`, undefined, signal);
  }
  return fromMock(() => {
    mockEnsure('manageSystem');
    const quotes = quoteEventsSnapshot().map(
      ({ quote, event }, i): Activity => ({
        id: `q${i}`,
        at: event.at,
        by: event.by,
        area: 'Orçamentos',
        summary: `Orçamento ${quote.number}: ${event.note}`,
        detail: event.detail,
        quoteId: quote.id,
      }),
    );
    // Ao contrário antes de ordenar: no mesmo instante, o mais novo fica em cima.
    return [...quotes, ...mockActivitySnapshot()]
      .reverse()
      .filter((a) => area === null || a.area === area)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, ACTIVITY_LIMIT);
  }, signal);
}
