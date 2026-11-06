import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/** Diálogo modal nativo: foco preso, Esc e clique fora fecham. */
export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${size === 'md' ? '' : styles[size]}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.body}>
          <div className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Fechar" onClick={onClose}>
              <Icon name="x" size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
