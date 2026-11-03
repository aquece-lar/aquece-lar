import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { termDiscount } from '@/config/quotes';
import { CustomerForm, type CustomerDraft } from '@/features/people/CustomerForm';
import { Modal } from '@/features/people/Modal';
import { useList } from '@/features/people/useList';
import { Combobox, type ComboboxOption } from '@/features/quotes/Combobox';
import { catalogFor } from '@/features/quotes/catalog';
import { useQuote } from '@/features/quotes/useQuote';
import { useSettings } from '@/features/settings/useSettings';
import { formatBRL, initials, toISODate } from '@/lib/format';
import { quoteTotals } from '@/lib/quoteTotals';
import { listCustomers, listSellers, newId, saveCustomer } from '@/services/peopleService';
import { listProducts } from '@/services/productsService';
import { ApiError } from '@/services/http';
import { createQuote, updateQuote } from '@/services/quotesService';
import type { Customer, Seller } from '@/types/people';
import type { CatalogProduct, QuoteContact, QuoteDetail, QuoteDiscount } from '@/types/quotes';
import type { QuoteDefaults } from '@/types/settings';
import { DatePicker } from '@/components/DatePicker';
import { Select } from '@/components/Select';

import formStyles from '@/features/people/Form.module.css';
import detailStyles from './QuoteDetailPage.module.css';
import styles from './QuoteFormPage.module.css';

/** `new` parte do zero; `edit` altera um pendente; `duplicate` cria um novo a partir de outro. */
export type QuoteFormMode = 'new' | 'edit' | 'duplicate';

/** Linha do formulário; quantidade e valor ficam como texto enquanto são digitados. */
interface Line {
  key: number;
  code: string;
  quantity: string;
  unitPrice: string;
}

type LineErrors = Partial<Record<'code' | 'quantity' | 'unitPrice', string>>;

interface Errors {
  customer?: string;
  seller?: string;
  validUntil?: string;
  discount?: string;
  lines?: Record<number, LineErrors>;
}

type DiscountType = QuoteDiscount['type'];

const FORM_ID = 'orcamento-form';

function emptyLine(key: number): Line {
  return { key, code: '', quantity: '1', unitPrice: '' };
}

function lineTotal(line: Line): number {
  const total = Number(line.quantity) * Number(line.unitPrice);
  return Number.isFinite(total) ? total : 0;
}

function defaultValidUntil(days: number): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

function validateLine(line: Line): LineErrors {
  const errors: LineErrors = {};
  if (!line.code) errors.code = 'Escolha o produto.';
  const quantity = Number(line.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = 'Mínimo 1.';
  const price = Number(line.unitPrice);
  if (line.unitPrice.trim() === '' || !Number.isFinite(price) || price <= 0) errors.unitPrice = 'Valor inválido.';
  return errors;
}

interface PageHeadProps {
  backTo: string;
  backLabel: string;
  title: string;
  sub: string;
  children?: ReactNode;
}

function PageHead({ backTo, backLabel, title, sub, children }: PageHeadProps) {
  return (
    <>
      <Link to={backTo} className={`link-strong ${detailStyles.back}`}>
        <Icon name="chevLeft" size={14} />
        {backLabel}
      </Link>
      <div className={detailStyles.pageHead}>
        <div className={detailStyles.titles}>
          <h1 className={detailStyles.h1}>{title}</h1>
          <p className={detailStyles.sub}>{sub}</p>
        </div>
        {children && <div className={detailStyles.actions}>{children}</div>}
      </div>
    </>
  );
}

/** `number` é o do orçamento-base (ex.: "#1182"), ignorado no modo `new`. */
function headText(mode: QuoteFormMode, number: string) {
  if (mode === 'edit') {
    return { title: `Editar orçamento ${number}`, sub: 'As alterações ficam registradas no histórico.', submit: 'Salvar alterações' };
  }
  if (mode === 'duplicate') {
    return { title: `Duplicar orçamento ${number}`, sub: 'Cria um orçamento novo, pendente; o original não muda.', submit: 'Criar cópia' };
  }
  return { title: 'Novo orçamento', sub: 'Ele é criado como pendente e pode ser enviado ao cliente depois.', submit: 'Salvar orçamento' };
}

interface PickerCardProps {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  options: ComboboxOption[];
  contact: QuoteContact | null;
  error?: string;
  onChange: (id: string) => void;
  onCreate?: (text: string) => void;
}

function PickerCard({ id, title, placeholder, value, options, contact, error, onChange, onCreate }: PickerCardProps) {
  return (
    <section className={`card ${detailStyles.side}`}>
      <label htmlFor={id} className={detailStyles.sideTitle}>
        {title} *
      </label>
      <Combobox
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        invalid={Boolean(error)}
        onCreate={onCreate}
      />
      {error && <p className={formStyles.error}>{error}</p>}
      {contact && (
        <>
          <div className={detailStyles.contact}>
            <span className={detailStyles.avatar} aria-hidden="true">
              {initials(contact.name)}
            </span>
            <div className={detailStyles.contactText}>
              <span className={detailStyles.contactName}>{contact.name}</span>
              {contact.detail && <span className={detailStyles.muted}>{contact.detail}</span>}
            </div>
          </div>
          {(contact.phone || contact.city) && (
            <dl className={detailStyles.facts}>
              {contact.phone && (
                <div>
                  <dt>Telefone</dt>
                  <dd>{contact.phone}</dd>
                </div>
              )}
              {contact.city && (
                <div>
                  <dt>Cidade</dt>
                  <dd>{contact.city}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}
    </section>
  );
}

interface QuoteFormProps {
  mode: QuoteFormMode;
  /** Orçamento editado ou copiado; `null` no modo `new`. */
  base: QuoteDetail | null;
  customers: Customer[];
  /** Só vendedores ativos. */
  sellers: Seller[];
  catalog: CatalogProduct[];
  /** Valores iniciais de um orçamento novo (validade, pagamento, observações). */
  defaults: QuoteDefaults;
}

function QuoteForm({ mode, base, customers: loadedCustomers, sellers, catalog, defaults }: QuoteFormProps) {
  const navigate = useNavigate();
  const text = headText(mode, base?.number ?? '');
  const backTo = base ? `/orcamentos/${base.id}` : '/orcamentos';

  // Clientes cadastrados por aqui entram na lista sem recarregar a página.
  const [created, setCreated] = useState<Customer[]>([]);
  const customers = useMemo(() => [...created, ...loadedCustomers], [created, loadedCustomers]);
  const [newCustomerName, setNewCustomerName] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState('');

  // Cliente e vendedor do orçamento-base são achados pelo nome; se não existirem mais, ficam em branco.
  const [customerId, setCustomerId] = useState(() => customers.find((c) => c.name === base?.customer)?.id ?? '');
  const [sellerId, setSellerId] = useState(() => sellers.find((s) => s.name === base?.seller)?.id ?? '');
  const [lines, setLines] = useState<Line[]>(() =>
    base
      ? base.items.map((item, key) => ({
          key,
          code: item.code,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      : [emptyLine(0)],
  );
  const nextKey = useRef(lines.length);
  // A cópia ganha validade nova; a edição mantém a original.
  const [validUntil, setValidUntil] = useState(() =>
    mode === 'edit' && base ? base.validUntil : defaultValidUntil(defaults.validDays),
  );
  const [paymentTerms, setPaymentTerms] = useState(base?.paymentTerms ?? defaults.paymentTerms[0] ?? '');
  // Orçamento novo já começa com o desconto que a condição padrão promete.
  const [discountType, setDiscountType] = useState<DiscountType>(base?.discount?.type ?? 'percent');
  const [discountValue, setDiscountValue] = useState(() => {
    if (base) return base.discount ? String(base.discount.value) : '';
    const percent = termDiscount(paymentTerms);
    return percent === null ? '' : String(percent);
  });
  const [notes, setNotes] = useState(base?.notes ?? defaults.notes);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmingDiscount, setConfirmingDiscount] = useState(false);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ id: c.id, name: c.name, hint: c.city })),
    [customers],
  );
  const sellerOptions = useMemo(() => sellers.map((s) => ({ id: s.id, name: s.name, hint: s.region })), [sellers]);
  // Mantém na lista uma forma de pagamento antiga que saiu da configuração.
  const paymentOptions = defaults.paymentTerms.includes(paymentTerms)
    ? defaults.paymentTerms
    : [paymentTerms, ...defaults.paymentTerms];

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const seller = sellers.find((s) => s.id === sellerId) ?? null;
  const customerContact: QuoteContact | null = customer && {
    name: customer.name,
    detail: customer.document,
    phone: customer.phone,
    city: customer.city || undefined,
  };
  const sellerContact: QuoteContact | null = seller && { name: seller.name, detail: seller.email, phone: seller.phone };

  const discountNumber = Number(discountValue);
  const discount: QuoteDiscount | null =
    discountValue.trim() === '' || !Number.isFinite(discountNumber) || discountNumber <= 0
      ? null
      : { type: discountType, value: discountNumber };
  const totals = quoteTotals(
    lines.map((line) => ({ quantity: 1, unitPrice: lineTotal(line) })),
    discount,
  );
  // Desconto efetivo em % do subtotal, seja ele digitado em % ou em R$.
  const discountPercent = totals.subtotal > 0 ? Math.round((totals.discount / totals.subtotal) * 10_000) / 100 : 0;
  const maxDiscount = defaults.maxDiscountPercent;
  const overLimit = maxDiscount !== null && discountPercent > maxDiscount;
  const units = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const today = toISODate(new Date());
  const productOptions = useMemo(
    () => catalog.map((p) => ({ id: p.code, name: `${p.code} · ${p.description}`, hint: formatBRL(p.unitPrice) })),
    [catalog],
  );

  // Compara com o estado inicial para saber se há algo a perder ao sair.
  const snapshot = JSON.stringify([
    customerId,
    sellerId,
    lines.map(({ code, quantity, unitPrice }) => [code, quantity, unitPrice]),
    validUntil,
    paymentTerms,
    discountType,
    discountValue,
    notes,
  ]);
  const initialSnapshot = useRef(snapshot);
  const dirty = snapshot !== initialSnapshot.current;
  // Depois de salvar, a navegação para o detalhe não deve pedir confirmação.
  const saved = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  );

  // Recarregar ou fechar a aba: o navegador mostra o próprio aviso.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function chooseCustomer(id: string, list: Customer[] = customers) {
    setCustomerId(id);
    // Sugere o vendedor responsável pelo cliente se nenhum foi escolhido.
    const owner = sellers.find((s) => s.name === list.find((c) => c.id === id)?.seller);
    if (!sellerId && owner) setSellerId(owner.id);
  }

  async function saveNewCustomer(draft: CustomerDraft) {
    setSavingCustomer(true);
    setCustomerError('');
    try {
      const customer = await saveCustomer({ id: newId('c'), quotes: 0, lastQuoteAt: null, ...draft });
      setCreated((prev) => [customer, ...prev]);
      setNewCustomerName(null);
      chooseCustomer(customer.id, [customer]);
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : 'Não foi possível salvar o cliente.');
    } finally {
      setSavingCustomer(false);
    }
  }

  /** Troca entre % e R$ mantendo o mesmo valor descontado. */
  function switchDiscountType(type: DiscountType) {
    if (type === discountType) return;
    setDiscountType(type);
    if (!discount) return;
    const converted =
      type === 'amount'
        ? totals.discount
        : totals.subtotal > 0
          ? Math.round((totals.discount / totals.subtotal) * 10_000) / 100
          : 0;
    setDiscountValue(String(converted));
  }

  /**
   * Condição que promete desconto preenche o percentual; ao trocar para outra,
   * o desconto sugerido sai. Um desconto digitado à mão não é tocado.
   */
  function choosePayment(terms: string) {
    const previous = termDiscount(paymentTerms);
    const next = termDiscount(terms);
    const suggested = previous !== null && discountType === 'percent' && discountNumber === previous;
    setPaymentTerms(terms);
    if (next !== null && (discountValue.trim() === '' || suggested)) {
      setDiscountType('percent');
      setDiscountValue(String(next));
    } else if (next === null && suggested) {
      setDiscountValue('');
    }
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseProduct(key: number, code: string) {
    const product = catalog.find((p) => p.code === code);
    updateLine(key, { code, unitPrice: product ? String(product.unitPrice) : '' });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(nextKey.current++)]);
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  /** `allowOverLimit` vem da confirmação de desconto acima do limite das configurações. */
  async function submit(event?: FormEvent, allowOverLimit = false) {
    event?.preventDefault();
    setConfirmingDiscount(false);
    const found: Errors = {};
    if (!customer) found.customer = 'Escolha o cliente.';
    if (!seller) found.seller = 'Escolha o vendedor.';
    if (!validUntil) found.validUntil = 'Informe a validade.';
    else if (validUntil < today) found.validUntil = 'A validade não pode ser anterior a hoje.';
    if (discountValue.trim() !== '') {
      if (!Number.isFinite(discountNumber) || discountNumber < 0) found.discount = 'Desconto inválido.';
      else if (discountType === 'percent' && discountNumber > 100) found.discount = 'O desconto vai até 100%.';
      else if (discountType === 'amount' && discountNumber > totals.subtotal) {
        found.discount = 'O desconto não pode passar do subtotal.';
      }
    }
    const lineErrors: Record<number, LineErrors> = {};
    for (const line of lines) {
      const lineError = validateLine(line);
      if (Object.keys(lineError).length > 0) lineErrors[line.key] = lineError;
    }
    if (Object.keys(lineErrors).length > 0) found.lines = lineErrors;
    setErrors(found);
    if (Object.keys(found).length > 0 || !customerContact || !sellerContact) return;
    if (overLimit && !allowOverLimit) {
      setConfirmingDiscount(true);
      return;
    }

    const draft = {
      customerInfo: customerContact,
      sellerInfo: sellerContact,
      items: lines.map((line) => ({
        code: line.code,
        description:
          catalog.find((p) => p.code === line.code)?.description ??
          base?.items.find((item) => item.code === line.code)?.description ??
          line.code,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
      validUntil,
      paymentTerms,
      discount,
      notes: notes.trim(),
    };

    setBusy(true);
    setSaveError('');
    try {
      const quote =
        mode === 'edit' && base
          ? await updateQuote(base.id, draft)
          : await createQuote(draft, base ? `Criado a partir do orçamento ${base.number}` : undefined);
      saved.current = true;
      navigate(`/orcamentos/${quote.id}`);
    } catch (error) {
      // Recusas da API (validação, orçamento que deixou de ser pendente) trazem o motivo.
      if (!(error instanceof ApiError)) console.error('Falha ao salvar o orçamento', error);
      setSaveError(error instanceof ApiError ? error.message : 'Não foi possível salvar o orçamento. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        backTo={backTo}
        backLabel={base ? `Orçamento ${base.number}` : 'Orçamentos'}
        title={text.title}
        sub={text.sub}
      >
        <Link to={backTo} className="btn btn-secondary">
          Cancelar
        </Link>
        <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={busy}>
          <Icon name="save" size={16} />
          {busy ? 'Salvando…' : text.submit}
        </button>
      </PageHead>

      {saveError && (
        <div className={detailStyles.alert} role="alert">
          <span>{saveError}</span>
        </div>
      )}

      <form id={FORM_ID} className={detailStyles.layout} onSubmit={submit} noValidate>
        <div className={detailStyles.mainCol}>
          <section className={`card ${detailStyles.itemsCard}`} aria-labelledby="itens-titulo">
            <div className={detailStyles.cardHead}>
              <h2 id="itens-titulo" className={detailStyles.cardTitle}>
                Itens
              </h2>
              <span className={detailStyles.muted}>
                {units} {units === 1 ? 'unidade' : 'unidades'}
              </span>
            </div>

            <div className={`${styles.line} ${styles.lineHead}`} aria-hidden="true">
              <span>Produto</span>
              <span className={styles.num}>Qtd.</span>
              <span className={styles.num}>Valor unit.</span>
              <span className={styles.num}>Total</span>
              <span />
            </div>
            <ul className={styles.lines}>
              {lines.map((line, index) => {
                const lineError = errors.lines?.[line.key];
                const taken = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.code));
                return (
                  <li key={line.key} className={styles.line}>
                    {/* div, não label: um label em volta repassaria ao campo os cliques na lista. */}
                    <div className={formStyles.field}>
                      <label htmlFor={`produto-${line.key}`} className={styles.cellLabel}>
                        Produto
                      </label>
                      <Combobox
                        id={`produto-${line.key}`}
                        options={productOptions.filter((p) => !taken.has(p.id))}
                        value={line.code}
                        onChange={(code) => chooseProduct(line.key, code)}
                        placeholder="Código ou nome do produto"
                        invalid={Boolean(lineError?.code)}
                      />
                      {lineError?.code && <p className={formStyles.error}>{lineError.code}</p>}
                    </div>
                    <label className={formStyles.field}>
                      <span className={styles.cellLabel}>Qtd.</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className={`${formStyles.input} ${styles.numInput}`}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        aria-invalid={Boolean(lineError?.quantity)}
                      />
                      {lineError?.quantity && <p className={formStyles.error}>{lineError.quantity}</p>}
                    </label>
                    <label className={formStyles.field}>
                      <span className={styles.cellLabel}>Valor unit. (R$)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        className={`${formStyles.input} ${styles.numInput}`}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        aria-invalid={Boolean(lineError?.unitPrice)}
                      />
                      {lineError?.unitPrice && <p className={formStyles.error}>{lineError.unitPrice}</p>}
                    </label>
                    <div className={styles.lineTotal}>
                      <span className={styles.cellLabel}>Total</span>
                      <span className={styles.num}>{formatBRL(lineTotal(line))}</span>
                    </div>
                    <button
                      type="button"
                      className={`icon-btn icon-btn--sm ${styles.remove}`}
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={styles.addRow}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addLine}
                disabled={lines.length >= catalog.length}
              >
                <Icon name="plus" size={16} />
                Adicionar item
              </button>
            </div>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span className={styles.num}>{formatBRL(totals.subtotal)}</span>
              </div>
              <div className={styles.summaryRow}>
                <label htmlFor="desconto">Desconto</label>
                <div className={styles.discount}>
                  <div role="group" aria-label="Tipo de desconto" className={styles.toggle}>
                    <button
                      type="button"
                      aria-pressed={discountType === 'percent'}
                      className={styles.toggleBtn}
                      onClick={() => switchDiscountType('percent')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      aria-pressed={discountType === 'amount'}
                      className={styles.toggleBtn}
                      onClick={() => switchDiscountType('amount')}
                    >
                      R$
                    </button>
                  </div>
                  <input
                    id="desconto"
                    type="number"
                    min={0}
                    max={discountType === 'percent' ? 100 : undefined}
                    step={discountType === 'percent' ? 0.5 : 0.01}
                    inputMode="decimal"
                    placeholder="0"
                    className={`${formStyles.input} ${styles.numInput} ${styles.discountInput}`}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    aria-invalid={Boolean(errors.discount)}
                  />
                  <span className={`${styles.num} ${styles.discountOff}`}>
                    {totals.discount > 0 ? `− ${formatBRL(totals.discount)}` : formatBRL(0)}
                  </span>
                </div>
              </div>
              {errors.discount ? (
                <p className={`${formStyles.error} ${styles.summaryError}`}>{errors.discount}</p>
              ) : (
                overLimit && (
                  <p className={styles.summaryWarn}>
                    Desconto de {discountPercent.toLocaleString('pt-BR')}%, acima do limite de{' '}
                    {maxDiscount?.toLocaleString('pt-BR')}% definido nas configurações.
                  </p>
                )
              )}
            </div>
            <div className={detailStyles.total}>
              <span>Total do orçamento</span>
              <strong>{formatBRL(totals.total)}</strong>
            </div>
          </section>

          <section className={`card ${detailStyles.side}`} aria-labelledby="condicoes-titulo">
            <h2 id="condicoes-titulo" className={detailStyles.sideTitle}>
              Condições
            </h2>
            <div className={formStyles.grid}>
              <div className={formStyles.field}>
                <label htmlFor="validade" className={formStyles.label}>
                  Validade *
                </label>
                <DatePicker
                  id="validade"
                  value={validUntil}
                  min={today}
                  onChange={setValidUntil}
                  aria-invalid={Boolean(errors.validUntil)}
                />
                {errors.validUntil && <p className={formStyles.error}>{errors.validUntil}</p>}
              </div>
              <div className={formStyles.field}>
                <label htmlFor="pagamento" className={formStyles.label}>
                  Pagamento
                </label>
                <Select
                  id="pagamento"
                  value={paymentTerms}
                  options={paymentOptions.map((terms) => ({ value: terms, label: terms }))}
                  onChange={choosePayment}
                />
              </div>
              <label className={`${formStyles.field} ${formStyles.full}`}>
                <span className={formStyles.label}>Observações</span>
                <textarea
                  className={`${formStyles.input} ${styles.textarea}`}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>

        <div className={`${detailStyles.sideCol} ${styles.pickers}`}>
          <PickerCard
            id="cliente"
            title="Cliente"
            placeholder="Digite ou escolha o cliente"
            value={customerId}
            options={customerOptions}
            contact={customerContact}
            error={errors.customer}
            onChange={(id) => chooseCustomer(id)}
            onCreate={setNewCustomerName}
          />
          <PickerCard
            id="vendedor"
            title="Vendedor"
            placeholder="Digite ou escolha o vendedor"
            value={sellerId}
            options={sellerOptions}
            contact={sellerContact}
            error={errors.seller}
            onChange={setSellerId}
          />
        </div>
      </form>

      <Modal open={newCustomerName !== null} title="Novo cliente" onClose={() => setNewCustomerName(null)}>
        {newCustomerName !== null && (
          <CustomerForm
            initial={{ name: newCustomerName, seller: seller?.name ?? '' }}
            sellers={sellers.map((s) => s.name)}
            busy={savingCustomer}
            error={customerError}
            onSubmit={saveNewCustomer}
            onCancel={() => {
              setCustomerError('');
              setNewCustomerName(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={confirmingDiscount}
        title="Desconto acima do limite"
        onClose={() => setConfirmingDiscount(false)}
        size="sm"
      >
        <p className={formStyles.text}>
          O desconto de <strong>{discountPercent.toLocaleString('pt-BR')}%</strong> ({formatBRL(totals.discount)}) passa
          do limite de {maxDiscount?.toLocaleString('pt-BR')}% definido nas configurações. Quer salvar mesmo assim?
        </p>
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDiscount(false)}>
            Revisar desconto
          </button>
          <button type="button" className="btn btn-primary" onClick={() => submit(undefined, true)} disabled={busy}>
            Salvar mesmo assim
          </button>
        </div>
      </Modal>

      <Modal open={blocker.state === 'blocked'} title="Descartar alterações?" onClose={() => blocker.reset?.()} size="sm">
        <p className={formStyles.text}>
          {mode === 'edit' ? 'As alterações neste orçamento ainda não foram salvas.' : 'Este orçamento ainda não foi salvo.'}{' '}
          Se sair agora, o que foi preenchido será perdido.
        </p>
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => blocker.reset?.()}>
            Continuar editando
          </button>
          <button type="button" className={`btn ${formStyles.dangerBtn}`} onClick={() => blocker.proceed?.()}>
            Descartar e sair
          </button>
        </div>
      </Modal>
    </>
  );
}

/** Carrega cadastros, catálogo e, ao editar ou duplicar, o orçamento-base. */
export function QuoteFormPage({ mode }: { mode: QuoteFormMode }) {
  const { id = '' } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const customersState = useList(listCustomers, 'Não foi possível carregar os clientes.', reloadKey);
  const sellersState = useList(listSellers, 'Não foi possível carregar os vendedores.', reloadKey);
  const productsState = useList(listProducts, 'Não foi possível carregar os produtos.', reloadKey);
  const baseState = useQuote(mode === 'new' ? null : id, reloadKey);
  const settingsState = useSettings(reloadKey);

  const activeSellers = useMemo(
    () => (sellersState.data ?? []).filter((s) => s.status === 'Ativo'),
    [sellersState.data],
  );

  const base = baseState.data;
  const catalog = useMemo(
    () => (productsState.data ? catalogFor(productsState.data, base) : null),
    [productsState.data, base],
  );
  const text = headText(mode, base?.number ?? `#${id}`);
  const backTo = mode === 'new' ? '/orcamentos' : `/orcamentos/${id}`;
  const backLabel = mode === 'new' ? 'Orçamentos' : `Orçamento #${id}`;

  if (baseState.status === 'not-found') {
    return (
      <section className={`card ${detailStyles.message}`}>
        <h1 className={detailStyles.messageTitle}>Orçamento não encontrado</h1>
        <p className={detailStyles.muted}>O orçamento #{id} não existe ou foi removido.</p>
        <Link to="/orcamentos" className="btn btn-secondary">
          <Icon name="chevLeft" size={16} />
          Voltar para orçamentos
        </Link>
      </section>
    );
  }

  if (mode === 'edit' && base && base.status !== 'Pendente') {
    return (
      <section className={`card ${detailStyles.message}`}>
        <h1 className={detailStyles.messageTitle}>Este orçamento não pode ser editado</h1>
        <p className={detailStyles.muted}>
          O orçamento {base.number} está {base.status.toLowerCase()}. Só pendentes podem ser editados; para mudar
          itens ou condições, crie uma cópia.
        </p>
        <div className={detailStyles.actions}>
          <Link to={backTo} className="btn btn-secondary">
            <Icon name="chevLeft" size={16} />
            Voltar ao orçamento
          </Link>
          <Link to={`/orcamentos/${base.id}/duplicar`} className="btn btn-primary">
            <Icon name="copy" size={16} />
            Duplicar
          </Link>
        </div>
      </section>
    );
  }

  const loadError = [customersState, sellersState, productsState, baseState, settingsState].find(
    (s) => s.status === 'error',
  );
  const customers = customersState.data;

  const settings = settingsState.data;

  if (customers && sellersState.data && catalog && settings && (mode === 'new' || baseState.status === 'success')) {
    return (
      <QuoteForm
        key={`${mode}-${id}`}
        mode={mode}
        base={base}
        customers={customers}
        sellers={activeSellers}
        catalog={catalog}
        defaults={settings.quotes}
      />
    );
  }

  return (
    <>
      <PageHead backTo={backTo} backLabel={backLabel} title={text.title} sub={text.sub} />
      {loadError?.status === 'error' ? (
        <div className={detailStyles.alert} role="alert">
          <span>{loadError.message}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className={`card ${detailStyles.skeleton}`} aria-busy="true">
          <span className="sr-only">Carregando formulário…</span>
        </div>
      )}
    </>
  );
}
