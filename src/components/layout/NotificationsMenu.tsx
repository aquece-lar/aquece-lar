import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useUserName } from '@/contexts/AuthContext';
import checkStyles from '@/features/settings/UserForm.module.css';
import { dismissNotifications, listNotifications, readSeen, saveSeen } from '@/services/notificationsService';
import type { Notification } from '@/types/notifications';
import styles from './Topbar.module.css';

/** Busca de novo a cada 5 minutos e ao voltar para a aba. */
const REFRESH_MS = 5 * 60 * 1000;

function daysLabel(n: Notification): string {
  const { days } = n.quote;
  if (n.kind === 'quote_follow_up') return 'Retornar';
  if (days === 0) return 'Venc. hoje';
  return days === 1 ? '1 dia' : `${days} dias`;
}

function NoticeText({ n }: { n: Notification }) {
  return (
    <>
      <span className={styles.noticeText}>
        <span className={styles.noticeTitle}>{n.title}</span>
        <span className={styles.noticeMessage}>{n.message}</span>
      </span>
      <span className={`${styles.noticeDays} ${n.kind === 'quote_follow_up' ? styles.noticeFollowUp : ''}`}>
        {n.kind === 'quote_follow_up' ? <Icon name="chat" size={12} /> : n.quote.days > 0 && <Icon name="clock" size={12} />}
        {daysLabel(n)}
      </span>
    </>
  );
}

/** Sininho do topo: conta os avisos ainda não vistos, lista, e deixa excluir alguns ou limpar todos. */
export function NotificationsMenu() {
  const { email } = useUserName();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(email));
  const [open, setOpen] = useState(false);
  /** `null` fora do modo de seleção; senão, os ids marcados. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback((signal?: AbortSignal) => {
    listNotifications(signal)
      .then(setItems)
      .catch((reason: unknown) => {
        if (!signal?.aborted) console.error('Não foi possível carregar os avisos', reason);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => load(), REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => setSeen(readSeen(email)), [email]);

  // Abrir a lista marca como vistos os avisos que estão nela.
  useEffect(() => {
    if (!open || !items) return;
    const ids = items.map((n) => n.id);
    saveSeen(email, ids);
    setSeen(new Set(ids));
  }, [open, items, email]);

  // Ao fechar, sai da seleção e da confirmação.
  useEffect(() => {
    if (open) return;
    setSelected(null);
    setConfirmingAll(false);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function dismiss(ids: readonly string[] | 'all') {
    setBusy(true);
    setError('');
    try {
      await dismissNotifications(ids);
      setItems((prev) => (ids === 'all' ? [] : (prev ?? []).filter((n) => !ids.includes(n.id))));
      setSelected(null);
      setConfirmingAll(false);
    } catch (reason) {
      console.error('Não foi possível excluir os avisos', reason);
      setError('Não foi possível excluir agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const unread = (items ?? []).filter((n) => !seen.has(n.id)).length;
  const label = unread > 0 ? `Notificações, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : 'Notificações';
  const picked = selected ? (items ?? []).filter((n) => selected.has(n.id)).map((n) => n.id) : [];
  const hasItems = Boolean(items && items.length > 0);

  return (
    <div ref={wrapRef} className={styles.userWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn ${styles.bell}`}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className={styles.count} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={`${styles.userMenu} ${styles.noticePanel}`} role="dialog" aria-label="Avisos">
          <div className={`${styles.userMenuHead} ${styles.noticeHead}`}>
            <span className={styles.noticeHeadText}>
              <span className={styles.userMenuName}>Avisos</span>
              <span className={styles.userMenuEmail}>Vencimentos e retornos</span>
            </span>
            {hasItems && !confirmingAll && (
              <span className={styles.noticeActions}>
                {selected ? (
                  <button type="button" className={styles.noticeLink} onClick={() => setSelected(null)} disabled={busy}>
                    Cancelar
                  </button>
                ) : (
                  <>
                    <button type="button" className={styles.noticeLink} onClick={() => setSelected(new Set())}>
                      Selecionar
                    </button>
                    <button
                      type="button"
                      className={`${styles.noticeLink} ${styles.noticeDanger}`}
                      onClick={() => setConfirmingAll(true)}
                    >
                      Limpar todas
                    </button>
                  </>
                )}
              </span>
            )}
          </div>

          {confirmingAll && (
            <div className={styles.noticeConfirm} role="alert">
              <span>Limpar todos os avisos? Eles só voltam se o orçamento mudar de validade.</span>
              <span className={styles.noticeActions}>
                <button type="button" className={styles.noticeLink} onClick={() => setConfirmingAll(false)} disabled={busy}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${styles.noticeLink} ${styles.noticeDanger}`}
                  onClick={() => void dismiss('all')}
                  disabled={busy}
                >
                  {busy ? 'Limpando…' : 'Limpar'}
                </button>
              </span>
            </div>
          )}

          {items === null ? (
            <p className={styles.noticeEmpty}>Carregando…</p>
          ) : items.length === 0 ? (
            <p className={styles.noticeEmpty}>Nenhum aviso por agora.</p>
          ) : (
            <ul className={styles.noticeList}>
              {items.map((n) => (
                <li key={n.id}>
                  {selected ? (
                    <label className={`${styles.noticeItem} ${styles.noticeSelectable}`}>
                      <span className={`${checkStyles.check} ${styles.noticeCheck}`}>
                        <input
                          type="checkbox"
                          className={checkStyles.checkInput}
                          checked={selected.has(n.id)}
                          onChange={() => toggle(n.id)}
                          aria-label={`Selecionar: ${n.title}`}
                        />
                        <span className={checkStyles.checkBox} aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                      </span>
                      <NoticeText n={n} />
                    </label>
                  ) : (
                    <Link to={n.link} className={styles.noticeItem} onClick={() => setOpen(false)}>
                      <NoticeText n={n} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className={styles.noticeError} role="alert">
              {error}
            </p>
          )}

          {selected && hasItems && (
            <div className={styles.noticeFooter}>
              <button
                type="button"
                className={`btn btn-secondary ${styles.noticeDeleteBtn}`}
                onClick={() => void dismiss(picked)}
                disabled={busy || picked.length === 0}
              >
                <Icon name="trash" size={16} />
                {busy ? 'Excluindo…' : `Excluir selecionadas (${picked.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
