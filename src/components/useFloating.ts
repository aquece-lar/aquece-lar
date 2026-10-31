import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Onde montar a lista: dentro do <dialog> modal, se houver (ele fica na "top layer"
 * do navegador e cobre qualquer coisa fora dele), senão no <body>.
 */
export function portalTarget(anchorRef: RefObject<HTMLElement | null>): HTMLElement {
  return anchorRef.current?.closest('dialog') ?? document.body;
}

/**
 * Posiciona uma lista/popover em `position: fixed` logo abaixo do elemento âncora.
 * Usado com `createPortal(…, document.body)` para que cartões e modais com
 * `overflow` não cortem a lista. A posição acompanha o campo enquanto a lista está aberta.
 */
export function useFloating(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatRef: RefObject<HTMLElement | null>,
  /** Para conteúdo que não encolhe (calendário): abre para cima se não couber embaixo. */
  flip = false,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(floatRef.current?.offsetWidth ?? 0, rect.width);
    const height = floatRef.current?.scrollHeight ?? 0;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom - 12;
    const up = flip && height > below && rect.top > below;
    const next: CSSProperties = { position: 'fixed', left, minWidth: rect.width, zIndex: 1000 };
    if (up) {
      next.top = 'auto';
      next.bottom = window.innerHeight - rect.top + 4;
    } else {
      next.top = rect.bottom + 4;
      // Listas rolam por dentro quando o espaço abaixo é menor que a altura delas.
      if (!flip) (next as Record<string, string | number>)['--float-max'] = `${Math.max(120, below)}px`;
    }
    const same = (prev: CSSProperties) =>
      prev.top === next.top &&
      prev.bottom === next.bottom &&
      prev.left === next.left &&
      (prev as Record<string, unknown>)['--float-max'] === (next as Record<string, unknown>)['--float-max'] &&
      prev.minWidth === next.minWidth;
    // Mantém o objeto anterior quando nada mudou, para não re-renderizar a cada frame.
    setStyle((prev) => (same(prev) ? prev : next));
  }, [anchorRef, floatRef, flip]);

  useLayoutEffect(() => {
    if (open) update();
  }, [open, update]);

  // Acompanha o campo a cada frame: o layout pode mudar (itens novos, foco, rolagem
  // de qualquer contêiner) sem disparar `scroll` ou `resize`.
  useEffect(() => {
    if (!open) return;
    let frame = requestAnimationFrame(function tick() {
      update();
      frame = requestAnimationFrame(tick);
    });
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, update]);

  return style;
}
