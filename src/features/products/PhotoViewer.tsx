import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Modal } from '@/features/people/Modal';
import type { Product } from '@/types/products';
import styles from './PhotoViewer.module.css';

interface PhotoViewerProps {
  /** Produto cujas fotos aparecem; `null` = fechado. */
  product: Product | null;
  onClose: () => void;
}

/** Arrasto mínimo, em pixels, para o toque contar como "próxima/anterior". */
const SWIPE = 40;

/** Fotos do produto em tamanho grande: setas, teclado (← →) e deslizar no celular. */
export function PhotoViewer({ product, onClose }: PhotoViewerProps) {
  const photos = product?.photos ?? [];
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const many = photos.length > 1;

  // Cada produto abre na capa.
  useEffect(() => setIndex(0), [product]);

  function go(step: number) {
    setIndex((i) => (i + step + photos.length) % photos.length);
  }

  useEffect(() => {
    if (!product || !many) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [product, many, photos.length]);

  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <Modal open={product !== null && photos.length > 0} title={product?.description ?? ''} onClose={onClose} size="lg">
      <div className={styles.viewer}>
        <div
          className={styles.stage}
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchX.current;
            const end = event.changedTouches[0]?.clientX;
            touchX.current = null;
            if (!many || start === null || end === undefined || Math.abs(end - start) < SWIPE) return;
            go(end < start ? 1 : -1);
          }}
        >
          {current && <img src={current} alt={`Foto ${index + 1} de ${photos.length}`} className={styles.photo} />}
          {many && (
            <>
              <button
                type="button"
                className={`${styles.nav} ${styles.prev}`}
                aria-label="Foto anterior"
                onClick={() => go(-1)}
              >
                <Icon name="chevLeft" size={22} />
              </button>
              <button
                type="button"
                className={`${styles.nav} ${styles.next}`}
                aria-label="Próxima foto"
                onClick={() => go(1)}
              >
                <Icon name="chevRight" size={22} />
              </button>
              <span className={styles.counter} aria-live="polite">
                {index + 1} de {photos.length}
              </span>
            </>
          )}
        </div>

        {many && (
          <ul className={styles.strip} aria-label="Todas as fotos">
            {photos.map((src, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`${styles.stripBtn} ${i === index ? styles.stripActive : ''}`}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                >
                  <img src={src} alt="" className={styles.stripImg} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.caption}>{product?.code}</p>
      </div>
    </Modal>
  );
}
