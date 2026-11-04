import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import toolbarStyles from '@/features/people/ListToolbar.module.css';
import { useList } from '@/features/people/useList';
import { formatDateTime } from '@/lib/format';
import { listActivity } from '@/services/activityService';
import { ACTIVITY_AREAS, ACTIVITY_LIMIT, type ActivityArea } from '@/types/activity';
import styles from './ActivitySection.module.css';

/** Quantas linhas aparecem de cada vez. */
const PAGE = 30;
const ALL = '';
const UNKNOWN = '—';

/** Quem fez o quê: orçamentos (criação, edição, status), configurações e usuários. Só administrador. */
export function ActivitySection({ reloadKey: outside = 0 }: { reloadKey?: number }) {
  const [area, setArea] = useState<ActivityArea | null>(null);
  const [person, setPerson] = useState(ALL);
  const [shown, setShown] = useState(PAGE);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback((signal: AbortSignal) => listActivity(area, signal), [area]);
  const state = useList(load, 'Não foi possível carregar o histórico.', reloadKey + outside);

  const people = useMemo(() => {
    const names = new Set((state.data ?? []).map((a) => a.by ?? UNKNOWN));
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.data]);
  const rows = (state.data ?? []).filter((a) => person === ALL || (a.by ?? UNKNOWN) === person);

  function pickArea(next: ActivityArea | null) {
    setArea(next);
    setShown(PAGE);
  }

  return (
    <section className={`card ${styles.section}`} aria-labelledby="alteracoes-titulo">
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 id="alteracoes-titulo" className={styles.title}>
            Histórico de alterações
          </h2>
          <p className={styles.hint}>
            Quem criou, editou ou mudou o status de orçamentos, e quem mexeu nas configurações e nos usuários. Mostra as{' '}
            {ACTIVITY_LIMIT} alterações mais recentes.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={state.status === 'loading'}
        >
          <Icon name="redo" size={16} />
          Atualizar
        </button>
      </div>

      <div className={styles.filters}>
        <div className={toolbarStyles.segmented} role="group" aria-label="Área">
          {[null, ...ACTIVITY_AREAS].map((option) => (
            <button
              key={option ?? 'tudo'}
              type="button"
              className={toolbarStyles.segment}
              aria-pressed={area === option}
              onClick={() => pickArea(option)}
            >
              {option ?? 'Tudo'}
            </button>
          ))}
        </div>
        <div className={styles.person}>
          <Select
            aria-label="Usuário"
            value={person}
            onChange={(value) => {
              setPerson(value);
              setShown(PAGE);
            }}
            options={[{ value: ALL, label: 'Todos os usuários' }, ...people.map((name) => ({ value: name, label: name }))]}
          />
        </div>
      </div>

      {state.status === 'error' && (
        <div className={styles.alert} role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {!state.data ? (
        state.status === 'loading' && <p className={styles.hint}>Carregando histórico…</p>
      ) : rows.length === 0 ? (
        <p className={styles.hint}>Nenhuma alteração por aqui ainda.</p>
      ) : (
        <>
          <ol className={styles.list} aria-label="Alterações">
            {rows.slice(0, shown).map((activity) => (
              <li key={activity.id} className={styles.row}>
                <span className={styles.when}>{formatDateTime(activity.at)}</span>
                <span className={styles.what}>
                  <span className={styles.summary}>
                    {activity.quoteId ? (
                      <Link to={`/orcamentos/${activity.quoteId}`}>{activity.summary}</Link>
                    ) : (
                      activity.summary
                    )}
                  </span>
                  {activity.detail && <span className={styles.detail}>{activity.detail}</span>}
                </span>
                <span className={styles.who}>
                  <span className={styles.area}>{activity.area}</span>
                  {activity.by ?? 'Autor desconhecido'}
                </span>
              </li>
            ))}
          </ol>
          {rows.length > shown && (
            <button type="button" className={`btn btn-secondary ${styles.more}`} onClick={() => setShown((n) => n + PAGE)}>
              Mostrar mais ({rows.length - shown})
            </button>
          )}
        </>
      )}
    </section>
  );
}
