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
import { cancelQuotes, deleteCancelledQuotes, listQuotes, reopenQuotes } from '@/services/quotesService';
import type { Period, QuoteStatus } from '@/types/dashboard';
import type { Quote } from '@/types/quotes';
import styles from './ListPage.module.css';

type StatusFilter = 'todos' | QuoteStatus;

const STATUSES: QuoteStatus[] = ['Pendente', 'Enviado', 'Aprovado', 'Cancelado'];
const PAGE_SIZE = 15;
/** Só estes podem ser cancelados. */
const CANCELLABLE: QuoteStatus[] = ['Pendente', 'Enviado'];

/** Ação em lote sendo confirmada. */
type BulkAction = 'delete-selected' | 'delete-all' | 'cancel' | 'cancel-delete' | 'reopen';

const MODAL_TITLES: Record<BulkAction, string> = {
  'delete-selected': 'Excluir selecionados',
  'delete-all': 'Excluir todos os cancelados',
  cancel: 'Cancelar orçamentos',
  'cancel-delete': 'Cancelar e apagar',
  reopen: 'Reabrir orçamentos',
};

/** `many` com # no lugar do número. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many.replace('#', String(n));
}

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
  const [confirming, setConfirming] = useState<BulkAction | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [bulkError, setBulkError] = useState('');
  /** Resultado da última ação em lote, quando nem todos os marcados puderam ser alterados. */
  const [notice, setNotice] = useState('');

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

  // Com o filtro "Cancelado", dá para reabrir os marcados, ou apagar de vez os marcados ou todos da lista (período e busca atuais).
  // Nos outros filtros, marcam-se pendentes e enviados para cancelar, ou cancelar e já apagar.
  const deleteMode = filter === 'Cancelado';
  const selectable = (q: Quote) => deleteMode || CANCELLABLE.includes(q.status);
  const candidates = quotes.filter(selectable);
  const selecting = candidates.length > 0;
  const picked = candidates.filter((q) => selected.has(q.id)).map((q) => q.id);
  const targets = confirming === 'delete-all' ? candidates.map((q) => q.id) : picked;
  const pageCandidates = visible.filter(selectable);
  const pageAllPicked = pageCandidates.length > 0 && pageCandidates.every((q) => selected.has(q.id));

  function ask(action: BulkAction) {
    setBulkError('');
    setConfirming(action);
  }

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

  async function runBulk() {
    if (!confirming) return;
    setWorking(true);
    setBulkError('');
    try {
      const done =
        confirming === 'reopen'
          ? await reopenQuotes(targets)
          : confirming.startsWith('delete')
            ? await deleteCancelledQuotes(targets)
            : await cancelQuotes(targets, { remove: confirming === 'cancel-delete' });
      const skipped = targets.length - done;
      setNotice(
        skipped > 0
          ? `${plural(skipped, '1 orçamento não pôde ser alterado', '# orçamentos não puderam ser alterados')} (mudou o status ou é de outro vendedor).`
          : '',
      );
      setConfirming(null);
      setSelected(new Set());
      setPage(0);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setWorking(false);
    }
  }

  // Qualquer mudança de filtro volta para a primeira página.
  function resetting<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
      setSelected(new Set());
      setNotice('');
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
                  : notice ||
                    (deleteMode
                      ? canDelete
                        ? 'Marque os que quer reabrir ou apagar.'
                        : 'Marque os que quer reabrir.'
                      : 'Marque pendentes ou enviados para cancelar.')}
              </span>
              <span className={styles.bulkActions}>
                {deleteMode ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={picked.length === 0}
                      onClick={() => ask('reopen')}
                    >
                      Reabrir ({picked.length})
                    </button>
                    {canDelete && (
                      <>
                        <button
                          type="button"
                          className={`btn btn-secondary ${styles.bulkDanger}`}
                          disabled={picked.length === 0}
                          onClick={() => ask('delete-selected')}
                        >
                          <Icon name="trash" size={16} />
                          Excluir selecionados ({picked.length})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-secondary ${styles.bulkDanger}`}
                          onClick={() => ask('delete-all')}
                        >
                          Excluir todos ({candidates.length})
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={picked.length === 0}
                      onClick={() => ask('cancel')}
                    >
                      Cancelar ({picked.length})
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className={`btn btn-secondary ${styles.bulkDanger}`}
                        disabled={picked.length === 0}
                        onClick={() => ask('cancel-delete')}
                      >
                        <Icon name="trash" size={16} />
                        Cancelar e apagar ({picked.length})
                      </button>
                    )}
                  </>
                )}
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
                            onChange={(on) => pick(pageCandidates.map((q) => q.id), on)}
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
                            {selectable(quote) && (
                              <SelectBox
                                label={`Selecionar ${quote.number}`}
                                checked={selected.has(quote.id)}
                                onChange={(on) => pick([quote.id], on)}
                              />
                            )}
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
                        {selecting && selectable(quote) && (
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
        open={confirming !== null}
        title={confirming ? MODAL_TITLES[confirming] : ''}
        onClose={() => setConfirming(null)}
        size="sm"
      >
        <p className={formStyles.text}>
          {confirming === 'reopen'
            ? `Reabrir ${plural(targets.length, 'o orçamento selecionado? Ele volta para pendente.', 'os # orçamentos selecionados? Eles voltam para pendente.')}`
            : confirming === 'cancel'
            ? `Cancelar ${plural(targets.length, 'o orçamento selecionado? Ele continua na lista, como cancelado.', 'os # orçamentos selecionados? Eles continuam na lista, como cancelados.')}`
            : confirming === 'cancel-delete'
              ? `Cancelar e apagar de vez ${plural(targets.length, 'o orçamento selecionado', 'os # orçamentos selecionados')}, com o histórico? Esta ação não pode ser desfeita.`
              : `Excluir de vez ${plural(targets.length, 'o orçamento cancelado', 'os # orçamentos cancelados')}${confirming === 'delete-all' ? ' desta lista' : ' selecionados'}, com o histórico? Esta ação não pode ser desfeita.`}
        </p>
        {bulkError && (
          <p className={formStyles.error} role="alert">
            {bulkError}
          </p>
        )}
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)} disabled={working}>
            Voltar
          </button>
          {confirming === 'cancel' || confirming === 'reopen' ? (
            <button type="button" className="btn btn-primary" onClick={() => void runBulk()} disabled={working}>
              {working
                ? confirming === 'reopen'
                  ? 'Reabrindo…'
                  : 'Cancelando…'
                : `${confirming === 'reopen' ? 'Reabrir' : 'Cancelar'} ${targets.length}`}
            </button>
          ) : (
            <button type="button" className={`btn ${formStyles.dangerBtn}`} onClick={() => void runBulk()} disabled={working}>
              {working ? 'Excluindo…' : confirming === 'cancel-delete' ? `Apagar ${targets.length}` : `Excluir ${targets.length}`}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
