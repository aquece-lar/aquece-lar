import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import { termDiscount } from '@/config/quotes';
import { useSettings } from '@/features/settings/useSettings';
import { ActivitySection } from '@/features/settings/ActivitySection';
import { UsersSection } from '@/features/settings/UsersSection';
import { resizeImage } from '@/lib/image';
import { InvalidSettingsError, MAX_ALERT_DAYS, MAX_VALID_DAYS, saveSettings } from '@/services/settingsService';
import type { CompanyInfo, Settings } from '@/types/settings';
import formStyles from '@/features/people/Form.module.css';
import listStyles from './ListPage.module.css';
import styles from './SettingsPage.module.css';

const LOGO_MAX_SIDE = 480;
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

interface Term {
  key: number;
  text: string;
}

/** Números ficam como texto enquanto são digitados; cada condição tem uma chave estável. */
interface FormState {
  company: CompanyInfo;
  validDays: string;
  /** Vazio é sem limite. */
  maxDiscount: string;
  alertDays: string;
  terms: Term[];
  notes: string;
}

interface Errors {
  name?: string;
  document?: string;
  email?: string;
  validDays?: string;
  maxDiscount?: string;
  alertDays?: string;
  terms?: string;
  term?: Record<number, string>;
}

function toForm(settings: Settings): FormState {
  return {
    company: { ...settings.company },
    validDays: String(settings.quotes.validDays),
    maxDiscount: settings.quotes.maxDiscountPercent === null ? '' : String(settings.quotes.maxDiscountPercent),
    alertDays: String(settings.quotes.expiryAlertDays),
    terms: settings.quotes.paymentTerms.map((text, key) => ({ key, text })),
    notes: settings.quotes.notes,
  };
}

function toSettings(form: FormState): Settings {
  const trim = (text: string) => text.trim();
  return {
    company: {
      name: trim(form.company.name),
      document: trim(form.company.document),
      phone: trim(form.company.phone),
      email: trim(form.company.email),
      address: trim(form.company.address),
      footer: trim(form.company.footer),
      logo: form.company.logo,
    },
    quotes: {
      validDays: Number(form.validDays),
      paymentTerms: form.terms.map((t) => t.text.trim()),
      notes: form.notes.trim(),
      maxDiscountPercent: form.maxDiscount.trim() === '' ? null : Number(form.maxDiscount),
      expiryAlertDays: Number(form.alertDays),
    },
  };
}

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.company.name.trim()) errors.name = 'Informe o nome da empresa.';
  const digits = form.company.document.replace(/\D/g, '');
  if (digits.length > 0 && digits.length !== 14) errors.document = 'O CNPJ deve ter 14 dígitos.';
  const email = form.company.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.';
  const days = Number(form.validDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_VALID_DAYS) {
    errors.validDays = `De 1 a ${MAX_VALID_DAYS} dias.`;
  }
  const limit = Number(form.maxDiscount);
  if (form.maxDiscount.trim() !== '' && (!Number.isFinite(limit) || limit < 0 || limit > 100)) {
    errors.maxDiscount = 'De 0 a 100%, ou vazio para sem limite.';
  }
  const alertDays = Number(form.alertDays);
  if (form.alertDays.trim() === '' || !Number.isInteger(alertDays) || alertDays < 0 || alertDays > MAX_ALERT_DAYS) {
    errors.alertDays = `De 0 a ${MAX_ALERT_DAYS} dias.`;
  }
  if (form.terms.length === 0) errors.terms = 'Informe ao menos uma condição de pagamento.';
  const seen = new Set<string>();
  const term: Record<number, string> = {};
  for (const t of form.terms) {
    const text = t.text.trim().toLowerCase();
    if (!text) term[t.key] = 'Escreva a condição ou remova a linha.';
    else if (seen.has(text)) term[t.key] = 'Condição repetida.';
    seen.add(text);
  }
  if (Object.keys(term).length > 0) errors.term = term;
  return errors;
}

function LogoField({ value, onChange }: { value: string | null; onChange: (logo: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Escolha uma imagem.');
    if (file.size > LOGO_MAX_BYTES) return setMessage('A imagem deve ter até 5 MB.');
    setMessage('');
    setLoading(true);
    try {
      onChange(await resizeImage(file, LOGO_MAX_SIDE, 'image/png'));
    } catch {
      setMessage('Não foi possível ler a imagem.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.logoField}>
      <div className={styles.logoBox}>
        {value ? (
          <img src={value} alt="Logo da empresa" className={styles.logoImg} />
        ) : (
          <Icon name="image" size={22} />
        )}
      </div>
      <div className={styles.logoSide}>
        <div className={styles.logoActions}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" size={16} />
            {loading ? 'Carregando…' : value ? 'Trocar logo' : 'Enviar logo'}
          </button>
          {value && (
            <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
              <Icon name="trash" size={16} />
              Remover
            </button>
          )}
        </div>
        <span className={styles.hint}>Aparece no PDF do orçamento. PNG com fundo transparente fica melhor.</span>
        {message && (
          <p className={formStyles.error} role="alert">
            {message}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden aria-label="Selecionar logo" onChange={onPick} />
    </div>
  );
}

/** `onSaved`: avisa a página para atualizar o histórico. */
function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const nextKey = useRef(form.terms.length);

  const dirty = JSON.stringify(toSettings(form)) !== JSON.stringify(saved);
  const limit = toSettings(form).quotes.maxDiscountPercent;

  function change(update: (prev: FormState) => FormState) {
    setForm(update);
    setNotice(null);
  }

  function setCompany<K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) {
    change((prev) => ({ ...prev, company: { ...prev.company, [key]: value } }));
  }

  function setTerm(key: number, text: string) {
    change((prev) => ({ ...prev, terms: prev.terms.map((t) => (t.key === key ? { ...t, text } : t)) }));
  }

  function addTerm() {
    const key = nextKey.current++;
    change((prev) => ({ ...prev, terms: [...prev.terms, { key, text: '' }] }));
    // Foca a linha nova depois que ela aparece.
    requestAnimationFrame(() => document.getElementById(`condicao-${key}`)?.focus());
  }

  function removeTerm(key: number) {
    change((prev) => ({ ...prev, terms: prev.terms.filter((t) => t.key !== key) }));
  }

  function makeDefault(key: number) {
    change((prev) => {
      const chosen = prev.terms.find((t) => t.key === key);
      return chosen ? { ...prev, terms: [chosen, ...prev.terms.filter((t) => t.key !== key)] } : prev;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ kind: 'error', text: 'Revise os campos destacados.' });
      return;
    }
    setBusy(true);
    try {
      const result = await saveSettings(toSettings(form));
      setSaved(result);
      setForm(toForm(result));
      nextKey.current = result.quotes.paymentTerms.length;
      setNotice({ kind: 'ok', text: 'Configurações salvas.' });
      onSaved();
    } catch (error) {
      const text = error instanceof InvalidSettingsError ? error.message : 'Não foi possível salvar. Tente novamente.';
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    setForm(toForm(saved));
    setErrors({});
    setNotice(null);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <section className={`card ${styles.section}`} aria-labelledby="empresa-titulo">
        <div className={styles.sectionHead}>
          <h2 id="empresa-titulo" className={styles.sectionTitle}>
            Empresa
          </h2>
          <p className={styles.hint}>Cabeçalho do PDF que o cliente recebe. Campos vazios não aparecem.</p>
        </div>
        <div className={formStyles.grid}>
          <div className={`${formStyles.field} ${formStyles.full}`}>
            <span className={formStyles.label}>Logo</span>
            <LogoField value={form.company.logo} onChange={(logo) => setCompany('logo', logo)} />
          </div>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Nome *</span>
            <input
              className={formStyles.input}
              value={form.company.name}
              onChange={(e) => setCompany('name', e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className={formStyles.error}>{errors.name}</p>}
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>CNPJ</span>
            <input
              className={formStyles.input}
              value={form.company.document}
              onChange={(e) => setCompany('document', e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              aria-invalid={Boolean(errors.document)}
            />
            {errors.document && <p className={formStyles.error}>{errors.document}</p>}
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Telefone</span>
            <input
              type="tel"
              className={formStyles.input}
              value={form.company.phone}
              onChange={(e) => setCompany('phone', e.target.value)}
              placeholder="(51) 99999-9999"
            />
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>E-mail</span>
            <input
              type="email"
              className={formStyles.input}
              value={form.company.email}
              onChange={(e) => setCompany('email', e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className={formStyles.error}>{errors.email}</p>}
          </label>
          <label className={`${formStyles.field} ${formStyles.full}`}>
            <span className={formStyles.label}>Endereço</span>
            <input
              className={formStyles.input}
              value={form.company.address}
              onChange={(e) => setCompany('address', e.target.value)}
              placeholder="Rua, número, bairro, cidade/UF"
            />
          </label>
          <label className={`${formStyles.field} ${formStyles.full}`}>
            <span className={formStyles.label}>Rodapé do PDF</span>
            <textarea
              className={`${formStyles.input} ${styles.textarea}`}
              rows={4}
              value={form.company.footer}
              onChange={(e) => setCompany('footer', e.target.value)}
              placeholder={'PIX: CNPJ 00.000.000/0000-00\nBanco 000 · Agência 0000 · Conta 00000-0\nGarantia de 12 meses nos equipamentos.'}
            />
            <span className={styles.hint}>Sai no fim de todo orçamento impresso. As quebras de linha são mantidas.</span>
          </label>
        </div>
      </section>

      <section className={`card ${styles.section}`} aria-labelledby="orcamentos-titulo">
        <div className={styles.sectionHead}>
          <h2 id="orcamentos-titulo" className={styles.sectionTitle}>
            Orçamentos novos
          </h2>
          <p className={styles.hint}>Valores com que um orçamento começa; dá para mudar em cada um.</p>
        </div>
        <div className={formStyles.grid}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Validade (dias) *</span>
            <input
              type="number"
              min={1}
              max={MAX_VALID_DAYS}
              step={1}
              inputMode="numeric"
              className={formStyles.input}
              value={form.validDays}
              onChange={(e) => change((prev) => ({ ...prev, validDays: e.target.value }))}
              aria-invalid={Boolean(errors.validDays)}
            />
            {errors.validDays && <p className={formStyles.error}>{errors.validDays}</p>}
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Desconto máximo (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              inputMode="decimal"
              className={formStyles.input}
              value={form.maxDiscount}
              onChange={(e) => change((prev) => ({ ...prev, maxDiscount: e.target.value }))}
              placeholder="Sem limite"
              aria-invalid={Boolean(errors.maxDiscount)}
            />
            {errors.maxDiscount ? (
              <p className={formStyles.error}>{errors.maxDiscount}</p>
            ) : (
              <span className={styles.hint}>Acima disso, o orçamento pede confirmação antes de salvar.</span>
            )}
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Aviso de vencimento (dias antes) *</span>
            <input
              type="number"
              min={0}
              max={MAX_ALERT_DAYS}
              step={1}
              inputMode="numeric"
              className={formStyles.input}
              value={form.alertDays}
              onChange={(e) => change((prev) => ({ ...prev, alertDays: e.target.value }))}
              aria-invalid={Boolean(errors.alertDays)}
            />
            {errors.alertDays ? (
              <p className={formStyles.error}>{errors.alertDays}</p>
            ) : (
              <span className={styles.hint}>Pendentes e enviados aparecem como “vencendo” no dashboard e na lista.</span>
            )}
          </label>

          <fieldset className={`${formStyles.field} ${formStyles.full} ${styles.fieldset}`}>
            <legend className={formStyles.label}>Condições de pagamento *</legend>
            <p className={styles.hint}>
              A primeira é a padrão. Escreva “5% de desconto” no texto para o orçamento já sugerir o desconto.
            </p>
            <ol className={styles.terms}>
              {form.terms.map((term, index) => {
                const percent = termDiscount(term.text);
                const error = errors.term?.[term.key];
                return (
                  <li key={term.key} className={styles.term}>
                    <div className={styles.termRow}>
                      <input
                        id={`condicao-${term.key}`}
                        className={`${formStyles.input} ${styles.termInput}`}
                        value={term.text}
                        onChange={(e) => setTerm(term.key, e.target.value)}
                        aria-label={`Condição ${index + 1}`}
                        aria-invalid={Boolean(error)}
                      />
                      {index === 0 ? (
                        <span className={styles.defaultBadge}>Padrão</span>
                      ) : (
                        <button type="button" className={styles.linkBtn} onClick={() => makeDefault(term.key)}>
                          Tornar padrão
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        aria-label={`Remover condição ${index + 1}`}
                        onClick={() => removeTerm(term.key)}
                        disabled={form.terms.length === 1}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    {error ? (
                      <p className={formStyles.error}>{error}</p>
                    ) : (
                      percent !== null && (
                        <span className={`${styles.hint} ${limit !== null && percent > limit ? styles.warn : ''}`}>
                          Sugere {percent.toLocaleString('pt-BR')}% de desconto no orçamento
                          {limit !== null && percent > limit
                            ? `, acima do limite de ${limit.toLocaleString('pt-BR')}%.`
                            : '.'}
                        </span>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
            {errors.terms && <p className={formStyles.error}>{errors.terms}</p>}
            <div>
              <button type="button" className="btn btn-secondary" onClick={addTerm}>
                <Icon name="plus" size={16} />
                Adicionar condição
              </button>
            </div>
          </fieldset>

          <label className={`${formStyles.field} ${formStyles.full}`}>
            <span className={formStyles.label}>Observações padrão</span>
            <textarea
              className={`${formStyles.input} ${styles.textarea}`}
              rows={3}
              value={form.notes}
              onChange={(e) => change((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <div className={styles.footer}>
        <p
          className={`${styles.notice} ${notice?.kind === 'error' ? styles.noticeError : ''}`}
          role={notice?.kind === 'error' ? 'alert' : 'status'}
        >
          {notice?.text ?? (dirty ? 'Há alterações não salvas.' : '')}
        </p>
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={discard} disabled={busy || !dirty}>
            Descartar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
            <Icon name="save" size={16} />
            {busy ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const state = useSettings(reloadKey);
  // Cada gravação aparece no histórico logo abaixo, sem precisar atualizar.
  const [activityKey, setActivityKey] = useState(0);
  const changed = useCallback(() => setActivityKey((k) => k + 1), []);

  return (
    <>
      <div className={listStyles.pageHead}>
        <div className={listStyles.titles}>
          <h1 className={listStyles.h1}>Configurações</h1>
          <p className={listStyles.sub}>Dados da empresa, valores padrão dos orçamentos, usuários e histórico de alterações.</p>
        </div>
      </div>

      {state.status === 'error' && (
        <div className={listStyles.alert} role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'success' ? (
        <>
          <SettingsForm initial={state.data} onSaved={changed} />
          <UsersSection onChanged={changed} />
          <ActivitySection reloadKey={activityKey} />
        </>
      ) : (
        state.status === 'loading' && (
          <div className={`card ${listStyles.skeleton}`} aria-busy="true">
            <span className="sr-only">Carregando configurações…</span>
          </div>
        )
      )}
    </>
  );
}
