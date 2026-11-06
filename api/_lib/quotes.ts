import type { Access } from '../../src/types/auth';
import { describeQuoteChanges } from '../../src/lib/changes.js';
import type { Period, QuoteStatus } from '../../src/types/dashboard';
import type { Quote, QuoteContact, QuoteDetail, QuoteDiscount, QuoteEvent, QuoteItem } from '../../src/types/quotes';
import { can, discountOverLimit, onlyOwn } from '../../src/lib/access.js';
import { toISODate } from '../../src/lib/format.js';
import { quoteTotals } from '../../src/lib/quoteTotals.js';
import { InvalidPeriodError, validatePeriod } from '../../src/services/period.js';
import { logActivity } from './activity.js';
import { forbidden, type Caller } from './auth.js';
import { customerIdByName, customerSellerId } from './customers.js';
import { db, iso, isUniqueViolation, num, TZ } from './db.js';
import { ApiError, invalid, notFound } from './http.js';
import { sellerIdByName } from './sellers.js';
import { getSettings } from './settings.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Colunas da linha da listagem (lista, dashboard, retorno de criação e edição). */
const LIST_COLUMNS = `id::text as id, number, customer_name, seller_name, amount, status, created_at,
  to_char(valid_until, 'YYYY-MM-DD') as valid_until`;

function toQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    number: `#${row.number as number}`,
    customer: row.customer_name as string,
    seller: row.seller_name as string,
    amount: num(row.amount),
    status: row.status as QuoteStatus,
    createdAt: iso(row.created_at),
    validUntil: row.valid_until as string,
  };
}

/**
 * Vendedor que só vê o que é dele: o id do seu cadastro de vendedor ('0', que não
 * existe, se não estiver ligado a nenhum). Quem vê tudo: `null`, sem filtro.
 */
export function ownSellerId(access: Access): string | null {
  return onlyOwn(access) ? (access.sellerId ?? '0') : null;
}

export function checkPeriod(period: Period): void {
  try {
    validatePeriod(period);
  } catch (error) {
    if (error instanceof InvalidPeriodError) throw new ApiError(400, 'invalid_period', error.message);
    throw error;
  }
}

/** Orçamentos criados no período (dia de São Paulo), do mais recente para o mais antigo. */
export async function listQuotes(period: Period, access: Access): Promise<Quote[]> {
  checkPeriod(period);
  const rows = await db().query(
    `select ${LIST_COLUMNS} from quotes
     where (created_at at time zone '${TZ}')::date between $1::date and $2::date
       and ($3::bigint is null or seller_id = $3::bigint)
     order by created_at desc, id desc`,
    [period.from, period.to, ownSellerId(access)],
  );
  return rows.map(toQuote);
}

/** Para o dashboard: criados desde `from`, mais os em aberto de qualquer data (vencimento). */
export async function quotesForDashboard(from: string, access: Access): Promise<Quote[]> {
  const rows = await db().query(
    `select ${LIST_COLUMNS} from quotes
     where ((created_at at time zone '${TZ}')::date >= $1::date or status in ('Pendente', 'Enviado'))
       and ($2::bigint is null or seller_id = $2::bigint)`,
    [from, ownSellerId(access)],
  );
  return rows.map(toQuote);
}

/** Em aberto (pendentes e enviados) que vencem de hoje até `days` dias, para os avisos. */
export async function quotesExpiringWithin(days: number, access: Access): Promise<Quote[]> {
  const rows = await db().query(
    `select ${LIST_COLUMNS} from quotes
     where status in ('Pendente', 'Enviado')
       and valid_until between (now() at time zone '${TZ}')::date and (now() at time zone '${TZ}')::date + $1::int
       and ($2::bigint is null or seller_id = $2::bigint)`,
    [days, ownSellerId(access)],
  );
  return rows.map(toQuote);
}

/** Orçamento de outro vendedor responde como inexistente para quem só vê os seus. */
export async function getQuote(id: string, access: Access): Promise<QuoteDetail> {
  const [row] = await db().query(
    `select ${LIST_COLUMNS}, customer_info, seller_info, items, payment_terms, discount, notes
     from quotes where id = $1 and ($2::bigint is null or seller_id = $2::bigint)`,
    [id, ownSellerId(access)],
  );
  if (!row) throw notFound('Orçamento');
  const events = await db()`
    select status, at, note, user_name, detail from quote_events where quote_id = ${id} order by at, id`;
  return {
    ...toQuote(row),
    customerInfo: row.customer_info as QuoteContact,
    sellerInfo: row.seller_info as QuoteContact,
    items: row.items as QuoteItem[],
    paymentTerms: row.payment_terms as string,
    discount: (row.discount as QuoteDiscount | null) ?? null,
    notes: row.notes as string,
    history: events.map(
      (e): QuoteEvent => ({
        status: e.status as QuoteStatus,
        at: iso(e.at),
        note: e.note as string,
        by: (e.user_name as string | null) ?? null,
        detail: e.detail as string,
      }),
    ),
  };
}

function str(value: unknown, label: string, opts: { min?: number; max?: number } = {}): string {
  if (value !== undefined && value !== null && typeof value !== 'string') throw invalid(`${label} deve ser um texto.`);
  const text = ((value as string | undefined) ?? '').trim();
  if (opts.min && text.length < opts.min) throw invalid(`Informe ${label.toLowerCase()}.`);
  if (text.length > (opts.max ?? 200)) throw invalid(`${label} pode ter no máximo ${opts.max ?? 200} caracteres.`);
  return text;
}

function readContact(value: unknown, who: string): QuoteContact {
  if (!value || typeof value !== 'object') throw invalid(`Informe o ${who}.`);
  const c = value as Record<string, unknown>;
  const contact: QuoteContact = {
    name: str(c.name, `O nome do ${who}`, { min: 1, max: 160 }),
    detail: str(c.detail, `O detalhe do ${who}`, { max: 160 }),
    phone: str(c.phone, `O telefone do ${who}`, { max: 30 }),
  };
  if (typeof c.city === 'string' && c.city.trim()) contact.city = str(c.city, `A cidade do ${who}`, { max: 80 });
  return contact;
}

function readItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value) || value.length === 0) throw invalid('Inclua ao menos um item.');
  if (value.length > 100) throw invalid('O orçamento pode ter no máximo 100 itens.');
  return value.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const quantity = item.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      throw invalid('A quantidade deve ser um número inteiro de 1 em diante.');
    }
    const unitPrice = item.unitPrice;
    if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw invalid('O valor unitário deve ser maior que zero.');
    }
    return {
      code: str(item.code, 'O código do item', { min: 1, max: 40 }),
      description: str(item.description, 'A descrição do item', { min: 1, max: 200 }),
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
    };
  });
}

function readDiscount(value: unknown, subtotal: number): QuoteDiscount | null {
  if (value === null || value === undefined) return null;
  const d = value as Record<string, unknown>;
  if ((d.type !== 'percent' && d.type !== 'amount') || typeof d.value !== 'number' || !Number.isFinite(d.value) || d.value < 0) {
    throw invalid('Desconto inválido.');
  }
  if (d.type === 'percent' && d.value > 100) throw invalid('O desconto deve ficar entre 0 e 100%.');
  if (d.type === 'amount' && d.value > subtotal) throw invalid('O desconto não pode passar do subtotal.');
  return { type: d.type, value: d.value };
}

/** Valida o corpo de POST/PUT e calcula o total no servidor, sem confiar no front. */
async function readDraft(body: Record<string, unknown>, isNew: boolean, access: Access) {
  const customerInfo = readContact(body.customerInfo, 'cliente');
  const sellerInfo = readContact(body.sellerInfo, 'vendedor');
  const items = readItems(body.items);
  const { subtotal } = quoteTotals(items, null);
  const discount = readDiscount(body.discount, subtotal);
  const validUntil = body.validUntil;
  if (typeof validUntil !== 'string' || !ISO_DATE.test(validUntil) || Number.isNaN(Date.parse(validUntil))) {
    throw invalid('Informe uma validade válida.');
  }
  if (isNew && validUntil < toISODate(new Date())) throw invalid('A validade não pode ser anterior a hoje.');
  const sellerId = await sellerIdByName(sellerInfo.name);
  if (!sellerId) throw invalid('Vendedor não encontrado.');
  const customerId = await customerIdByName(customerInfo.name);
  // O vendedor só faz orçamento em nome próprio e para os seus clientes.
  if (access.role === 'Vendedor') {
    if (sellerId !== access.sellerId) throw forbidden('O orçamento precisa ficar no seu nome.');
    if (customerId && onlyOwn(access) && (await customerSellerId(customerId)) !== access.sellerId) {
      throw forbidden('Este cliente é de outro vendedor.');
    }
  }
  const { total } = quoteTotals(items, discount);
  if (!can(access, 'exceedDiscount')) {
    const { quotes: defaults } = await getSettings();
    if (discountOverLimit(subtotal, subtotal - total, defaults.maxDiscountPercent)) {
      throw new ApiError(
        403,
        'discount_over_limit',
        `O desconto passa do máximo de ${String(defaults.maxDiscountPercent).replace('.', ',')}%. Peça a um gerente.`,
      );
    }
  }
  return {
    customerInfo,
    sellerInfo,
    items,
    discount,
    validUntil,
    paymentTerms: str(body.paymentTerms, 'A condição de pagamento', { max: 200 }),
    notes: str(body.notes, 'As observações', { max: 2000 }),
    amount: total,
    customerId,
    sellerId,
  };
}

const CREATION_NOTE = /^(Orçamento criado|Criado a partir do orçamento #\d+)$/;

export async function createQuote(body: Record<string, unknown>, me: Caller): Promise<Quote> {
  const d = await readDraft(body, true, me.access);
  const note = typeof body.note === 'string' && CREATION_NOTE.test(body.note) ? body.note : 'Orçamento criado';
  // O número é o próximo da sequência; se dois saírem juntos, a unicidade barra um e ele tenta de novo.
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db()`
        with n as (select coalesce(max(number), 0) + 1 as next from quotes),
        q as (
          insert into quotes (id, number, customer_id, seller_id, customer_name, seller_name, customer_info, seller_info,
            items, valid_until, payment_terms, discount, notes, amount)
          select n.next, n.next, ${d.customerId}, ${d.sellerId},
            ${d.customerInfo.name}, ${d.sellerInfo.name}, ${JSON.stringify(d.customerInfo)}::jsonb,
            ${JSON.stringify(d.sellerInfo)}::jsonb, ${JSON.stringify(d.items)}::jsonb, ${d.validUntil}::date,
            ${d.paymentTerms}, ${d.discount ? JSON.stringify(d.discount) : null}::jsonb, ${d.notes}, ${d.amount}
          from n
          returning *
        ), e as (
          insert into quote_events (quote_id, status, at, note, user_id, user_name)
          select id, 'Pendente', created_at, ${note}, ${me.id}::bigint, ${me.session.name} from q
        )
        select id::text as id, number, customer_name, seller_name, amount, status, created_at,
          to_char(valid_until, 'YYYY-MM-DD') as valid_until
        from q`;
      return toQuote(row!);
    } catch (error) {
      if (attempt < 3 && (isUniqueViolation(error, 'quotes_pkey') || isUniqueViolation(error, 'quotes_number_key'))) continue;
      throw error;
    }
  }
}

/** Status atual; o vendedor só mexe nos orçamentos dele (mesmo podendo ver os de todos). */
async function currentStatus(id: string, access: Access): Promise<QuoteStatus> {
  const [row] = await db()`select status, seller_id::text as seller_id from quotes where id = ${id}`;
  if (!row) throw notFound('Orçamento');
  if (access.role === 'Vendedor' && row.seller_id !== access.sellerId) {
    if (onlyOwn(access)) throw notFound('Orçamento');
    throw forbidden('Este orçamento é de outro vendedor.');
  }
  return row.status as QuoteStatus;
}

const NOT_EDITABLE = new ApiError(409, 'quote_not_editable', 'Só orçamentos pendentes podem ser editados. Duplique este orçamento.');

export async function updateQuote(id: string, body: Record<string, unknown>, me: Caller): Promise<Quote> {
  if ((await currentStatus(id, me.access)) !== 'Pendente') throw NOT_EDITABLE;
  const d = await readDraft(body, false, me.access);
  const detail = describeQuoteChanges(await getQuote(id, me.access), d);
  const [row] = await db()`
    with q as (
      update quotes set customer_id = ${d.customerId}, seller_id = ${d.sellerId}, customer_name = ${d.customerInfo.name},
        seller_name = ${d.sellerInfo.name}, customer_info = ${JSON.stringify(d.customerInfo)}::jsonb,
        seller_info = ${JSON.stringify(d.sellerInfo)}::jsonb, items = ${JSON.stringify(d.items)}::jsonb,
        valid_until = ${d.validUntil}::date, payment_terms = ${d.paymentTerms},
        discount = ${d.discount ? JSON.stringify(d.discount) : null}::jsonb, notes = ${d.notes}, amount = ${d.amount}
      where id = ${id} and status = 'Pendente'
      returning *
    ), e as (
      insert into quote_events (quote_id, status, note, user_id, user_name, detail)
      select id, 'Pendente', 'Orçamento editado', ${me.id}::bigint, ${me.session.name}, ${detail} from q
    )
    select id::text as id, number, customer_name, seller_name, amount, status, created_at,
      to_char(valid_until, 'YYYY-MM-DD') as valid_until
    from q`;
  // Mudou de status entre a leitura e a gravação.
  if (!row) throw NOT_EDITABLE;
  return toQuote(row);
}

/**
 * Apaga de vez orçamentos cancelados (com o histórico deles). Os de outro
 * status ficam; `{ deleted }` diz quantos saíram. Fica registrado no histórico geral.
 */
export async function deleteCancelledQuotes(ids: readonly string[], me: Caller): Promise<{ deleted: number }> {
  const rows = await db()`
    delete from quotes where id = any(${ids}::bigint[]) and status = 'Cancelado'
    returning number, customer_name`;
  if (rows.length === 1) {
    const [row] = rows;
    await logActivity(me, 'Orçamentos', `Orçamento #${row!.number as number} excluído`, `cancelado · ${row!.customer_name as string}`);
  } else if (rows.length > 1) {
    const numbers = rows.map((row) => `#${row.number as number}`).sort().join(', ');
    await logActivity(me, 'Orçamentos', `${rows.length} orçamentos cancelados excluídos`, numbers);
  }
  return { deleted: rows.length };
}

/** Um orçamento: só se estiver cancelado. */
export async function deleteQuote(id: string, me: Caller): Promise<void> {
  const status = await currentStatus(id, me.access);
  if (status !== 'Cancelado') {
    throw new ApiError(409, 'quote_not_deletable', 'Só orçamentos cancelados podem ser excluídos.');
  }
  const { deleted } = await deleteCancelledQuotes([id], me);
  if (deleted === 0) throw new ApiError(409, 'quote_not_deletable', 'O orçamento mudou enquanto isso. Recarregue a página.');
}

/** Transições permitidas e o texto do histórico de cada uma. */
const TRANSITIONS: Record<QuoteStatus, Partial<Record<QuoteStatus, string>>> = {
  Pendente: { Enviado: 'Enviado ao cliente', Cancelado: 'Orçamento cancelado' },
  Enviado: { Aprovado: 'Aprovado pelo cliente', Cancelado: 'Orçamento cancelado' },
  Aprovado: {},
  Cancelado: { Pendente: 'Voltou para pendente' },
};

export async function changeStatus(id: string, body: Record<string, unknown>, me: Caller): Promise<QuoteDetail> {
  const from = await currentStatus(id, me.access);
  const to = body.status as QuoteStatus;
  let note = TRANSITIONS[from][to];
  if (!note) throw new ApiError(409, 'invalid_status_transition', `Não é possível passar de ${from} para ${String(to)}.`);
  if (to === 'Enviado' && body.channel === 'whatsapp') note = 'Enviado ao cliente por WhatsApp';
  const rows = await db()`
    with q as (update quotes set status = ${to} where id = ${id} and status = ${from} returning id),
    e as (
      insert into quote_events (quote_id, status, note, user_id, user_name)
      select id, ${to}, ${note}, ${me.id}::bigint, ${me.session.name} from q
    )
    select id from q`;
  if (!rows[0]) throw new ApiError(409, 'invalid_status_transition', 'O orçamento mudou enquanto isso. Recarregue a página.');
  return getQuote(id, me.access);
}
