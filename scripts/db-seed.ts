/**
 * Coloca no banco os mesmos dados de exemplo do modo fictício (vendedores,
 * clientes, produtos, equivalências, configurações e orçamentos com itens e histórico).
 *   npm run db:seed            só num banco vazio
 *   npm run db:seed -- --reset apaga tudo antes
 */
import { normalizeTerm } from '../src/lib/equivalence';
import { quoteTotals } from '../src/lib/quoteTotals';
import { db } from '../api/_lib/db.js';

// Os mocks calculam as datas ao carregar: precisam do fuso do negócio antes.
process.env.TZ = 'America/Sao_Paulo';
const { SELLERS_MOCK, CUSTOMERS_MOCK } = await import('../src/services/mocks/peopleMock');
const { PRODUCTS_MOCK } = await import('../src/services/mocks/productsMock');
const { EQUIVALENCES_MOCK } = await import('../src/services/mocks/equivalencesMock');
const { SETTINGS_MOCK } = await import('../src/services/mocks/settingsMock');
const { QUOTES_MOCK } = await import('../src/services/mocks/quotesMock');
const { buildHistory, buildQuoteDetail } = await import('../src/services/mocks/quoteDetailMock');

const sql = db();
const reset = process.argv.includes('--reset');

const [{ total }] = (await sql`select (select count(*) from sellers) + (select count(*) from quotes) as total`) as [{ total: string }];
if (Number(total) > 0 && !reset) {
  console.error('O banco já tem dados. Use "npm run db:seed -- --reset" para apagar tudo e recomeçar.');
  process.exit(1);
}
if (reset) {
  await sql`truncate quote_events, quotes, customers, equivalences, products, sellers, settings restart identity cascade`;
}

// A listagem ordena por created_at decrescente: o primeiro do mock fica com o mais recente.
const base = Date.now();
const at = (index: number) => new Date(base - index * 1000).toISOString();

await sql.query(
  `insert into sellers (name, email, phone, region, status, monthly_goal, created_at)
   select name, email, phone, region, status, monthly_goal, created_at
   from jsonb_to_recordset($1::jsonb) as r(name text, email text, phone text, region text, status text,
     monthly_goal numeric, created_at timestamptz)`,
  [JSON.stringify(SELLERS_MOCK.map((s, i) => ({ ...s, monthly_goal: s.monthlyGoal, created_at: at(i) })))],
);

await sql.query(
  `insert into customers (name, kind, document, phone, city, seller_id, created_at)
   select r.name, r.kind, r.document, r.phone, r.city, s.id, r.created_at
   from jsonb_to_recordset($1::jsonb) as r(name text, kind text, document text, phone text, city text,
     seller text, created_at timestamptz)
   left join sellers s on s.name = r.seller`,
  [JSON.stringify(CUSTOMERS_MOCK.map((c, i) => ({ ...c, created_at: at(i) })))],
);

await sql.query(
  `insert into products (code, description, category, unit_price, status, photos, created_at, inactivated_at)
   select code, description, category, unit_price, status, photos, created_at, inactivated_at
   from jsonb_to_recordset($1::jsonb) as r(code text, description text, category text, unit_price numeric,
     status text, photos jsonb, created_at timestamptz, inactivated_at timestamptz)`,
  [
    JSON.stringify(
      PRODUCTS_MOCK.map((p, i) => ({
        ...p,
        unit_price: p.unitPrice,
        photos: p.photos ?? [],
        created_at: at(i),
        inactivated_at: p.status === 'Inativo' ? new Date(base + i * 1000).toISOString() : null,
      })),
    ),
  ],
);

// Ligadas pelo código do produto (os ids do banco não são os do mock).
await sql.query(
  `insert into equivalences (term, normalized, product_id, brand)
   select r.term, r.normalized, p.id, r.brand
   from jsonb_to_recordset($1::jsonb) as r(term text, normalized text, product_code text, brand text)
   join products p on p.code = r.product_code`,
  [
    JSON.stringify(
      EQUIVALENCES_MOCK.map((e) => ({
        term: e.term,
        normalized: normalizeTerm(e.term),
        product_code: e.productCode,
        brand: e.brand,
      })),
    ),
  ],
);

await sql`insert into settings (id, data) values (1, ${JSON.stringify(SETTINGS_MOCK)}::jsonb)`;

const details = QUOTES_MOCK.map((quote) => buildQuoteDetail(quote, buildHistory(quote)));

await sql.query(
  `insert into quotes (id, number, customer_id, seller_id, customer_name, seller_name, customer_info, seller_info,
     items, valid_until, payment_terms, discount, notes, amount, status, created_at)
   select r.number, r.number, c.id, s.id, r.customer_name, r.seller_name, r.customer_info, r.seller_info,
     r.items, r.valid_until, r.payment_terms, r.discount, r.notes, r.amount, r.status, r.created_at
   from jsonb_to_recordset($1::jsonb) as r(number int, customer_name text, seller_name text, customer_info jsonb,
     seller_info jsonb, items jsonb, valid_until date, payment_terms text, discount jsonb, notes text,
     amount numeric, status text, created_at timestamptz)
   left join customers c on c.name = r.customer_name
   left join sellers s on s.name = r.seller_name`,
  [
    JSON.stringify(
      details.map((d) => ({
        number: Number(d.id),
        customer_name: d.customer,
        seller_name: d.seller,
        customer_info: d.customerInfo,
        seller_info: d.sellerInfo,
        items: d.items,
        valid_until: d.validUntil,
        payment_terms: d.paymentTerms,
        discount: d.discount,
        notes: d.notes,
        amount: quoteTotals(d.items, d.discount).total,
        status: d.status,
        created_at: d.createdAt,
      })),
    ),
  ],
);

await sql.query(
  `insert into quote_events (quote_id, status, at, note)
   select q.id, r.status, r.at, r.note
   from jsonb_to_recordset($1::jsonb) as r(number int, status text, at timestamptz, note text, seq int)
   join quotes q on q.id = r.number
   order by r.number, r.seq`,
  [JSON.stringify(details.flatMap((d) => d.history.map((e, seq) => ({ number: Number(d.id), ...e, seq }))))],
);

const [counts] = await sql`
  select (select count(*) from sellers) as sellers, (select count(*) from customers) as customers,
         (select count(*) from products) as products, (select count(*) from equivalences) as equivalences,
         (select count(*) from quotes) as quotes,
         (select count(*) from quote_events) as events`;
console.log('Dados de exemplo inseridos:', counts);
