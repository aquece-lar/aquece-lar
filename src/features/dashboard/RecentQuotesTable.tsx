import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import type { RecentQuote } from '@/types/dashboard';
import { formatBRL, formatDateTime } from '@/lib/format';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import styles from './RecentQuotesTable.module.css';

interface RecentQuotesTableProps {
  quotes: RecentQuote[];
  title?: string;
  /** Link "ver todos" do cabeçalho; `null` esconde. */
  link?: { to: string; label: string } | null;
  /** Coluna repetida na tela (ex.: o cliente, na ficha do cliente). */
  hide?: 'customer' | 'seller';
  empty?: string;
}

const TITLE_ID = 'ultimos-orcamentos-titulo';

export function RecentQuotesTable({
  quotes,
  title = 'Últimos 10 orçamentos',
  link = { to: '/orcamentos', label: 'Ver todos os orçamentos' },
  hide,
  empty = 'Nenhum orçamento recente.',
}: RecentQuotesTableProps) {
  const showCustomer = hide !== 'customer';
  const showSeller = hide !== 'seller';
  return (
    <section className={`card ${styles.card}`} aria-labelledby={TITLE_ID}>
      <div className={styles.head}>
        <h2 id={TITLE_ID} className={styles.title}>
          {title}
        </h2>
        {link && (
          <Link to={link.to} className="link-strong">
            {link.label}
            <Icon name="chevRight" size={14} />
          </Link>
        )}
      </div>

      {quotes.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nº</th>
                  {showCustomer && <th scope="col">Cliente</th>}
                  {showSeller && <th scope="col">Vendedor</th>}
                  <th scope="col" className={styles.num}>
                    Valor
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Data</th>
                  <th scope="col" className={styles.actionsHead}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className={styles.row}>
                    <td className={styles.number}>{quote.number}</td>
                    {showCustomer && <td>{quote.customer}</td>}
                    {showSeller && <td className={styles.muted}>{quote.seller}</td>}
                    <td className={styles.num}>{formatBRL(quote.amount)}</td>
                    <td>
                      <QuoteStatusBadge status={quote.status} />
                    </td>
                    <td className={styles.date}>{formatDateTime(quote.createdAt)}</td>
                    <td>
                      <div className={styles.actions}>
                        <Link
                          to={`/orcamentos/${quote.id}`}
                          className="icon-btn icon-btn--sm"
                          aria-label={`Abrir orçamento ${quote.number}`}
                        >
                          <Icon name="eye" size={17} />
                        </Link>
                        <Link
                          to={`/orcamentos/${quote.id}/pdf`}
                          className="icon-btn icon-btn--sm"
                          aria-label={`Baixar PDF ${quote.number}`}
                        >
                          <Icon name="download" size={17} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cards}>
            {quotes.map((quote) => (
              <li key={quote.id} className={styles.quoteCard}>
                <div className={styles.cardTop}>
                  <span className={styles.number}>{quote.number}</span>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                {showCustomer && <p className={styles.cardCustomer}>{quote.customer}</p>}
                <p className={styles.cardMeta}>
                  {showSeller && `${quote.seller} · `}
                  {formatDateTime(quote.createdAt)}
                </p>
                <div className={styles.cardFoot}>
                  <span className={styles.cardAmount}>{formatBRL(quote.amount)}</span>
                  <div className={styles.actions}>
                    <Link
                      to={`/orcamentos/${quote.id}`}
                      className="icon-btn icon-btn--sm"
                      aria-label={`Abrir orçamento ${quote.number}`}
                    >
                      <Icon name="eye" size={17} />
                    </Link>
                    <Link
                      to={`/orcamentos/${quote.id}/pdf`}
                      className="icon-btn icon-btn--sm"
                      aria-label={`Baixar PDF ${quote.number}`}
                    >
                      <Icon name="download" size={17} />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
