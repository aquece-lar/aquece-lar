import { useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { ROLES, type Role } from '@/types/auth';
import type { Seller } from '@/types/people';
import { MIN_PASSWORD, type User, type UserDraft } from '@/types/users';
import styles from '@/features/people/Form.module.css';
import checkStyles from './UserForm.module.css';

type Errors = Partial<Record<keyof UserDraft | 'confirm', string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O que cada perfil faz, para quem cadastra escolher. */
export const ROLE_HINTS: Record<Role, string> = {
  Administrador: 'Acesso total, inclusive usuários e configurações.',
  Gerente: 'Tudo, menos usuários e configurações. Pode passar do desconto máximo.',
  Vendedor: 'Faz orçamentos e cadastra clientes no próprio nome.',
};

interface UserFormProps {
  /** Sem `initial`, é um usuário novo e a senha é obrigatória. */
  initial?: User;
  /** Cadastros de vendedor para ligar ao perfil Vendedor. */
  sellers: Seller[];
  busy: boolean;
  /** Erro ao salvar (ex.: e-mail já usado). */
  error?: string;
  onSubmit: (draft: UserDraft) => void;
  onCancel: () => void;
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className={checkStyles.check}>
      <input
        type="checkbox"
        className={checkStyles.checkInput}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={checkStyles.checkBox} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
      <span>{children}</span>
    </label>
  );
}

export function UserForm({ initial, sellers, busy, error, onSubmit, onCancel }: UserFormProps) {
  const [draft, setDraft] = useState<UserDraft>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    password: '',
    role: initial?.role ?? 'Vendedor',
    sellerId: initial?.sellerId ?? null,
    seeAll: initial?.seeAll ?? false,
    exceedDiscount: initial?.exceedDiscount ?? false,
  });
  const isSeller = draft.role === 'Vendedor';
  // O próprio perfil não muda por aqui: evita alguém se trancar fora das configurações.
  const lockedRole = Boolean(initial?.isCurrent);
  // Mantém na lista um vendedor ligado que ficou inativo.
  const sellerOptions = sellers.filter((s) => s.status === 'Ativo' || s.id === draft.sellerId);
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const editing = Boolean(initial);

  function set<K extends keyof UserDraft>(key: K, value: UserDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): Errors {
    const found: Errors = {};
    if (draft.name.trim().length < 3) found.name = 'Informe o nome completo.';
    if (!EMAIL.test(draft.email.trim())) found.email = 'Informe um e-mail válido.';
    if ((!editing || draft.password) && draft.password.length < MIN_PASSWORD) {
      found.password = `A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`;
    } else if (draft.password && confirm !== draft.password) {
      found.confirm = 'As senhas não conferem.';
    }
    if (isSeller && !draft.sellerId) found.sellerId = 'Escolha o vendedor ligado a este usuário.';
    return found;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({
        ...draft,
        name: draft.name.trim(),
        email: draft.email.trim(),
        // Fora do perfil Vendedor, as permissões de vendedor não se aplicam.
        sellerId: isSeller ? draft.sellerId : null,
        seeAll: isSeller && draft.seeAll,
        exceedDiscount: isSeller && draft.exceedDiscount,
      });
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>Nome *</span>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            autoFocus
          />
          {errors.name && <p className={styles.error}>{errors.name}</p>}
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>E-mail (usado para entrar) *</span>
          <input
            type="email"
            autoComplete="off"
            className={styles.input}
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className={styles.error}>{errors.email}</p>}
        </label>
        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="usuario-perfil" className={styles.label}>
            Perfil *
          </label>
          <Select
            id="usuario-perfil"
            value={draft.role}
            options={ROLES.map((role) => ({ value: role, label: role }))}
            onChange={(value) => set('role', value as Role)}
            disabled={lockedRole}
          />
          <span className={checkStyles.hint}>
            {lockedRole ? 'Você não pode mudar o seu próprio perfil.' : ROLE_HINTS[draft.role]}
          </span>
        </div>
        {isSeller && (
          <>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="usuario-vendedor" className={styles.label}>
                Vendedor ligado *
              </label>
              <Select
                id="usuario-vendedor"
                value={draft.sellerId ?? ''}
                placeholder="Escolha o cadastro de vendedor"
                options={sellerOptions.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(value) => set('sellerId', value)}
                invalid={Boolean(errors.sellerId)}
              />
              {errors.sellerId ? (
                <p className={styles.error}>{errors.sellerId}</p>
              ) : (
                <span className={checkStyles.hint}>Os orçamentos e clientes desse vendedor são os dele.</span>
              )}
            </div>
            <fieldset className={`${styles.full} ${checkStyles.permissions}`}>
              <legend className={styles.label}>Permissões</legend>
              <Check checked={draft.seeAll} onChange={(value) => set('seeAll', value)}>
                Ver orçamentos, clientes e dashboard de todos os vendedores
              </Check>
              <Check checked={draft.exceedDiscount} onChange={(value) => set('exceedDiscount', value)}>
                Passar do desconto máximo das configurações
              </Check>
              <span className={checkStyles.hint}>
                Sem elas, vê só o que é dele e não salva orçamento com desconto acima do máximo.
              </span>
            </fieldset>
          </>
        )}
        <label className={styles.field}>
          <span className={styles.label}>{editing ? 'Nova senha' : 'Senha *'}</span>
          <input
            type="password"
            autoComplete="new-password"
            className={styles.input}
            value={draft.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder={editing ? 'Deixe vazio para manter' : `Mínimo ${MIN_PASSWORD} caracteres`}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <p className={styles.error}>{errors.password}</p>}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Repita a senha{editing ? '' : ' *'}</span>
          <input
            type="password"
            autoComplete="new-password"
            className={styles.input}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={editing && !draft.password}
            aria-invalid={Boolean(errors.confirm)}
          />
          {errors.confirm && <p className={styles.error}>{errors.confirm}</p>}
        </label>
      </div>

      {editing && draft.password && (
        <p className={styles.text}>Com a senha nova, quem estiver conectado com esta conta precisa entrar de novo.</p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
