import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useRefreshSession } from '@/contexts/AuthContext';
import { ConfirmDelete } from '@/features/people/ConfirmDelete';
import { Modal } from '@/features/people/Modal';
import { RowMenu } from '@/features/people/RowMenu';
import { useList } from '@/features/people/useList';
import { formatDateTime, initials } from '@/lib/format';
import { listSellers } from '@/services/peopleService';
import { createUser, deleteUser, listUsers, updateUser } from '@/services/usersService';
import type { User, UserDraft } from '@/types/users';
import { UserForm } from './UserForm';
import styles from './UsersSection.module.css';

/** Quem pode entrar no sistema: cadastrar, trocar senha e excluir. Salva na hora, fora do formulário de cima. */
export function UsersSection({ onChanged }: { onChanged?: () => void }) {
  const refresh = useRefreshSession();
  const [reloadKey, setReloadKey] = useState(0);
  const state = useList(listUsers, 'Não foi possível carregar os usuários.', reloadKey);
  const sellersState = useList(listSellers, 'Não foi possível carregar os vendedores.', reloadKey);

  /** `{}` = novo; `{ item }` = edição; `null` = fechado. */
  const [form, setForm] = useState<{ item?: User } | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function openForm(next: { item?: User } | null) {
    setFormError('');
    setForm(next);
  }

  async function handleSave(draft: UserDraft) {
    setBusy(true);
    setFormError('');
    try {
      const editing = form?.item;
      if (editing) await updateUser(editing.id, draft);
      else await createUser(draft);
      setForm(null);
      setReloadKey((k) => k + 1);
      onChanged?.();
      // O próprio nome e o perfil aparecem no menu e no topo.
      if (editing?.isCurrent) await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o usuário.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteUser(toDelete.id);
      setToDelete(null);
      setReloadKey((k) => k + 1);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const users = state.data;

  return (
    <section className={`card ${styles.section}`} aria-labelledby="usuarios-titulo">
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 id="usuarios-titulo" className={styles.title}>
            Usuários
          </h2>
          <p className={styles.hint}>Quem pode entrar no sistema, com e-mail, senha e perfil.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => openForm({})}>
          <Icon name="plus" size={16} />
          Novo usuário
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

      {!users ? (
        state.status === 'loading' && <p className={styles.hint}>Carregando usuários…</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de usuários">
          {users.map((user) => (
            <li key={user.id} className={styles.row}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className={styles.person}>
                <span className={styles.name}>
                  {user.name}
                  {user.isCurrent && <span className={styles.you}>você</span>}
                </span>
                <span className={styles.detail}>{user.email}</span>
              </span>
              <span className={styles.role}>
                <span className={styles.roleName}>{user.role}</span>
                {user.role === 'Vendedor' && (
                  <span className={styles.detail}>
                    {user.sellerName ?? 'Sem vendedor ligado'}
                    {user.seeAll ? ' · vê todos' : ''}
                    {user.exceedDiscount ? ' · passa do desconto' : ''}
                  </span>
                )}
              </span>
              <span className={styles.access}>
                {user.lastLoginAt ? `Último acesso ${formatDateTime(user.lastLoginAt)}` : 'Nunca entrou'}
              </span>
              <RowMenu label={user.name} onEdit={() => openForm({ item: user })} onDelete={() => setToDelete(user)} />
            </li>
          ))}
        </ul>
      )}

      <Modal open={form !== null} title={form?.item ? 'Editar usuário' : 'Novo usuário'} onClose={() => openForm(null)}>
        <UserForm
          key={form?.item?.id ?? 'novo'}
          initial={form?.item}
          sellers={sellersState.data ?? []}
          busy={busy}
          error={formError}
          onSubmit={handleSave}
          onCancel={() => openForm(null)}
        />
      </Modal>

      <ConfirmDelete
        name={toDelete?.name ?? null}
        what="usuário"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
