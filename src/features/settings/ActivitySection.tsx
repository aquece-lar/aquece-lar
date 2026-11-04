import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import formStyles from '@/features/people/Form.module.css';
import toolbarStyles from '@/features/people/ListToolbar.module.css';
import { Modal } from '@/features/people/Modal';
import { useList } from '@/features/people/useList';
import { formatBRL, formatDateTime } from '@/lib/format';
import { deleteActivity, listActivity } from '@/services/activityService';
import { ACTIVITY_AREAS, ACTIVITY_LIMIT, type ActivityArea } from '@/types/activity';
import styles from './ActivitySection.module.css';
import checkStyles from './UserForm.module.css';

/** Quantas linhas aparecem de cada vez. */
const PAGE = 30;
const ALL = '';
const UNKNOWN = '—';

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className={`${checkStyles.check} ${styles.check}`}>
      <input
        type="checkbox"
        className={checkStyles.checkInput}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={checkStyles.checkBox} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
      {children}
    </label>
  );
}

function items(n: number): string {
  return n === 1 ? '1 item' : `${n} itens`;
}

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

  // Só conta o que está na lista filtrada: trocar o filtro não apaga o que sumiu da tela.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const picked = rows.filter((a) => selected.has(a.id)).map((a) => a.id);
  const allPicked = rows.length > 0 && picked.length === rows.length;
  /** Diálogo de confirmação: os escolhidos, tudo, ou fechado. */
  const [confirming, setConfirming] = useState<'selected' | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openConfirm(next: 'selected' | 'all' | null) {
    setDeleteError('');
    setConfirming(next);
  }

  async function handleDelete() {
    if (!confirming) return;
    setBusy(true);
    setDeleteError('');
    try {
      await deleteActivity(confirming === 'all' ? 'all' : picked);
      setSelected(new Set());
      setConfirming(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível apagar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

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
        <div className={styles.headActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={state.status === 'loading'}
          >
            <Icon name="redo" size={16} />
            Atualizar
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${styles.danger}`}
            onClick={() => openConfirm('all')}
            disabled={!state.data?.length}
          >
            <Icon name="trash" size={16} />
            Apagar tudo
          </button>
        </div>
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
          <div className={styles.selectionBar}>
            <Check checked={allPicked} onChange={(on) => setSelected(new Set(on ? rows.map((a) => a.id) : []))}>
              <span>Selecionar todos ({rows.length})</span>
            </Check>
            {picked.length > 0 && (
              <button type="button" className={`btn btn-secondary ${styles.danger}`} onClick={() => openConfirm('selected')}>
                <Icon name="trash" size={16} />
                Apagar selecionados ({picked.length})
              </button>
            )}
          </div>
          <ol className={styles.list} aria-label="Alterações">
            {rows.slice(0, shown).map((activity) => (
              <li key={activity.id} className={styles.row}>
                <Check checked={selected.has(activity.id)} onChange={(on) => toggle(activity.id, on)}>
                  <span className="sr-only">Selecionar: {activity.summary}</span>
                </Check>
                <span className={styles.when}>{formatDateTime(activity.at)}</span>
                <span className={styles.what}>
                  <span className={styles.summary}>
                    {activity.quoteId ? (
                      <Link to={`/orcamentos/${activity.quoteId}`}>{activity.summary}</Link>
                    ) : (
                      activity.summary
                    )}
                  </span>
                  {activity.quote && (
                    <span className={styles.quoteInfo}>
                      <span>{activity.quote.seller}</span> · <span>{activity.quote.customer}</span> ·{' '}
                      <span>{formatBRL(activity.quote.amount)}</span>
                    </span>
                  )}
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

      <Modal
        open={confirming !== null}
        title={confirming === 'all' ? 'Apagar todo o histórico' : 'Apagar do histórico'}
        onClose={() => openConfirm(null)}
        size="sm"
      >
        <p className={formStyles.text}>
          {confirming === 'all' ? (
            <>
              Tem certeza que deseja apagar <strong>todo o histórico</strong>?
            </>
          ) : (
            <>
              Tem certeza que deseja apagar <strong>{items(picked.length)}</strong> do histórico?
            </>
          )}{' '}
          A linha do tempo de cada orçamento não muda, e a limpeza fica registrada com o seu nome. Esta ação não pode ser
          desfeita.
        </p>
        {deleteError && (
          <p className={formStyles.error} role="alert">
            {deleteError}
          </p>
        )}
        <div className={formStyles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => openConfirm(null)} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={`btn ${formStyles.dangerBtn}`} onClick={handleDelete} disabled={busy}>
            {busy ? 'Apagando…' : 'Apagar'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
