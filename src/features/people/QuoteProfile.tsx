import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { RecentQuotesTable } from '@/features/dashboard/RecentQuotesTable';
import { formatBRLRounded, formatDate, formatDateTime, initials, parseISODate, toISODate } from '@/lib/format';
import { quoteStats } from '@/lib/quoteStats';
import { ApiError } from '@/services/http';
import type { QuoteHistory } from '@/types/people';
import styles from './QuoteProfile.module.css';

type State =
  | { status: 'loading' }
  | { status: 'success'; data: QuoteHistory }
  | { status: 'missing' }
  | { status: 'error' };

interface QuoteProfileProps {
  back: { to: string; label: string };
  /** `null` enquanto o cadastro carrega. */
  name: string | null;
  /** Linha de baixo do nome: documento, telefone, cidade… (vazios somem). */
  details: string[];
  badge?: ReactNode;
  /** O cadastro não existe (ou é de outro vendedor). */
  missing: boolean;
  missingText: string;
  load: (signal: AbortSignal) => Promise<QuoteHistory>;
  /** A coluna que repete o próprio cadastro na tabela. */
  hide: 'customer' | 'seller';
}

/** "hoje", "ontem", "há 5 dias", pela data do calendário. */
function daysAgo(iso: string, today = new Date()): string {
  const days = Math.round(
    (parseISODate(toISODate(today)).getTime() - parseISODate(toISODate(new Date(iso))).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`card ${styles.stat}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statNote}>{note}</span>
    </div>
  );
}

/** Ficha do cliente ou do vendedor: números dos orçamentos dele e a lista completa. */
export function QuoteProfile({ back, name, details, badge, missing, missingText, load, hide }: QuoteProfileProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'missing' });
          return;
        }
        console.error('Não foi possível carregar os orçamentos', error);
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [load, reloadKey]);

  const backLink = (
    <Link to={back.to} className={`link-strong ${styles.back}`}>
      <Icon name="chevLeft" size={14} />
      {back.label}
    </Link>
  );

  if (missing || state.status === 'missing') {
    return (
      <>
        {backLink}
        <div className={`card ${styles.message}`}>
          <h1 className={styles.messageTitle}>{missingText}</h1>
          <p className={styles.sub}>Ele pode ter sido excluído, ou você não tem acesso a ele.</p>
        </div>
      </>
    );
  }

  const stats = state.status === 'success' ? quoteStats(state.data.quotes) : null;
  const last = state.status === 'success' ? state.data.lastActivityAt : null;

  return (
    <>
      {backLink}

      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {name ? initials(name) : ''}
        </span>
        <div className={styles.titles}>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>{name ?? 'Carregando…'}</h1>
            {badge}
          </div>
          {details.some(Boolean) && <p className={styles.sub}>{details.filter(Boolean).join(' · ')}</p>}
        </div>
      </div>

      {state.status === 'error' && (
        <div className={styles.alert} role="alert">
          <span>Não foi possível carregar os orçamentos.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className={`card ${styles.skeleton}`} aria-busy="true">
          <span className="sr-only">Carregando orçamentos…</span>
        </div>
      )}

      {stats && state.status === 'success' && (
        <>
          <div className={styles.stats}>
            <Stat
              label="Orçamentos"
              value={String(stats.count)}
              note={
                state.data.quotes[0]
                  ? `o mais recente em ${formatDate(toISODate(new Date(state.data.quotes[0].createdAt)))}`
                  : 'Nenhum ainda'
              }
            />
            <Stat label="Total orçado" value={formatBRLRounded(stats.total)} note="soma de todos os orçamentos" />
            <Stat
              label="Aprovado"
              value={formatBRLRounded(stats.approvedTotal)}
              note={plural(stats.approvedCount, 'orçamento aprovado', 'orçamentos aprovados')}
            />
            <Stat
              label="Taxa de aprovação"
              value={stats.approvalRate === null ? '—' : `${stats.approvalRate}%`}
              note={
                stats.decided === 0
                  ? 'Nenhum respondido ainda'
                  : `${stats.approvedCount} de ${plural(stats.decided, 'respondido', 'respondidos')}`
              }
            />
            <Stat
              label="Em aberto"
              value={formatBRLRounded(stats.openTotal)}
              note={plural(stats.openCount, 'pendente ou enviado', 'pendentes ou enviados')}
            />
            <Stat
              label="Último contato"
              value={last ? daysAgo(last) : '—'}
              note={last ? formatDateTime(last) : 'Nenhum orçamento ainda'}
            />
          </div>

          <RecentQuotesTable
            quotes={state.data.quotes}
            title={plural(state.data.quotes.length, 'orçamento', 'orçamentos')}
            link={null}
            hide={hide}
            empty="Nenhum orçamento ainda."
          />
        </>
      )}
    </>
  );
}
