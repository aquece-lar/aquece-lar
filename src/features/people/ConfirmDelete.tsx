import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import styles from './Form.module.css';

interface ConfirmDeleteProps {
  /** Nome do item a excluir; `null` mantém o diálogo fechado. */
  name: string | null;
  what: string;
  busy: boolean;
  /** Se rejeitar (ex.: a API recusa porque o item está em uso), a mensagem aparece no diálogo. */
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDelete({ name, what, busy, onConfirm, onCancel }: ConfirmDeleteProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [name]);

  async function confirm() {
    setError(null);
    try {
      await onConfirm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir. Tente novamente.');
    }
  }

  return (
    <Modal open={name !== null} title={`Excluir ${what}`} onClose={onCancel} size="sm">
      <p className={styles.text}>
        Tem certeza que deseja excluir <strong>{name}</strong>? Esta ação não pode ser desfeita.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          {error ? 'Fechar' : 'Cancelar'}
        </button>
        <button type="button" className={`btn ${styles.dangerBtn}`} onClick={confirm} disabled={busy || error !== null}>
          {busy ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
    </Modal>
  );
}
