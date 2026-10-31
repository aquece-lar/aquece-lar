import { useMemo, useState, type CSSProperties } from 'react';
import type { DailyPoint } from '@/types/dashboard';
import { formatBRLRounded, formatDayMonth, formatWeekdayDayMonth } from '@/lib/format';
import styles from './DailyChart.module.css';

type Metric = 'qtd' | 'valor';

const CHART_HEIGHT = 220;
const TICKS = 3;

function niceMax(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step);
}

function labelStep(count: number): number {
  return Math.max(1, Math.round(count / 6));
}

/**
 * Rótulos contados a partir do último dia, que sempre aparece. O primeiro só
 * entra se ficar a pelo menos meio intervalo do vizinho, para não encavalar.
 */
function showLabel(index: number, count: number, step: number): boolean {
  const fromEnd = count - 1 - index;
  if (fromEnd % step === 0) return true;
  return index === 0 && fromEnd % step >= Math.ceil(step / 2);
}

export function DailyChart({ points }: { points: DailyPoint[] }) {
  const [metric, setMetric] = useState<Metric>('qtd');
  const [hovered, setHovered] = useState<number | null>(null);

  const totals = useMemo(
    () => ({
      quantity: points.reduce((sum, p) => sum + p.quantity, 0),
      amount: points.reduce((sum, p) => sum + p.amount, 0),
    }),
    [points],
  );

  const values = points.map((p) => (metric === 'qtd' ? p.quantity : p.amount / 1000));
  const max = metric === 'qtd' ? niceMax(Math.max(0, ...values), TICKS) : niceMax(Math.max(0, ...values), 30);
  const step = labelStep(points.length);
  const barGap = points.length > 60 ? 1 : points.length > 31 ? 3 : 6;

  const ticks = Array.from({ length: TICKS + 1 }, (_, k) => {
    const value = (max / TICKS) * k;
    return {
      bottom: Math.round((k / TICKS) * CHART_HEIGHT),
      label: metric === 'qtd' ? String(Math.round(value)) : k === 0 ? '0' : `${Math.round(value)} mil`,
    };
  });

  const title = metric === 'qtd' ? 'Orçamentos por dia' : 'Valor orçado por dia';
  const subtitle =
    metric === 'qtd' ? `${totals.quantity} orçamentos no período` : `${formatBRLRounded(totals.amount)} no período`;

  function tipText(point: DailyPoint): string {
    return metric === 'qtd' ? `${point.quantity} orçamentos` : formatBRLRounded(point.amount);
  }

  return (
    <section className={`card ${styles.chartCard}`} aria-labelledby="grafico-diario-titulo">
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 id="grafico-diario-titulo" className={styles.title}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div role="group" aria-label="Métrica do gráfico" className={styles.toggle}>
          <button
            type="button"
            aria-pressed={metric === 'qtd'}
            className={styles.toggleBtn}
            onClick={() => setMetric('qtd')}
          >
            Quantidade
          </button>
          <button
            type="button"
            aria-pressed={metric === 'valor'}
            className={styles.toggleBtn}
            onClick={() => setMetric('valor')}
          >
            Valor
          </button>
        </div>
      </div>

      {points.length === 0 ? (
        <p className={styles.empty}>Sem dados no período selecionado.</p>
      ) : (
        <div className={styles.plot} style={{ '--chart-h': `${CHART_HEIGHT}px` } as CSSProperties}>
          <div className={styles.yAxis} aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick.bottom} className={styles.yLabel} style={{ bottom: tick.bottom }}>
                {tick.label}
              </span>
            ))}
          </div>
          <div className={styles.area}>
            <div className={styles.grid}>
              {ticks.map((tick) => (
                <div key={tick.bottom} className={styles.gridLine} style={{ bottom: tick.bottom }} />
              ))}
              <div
                className={styles.bars}
                style={{ '--bar-gap': `${barGap}px` } as CSSProperties}
                onMouseLeave={() => setHovered(null)}
              >
                {points.map((point, index) => {
                  const value = values[index] ?? 0;
                  const height = Math.max(value > 0 ? 3 : 0, Math.round((value / max) * CHART_HEIGHT));
                  return (
                    <div
                      key={point.date}
                      className={styles.barSlot}
                      tabIndex={0}
                      aria-label={`${formatWeekdayDayMonth(point.date)}: ${tipText(point)}${point.partial ? ' (parcial)' : ''}`}
                      onMouseEnter={() => setHovered(index)}
                      onFocus={() => setHovered(index)}
                      onBlur={() => setHovered(null)}
                    >
                      <div
                        className={styles.bar}
                        style={{ height, opacity: point.partial ? 0.45 : 1 }}
                      />
                      {hovered === index && (
                        <div className={styles.tooltip} style={{ bottom: height + 10 }} role="tooltip">
                          <span className={styles.tipDate}>{formatWeekdayDayMonth(point.date)}</span>
                          <span className={styles.tipValue}>{tipText(point)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.xAxis} style={{ '--bar-gap': `${barGap}px` } as CSSProperties} aria-hidden="true">
              {points.map((point, index) => {
                return (
                  <span key={point.date} className={styles.xLabel}>
                    {showLabel(index, points.length, step) ? formatDayMonth(point.date) : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
