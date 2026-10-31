export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Reduz a imagem para caber em `maxSide` px e devolve como data URL. JPEG ganha
 * fundo branco; PNG mantém a transparência (bom para logo). Sem canvas, usa o
 * arquivo original.
 */
export async function resizeImage(
  file: File,
  maxSide: number,
  type: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('sem canvas');
    if (type === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL(type, 0.85);
  } catch {
    return readAsDataURL(file);
  }
}
