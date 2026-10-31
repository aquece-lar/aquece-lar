import { useRef, useState, type ChangeEvent } from 'react';
import { Icon } from '@/components/Icon';
import styles from './PhotoField.module.css';

export const MAX_PHOTOS = 8;
const MAX_SIDE = 1280;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Reduz para até 1280 px (JPEG) para o cadastro não ficar pesado; sem canvas, usa o arquivo original. */
async function toPhoto(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('sem canvas');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return readAsDataURL(file);
  }
}

interface PhotoFieldProps {
  photos: string[];
  onChange: (photos: string[]) => void;
}

/** Uma ou mais fotos do produto; a primeira é a capa. */
export function PhotoField({ photos, onChange }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const images = files.filter((f) => f.type.startsWith('image/'));
    const valid = images.filter((f) => f.size <= MAX_FILE_BYTES);
    const room = MAX_PHOTOS - photos.length;
    const accepted = valid.slice(0, room);
    const problems: string[] = [];
    if (images.length < files.length) problems.push('Só imagens são aceitas.');
    if (valid.length < images.length) problems.push('Imagens acima de 10 MB foram ignoradas.');
    if (valid.length > room) problems.push(`O limite é de ${MAX_PHOTOS} fotos por produto.`);
    setMessage(problems.join(' '));

    if (accepted.length === 0) return;
    setLoading(true);
    try {
      const added = await Promise.all(accepted.map(toPhoto));
      onChange([...photos, ...added]);
    } catch {
      setMessage('Não foi possível ler uma das imagens.');
    } finally {
      setLoading(false);
    }
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    onChange([photos[index] as string, ...photos.filter((_, i) => i !== index)]);
  }

  return (
    <div className={styles.field}>
      {photos.length > 0 && (
        <ul className={styles.grid} aria-label="Fotos do produto">
          {photos.map((src, index) => (
            <li key={`${index}-${src.slice(-40)}`} className={styles.item}>
              <img src={src} alt={`Foto ${index + 1}`} className={styles.img} />
              {index === 0 ? (
                <span className={styles.cover}>Capa</span>
              ) : (
                <button type="button" className={styles.coverBtn} onClick={() => makeCover(index)}>
                  Tornar capa
                </button>
              )}
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remover foto ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || photos.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="image" size={16} />
          {loading ? 'Carregando…' : photos.length ? 'Adicionar mais fotos' : 'Adicionar fotos'}
        </button>
        <span className={styles.hint}>
          {photos.length}/{MAX_PHOTOS} · JPG, PNG ou WebP
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Selecionar fotos"
        onChange={onPick}
      />
      {message && (
        <p className={styles.message} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
