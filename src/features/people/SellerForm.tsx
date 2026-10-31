import { Select } from '@/components/Select';
import { useState, type FormEvent } from 'react';
import type { Seller, SellerStatus } from '@/types/people';
import styles from './Form.module.css';

export type SellerDraft = Pick<Seller, 'name' | 'email' | 'phone' | 'region' | 'status'>;

type Errors = Partial<Record<keyof SellerDraft, string>>;

const EMPTY: SellerDraft = { name: '', email: '', phone: '', region: '', status: 'Ativo' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(draft: SellerDraft): Errors {
  const errors: Errors = {};
  if (draft.name.trim().length < 3) errors.name = 'Informe o nome completo.';
  if (!EMAIL.test(draft.email.trim())) errors.email = 'Informe um e-mail válido.';
  return errors;
}

interface SellerFormProps {
  initial?: Seller;
  busy: boolean;
  onSubmit: (draft: SellerDraft) => void;
  onCancel: () => void;
}

export function SellerForm({ initial, busy, onSubmit, onCancel }: SellerFormProps) {
  const [draft, setDraft] = useState<SellerDraft>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  function set<K extends keyof SellerDraft>(key: K, value: SellerDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ ...draft, name: draft.name.trim(), email: draft.email.trim() });
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
          <span className={styles.label}>E-mail *</span>
          <input
            type="email"
            className={styles.input}
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className={styles.error}>{errors.email}</p>}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Telefone</span>
          <input
            type="tel"
            className={styles.input}
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="(54) 99999-9999"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Região</span>
          <input className={styles.input} value={draft.region} onChange={(e) => set('region', e.target.value)} />
        </label>
        <div className={styles.field}>
          <label htmlFor="vendedor-status" className={styles.label}>
            Status
          </label>
          <Select
            id="vendedor-status"
            value={draft.status}
            options={[
              { value: 'Ativo', label: 'Ativo' },
              { value: 'Inativo', label: 'Inativo' },
            ]}
            onChange={(value) => set('status', value as SellerStatus)}
          />
        </div>
      </div>

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
