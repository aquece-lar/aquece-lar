import { useState, type FormEvent } from 'react';
import { Combobox } from '@/features/quotes/Combobox';
import { MAX_TERM, type Equivalence, type EquivalenceDraft } from '@/types/equivalences';
import type { Product } from '@/types/products';
import styles from '@/features/people/Form.module.css';

type Errors = Partial<Record<keyof EquivalenceDraft, string>>;

function validate(draft: EquivalenceDraft): Errors {
  const errors: Errors = {};
  const term = draft.term.trim();
  if (!term) errors.term = 'Escreva como o cliente chama o produto.';
  else if (term.length > MAX_TERM) errors.term = `No máximo ${MAX_TERM} caracteres.`;
  if (!draft.productId) errors.productId = 'Escolha o produto.';
  return errors;
}

interface EquivalenceFormProps {
  initial?: Equivalence;
  /** Todos os produtos (inativos também, para não perder o que já aponta para eles). */
  products: Product[];
  busy: boolean;
  error?: string;
  onSubmit: (draft: EquivalenceDraft) => void;
  onCancel: () => void;
}

export function EquivalenceForm({ initial, products, busy, error, onSubmit, onCancel }: EquivalenceFormProps) {
  const [draft, setDraft] = useState<EquivalenceDraft>({
    term: initial?.term ?? '',
    productId: initial?.productId ?? '',
    brand: initial?.brand ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const options = products.map((p) => ({
    id: p.id,
    name: `${p.code} · ${p.description}`,
    hint: p.status === 'Ativo' ? undefined : 'Inativo',
  }));

  function set<K extends keyof EquivalenceDraft>(key: K, value: EquivalenceDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit({ ...draft, term: draft.term.trim(), brand: draft.brand.trim() });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>Termo *</span>
          <input
            className={styles.input}
            value={draft.term}
            onChange={(e) => set('term', e.target.value)}
            placeholder="aquecedor 20 litros, REU-1002…"
            aria-invalid={Boolean(errors.term)}
            autoFocus
          />
          {errors.term ? (
            <p className={styles.error}>{errors.term}</p>
          ) : (
            <span className={styles.hint}>Como o cliente escreve. Acento e maiúsculas não importam.</span>
          )}
        </label>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="equivalencia-produto" className={styles.label}>
            Produto *
          </label>
          <Combobox
            id="equivalencia-produto"
            options={options}
            value={draft.productId}
            onChange={(id) => set('productId', id)}
            placeholder="Código ou nome do produto"
            invalid={Boolean(errors.productId)}
          />
          {errors.productId && <p className={styles.error}>{errors.productId}</p>}
        </div>

        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>Marca</span>
          <input
            className={styles.input}
            value={draft.brand}
            onChange={(e) => set('brand', e.target.value)}
            placeholder="Rinnai, Komeco…"
          />
          <span className={styles.hint}>Só quando o termo é o código de outro fabricante. Vazio é um apelido.</span>
        </label>
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
