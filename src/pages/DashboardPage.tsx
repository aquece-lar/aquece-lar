import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useCan, useUserName } from '@/contexts/AuthContext';
import { DailyChart } from '@/features/dashboard/DailyChart';
import { ExpiringQuotes } from '@/features/dashboard/ExpiringQuotes';
import { KpiCard } from '@/features/dashboard/KpiCard';
import { PeriodFilter } from '@/features/dashboard/PeriodFilter';
import { RecentQuotesTable } from '@/features/dashboard/RecentQuotesTable';
import { SellerRanking } from '@/features/dashboard/SellerRanking';
import { useDashboard } from '@/features/dashboard/useDashboard';
import { formatDate, greeting, toISODate } from '@/lib/format';
import type { Period } from '@/types/dashboard';
import styles from './DashboardPage.module.css';

function defaultPeriod(): Period {
  const now = new Date();
  return {
    from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toISODate(now),
  };
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [reloadKey, setReloadKey] = useState(0);
  const state = useDashboard(period, reloadKey);
  const greet = useMemo(() => greeting(), []);
  const user = useUserName();
  // "Vendedores ativos" só faz sentido para quem acompanha a equipe.
  const canViewSellers = useCan('viewSellers');

  const data = state.data;
  const loading = state.status === 'loading' && !data;
  const error = state.status === 'error' ? state.message : null;

  return (
    <>
      <div className={styles.pageHead}>
        <div className={styles.titles}>
          <h1 className={styles.h1}>{greet}, {user.name.split(' ')[0]}</h1>
          <p className={styles.sub}>
            Resumo de {formatDate(period.from)} a {formatDate(period.to)}
          </p>
        </div>
        <div className={styles.actions}>
          <PeriodFilter value={period} onChange={setPeriod} />
          <Link to="/conversas" className="btn btn-secondary">
            <Icon name="chat" size={16} />
            Ver conversas
          </Link>
          <Link to="/orcamentos/novo" className="btn btn-primary">
            <Icon name="plus" size={16} />
            Novo orçamento
          </Link>
        </div>
      </div>

      {error && (
        <div className={styles.alert} role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.skeleton} aria-busy="true" aria-live="polite">
          <span className="sr-only">Carregando dashboard…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`card ${styles.skelBlock}`} />
          ))}
          <div className={`card ${styles.skelChart}`} />
          <div className={`card ${styles.skelWide}`} />
          <div className={`card ${styles.skelSide}`} />
          <div className={`card ${styles.skelTable}`} />
        </div>
      ) : data ? (
        <>
          <div className={styles.kpis}>
            {data.kpis.filter((kpi) => canViewSellers || kpi.id !== 'vendedores').map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
          <DailyChart points={data.daily} />
          <div className={styles.split}>
            <ExpiringQuotes expiry={data.expiry} />
            <SellerRanking sellers={data.ranking} />
          </div>
          <RecentQuotesTable quotes={data.recentQuotes} />
        </>
      ) : null}
    </>
  );
}
