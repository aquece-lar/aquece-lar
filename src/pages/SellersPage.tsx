import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ConfirmDelete } from '@/features/people/ConfirmDelete';
import { ListToolbar } from '@/features/people/ListToolbar';
import { Modal } from '@/features/people/Modal';
import { RowMenu } from '@/features/people/RowMenu';
import { SellerForm, type SellerDraft } from '@/features/people/SellerForm';
import { matches, useList } from '@/features/people/useList';
import { formatBRLRounded, initials } from '@/lib/format';
import { deleteSeller, listSellers, newId, saveSeller } from '@/services/peopleService';
import type { Seller, SellerStatus } from '@/types/people';
import styles from './ListPage.module.css';

type StatusFilter = 'todos' | SellerStatus;

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Ativo', label: 'Ativos' },
  { value: 'Inativo', label: 'Inativos' },
] as const satisfies ReadonlyArray<{ value: StatusFilter; label: string }>;

function StatusBadge({ status }: { status: SellerStatus }) {
  return <span className={`${styles.badge} ${status === 'Ativo' ? styles.ok : styles.off}`}>{status}</span>;
}

/** Quanto da meta do mês o valor orçado no mês já cobre. */
function goalPercent(seller: Seller): number {
  return seller.monthlyGoal ? Math.round((seller.amount / seller.monthlyGoal) * 100) : 0;
}

export function SellersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [reloadKey, setReloadKey] = useState(0);
  const state = useList(listSellers, 'Não foi possível carregar os vendedores.', reloadKey);

  /** `{}` = novo cadastro; `{ item }` = edição; `null` = fechado. */
  const [form, setForm] = useState<{ item?: Seller } | null>(null);
  const [toDelete, setToDelete] = useState<Seller | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => setFormError(''), [form]);

  const all = state.data;
  const sellers = useMemo(
    () =>
      (all ?? []).filter(
        (s) =>
          (filter === 'todos' || s.status === filter) && matches(query, s.name, s.email, s.phone, s.region),
      ),
    [all, filter, query],
  );
  const activeCount = (all ?? []).filter((s) => s.status === 'Ativo').length;

  async function handleSave(draft: SellerDraft) {
    setBusy(true);
    setFormError('');
    try {
      await saveSeller({ ...(form?.item ?? { id: newId('v'), quotes: 0, amount: 0 }), ...draft });
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o vendedor.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteSeller(toDelete.id);
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
          <h1 className={styles.h1}>Vendedores</h1>
          <p className={styles.sub}>
            {all ? `${activeCount} ativos de ${all.length} cadastrados · números do mês atual` : 'Equipe comercial'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
          <Icon name="plus" size={16} />
          Novo vendedor
        </button>
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
          <span className="sr-only">Carregando vendedores…</span>
        </div>
      ) : all ? (
        <section className={`card ${styles.card}`} aria-label="Lista de vendedores">
          <ListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por nome, e-mail, telefone ou região"
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            filterLabel="Filtrar por status"
            count={sellers.length}
            noun={['vendedor', 'vendedores']}
          />

          {sellers.length === 0 ? (
            <p className={styles.empty}>Nenhum vendedor encontrado.</p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Vendedor</th>
                      <th scope="col">Telefone</th>
                      <th scope="col">Região</th>
                      <th scope="col">Status</th>
                      <th scope="col" className={styles.num}>
                        Orçamentos
                      </th>
                      <th scope="col" className={styles.num}>
                        Valor orçado
                      </th>
                      <th scope="col" className={styles.num}>
                        Meta do mês
                      </th>
                      <th scope="col" className={styles.actionsHead}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller) => (
                      <tr key={seller.id} className={styles.row}>
                        <td>
                          <div className={styles.person}>
                            <span className={styles.avatar} aria-hidden="true">
                              {initials(seller.name)}
                            </span>
                            <span className={styles.personText}>
                              <Link to={`/vendedores/${seller.id}`} className={`${styles.name} ${styles.nameLink}`}>
                                {seller.name}
                              </Link>
                              <span className={styles.detail}>{seller.email}</span>
                            </span>
                          </div>
                        </td>
                        <td className={styles.date}>{seller.phone || '—'}</td>
                        <td className={styles.muted}>{seller.region || '—'}</td>
                        <td>
                          <StatusBadge status={seller.status} />
                        </td>
                        <td className={styles.num}>{seller.quotes}</td>
                        <td className={styles.num}>{formatBRLRounded(seller.amount)}</td>
                        <td className={styles.num}>
                          {seller.monthlyGoal ? (
                            <span className={styles.goalCell}>
                              <span>{formatBRLRounded(seller.monthlyGoal)}</span>
                              <span className={styles.detail}>{goalPercent(seller)}% atingido</span>
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <RowMenu
                            label={seller.name}
                            onEdit={() => setForm({ item: seller })}
                            onDelete={() => setToDelete(seller)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cards}>
                {sellers.map((seller) => (
                  <li key={seller.id} className={styles.itemCard}>
                    <div className={styles.cardTop}>
                      <div className={styles.person}>
                        <span className={styles.avatar} aria-hidden="true">
                          {initials(seller.name)}
                        </span>
                        <span className={styles.personText}>
                          <Link to={`/vendedores/${seller.id}`} className={`${styles.name} ${styles.nameLink}`}>
                                {seller.name}
                              </Link>
                          <span className={styles.detail}>{seller.region}</span>
                        </span>
                      </div>
                      <RowMenu
                        label={seller.name}
                        onEdit={() => setForm({ item: seller })}
                        onDelete={() => setToDelete(seller)}
                      />
                    </div>
                    <p className={styles.cardMeta}>
                      {[seller.email, seller.phone].filter(Boolean).join(' · ')}
                    </p>
                    <div className={styles.cardFoot}>
                      <StatusBadge status={seller.status} />
                      <span>
                        {seller.quotes} {seller.quotes === 1 ? 'orçamento' : 'orçamentos'} ·{' '}
                        <span className={styles.cardStrong}>{formatBRLRounded(seller.amount)}</span>
                        {seller.monthlyGoal ? ` · ${goalPercent(seller)}% da meta` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <Modal open={form !== null} title={form?.item ? 'Editar vendedor' : 'Novo vendedor'} onClose={() => setForm(null)}>
        <SellerForm
          key={form?.item?.id ?? 'novo'}
          initial={form?.item}
          busy={busy}
          error={formError}
          onSubmit={handleSave}
          onCancel={() => setForm(null)}
        />
      </Modal>

      <ConfirmDelete
        name={toDelete?.name ?? null}
        what="vendedor"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
