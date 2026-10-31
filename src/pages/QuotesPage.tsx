import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { PeriodFilter } from '@/features/dashboard/PeriodFilter';
import { QuoteStatusBadge } from '@/features/dashboard/QuoteStatusBadge';
import { ListToolbar } from '@/features/people/ListToolbar';
import { matches, useList } from '@/features/people/useList';
import { ExpiryBadge } from '@/features/quotes/ExpiryBadge';
import { useSettings } from '@/features/settings/useSettings';
import { formatBRL, formatBRLRounded, formatDateTime, toISODate } from '@/lib/format';
import { listQuotes } from '@/services/quotesService';
import type { Period, QuoteStatus } from '@/types/dashboard';
import type { Quote } from '@/types/quotes';
import styles from './ListPage.module.css';

type StatusFilter = 'todos' | QuoteStatus;

const STATUSES: QuoteStatus[] = ['Pendente', 'Enviado', 'Aprovado', 'Cancelado'];
const PAGE_SIZE = 15;

function defaultPeriod(): Period {
  const now = new Date();
  return {
    from: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: toISODate(now),
  };
}

function QuoteActions({ quote }: { quote: Quote }) {
  return (
    <div className={styles.rowActions}>
      <Link to={`/orcamentos/${quote.id}`} className="icon-btn icon-btn--sm" aria-label={`Abrir orçamento ${quote.number}`}>
        <Icon name="eye" size={17} />
      </Link>
      <Link
        to={`/orcamentos/${quote.id}/pdf`}
        className="icon-btn icon-btn--sm"
        aria-label={`Baixar PDF ${quote.number}`}
      >
        <Icon name="download" size={17} />
      </Link>
    </div>
  );
}

export function QuotesPage() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const { from, to } = period;
  const load = useCallback((signal: AbortSignal) => listQuotes({ from, to }, signal), [from, to]);
  const state = useList(load, 'Não foi possível carregar os orçamentos.', reloadKey);
  // Antes de carregar as configurações, só os vencidos ganham selo.
  const alertDays = useSettings().data?.quotes.expiryAlertDays ?? -1;

  const all = state.data;
  const searched = useMemo(
    () => (all ?? []).filter((q) => matches(query, q.number, q.customer, q.seller)),
    [all, query],
  );
  const quotes = useMemo(
    () => (filter === 'todos' ? searched : searched.filter((q) => q.status === filter)),
    [searched, filter],
  );

  const filters = useMemo(
    () => [
      { value: 'todos' as StatusFilter, label: `Todos · ${searched.length}` },
      ...STATUSES.map((status) => ({
        value: status as StatusFilter,
        label: `${status} · ${searched.filter((q) => q.status === status).length}`,
      })),
    ],
    [searched],
  );

  const pageCount = Math.max(1, Math.ceil(quotes.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = quotes.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const total = quotes.reduce((sum, q) => sum + q.amount, 0);

  // Qualquer mudança de filtro volta para a primeira página.
  function resetting<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div className={styles.titles}>
          <h1 className={styles.h1}>Orçamentos</h1>
          <p className={styles.sub}>
            {all
              ? `${quotes.length} ${quotes.length === 1 ? 'orçamento' : 'orçamentos'} · ${formatBRLRounded(total)}`
              : 'Carregando…'}
          </p>
        </div>
        <div className={styles.headActions}>
          <PeriodFilter value={period} onChange={resetting(setPeriod)} />
          <Link to="/orcamentos/novo" className="btn btn-primary">
            <Icon name="plus" size={16} />
            Novo orçamento
          </Link>
        </div>
      </div>

      {state.status === 'error' && (
        <div className={styles.alert} role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {!all && state.status === 'loading' ? (
        <div className={`card ${styles.skeleton}`} aria-busy="true">
          <span className="sr-only">Carregando orçamentos…</span>
        </div>
      ) : all ? (
        <section
          className={`card ${styles.card}`}
          aria-label="Lista de orçamentos"
          aria-busy={state.status === 'loading'}
        >
          <ListToolbar
            query={query}
            onQueryChange={resetting(setQuery)}
            placeholder="Buscar por número, cliente ou vendedor"
            filters={filters}
            filter={filter}
            onFilterChange={resetting(setFilter)}
            filterLabel="Filtrar por status"
            count={quotes.length}
            noun={['orçamento', 'orçamentos']}
          />

          {quotes.length === 0 ? (
            <p className={styles.empty}>Nenhum orçamento encontrado no período.</p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Nº</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Vendedor</th>
                      <th scope="col" className={styles.num}>
                        Valor
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Data</th>
                      <th scope="col" className={styles.actionsHead}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((quote) => (
                      <tr key={quote.id} className={styles.row}>
                        <td className={styles.name}>{quote.number}</td>
                        <td>{quote.customer}</td>
                        <td className={styles.muted}>{quote.seller}</td>
                        <td className={styles.num}>{formatBRL(quote.amount)}</td>
                        <td>
                          <span className={styles.badges}>
                            <QuoteStatusBadge status={quote.status} />
                            <ExpiryBadge quote={quote} alertDays={alertDays} compact />
                          </span>
                        </td>
                        <td className={styles.date}>{formatDateTime(quote.createdAt)}</td>
                        <td className={styles.actionsCell}>
                          <QuoteActions quote={quote} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cards}>
                {visible.map((quote) => (
                  <li key={quote.id} className={styles.itemCard}>
                    <div className={styles.cardTop}>
                      <span className={styles.name}>{quote.number}</span>
                      <span className={styles.badges}>
                        <QuoteStatusBadge status={quote.status} />
                        <ExpiryBadge quote={quote} alertDays={alertDays} compact />
                      </span>
                    </div>
                    <div>
                      <p className={styles.name}>{quote.customer}</p>
                      <p className={styles.cardMeta}>
                        {quote.seller} · {formatDateTime(quote.createdAt)}
                      </p>
                    </div>
                    <div className={styles.cardFoot}>
                      <span className={styles.cardStrong}>{formatBRL(quote.amount)}</span>
                      <QuoteActions quote={quote} />
                    </div>
                  </li>
                ))}
              </ul>

              {pageCount > 1 && (
                <nav className={styles.pager} aria-label="Paginação">
                  <span className={styles.pagerInfo}>
                    {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, quotes.length)} de{' '}
                    {quotes.length}
                  </span>
                  <div className={styles.pagerButtons}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPage(current - 1)}
                      disabled={current === 0}
                    >
                      <Icon name="chevLeft" size={16} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPage(current + 1)}
                      disabled={current >= pageCount - 1}
                    >
                      Próxima
                      <Icon name="chevRight" size={16} />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
