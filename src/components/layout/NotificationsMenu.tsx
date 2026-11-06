import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useUserName } from '@/contexts/AuthContext';
import { listNotifications, readSeen, saveSeen } from '@/services/notificationsService';
import type { Notification } from '@/types/notifications';
import styles from './Topbar.module.css';

/** Busca de novo a cada 5 minutos e ao voltar para a aba. */
const REFRESH_MS = 5 * 60 * 1000;

function daysLabel(days: number): string {
  if (days === 0) return 'Venc. hoje';
  return days === 1 ? '1 dia' : `${days} dias`;
}

/** Sininho do topo: conta os avisos ainda não vistos e abre a lista. */
export function NotificationsMenu() {
  const { email } = useUserName();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(email));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback((signal?: AbortSignal) => {
    listNotifications(signal)
      .then(setItems)
      .catch((error: unknown) => {
        if (!signal?.aborted) console.error('Não foi possível carregar os avisos', error);
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

  const unread = (items ?? []).filter((n) => !seen.has(n.id)).length;
  const label = unread > 0 ? `Notificações, ${unread} ${unread === 1 ? 'nova' : 'novas'}` : 'Notificações';

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
          <div className={styles.userMenuHead}>
            <span className={styles.userMenuName}>Avisos</span>
            <span className={styles.userMenuEmail}>Orçamentos em aberto perto de vencer</span>
          </div>
          {items === null ? (
            <p className={styles.noticeEmpty}>Carregando…</p>
          ) : items.length === 0 ? (
            <p className={styles.noticeEmpty}>Nenhum orçamento vencendo por agora.</p>
          ) : (
            <ul className={styles.noticeList}>
              {items.map((n) => (
                <li key={n.id}>
                  <Link to={n.link} className={styles.noticeItem} onClick={() => setOpen(false)}>
                    <span className={styles.noticeText}>
                      <span className={styles.noticeTitle}>{n.title}</span>
                      <span className={styles.noticeMessage}>{n.message}</span>
                    </span>
                    <span className={styles.noticeDays}>
                      {n.quote.days > 0 && <Icon name="clock" size={12} />}
                      {daysLabel(n.quote.days)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
