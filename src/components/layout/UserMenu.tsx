import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useAccess, useLogout, useUserName } from '@/contexts/AuthContext';
import styles from './Topbar.module.css';

/** Botão com o nome de quem está conectado; abre o menu com "Sair". */
export function UserMenu() {
  const user = useUserName();
  const logout = useLogout();
  const access = useAccess();
  // Vendedor mostra também o cadastro de vendedor ligado à conta.
  const role = access.role === 'Vendedor' && access.sellerName ? `Vendedor · ${access.sellerName}` : access.role;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

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

  return (
    <div ref={wrapRef} className={styles.userWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={`icon-btn ${styles.userButton}`}
        aria-label={`Menu de ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar}>{user.initials}</span>
        <span className={styles.userName}>{user.name}</span>
        <Icon name="chevDown" size={16} className={open ? styles.chevOpen : undefined} />
      </button>
      {open && (
        <div ref={menuRef} role="menu" className={styles.userMenu}>
          <div className={styles.userMenuHead}>
            <span className={styles.userMenuName}>{user.name}</span>
            {user.email && <span className={styles.userMenuEmail}>{user.email}</span>}
            <span className={styles.userMenuRole}>{role}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className={styles.userMenuItem}
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <Icon name="logout" size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
