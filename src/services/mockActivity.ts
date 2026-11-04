import type { Activity, ActivityArea } from '@/types/activity';
import { mockUserName } from './mockSession';

/**
 * Histórico de configurações e usuários do modo fictício: em memória, vale até
 * a página ser recarregada. Os eventos dos orçamentos ficam no quotesService;
 * aqui fica só quais deles foram apagados do histórico geral.
 */
let log: Activity[] = [];
let nextId = 1;
const hiddenQuoteEvents = new Set<string>();

export function recordMockActivity(area: Exclude<ActivityArea, 'Orçamentos'>, summary: string, detail = ''): void {
  log = [
    ...log,
    { id: `a${nextId++}`, at: new Date().toISOString(), by: mockUserName(), area, summary, detail, quoteId: null },
  ];
}

export function mockActivitySnapshot(): readonly Activity[] {
  return log;
}

export function isHiddenQuoteEvent(id: string): boolean {
  return hiddenQuoteEvents.has(id);
}

/** Tira do histórico geral; devolve quantos saíram. */
export function hideMockActivity(ids: readonly string[]): number {
  const before = log.length;
  log = log.filter((a) => !ids.includes(a.id));
  let hidden = 0;
  for (const id of ids) {
    if (id.startsWith('q') && !hiddenQuoteEvents.has(id)) {
      hiddenQuoteEvents.add(id);
      hidden++;
    }
  }
  return before - log.length + hidden;
}
