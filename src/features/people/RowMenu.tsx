import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import styles from './RowMenu.module.css';

interface RowMenuProps {
  /** Nome do item, usado no rótulo acessível do botão. */
  label: string;
  onEdit: () => void;
  /** Sem `onDelete` (perfil sem permissão), o menu só tem Editar. */
  onDelete?: () => void;
}

/**
 * Engrenagem com as ações da linha. O menu usa posição fixa para não
 * ser cortado pela rolagem horizontal da tabela.
 */
export function RowMenu({ label, onEdit, onDelete }: RowMenuProps) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    function close() {
      setPos(null);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setPos(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  function choose(action: () => void) {
    setPos(null);
    action();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn icon-btn--sm"
        aria-label={`Ações de ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="gear" size={17} />
      </button>
      {pos && (
        <div ref={menuRef} role="menu" className={styles.menu} style={{ top: pos.top, right: pos.right }}>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose(onEdit)}>
            <Icon name="edit" size={16} />
            Editar
          </button>
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.danger}`}
              onClick={() => choose(onDelete)}
            >
              <Icon name="trash" size={16} />
              Excluir
            </button>
          )}
        </div>
      )}
    </>
  );
}
