/**
 * Tabelas do Postgres (Neon). Idempotente: `npm run db:migrate` pode rodar de
 * novo sem perder dados. Itens e contatos do orçamento ficam em JSON porque são
 * a cópia do momento em que o orçamento foi feito.
 */
export const SCHEMA: string[] = [
  `create table if not exists sellers (
    id           bigint generated always as identity primary key,
    name         text not null,
    email        text not null,
    phone        text not null default '',
    region       text not null default '',
    status       text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
    monthly_goal numeric(12, 2) check (monthly_goal is null or monthly_goal > 0),
    created_at   timestamptz not null default now()
  )`,
  `create table if not exists customers (
    id         bigint generated always as identity primary key,
    name       text not null,
    kind       text not null check (kind in ('PF', 'PJ')),
    document   text not null default '',
    phone      text not null default '',
    city       text not null default '',
    seller_id  bigint references sellers (id) on delete set null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists products (
    id             bigint generated always as identity primary key,
    code           text not null,
    description    text not null,
    category       text not null,
    unit_price     numeric(12, 2) not null check (unit_price > 0),
    status         text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
    photos         jsonb not null default '[]',
    created_at     timestamptz not null default now(),
    inactivated_at timestamptz
  )`,
  `create unique index if not exists products_code_key on products (upper(code))`,
  // id = number: o link do orçamento (/orcamentos/1181) é o próprio número.
  `create table if not exists quotes (
    id             bigint primary key,
    number         integer not null unique check (number = id),
    customer_id    bigint references customers (id) on delete set null,
    seller_id      bigint references sellers (id) on delete set null,
    customer_name  text not null,
    seller_name    text not null,
    customer_info  jsonb not null,
    seller_info    jsonb not null,
    items          jsonb not null,
    valid_until    date not null,
    payment_terms  text not null default '',
    discount       jsonb,
    notes          text not null default '',
    amount         numeric(12, 2) not null,
    status         text not null default 'Pendente' check (status in ('Pendente', 'Enviado', 'Aprovado', 'Cancelado')),
    created_at     timestamptz not null default now()
  )`,
  `create index if not exists quotes_created_idx on quotes (created_at)`,
  `create index if not exists quotes_customer_idx on quotes (customer_id)`,
  `create index if not exists quotes_seller_idx on quotes (seller_id)`,
  `create table if not exists quote_events (
    id       bigint generated always as identity primary key,
    quote_id bigint not null references quotes (id) on delete cascade,
    status   text not null,
    at       timestamptz not null default now(),
    note     text not null
  )`,
  `create index if not exists quote_events_quote_idx on quote_events (quote_id, at)`,
  `create table if not exists settings (
    id   smallint primary key default 1 check (id = 1),
    data jsonb not null
  )`,
  // Login: e-mail único (sem diferenciar maiúsculas) e senha com hash scrypt.
  `create table if not exists users (
    id            bigint generated always as identity primary key,
    email         text not null,
    name          text not null,
    password_hash text not null,
    created_at    timestamptz not null default now()
  )`,
  `create unique index if not exists users_email_key on users (lower(email))`,
  `alter table users add column if not exists last_login_at timestamptz`,
  // Sessões: o cookie leva o token; aqui fica só o hash dele.
  `create table if not exists sessions (
    token_hash text primary key,
    user_id    bigint not null references users (id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists sessions_user_idx on sessions (user_id)`,
  // Perfis (src/lib/access.ts). Quem já existia vira administrador, para ninguém perder acesso.
  `alter table users add column if not exists role text not null default 'Administrador'
    check (role in ('Administrador', 'Gerente', 'Vendedor'))`,
  `alter table users add column if not exists seller_id bigint references sellers (id) on delete set null`,
  `alter table users add column if not exists see_all boolean not null default false`,
  `alter table users add column if not exists exceed_discount boolean not null default false`,
  // Histórico de alterações: quem fez cada passo do orçamento e o que mudou na edição.
  `alter table quote_events add column if not exists user_id bigint references users (id) on delete set null`,
  `alter table quote_events add column if not exists user_name text`,
  `alter table quote_events add column if not exists detail text not null default ''`,
  // O resto (configurações e usuários). O nome fica copiado: vale mesmo depois de o usuário ser excluído.
  `create table if not exists activity_log (
    id        bigint generated always as identity primary key,
    at        timestamptz not null default now(),
    user_id   bigint references users (id) on delete set null,
    user_name text,
    area      text not null check (area in ('Configurações', 'Usuários')),
    summary   text not null,
    detail    text not null default ''
  )`,
  `create index if not exists activity_log_at_idx on activity_log (at)`,
  `create index if not exists quote_events_at_idx on quote_events (at)`,
  // Apagar do histórico geral só esconde o evento: a linha do tempo do orçamento continua inteira.
  `alter table quote_events add column if not exists in_log boolean not null default true`,
  // Avisos que cada usuário excluiu do sininho (o id muda se o orçamento ganhar outra validade).
  `create table if not exists notification_dismissals (
    user_id         bigint not null references users (id) on delete cascade,
    notification_id text not null,
    created_at      timestamptz not null default now(),
    primary key (user_id, notification_id)
  )`,
  // Excluir orçamento fica no histórico geral (os eventos dele somem junto com ele).
  `alter table activity_log drop constraint if exists activity_log_area_check`,
  `alter table activity_log add constraint activity_log_area_check check (area in ('Orçamentos', 'Configurações', 'Usuários'))`,
];
