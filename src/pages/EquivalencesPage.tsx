import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCan } from '@/contexts/AuthContext';
import { EquivalenceForm } from '@/features/equivalences/EquivalenceForm';
import { MatchTester } from '@/features/equivalences/MatchTester';
import { ConfirmDelete } from '@/features/people/ConfirmDelete';
import { ListToolbar } from '@/features/people/ListToolbar';
import { Modal } from '@/features/people/Modal';
import { RowMenu } from '@/features/people/RowMenu';
import { matches, useList } from '@/features/people/useList';
import { deleteEquivalence, listEquivalences, saveEquivalence } from '@/services/equivalencesService';
import { listProducts } from '@/services/productsService';
import type { Equivalence, EquivalenceDraft } from '@/types/equivalences';
import styles from './ListPage.module.css';

type KindFilter = 'todos' | 'apelidos' | 'marcas';

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'apelidos', label: 'Apelidos' },
  { value: 'marcas', label: 'Outras marcas' },
] as const satisfies ReadonlyArray<{ value: KindFilter; label: string }>;

function KindBadge({ brand }: { brand: string }) {
  return brand ? (
    <span className={`${styles.badge} ${styles.info}`}>{brand}</span>
  ) : (
    <span className={`${styles.badge} ${styles.brand}`}>Apelido</span>
  );
}

/** Como o cliente chama cada produto: apelidos e códigos de outras marcas. O bot e a busca do orçamento usam. */
export function EquivalencesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<KindFilter>('todos');
  const [reloadKey, setReloadKey] = useState(0);
  const state = useList(listEquivalences, 'Não foi possível carregar as equivalências.', reloadKey);
  const productsState = useList(listProducts, 'Não foi possível carregar os produtos.');
  const canEdit = useCan('manageCatalog');

  /** `{}` = nova; `{ item }` = edição; `null` = fechado. */
  const [form, setForm] = useState<{ item?: Equivalence } | null>(null);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Equivalence | null>(null);
  const [busy, setBusy] = useState(false);

  const all = state.data;
  const rows = useMemo(
    () =>
      (all ?? []).filter(
        (e) =>
          (filter === 'todos' || (filter === 'marcas' ? e.brand !== '' : e.brand === '')) &&
          matches(query, e.term, e.brand, e.productCode, e.productDescription),
      ),
    [all, filter, query],
  );
  const productCount = new Set((all ?? []).map((e) => e.productId)).size;

  function openForm(item?: Equivalence) {
    setFormError('');
    setForm(item ? { item } : {});
  }

  async function handleSave(draft: EquivalenceDraft) {
    setBusy(true);
    setFormError('');
    try {
      await saveEquivalence(form?.item?.id ?? null, draft);
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteEquivalence(toDelete.id);
      setToDelete(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div className={styles.titles}>
          <h1 className={styles.h1}>Equivalências</h1>
          <p className={styles.sub}>
            {all
              ? `${all.length} ${all.length === 1 ? 'termo' : 'termos'} para ${productCount} ${productCount === 1 ? 'produto' : 'produtos'} · como o cliente chama cada produto`
              : 'Como o cliente chama cada produto'}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => openForm()}>
            <Icon name="plus" size={16} />
            Nova equivalência
          </button>
        )}
      </div>

      {all && <MatchTester equivalences={all} />}

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
          <span className="sr-only">Carregando equivalências…</span>
        </div>
      ) : all ? (
        <section className={`card ${styles.card}`} aria-label="Lista de equivalências">
          <ListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por termo, marca ou produto"
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            filterLabel="Filtrar por tipo"
            count={rows.length}
            noun={['termo', 'termos']}
          />

          {rows.length === 0 ? (
            <p className={styles.empty}>
              {all.length === 0 ? 'Nenhuma equivalência cadastrada ainda.' : 'Nenhuma equivalência encontrada.'}
            </p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={`${styles.table} ${styles.tableNarrow}`}>
                  <thead>
                    <tr>
                      <th scope="col">Termo do cliente</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Produto</th>
                      <th scope="col" className={styles.actionsHead}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className={styles.row}>
                        <td className={styles.name}>“{e.term}”</td>
                        <td>
                          <KindBadge brand={e.brand} />
                        </td>
                        <td>
                          <span className={styles.personText}>
                            <span>{e.productDescription}</span>
                            <span className={styles.detail}>
                              {e.productCode}
                              {!e.productActive && ' · inativo'}
                            </span>
                          </span>
                        </td>
                        <td className={styles.actionsCell}>
                          {canEdit && (
                            <RowMenu label={e.term} onEdit={() => openForm(e)} onDelete={() => setToDelete(e)} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cards}>
                {rows.map((e) => (
                  <li key={e.id} className={styles.itemCard}>
                    <div className={styles.cardTop}>
                      <span className={styles.name}>“{e.term}”</span>
                      {canEdit && <RowMenu label={e.term} onEdit={() => openForm(e)} onDelete={() => setToDelete(e)} />}
                    </div>
                    <p className={styles.cardMeta}>
                      {e.productCode} · {e.productDescription}
                      {!e.productActive && ' · inativo'}
                    </p>
                    <div className={styles.cardFoot}>
                      <KindBadge brand={e.brand} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <Modal
        open={form !== null}
        title={form?.item ? 'Editar equivalência' : 'Nova equivalência'}
        onClose={() => setForm(null)}
      >
        <EquivalenceForm
          key={form?.item?.id ?? 'nova'}
          initial={form?.item}
          products={productsState.data ?? []}
          busy={busy}
          error={formError}
          onSubmit={handleSave}
          onCancel={() => setForm(null)}
        />
      </Modal>

      <ConfirmDelete
        name={toDelete ? `“${toDelete.term}” → ${toDelete.productCode}` : null}
        what="equivalência"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
