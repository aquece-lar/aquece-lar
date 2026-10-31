import { Select } from '@/components/Select';
import { PhotoField } from '@/features/products/PhotoField';
import { useState, type FormEvent } from 'react';
import { sameCode } from '@/services/productsService';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory, type ProductStatus } from '@/types/products';
import styles from '@/features/people/Form.module.css';

export type ProductDraft = Pick<Product, 'code' | 'description' | 'category' | 'unitPrice' | 'status'> & {
  photos: string[];
};

/** O preço fica como texto enquanto é digitado. */
type FormState = Omit<ProductDraft, 'unitPrice'> & { unitPrice: string };

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  code: '',
  description: '',
  category: 'Aquecedores a gás',
  unitPrice: '',
  status: 'Ativo',
  photos: [],
};

interface ProductFormProps {
  initial?: Product;
  /** Códigos já usados por outros produtos, para avisar antes de salvar. */
  takenCodes: string[];
  busy: boolean;
  /** Erro devolvido pelo serviço ao salvar. */
  error?: string;
  onSubmit: (draft: ProductDraft) => void;
  onCancel: () => void;
}

export function ProductForm({ initial, takenCodes, busy, error, onSubmit, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<FormState>(
    initial ? { ...initial, unitPrice: String(initial.unitPrice), photos: initial.photos ?? [] } : EMPTY,
  );
  const [errors, setErrors] = useState<Errors>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): Errors {
    const found: Errors = {};
    const code = form.code.trim();
    if (!code) found.code = 'Informe o código.';
    else if (takenCodes.some((taken) => sameCode(taken, code))) found.code = 'Já existe um produto com este código.';
    if (form.description.trim().length < 3) found.description = 'Informe a descrição.';
    const price = Number(form.unitPrice);
    if (form.unitPrice.trim() === '' || !Number.isFinite(price) || price <= 0) found.unitPrice = 'Informe um preço maior que zero.';
    return found;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit({
        ...form,
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        unitPrice: Math.round(Number(form.unitPrice) * 100) / 100,
      });
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Código *</span>
          <input
            className={styles.input}
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="AQG-20D"
            autoCapitalize="characters"
            aria-invalid={Boolean(errors.code)}
            autoFocus
          />
          {errors.code && <p className={styles.error}>{errors.code}</p>}
        </label>
        <div className={styles.field}>
          <label htmlFor="produto-categoria" className={styles.label}>
            Categoria
          </label>
          <Select
            id="produto-categoria"
            value={form.category}
            options={PRODUCT_CATEGORIES.map((category) => ({ value: category, label: category }))}
            onChange={(value) => set('category', value as ProductCategory)}
          />
        </div>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>Descrição *</span>
          <input
            className={styles.input}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && <p className={styles.error}>{errors.description}</p>}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Preço de tabela (R$) *</span>
          <input
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            className={styles.input}
            value={form.unitPrice}
            onChange={(e) => set('unitPrice', e.target.value)}
            aria-invalid={Boolean(errors.unitPrice)}
          />
          {errors.unitPrice && <p className={styles.error}>{errors.unitPrice}</p>}
        </label>
        <div className={styles.field}>
          <label htmlFor="produto-status" className={styles.label}>
            Status
          </label>
          <Select
            id="produto-status"
            value={form.status}
            options={[
              { value: 'Ativo', label: 'Ativo (aparece nos orçamentos)' },
              { value: 'Inativo', label: 'Inativo' },
            ]}
            onChange={(value) => set('status', value as ProductStatus)}
          />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>Fotos</span>
          <PhotoField photos={form.photos} onChange={(photos) => set('photos', photos)} />
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
