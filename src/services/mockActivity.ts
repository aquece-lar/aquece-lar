import type { Activity, LoggedArea } from '@/types/activity';
import { mockUserName } from './mockSession';

/**
 * Histórico de configurações e usuários do modo fictício: em memória, vale até
 * a página ser recarregada. Os eventos dos orçamentos ficam no quotesService;
 * aqui fica só quais deles foram apagados do histórico geral.
 */
let log: Activity[] = [];
let nextId = 1;
const hiddenQuoteEvents = new Set<string>();

export function recordMockActivity(area: LoggedArea, summary: string, detail = ''): void {
  log = [
    ...log,
    { id: `a${nextId++}`, at: new Date().toISOString(), by: mockUserName(), area, summary, detail, quoteId: null, quote: null },
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

/** Cadastro salvo no modo fictício: "… cadastrado" ou "… editado" com o que mudou (sem mudança, nada), como a API. */
export function recordMockSave<T>(
  area: LoggedArea,
  title: string,
  before: T | undefined,
  after: T,
  changes: (before: T, after: T) => string,
): void {
  if (!before) {
    recordMockActivity(area, `${title} cadastrado`);
    return;
  }
  const detail = changes(before, after);
  if (detail) recordMockActivity(area, `${title} editado`, detail);
}
