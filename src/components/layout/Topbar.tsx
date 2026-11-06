import { useEffect, useRef } from 'react';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/contexts/ThemeContext';
import styles from './Topbar.module.css';
import { UserMenu } from './UserMenu';

interface TopbarProps {
  mobileMenuOpen: boolean;
  onOpenMobileMenu: () => void;
}

export function Topbar({ mobileMenuOpen, onOpenMobileMenu }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className={styles.topbar} data-no-print>
      <button
        type="button"
        className={`icon-btn ${styles.menuButton}`}
        aria-label="Abrir menu"
        aria-controls="menu-principal"
        aria-expanded={mobileMenuOpen}
        onClick={onOpenMobileMenu}
      >
        <Icon name="menu" size={20} />
      </button>

      <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
        <Icon name="search" size={18} />
        <input
          ref={searchRef}
          type="search"
          aria-label="Busca global"
          placeholder="Buscar orçamentos, clientes, produtos…"
          className={styles.searchInput}
          maxLength={120}
        />
        <kbd className={styles.kbd}>Ctrl K</kbd>
      </form>

      <div className={styles.spacer} />

      <button
        type="button"
        className="icon-btn"
        aria-label={theme === 'claro' ? 'Ativar tema escuro' : 'Ativar tema claro'}
        onClick={toggleTheme}
      >
        <Icon name={theme === 'claro' ? 'moon' : 'sun'} size={18} />
      </button>

      <button type="button" className={`icon-btn ${styles.bell}`} aria-label="Notificações, 3 novas">
        <Icon name="bell" size={18} />
        <span className={styles.dot} />
      </button>

      <UserMenu />
    </header>
  );
}
