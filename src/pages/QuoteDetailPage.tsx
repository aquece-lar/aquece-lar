import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { QuoteStatusBadge } from '@/features/dashboard/QuoteStatusBadge';
import { Modal } from '@/features/people/Modal';
import { useQuote } from '@/features/quotes/useQuote';
import { ExpiryBadge } from '@/features/quotes/ExpiryBadge';
import { useSettings } from '@/features/settings/useSettings';
import { formatBRL, formatDate, formatDateTime, initials } from '@/lib/format';
import { quoteTotals } from '@/lib/quoteTotals';
import { updateQuoteStatus } from '@/services/quotesService';
import type { QuoteStatus } from '@/types/dashboard';
import type { QuoteContact } from '@/types/quotes';
import type { CompanyInfo } from '@/types/settings';
import formStyles from '@/features/people/Form.module.css';
import styles from './QuoteDetailPage.module.css';

interface StatusAction {
  to: QuoteStatus;
  label: string;
  icon: 'check' | 'upload' | 'x' | 'undo';
  primary?: boolean;
  confirm?: boolean;
}

/** Próximos passos possíveis a partir de cada status. */
const ACTIONS: Record<QuoteStatus, StatusAction[]> = {
  Pendente: [
    { to: 'Cancelado', label: 'Cancelar', icon: 'x', confirm: true },
    { to: 'Enviado', label: 'Marcar como enviado', icon: 'upload', primary: true },
  ],
  Enviado: [
    { to: 'Cancelado', label: 'Cancelar', icon: 'x', confirm: true },
    { to: 'Aprovado', label: 'Aprovar', icon: 'check', primary: true },
  ],
  Aprovado: [],
  Cancelado: [{ to: 'Pendente', label: 'Reabrir', icon: 'undo' }],
};

const DOT_CLASS: Record<QuoteStatus, string> = {
  Pendente: styles.dotWarn ?? '',
  Enviado: styles.dotInfo ?? '',
  Aprovado: styles.dotOk ?? '',
  Cancelado: styles.dotErr ?? '',
};

function ContactCard({ title, contact }: { title: string; contact: QuoteContact }) {
  return (
    <section className={`card ${styles.side}`}>
      <h2 className={styles.sideTitle}>{title}</h2>
      <div className={styles.contact}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(contact.name)}
        </span>
        <div className={styles.contactText}>
          <span className={styles.contactName}>{contact.name}</span>
          {contact.detail && <span className={styles.muted}>{contact.detail}</span>}
        </div>
      </div>
      <dl className={styles.facts}>
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
    </section>
  );
}

/** Cabeçalho só da folha impressa: logo e dados da empresa preenchidos nas configurações. */
function CompanyHeader({ company }: { company: CompanyInfo }) {
  const contacts = [company.phone, company.email].filter(Boolean).join(' · ');
  return (
    <header className={styles.companyHeader} data-print-only>
      {company.logo && <img src={company.logo} alt="" className={styles.companyLogo} />}
      <div className={styles.companyText}>
        <strong className={styles.companyName}>{company.name}</strong>
        {company.document && <span>CNPJ {company.document}</span>}
        {contacts && <span>{contacts}</span>}
        {company.address && <span>{company.address}</span>}
      </div>
    </header>
  );
}

export function QuoteDetailPage({ autoPrint = false }: { autoPrint?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const state = useQuote(id, reloadKey);
  const settings = useSettings();
  const [confirming, setConfirming] = useState<StatusAction | null>(null);
  const [busy, setBusy] = useState(false);
  const printed = useRef(false);

  const quote = state.data;
  // Sem as configurações (falha ao carregar), a folha sai sem o cabeçalho da empresa.
  const settingsDone = settings.status !== 'loading';

  // Rota /pdf: abre a impressão uma vez (com o cabeçalho pronto) e volta para a URL do detalhe.
  useEffect(() => {
    if (!autoPrint || !quote || !settingsDone || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => {
      window.print();
      navigate(`/orcamentos/${quote.id}`, { replace: true });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [autoPrint, quote, settingsDone, navigate]);

  async function changeStatus(action: StatusAction) {
    if (!quote) return;
    setBusy(true);
    try {
      await updateQuoteStatus(quote.id, action.to);
      setConfirming(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'not-found') {
    return (
      <section className={`card ${styles.message}`}>
        <h1 className={styles.messageTitle}>Orçamento não encontrado</h1>
        <p className={styles.muted}>O orçamento #{id} não existe ou foi removido.</p>
        <Link to="/orcamentos" className="btn btn-secondary">
          <Icon name="chevLeft" size={16} />
          Voltar para orçamentos
        </Link>
      </section>
    );
  }

  if (!quote) {
    return state.status === 'error' ? (
      <div className={styles.alert} role="alert">
        <span>{state.message}</span>
        <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
          Tentar novamente
        </button>
      </div>
    ) : (
      <div className={`card ${styles.skeleton}`} aria-busy="true">
        <span className="sr-only">Carregando orçamento…</span>
      </div>
    );
  }

  const itemCount = quote.items.reduce((sum, item) => sum + item.quantity, 0);
  const totals = quoteTotals(quote.items, quote.discount);

  return (
    <>
      {settings.data && <CompanyHeader company={settings.data.company} />}
      <Link to="/orcamentos" className={`link-strong ${styles.back}`} data-no-print>
        <Icon name="chevLeft" size={14} />
        Orçamentos
      </Link>

      <div className={styles.pageHead}>
        <div className={styles.titles}>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>Orçamento {quote.number}</h1>
            <QuoteStatusBadge status={quote.status} />
            {/* Aviso interno: não vai para o PDF do cliente. */}
            {settings.data && (
              <span data-no-print>
                <ExpiryBadge quote={quote} alertDays={settings.data.quotes.expiryAlertDays} />
              </span>
            )}
          </div>
          <p className={styles.sub}>
            Criado em {formatDateTime(quote.createdAt)} · válido até {formatDate(quote.validUntil)}
          </p>
        </div>
        <div className={styles.actions} data-no-print>
          {quote.status === 'Pendente' && (
            <Link to={`/orcamentos/${quote.id}/editar`} className="btn btn-secondary">
              <Icon name="edit" size={16} />
              Editar
            </Link>
          )}
          <Link to={`/orcamentos/${quote.id}/duplicar`} className="btn btn-secondary">
            <Icon name="copy" size={16} />
            Duplicar
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="download" size={16} />
            Baixar PDF
          </button>
          {ACTIONS[quote.status].map((action) => (
            <button
              key={action.to}
              type="button"
              className={`btn ${action.primary ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy}
              onClick={() => (action.confirm ? setConfirming(action) : changeStatus(action))}
            >
              <Icon name={action.icon} size={16} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <section className={`card ${styles.itemsCard}`} aria-labelledby="itens-titulo">
            <div className={styles.cardHead}>
              <h2 id="itens-titulo" className={styles.cardTitle}>
                Itens
              </h2>
              <span className={styles.muted}>
                {itemCount} {itemCount === 1 ? 'unidade' : 'unidades'}
              </span>
            </div>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Descrição</th>
                    <th scope="col" className={styles.num}>
                      Qtd.
                    </th>
                    <th scope="col" className={styles.num}>
                      Valor unit.
                    </th>
                    <th scope="col" className={styles.num}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.code}>
                      <td className={styles.code}>{item.code}</td>
                      <td>{item.description}</td>
                      <td className={styles.num}>{item.quantity}</td>
                      <td className={styles.num}>{formatBRL(item.unitPrice)}</td>
                      <td className={styles.num}>{formatBRL(item.unitPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={styles.itemCards}>
              {quote.items.map((item) => (
                <li key={item.code} className={styles.itemCard}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemDesc}>{item.description}</span>
                    <span className={styles.code}>
                      {item.code} · {item.quantity} × {formatBRL(item.unitPrice)}
                    </span>
                  </div>
                  <span className={styles.num}>{formatBRL(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            {quote.discount && (
              <dl className={styles.summary}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatBRL(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>
                    Desconto
                    {quote.discount.type === 'percent' && ` (${quote.discount.value.toLocaleString('pt-BR')}%)`}
                  </dt>
                  <dd>− {formatBRL(totals.discount)}</dd>
                </div>
              </dl>
            )}
            <div className={styles.total}>
              <span>Total do orçamento</span>
              <strong>{formatBRL(quote.amount)}</strong>
            </div>
          </section>

          <section className={`card ${styles.side}`} aria-labelledby="condicoes-titulo">
            <h2 id="condicoes-titulo" className={styles.sideTitle}>
              Condições
            </h2>
            <dl className={styles.facts}>
              <div>
                <dt>Pagamento</dt>
                <dd>{quote.paymentTerms}</dd>
              </div>
              <div>
                <dt>Validade</dt>
                <dd>{formatDate(quote.validUntil)}</dd>
              </div>
            </dl>
            <p className={styles.notes}>{quote.notes}</p>
          </section>
        </div>

        <div className={styles.sideCol}>
          <ContactCard title="Cliente" contact={quote.customerInfo} />
          <ContactCard title="Vendedor" contact={quote.sellerInfo} />

          <section className={`card ${styles.side}`} aria-labelledby="historico-titulo" data-no-print>
            <h2 id="historico-titulo" className={styles.sideTitle}>
              Histórico
            </h2>
            <ol className={styles.timeline}>
              {quote.history.map((event, index) => (
                <li key={`${event.at}-${index}`} className={styles.event}>
                  <span className={`${styles.dot} ${DOT_CLASS[event.status]}`} aria-hidden="true" />
                  <div className={styles.eventText}>
                    <span className={styles.eventNote}>{event.note}</span>
                    <span className={styles.muted}>{formatDateTime(event.at)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {settings.data?.company.footer && (
        <footer className={styles.companyFooter} data-print-only>
          {settings.data.company.footer}
        </footer>
      )}

      <Modal
        open={confirming !== null}
        title="Cancelar orçamento"
        onClose={() => setConfirming(null)}
        size="sm"
      >
        <p className={formStyles.text}>
          Tem certeza que deseja cancelar o orçamento <strong>{quote.number}</strong>? Ele poderá ser reaberto depois.
        </p>
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className={`btn ${formStyles.dangerBtn}`}
            onClick={() => confirming && changeStatus(confirming)}
            disabled={busy}
          >
            {busy ? 'Cancelando…' : 'Cancelar orçamento'}
          </button>
        </div>
      </Modal>
    </>
  );
}
