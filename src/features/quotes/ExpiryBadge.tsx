import { Icon } from '@/components/Icon';
import { expiryLabel, expiryShortLabel, quoteExpiry } from '@/lib/quoteExpiry';
import type { Quote } from '@/types/quotes';
import styles from './ExpiryBadge.module.css';

interface ExpiryBadgeProps {
  quote: Pick<Quote, 'status' | 'validUntil'>;
  /** Dias de antecedência do aviso, das configurações. */
  alertDays: number;
  /** Nas listas: só o relógio e "2 dias"; o texto inteiro fica no detalhe (e no leitor de tela). */
  compact?: boolean;
}

/** "Vence em 2 dias" / "Vencido há 5 dias" para orçamentos em aberto; nada nos demais. */
export function ExpiryBadge({ quote, alertDays, compact = false }: ExpiryBadgeProps) {
  const expiry = quoteExpiry(quote, alertDays);
  if (!expiry) return null;
  const label = expiryLabel(expiry);
  const kind = expiry.kind === 'expired' ? styles.expired : '';

  if (compact) {
    return (
      <span className={`${styles.badge} ${styles.compact} ${kind}`} title={label}>
        <Icon name="clock" size={12} />
        <span aria-hidden="true">{expiryShortLabel(expiry)}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span className={`${styles.badge} ${kind}`}>
      <Icon name="clock" size={12} />
      {label}
    </span>
  );
}
