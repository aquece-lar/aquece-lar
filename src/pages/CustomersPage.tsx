import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ConfirmDelete } from '@/features/people/ConfirmDelete';
import { CustomerForm, type CustomerDraft } from '@/features/people/CustomerForm';
import { ListToolbar } from '@/features/people/ListToolbar';
import { Modal } from '@/features/people/Modal';
import { RowMenu } from '@/features/people/RowMenu';
import { matches, useList } from '@/features/people/useList';
import { formatDateTime, initials } from '@/lib/format';
import { deleteCustomer, listCustomers, listSellers, newId, saveCustomer } from '@/services/peopleService';
import type { Customer, CustomerKind } from '@/types/people';
import styles from './ListPage.module.css';

type KindFilter = 'todos' | CustomerKind;

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'PJ', label: 'Empresas' },
  { value: 'PF', label: 'Pessoas' },
] as const satisfies ReadonlyArray<{ value: KindFilter; label: string }>;

function KindBadge({ kind }: { kind: CustomerKind }) {
  return (
    <span className={`${styles.badge} ${kind === 'PJ' ? styles.info : styles.brand}`}>
      {kind === 'PJ' ? 'Empresa' : 'Pessoa'}
    </span>
  );
}

export function CustomersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<KindFilter>('todos');
  const [reloadKey, setReloadKey] = useState(0);
  const state = useList(listCustomers, 'Não foi possível carregar os clientes.', reloadKey);
  const sellersState = useList(listSellers, 'Não foi possível carregar os vendedores.');

  /** `{}` = novo cadastro; `{ item }` = edição; `null` = fechado. */
  const [form, setForm] = useState<{ item?: Customer } | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => setFormError(''), [form]);

  const all = state.data;
  const customers = useMemo(
    () =>
      (all ?? []).filter(
        (c) =>
          (filter === 'todos' || c.kind === filter) &&
          matches(query, c.name, c.document, c.phone, c.city, c.seller),
      ),
    [all, filter, query],
  );
  const sellerNames = useMemo(
    () => (sellersState.data ?? []).filter((s) => s.status === 'Ativo').map((s) => s.name),
    [sellersState.data],
  );

  async function handleSave(draft: CustomerDraft) {
    setBusy(true);
    setFormError('');
    try {
      await saveCustomer({ ...(form?.item ?? { id: newId('c'), quotes: 0, lastQuoteAt: null }), ...draft });
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteCustomer(toDelete.id);
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
          <h1 className={styles.h1}>Clientes</h1>
          <p className={styles.sub}>{all ? `${all.length} clientes cadastrados` : 'Carteira de clientes'}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({})}>
          <Icon name="plus" size={16} />
          Novo cliente
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
          <span className="sr-only">Carregando clientes…</span>
        </div>
      ) : all ? (
        <section className={`card ${styles.card}`} aria-label="Lista de clientes">
          <ListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por nome, CPF/CNPJ, telefone, cidade ou vendedor"
            filters={FILTERS}
            filter={filter}
            onFilterChange={setFilter}
            filterLabel="Filtrar por tipo de cliente"
            count={customers.length}
            noun={['cliente', 'clientes']}
          />

          {customers.length === 0 ? (
            <p className={styles.empty}>Nenhum cliente encontrado.</p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Telefone</th>
                      <th scope="col">Cidade</th>
                      <th scope="col">Vendedor</th>
                      <th scope="col" className={styles.num}>
                        Orçamentos
                      </th>
                      <th scope="col">Último orçamento</th>
                      <th scope="col" className={styles.actionsHead}>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className={styles.row}>
                        <td>
                          <div className={styles.person}>
                            <span className={styles.avatar} aria-hidden="true">
                              {initials(customer.name)}
                            </span>
                            <span className={styles.personText}>
                              <span className={styles.name}>{customer.name}</span>
                              {customer.document && <span className={styles.detail}>{customer.document}</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <KindBadge kind={customer.kind} />
                        </td>
                        <td className={styles.date}>{customer.phone || '—'}</td>
                        <td className={styles.muted}>{customer.city || '—'}</td>
                        <td className={styles.muted}>{customer.seller || '—'}</td>
                        <td className={styles.num}>{customer.quotes}</td>
                        <td className={styles.date}>
                          {customer.lastQuoteAt ? formatDateTime(customer.lastQuoteAt) : '—'}
                        </td>
                        <td className={styles.actionsCell}>
                          <RowMenu
                            label={customer.name}
                            onEdit={() => setForm({ item: customer })}
                            onDelete={() => setToDelete(customer)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.cards}>
                {customers.map((customer) => (
                  <li key={customer.id} className={styles.itemCard}>
                    <div className={styles.cardTop}>
                      <div className={styles.person}>
                        <span className={styles.avatar} aria-hidden="true">
                          {initials(customer.name)}
                        </span>
                        <span className={styles.personText}>
                          <span className={styles.name}>{customer.name}</span>
                          {customer.document && <span className={styles.detail}>{customer.document}</span>}
                        </span>
                      </div>
                      <RowMenu
                        label={customer.name}
                        onEdit={() => setForm({ item: customer })}
                        onDelete={() => setToDelete(customer)}
                      />
                    </div>
                    <p className={styles.cardMeta}>
                      {[customer.city, customer.phone, customer.seller].filter(Boolean).join(' · ')}
                    </p>
                    <div className={styles.cardFoot}>
                      <KindBadge kind={customer.kind} />
                      <span className={styles.cardMeta}>
                        {customer.quotes} {customer.quotes === 1 ? 'orçamento' : 'orçamentos'}
                        {customer.lastQuoteAt && ` · último ${formatDateTime(customer.lastQuoteAt)}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <Modal open={form !== null} title={form?.item ? 'Editar cliente' : 'Novo cliente'} onClose={() => setForm(null)}>
        <CustomerForm
          key={form?.item?.id ?? 'novo'}
          initial={form?.item}
          sellers={sellerNames}
          busy={busy}
          error={formError}
          onSubmit={handleSave}
          onCancel={() => setForm(null)}
        />
      </Modal>

      <ConfirmDelete
        name={toDelete?.name ?? null}
        what="cliente"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
