import { Link } from 'react-router-dom';
import { useCan } from '@/contexts/AuthContext';
import type { SellerRank } from '@/types/dashboard';
import { formatBRLRounded, initials } from '@/lib/format';
import styles from './SellerRanking.module.css';

/** Com meta, a barra mostra quanto dela já foi orçado; sem meta, compara com o primeiro do ranking. */
function progress(seller: SellerRank, max: number): { width: number; percent: number | null } {
  if (seller.goal) {
    const percent = Math.round((seller.amount / seller.goal) * 100);
    return { width: Math.min(100, percent), percent };
  }
  return { width: max > 0 ? Math.round((seller.amount / max) * 100) : 0, percent: null };
}

export function SellerRanking({ sellers }: { sellers: SellerRank[] }) {
  const sorted = [...sellers].sort((a, b) => b.amount - a.amount);
  const max = Math.max(0, ...sorted.map((s) => s.amount));
  // O vendedor não abre a tela de vendedores.
  const canViewSellers = useCan('viewSellers');

  return (
    <section className={`card ${styles.card}`} aria-labelledby="ranking-titulo">
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 id="ranking-titulo" className={styles.title}>
            Ranking de vendedores
          </h2>
          <p className={styles.subtitle}>Valor orçado e meta no período</p>
        </div>
        {canViewSellers && (
          <Link to="/vendedores" className="link-strong">
            Ver todos
          </Link>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className={styles.empty}>Nenhum vendedor com orçamentos no período.</p>
      ) : (
        <ol className={styles.list}>
          {sorted.map((seller, index) => {
            const { width, percent } = progress(seller, max);
            const reached = percent !== null && percent >= 100;
            return (
              <li key={seller.id} className={styles.item}>
                <div className={styles.row}>
                  <span className={styles.pos}>{index + 1}</span>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(seller.name)}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.name}>{seller.name}</span>
                    <span className={styles.qtd}>{seller.quotes} {seller.quotes === 1 ? 'orçamento' : 'orçamentos'}</span>
                  </span>
                  <span className={styles.amount}>{formatBRLRounded(seller.amount)}</span>
                </div>
                <div className={styles.track} aria-hidden="true">
                  <div className={`${styles.fill} ${reached ? styles.reached : ''}`} style={{ width: `${width}%` }} />
                </div>
                <p className={`${styles.goal} ${reached ? styles.goalReached : ''}`}>
                  {seller.goal
                    ? `${reached ? 'Meta batida: ' : ''}${percent}% da meta de ${formatBRLRounded(seller.goal)}`
                    : 'Sem meta definida'}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
