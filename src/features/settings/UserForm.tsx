import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD, type User, type UserDraft } from '@/types/users';
import styles from '@/features/people/Form.module.css';

type Errors = Partial<Record<keyof UserDraft | 'confirm', string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserFormProps {
  /** Sem `initial`, é um usuário novo e a senha é obrigatória. */
  initial?: User;
  busy: boolean;
  /** Erro ao salvar (ex.: e-mail já usado). */
  error?: string;
  onSubmit: (draft: UserDraft) => void;
  onCancel: () => void;
}

export function UserForm({ initial, busy, error, onSubmit, onCancel }: UserFormProps) {
  const [draft, setDraft] = useState<UserDraft>({ name: initial?.name ?? '', email: initial?.email ?? '', password: '' });
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
    return found;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ name: draft.name.trim(), email: draft.email.trim(), password: draft.password });
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
