import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useCan } from '@/contexts/AuthContext';
import { PeriodFilter } from '@/features/dashboard/PeriodFilter';
import { QuoteStatusBadge } from '@/features/dashboard/QuoteStatusBadge';
import formStyles from '@/features/people/Form.module.css';
import { ListToolbar } from '@/features/people/ListToolbar';
import { Modal } from '@/features/people/Modal';
import { matches, useList } from '@/features/people/useList';
import { ExpiryBadge } from '@/features/quotes/ExpiryBadge';
import checkStyles from '@/features/settings/UserForm.module.css';
import { useSettings } from '@/features/settings/useSettings';
import { formatBRL, formatBRLRounded, formatDateTime, toISODate } from '@/lib/format';
import { deleteCancelledQuotes, listQuotes } from '@/services/quotesService';
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

/** Caixa de seleção no visual do sistema; o texto vai só para o leitor de tela. */
function SelectBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={`${checkStyles.check} ${styles.selectBox}`}>
      <input
        type="checkbox"
        className={checkStyles.checkInput}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className={checkStyles.checkBox} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
    </label>
  );
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
  const canDelete = useCan('deleteRecords');
  /** Qual exclusão está sendo confirmada: só os marcados ou todos os cancelados da lista. */
  const [confirmingDelete, setConfirmingDelete] = useState<'selected' | 'all' | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // Com o filtro "Cancelado", dá para apagar de vez os marcados ou todos da lista (período e busca atuais).
  const cancelled = filter === 'Cancelado' ? quotes : [];
  const selecting = canDelete && cancelled.length > 0;
  const picked = cancelled.filter((q) => selected.has(q.id)).map((q) => q.id);
  const toDelete = confirmingDelete === 'all' ? cancelled.map((q) => q.id) : picked;
  const pageAllPicked = visible.length > 0 && visible.every((q) => selected.has(q.id));

  function pick(ids: readonly string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function removeCancelled() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteCancelledQuotes(toDelete);
      setConfirmingDelete(null);
      setSelected(new Set());
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir os orçamentos.');
    } finally {
      setDeleting(false);
    }
  }

  // Qualquer mudança de filtro volta para a primeira página.
  function resetting<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
      setSelected(new Set());
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

          {selecting && (
            <div className={styles.bulkBar}>
              <span>
                {picked.length > 0
                  ? `${picked.length} ${picked.length === 1 ? 'selecionado' : 'selecionados'}`
                  : 'Marque os que quer apagar de vez, ou apague todos.'}
              </span>
              <span className={styles.bulkActions}>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.bulkDanger}`}
                  disabled={picked.length === 0}
                  onClick={() => {
                    setDeleteError('');
                    setConfirmingDelete('selected');
                  }}
                >
                  <Icon name="trash" size={16} />
                  Excluir selecionados ({picked.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.bulkDanger}`}
                  onClick={() => {
                    setDeleteError('');
                    setConfirmingDelete('all');
                  }}
                >
                  Excluir todos ({cancelled.length})
                </button>
              </span>
            </div>
          )}

          {quotes.length === 0 ? (
            <p className={styles.empty}>Nenhum orçamento encontrado no período.</p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {selecting && (
                        <th scope="col" className={styles.selectCell}>
                          <SelectBox
                            label="Selecionar todos desta página"
                            checked={pageAllPicked}
                            onChange={(on) => pick(visible.map((q) => q.id), on)}
                          />
                        </th>
                      )}
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
                        {selecting && (
                          <td className={styles.selectCell}>
                            <SelectBox
                              label={`Selecionar ${quote.number}`}
                              checked={selected.has(quote.id)}
                              onChange={(on) => pick([quote.id], on)}
                            />
                          </td>
                        )}
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
                      <span className={styles.cardNumber}>
                        {selecting && (
                          <SelectBox
                            label={`Selecionar ${quote.number}`}
                            checked={selected.has(quote.id)}
                            onChange={(on) => pick([quote.id], on)}
                          />
                        )}
                        <span className={styles.name}>{quote.number}</span>
                      </span>
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

      <Modal
        open={confirmingDelete !== null}
        title={confirmingDelete === 'all' ? 'Excluir todos os cancelados' : 'Excluir selecionados'}
        onClose={() => setConfirmingDelete(null)}
        size="sm"
      >
        <p className={formStyles.text}>
          Excluir de vez {toDelete.length === 1 ? 'o orçamento cancelado' : `os ${toDelete.length} orçamentos cancelados`}
          {confirmingDelete === 'all' ? ' desta lista' : ' selecionados'}, com o histórico? Esta ação não pode ser desfeita.
        </p>
        {deleteError && (
          <p className={formStyles.error} role="alert">
            {deleteError}
          </p>
        )}
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDelete(null)} disabled={deleting}>
            Voltar
          </button>
          <button type="button" className={`btn ${formStyles.dangerBtn}`} onClick={() => void removeCancelled()} disabled={deleting}>
            {deleting ? 'Excluindo…' : `Excluir ${toDelete.length}`}
          </button>
        </div>
      </Modal>
    </>
  );
}
