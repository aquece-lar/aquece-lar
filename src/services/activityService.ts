import { ACTIVITY_LIMIT, type Activity, type ActivityArea } from '@/types/activity';
import { api, ApiError, USE_MOCKS } from './http';
import { fromMock } from './mockLatency';
import { hideMockActivity, isHiddenQuoteEvent, mockActivitySnapshot, recordMockActivity } from './mockActivity';
import { mockEnsure } from './mockSession';
import { quoteEventsSnapshot } from './quotesService';

/** Tudo que o histórico tem no modo fictício, sem filtro nem limite. */
function mockAll(): Activity[] {
  const quotes = quoteEventsSnapshot()
    .map(
      ({ quote, event, index }): Activity => ({
        // Estável: os eventos de um orçamento só crescem no fim.
        id: `q${quote.id}-${index}`,
        at: event.at,
        by: event.by,
        area: 'Orçamentos',
        summary: `Orçamento ${quote.number}: ${event.note}`,
        detail: event.detail,
        quoteId: quote.id,
        quote: { seller: quote.seller, customer: quote.customer, amount: quote.amount },
      }),
    )
    .filter((a) => !isHiddenQuoteEvent(a.id));
  return [...quotes, ...mockActivitySnapshot()];
}

/** Histórico de alterações, do mais recente para o mais antigo; só administrador. `area` vazia = todas. */
export function listActivity(area: ActivityArea | null, signal?: AbortSignal): Promise<Activity[]> {
  if (!USE_MOCKS) {
    const query = area ? `?${new URLSearchParams({ area })}` : '';
    return api<Activity[]>('GET', `/activity${query}`, undefined, signal);
  }
  return fromMock(() => {
    mockEnsure('manageSystem');
    // Ao contrário antes de ordenar: no mesmo instante, o mais novo fica em cima.
    return mockAll()
      .reverse()
      .filter((a) => area === null || a.area === area)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, ACTIVITY_LIMIT);
  }, signal);
}

/**
 * Apaga do histórico geral os itens escolhidos, ou todos (`'all'`). Os eventos
 * de orçamento continuam na linha do tempo de cada orçamento, e a limpeza fica
 * registrada. Devolve quantos itens saíram.
 */
export async function deleteActivity(ids: readonly string[] | 'all'): Promise<number> {
  if (!USE_MOCKS) {
    const body = ids === 'all' ? { all: true } : { ids };
    return (await api<{ deleted: number }>('DELETE', '/activity', body)).deleted;
  }
  return fromMock(() => {
    mockEnsure('manageSystem');
    if (ids !== 'all' && ids.length === 0) throw new ApiError(400, 'validation', 'Escolha o que apagar.');
    const deleted = hideMockActivity(ids === 'all' ? mockAll().map((a) => a.id) : ids);
    if (deleted > 0) {
      const what = deleted === 1 ? '1 item' : `${deleted} itens`;
      recordMockActivity('Configurações', 'Histórico apagado', ids === 'all' ? `tudo (${what})` : what);
    }
    return deleted;
  });
}
