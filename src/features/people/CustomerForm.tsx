import { Select } from '@/components/Select';
import { useState, type FormEvent } from 'react';
import type { Customer, CustomerKind } from '@/types/people';
import styles from './Form.module.css';

export type CustomerDraft = Pick<Customer, 'name' | 'kind' | 'document' | 'phone' | 'city' | 'seller'>;

type Errors = Partial<Record<keyof CustomerDraft, string>>;

const EMPTY: CustomerDraft = { name: '', kind: 'PJ', document: '', phone: '', city: '', seller: '' };

function validate(draft: CustomerDraft): Errors {
  const errors: Errors = {};
  if (draft.name.trim().length < 3) errors.name = 'Informe o nome do cliente.';
  const digits = draft.document.replace(/\D/g, '');
  const expected = draft.kind === 'PJ' ? 14 : 11;
  if (digits.length > 0 && digits.length !== expected) {
    errors.document = draft.kind === 'PJ' ? 'O CNPJ deve ter 14 dígitos.' : 'O CPF deve ter 11 dígitos.';
  }
  return errors;
}

interface CustomerFormProps {
  /** Cliente em edição, ou só alguns campos já sabidos num cadastro novo (ex.: o nome digitado). */
  initial?: Partial<CustomerDraft>;
  sellers: string[];
  /** Perfil Vendedor: o cliente fica sempre no nome dele (a API também força). */
  lockedSeller?: string;
  busy: boolean;
  /** Erro ao salvar (ex.: recusado pela API). */
  error?: string;
  onSubmit: (draft: CustomerDraft) => void;
  onCancel: () => void;
}

export function CustomerForm({ initial, sellers, lockedSeller, busy, error, onSubmit, onCancel }: CustomerFormProps) {
  const [draft, setDraft] = useState<CustomerDraft>({
    ...EMPTY,
    ...initial,
    ...(lockedSeller === undefined ? {} : { seller: lockedSeller }),
  });
  const [errors, setErrors] = useState<Errors>({});
  // Mantém o vendedor atual na lista mesmo que ele tenha sido excluído.
  const sellerOptions = draft.seller && !sellers.includes(draft.seller) ? [draft.seller, ...sellers] : sellers;

  function set<K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({ ...draft, name: draft.name.trim(), document: draft.document.trim() });
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
        <div className={styles.field}>
          <label htmlFor="cliente-tipo" className={styles.label}>
            Tipo
          </label>
          <Select
            id="cliente-tipo"
            value={draft.kind}
            options={[
              { value: 'PJ', label: 'Empresa (CNPJ)' },
              { value: 'PF', label: 'Pessoa (CPF)' },
            ]}
            onChange={(value) => set('kind', value as CustomerKind)}
          />
        </div>
        <label className={styles.field}>
          <span className={styles.label}>{draft.kind === 'PJ' ? 'CNPJ' : 'CPF'}</span>
          <input
            className={styles.input}
            value={draft.document}
            onChange={(e) => set('document', e.target.value)}
            inputMode="numeric"
            placeholder={draft.kind === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
            aria-invalid={Boolean(errors.document)}
          />
          {errors.document && <p className={styles.error}>{errors.document}</p>}
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
          <span className={styles.label}>Cidade</span>
          <input className={styles.input} value={draft.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="cliente-vendedor" className={styles.label}>
            Vendedor responsável
          </label>
          <Select
            id="cliente-vendedor"
            value={draft.seller}
            options={[{ value: '', label: 'Sem vendedor' }, ...sellerOptions.map((name) => ({ value: name, label: name }))]}
            onChange={(value) => set('seller', value)}
            disabled={lockedSeller !== undefined}
          />
        </div>
      </div>

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
