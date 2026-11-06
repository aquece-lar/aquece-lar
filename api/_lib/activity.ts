import { ACTIVITY_AREAS, ACTIVITY_LIMIT, type Activity, type ActivityArea } from '../../src/types/activity.js';
import type { Caller } from './auth.js';
import { db, iso, num } from './db.js';
import { invalid } from './http.js';

/** Guarda uma alteração de configurações ou de usuários (os orçamentos ficam em quote_events). */
export async function logActivity(
  me: Caller,
  /** 'Orçamentos' só para o que não fica na linha do tempo do orçamento (ex.: exclusão). */
  area: ActivityArea,
  summary: string,
  detail = '',
): Promise<void> {
  await db()`
    insert into activity_log (user_id, user_name, area, summary, detail)
    values (${me.id}, ${me.session.name}, ${area}, ${summary}, ${detail})`;
}

/** Histórico geral: os eventos dos orçamentos junto com o resto, do mais recente para o mais antigo. */
export async function listActivity(url: URL): Promise<Activity[]> {
  const area = url.searchParams.get('area') || null;
  if (area !== null && !ACTIVITY_AREAS.includes(area as ActivityArea)) throw invalid('Área inválida.');
  const rows = await db().query(
    `select * from (
       select 'a' || id as id, at, user_name, area, summary, detail, null::text as quote_id,
         null::text as seller_name, null::text as customer_name, null::numeric as amount
       from activity_log
       union all
       select 'q' || e.id, e.at, e.user_name, 'Orçamentos', 'Orçamento #' || q.number || ': ' || e.note, e.detail,
         q.id::text, q.seller_name, q.customer_name, q.amount
       from quote_events e join quotes q on q.id = e.quote_id
       where e.in_log
     ) x
     where $1::text is null or area = $1::text
     order by at desc, id desc
     limit ${ACTIVITY_LIMIT}`,
    [area],
  );
  return rows.map((row) => ({
    id: row.id as string,
    at: iso(row.at),
    by: (row.user_name as string | null) ?? null,
    area: row.area as ActivityArea,
    summary: row.summary as string,
    detail: row.detail as string,
    quoteId: (row.quote_id as string | null) ?? null,
    quote: row.quote_id
      ? { seller: row.seller_name as string, customer: row.customer_name as string, amount: num(row.amount) }
      : null,
  }));
}

/** Separa os ids da tela ("a12" = activity_log, "q34" = quote_events). */
function readIds(value: unknown): { log: string[]; quote: string[] } {
  if (!Array.isArray(value) || value.length === 0) throw invalid('Escolha o que apagar.');
  if (value.length > ACTIVITY_LIMIT) throw invalid(`Apague no máximo ${ACTIVITY_LIMIT} de cada vez.`);
  const ids = { log: [] as string[], quote: [] as string[] };
  for (const id of value) {
    const match = typeof id === 'string' ? /^([aq])(\d+)$/.exec(id) : null;
    if (!match) throw invalid('Item do histórico inválido.');
    (match[1] === 'a' ? ids.log : ids.quote).push(match[2]!);
  }
  return ids;
}

/**
 * Apaga do histórico geral os itens escolhidos (`{ ids }`) ou todos (`{ all: true }`).
 * Os eventos de orçamento só saem desta lista; a linha do tempo de cada
 * orçamento continua inteira. A limpeza fica registrada, com quem fez.
 */
export async function deleteActivity(body: Record<string, unknown>, me: Caller): Promise<{ deleted: number }> {
  const all = body.all === true;
  const ids = all ? null : readIds(body.ids);
  const [log, quote] = all
    ? await Promise.all([
        db()`delete from activity_log returning id`,
        db()`update quote_events set in_log = false where in_log returning id`,
      ])
    : await Promise.all([
        db()`delete from activity_log where id = any(${ids!.log}::bigint[]) returning id`,
        db()`update quote_events set in_log = false where in_log and id = any(${ids!.quote}::bigint[]) returning id`,
      ]);
  const deleted = log.length + quote.length;
  if (deleted > 0) {
    const what = deleted === 1 ? '1 item' : `${deleted} itens`;
    await logActivity(me, 'Configurações', 'Histórico apagado', all ? `tudo (${what})` : what);
  }
  return { deleted };
}
