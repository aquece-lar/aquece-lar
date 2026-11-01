import { NavLink } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { NAVIGATION } from '@/config/navigation';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo-aquece-lar.jpg';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onToggleCollapsed, onCloseMobile }: SidebarProps) {
  const { logout } = useAuth();
  const className = [styles.sidebar, collapsed && styles.collapsed, mobileOpen && styles.mobileOpen]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropVisible : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
        data-no-print
      />
      <aside id="menu-principal" aria-label="Menu principal" className={className} data-no-print>
        <div className={styles.header}>
          <NavLink to="/" className={styles.brand} onClick={onCloseMobile}>
            <img src={logo} alt="" className={styles.logo} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Aquece Lar</span>
              <span className={styles.brandSub}>Orçamentos</span>
            </span>
          </NavLink>
          <button
            type="button"
            className={`${styles.navButton} ${styles.collapseButton}`}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          >
            <Icon name="panel" size={18} />
          </button>
          <button
            type="button"
            className={`${styles.navButton} ${styles.closeButton}`}
            aria-label="Fechar menu"
            onClick={onCloseMobile}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          {NAVIGATION.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={onCloseMobile}
                >
                  <Icon name={item.icon} size={18} />
                  <span className={styles.label}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.userCard}>
          <span className={styles.userAvatar}>AD</span>
          <span className={styles.userInfo}>
            <span className={styles.userName}>Administrador</span>
            <span className={styles.userRole}>Acesso total</span>
          </span>
          <button type="button" className={styles.navButton} aria-label="Sair" title="Sair" onClick={logout}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
