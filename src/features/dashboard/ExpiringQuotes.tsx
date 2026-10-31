import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ExpiryBadge } from '@/features/quotes/ExpiryBadge';
import { formatBRL, formatDate } from '@/lib/format';
import type { ExpirySummary } from '@/types/dashboard';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import styles from './ExpiringQuotes.module.css';

const MAX_ROWS = 6;

function daysText(days: number): string {
  if (days === 0) return 'hoje';
  return days === 1 ? 'até amanhã' : `nos próximos ${days} dias`;
}

/** Orçamentos em aberto para cobrar o cliente antes que vençam. Some quando não há nada. */
export function ExpiringQuotes({ expiry }: { expiry: ExpirySummary }) {
  const { alertDays, expiring, expired } = expiry;
  if (expiring.length === 0 && expired === 0) return null;
  const rows = expiring.slice(0, MAX_ROWS);

  return (
    <section className={`card ${styles.card}`} aria-labelledby="vencendo-titulo">
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="clock" size={18} />
        </span>
        <div className={styles.titles}>
          <h2 id="vencendo-titulo" className={styles.title}>
            {expiring.length === 0
              ? 'Nenhum orçamento vencendo'
              : `${expiring.length} ${expiring.length === 1 ? 'orçamento vence' : 'orçamentos vencem'} ${daysText(alertDays)}`}
          </h2>
          <p className={styles.subtitle}>Pendentes e enviados: vale cobrar uma resposta do cliente.</p>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((quote) => (
            <li key={quote.id}>
              <Link to={`/orcamentos/${quote.id}`} className={styles.row}>
                <span className={styles.number}>{quote.number}</span>
                <span className={styles.who}>
                  <span className={styles.customer}>{quote.customer}</span>
                  <span className={styles.muted}>
                    {quote.seller} · válido até {formatDate(quote.validUntil)}
                  </span>
                </span>
                <span className={styles.badges}>
                  <QuoteStatusBadge status={quote.status} />
                  <ExpiryBadge quote={quote} alertDays={alertDays} compact />
                </span>
                <span className={styles.amount}>{formatBRL(quote.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(expiring.length > rows.length || expired > 0) && (
        <p className={styles.foot}>
          {expiring.length > rows.length && `E mais ${expiring.length - rows.length} vencendo. `}
          {expired > 0 &&
            `${expired} ${expired === 1 ? 'orçamento já venceu' : 'orçamentos já venceram'} sem resposta; vale cancelar ou renovar.`}
        </p>
      )}
    </section>
  );
}
