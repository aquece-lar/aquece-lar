import { ACTIVITY_AREAS, ACTIVITY_LIMIT, type Activity, type ActivityArea } from '../../src/types/activity.js';
import type { Caller } from './auth.js';
import { db, iso } from './db.js';
import { invalid } from './http.js';

/** Guarda uma alteração de configurações ou de usuários (os orçamentos ficam em quote_events). */
export async function logActivity(
  me: Caller,
  area: Exclude<ActivityArea, 'Orçamentos'>,
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
       select 'a' || id as id, at, user_name, area, summary, detail, null::text as quote_id from activity_log
       union all
       select 'q' || e.id, e.at, e.user_name, 'Orçamentos', 'Orçamento #' || q.number || ': ' || e.note, e.detail,
         q.id::text
       from quote_events e join quotes q on q.id = e.quote_id
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
  }));
}
