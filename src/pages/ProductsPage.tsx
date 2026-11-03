import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCan } from '@/contexts/AuthContext';
import { ConfirmDelete } from '@/features/people/ConfirmDelete';
import { ListToolbar } from '@/features/people/ListToolbar';
import { Modal } from '@/features/people/Modal';
import { RowMenu } from '@/features/people/RowMenu';
import { matches, useList } from '@/features/people/useList';
import { ProductForm, type ProductDraft } from '@/features/products/ProductForm';
import { formatBRL } from '@/lib/format';
import { newId } from '@/services/peopleService';
import { deleteProduct, DuplicateProductCodeError, listProducts, saveProduct } from '@/services/productsService';
import type { Product, ProductStatus } from '@/types/products';
import styles from './ListPage.module.css';

type StatusFilter = 'todos' | ProductStatus;

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Ativo', label: 'Ativos' },
  { value: 'Inativo', label: 'Inativos' },
] as const satisfies ReadonlyArray<{ value: StatusFilter; label: string }>;

function StatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`${styles.badge} ${status === 'Ativo' ? styles.ok : styles.off}`}>{status}</span>;
}

function Thumb({ src }: { src?: string }) {
  return src ? (
    <img src={src} alt="" className={styles.thumb} />
  ) : (
    <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
      <Icon name="image" size={16} />
    </span>
  );
}

export function ProductsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [reloadKey, setReloadKey] = useState(0);
  const state = useList(listProducts, 'Não foi possível carregar os produtos.', reloadKey);
  // O vendedor só consulta o catálogo.
  const canEdit = useCan('manageCatalog');

  /** `{}` = novo cadastro; `{ item }` = edição; `null` = fechado. */
  const [form, setForm] = useState<{ item?: Product } | null>(null);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const all = state.data;
  const products = useMemo(
    () =>
      (all ?? []).filter(
        (p) => (filter === 'todos' || p.status === filter) && matches(query, p.code, p.description, p.category),
      ),
    [all, filter, query],
  );
  const activeCount = (all ?? []).filter((p) => p.status === 'Ativo').length;
  const takenCodes = (all ?? []).filter((p) => p.id !== form?.item?.id).map((p) => p.code);

  function openForm(item?: Product) {
    setFormError('');
    setForm(item ? { item } : {});
  }

  async function handleSave(draft: ProductDraft) {
    setBusy(true);
    setFormError('');
    try {
      await saveProduct({ ...(form?.item ?? { id: newId('p') }), ...draft });
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      if (!(error instanceof DuplicateProductCodeError)) console.error('Falha ao salvar o produto', error);
      setFormError(error instanceof DuplicateProductCodeError ? error.message : 'Não foi possível salvar o produto.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteProduct(toDelete.id);
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
          <h1 className={styles.h1}>Produtos</h1>
          <p className={styles.sub}>
            {all ? `${activeCount} ativos de ${all.length} cadastrados · os ativos aparecem nos orçamentos` : 'Catálogo'}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => openForm()}>
            <Icon name="plus" size={16} />
            Novo produto
          </button>
        )}
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
          <span className="sr-only">Carregando produtos…</span>
        </div>
      ) : all ? (
        <section className={`card ${styles.card}`} aria-label="Lista de produtos">
          <ListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por código, descrição ou categoria"
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            filterLabel="Filtrar por status"
            count={products.length}
            noun={['produto', 'produtos']}
          />

          {products.length === 0 ? (
            <p className={styles.empty}>Nenhum produto encontrado.</p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={`${styles.table} ${styles.tableNarrow}`}>
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Status</th>
                      <th scope="col" className={styles.num}>
                        Preço de tabela
                      </th>
                      <th scope="col" className={styles.actionsHead}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className={styles.row}>
                        <td>
                          <span className={styles.productCell}>
                            <Thumb src={product.photos?.[0]} />
                            <span className={styles.personText}>
                              <span className={styles.name}>{product.description}</span>
                              <span className={styles.detail}>{product.code}</span>
                            </span>
                          </span>
                        </td>
                        <td className={styles.muted}>{product.category}</td>
                        <td>
                          <StatusBadge status={product.status} />
                        </td>
                        <td className={styles.num}>{formatBRL(product.unitPrice)}</td>
                        <td className={styles.actionsCell}>
                          {canEdit && (
                            <RowMenu
                              label={product.description}
                              onEdit={() => openForm(product)}
                              onDelete={() => setToDelete(product)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cards}>
                {products.map((product) => (
                  <li key={product.id} className={styles.itemCard}>
                    <div className={styles.cardTop}>
                      <span className={styles.productCell}>
                        <Thumb src={product.photos?.[0]} />
                        <span className={styles.personText}>
                          <span className={styles.name}>{product.description}</span>
                          <span className={styles.detail}>
                            {product.code} · {product.category}
                          </span>
                        </span>
                      </span>
                      {canEdit && (
                        <RowMenu
                          label={product.description}
                          onEdit={() => openForm(product)}
                          onDelete={() => setToDelete(product)}
                        />
                      )}
                    </div>
                    <div className={styles.cardFoot}>
                      <StatusBadge status={product.status} />
                      <span className={styles.cardStrong}>{formatBRL(product.unitPrice)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <Modal open={form !== null} title={form?.item ? 'Editar produto' : 'Novo produto'} onClose={() => setForm(null)}>
        <ProductForm
          key={form?.item?.id ?? 'novo'}
          initial={form?.item}
          takenCodes={takenCodes}
          busy={busy}
          error={formError}
          onSubmit={handleSave}
          onCancel={() => setForm(null)}
        />
      </Modal>

      <ConfirmDelete
        name={toDelete ? `${toDelete.code} · ${toDelete.description}` : null}
        what="produto"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
