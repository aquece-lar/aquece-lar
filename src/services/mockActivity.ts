import type { Activity, ActivityArea } from '@/types/activity';
import { mockUserName } from './mockSession';

/**
 * Histórico de configurações e usuários do modo fictício: em memória, vale até
 * a página ser recarregada. Os eventos dos orçamentos ficam no quotesService.
 */
let log: Activity[] = [];

export function recordMockActivity(area: Exclude<ActivityArea, 'Orçamentos'>, summary: string, detail = ''): void {
  log = [
    ...log,
    { id: `a${log.length + 1}`, at: new Date().toISOString(), by: mockUserName(), area, summary, detail, quoteId: null },
  ];
}

export function mockActivitySnapshot(): readonly Activity[] {
  return log;
}
