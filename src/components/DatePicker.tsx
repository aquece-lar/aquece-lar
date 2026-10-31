import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent } from 'react';
import { Icon } from '@/components/Icon';
import { portalTarget, useFloating } from '@/components/useFloating';
import { formatDate, parseISODate, toISODate } from '@/lib/format';
import styles from './DatePicker.module.css';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

interface DatePickerProps {
  /** Data no formato "AAAA-MM-DD" (vazio = sem data). */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  /** Permite limpar a data. Padrão: false. */
  clearable?: boolean;
  /** "field" imita os inputs de formulário; "inline" é sem borda (para filtros). */
  variant?: 'field' | 'inline';
  placeholder?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  id?: string;
}

function monthOf(iso: string): { year: number; month: number } {
  const date = iso ? parseISODate(iso) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  clearable = false,
  variant = 'field',
  placeholder = 'dd/mm/aaaa',
  id,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value));
  const [focusIso, setFocusIso] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popId = useId();
  const today = toISODate(new Date());
  const pos = useFloating(open, triggerRef, popRef, true);

  const disabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  function openPicker() {
    setView(monthOf(value));
    setFocusIso(value || today);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function select(iso: string) {
    if (disabled(iso)) return;
    onChange(iso);
    close();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Move o foco para o dia ativo (navegação por teclado).
  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector<HTMLButtonElement>('button[data-focus="true"]')?.focus({ preventScroll: true });
  }, [open, focusIso, view]);

  function shiftMonth(delta: number) {
    setView((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function moveFocus(days: number) {
    const next = parseISODate(focusIso || today);
    next.setDate(next.getDate() + days);
    setFocusIso(toISODate(next));
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  function onGridKeyDown(event: KeyboardEvent) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in steps) {
      event.preventDefault();
      moveFocus(steps[event.key] as number);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const next = parseISODate(focusIso || today);
      next.setMonth(next.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      setFocusIso(toISODate(next));
      setView({ year: next.getFullYear(), month: next.getMonth() });
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close();
    }
  }

  // Grade de 6 semanas começando no domingo.
  const first = new Date(view.year, view.month, 1);
  const days = Array.from({ length: 42 }, (_, i) => new Date(view.year, view.month, 1 - first.getDay() + i));
  const gridFocus = days.some((d) => toISODate(d) === focusIso) ? focusIso : toISODate(first);

  return (
    <div ref={rootRef} className={`${styles.root} ${variant === 'inline' ? styles.inline : ''}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={aria['aria-label']}
        aria-invalid={aria['aria-invalid']}
        onClick={() => (open ? close(false) : openPicker())}
      >
        <span className={value ? styles.value : styles.placeholder}>{value ? formatDate(value) : placeholder}</span>
        <Icon name="calendar" size={16} />
      </button>

      {open &&
        createPortal(
          <div ref={popRef} id={popId} role="dialog" aria-label="Escolher data" className={styles.popover} style={pos}>
            <div className={styles.head}>
              <strong className={styles.title} aria-live="polite">
                {MONTHS[view.month]} de {view.year}
              </strong>
              <button type="button" className={styles.nav} aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
                <Icon name="chevLeft" size={16} />
              </button>
              <button type="button" className={styles.nav} aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
                <Icon name="chevRight" size={16} />
              </button>
            </div>

            <div className={styles.grid} role="grid" onKeyDown={onGridKeyDown}>
              {WEEKDAYS.map((label, i) => (
                <span key={i} className={styles.weekday} aria-hidden="true">
                  {label}
                </span>
              ))}
              {days.map((date) => {
                const iso = toISODate(date);
                const outside = date.getMonth() !== view.month;
                const cls = [
                  styles.day,
                  outside ? styles.outside : '',
                  iso === value ? styles.selected : '',
                  iso === today ? styles.today : '',
                ].join(' ');
                return (
                  <button
                    key={iso}
                    type="button"
                    className={cls}
                    disabled={disabled(iso)}
                    tabIndex={iso === gridFocus ? 0 : -1}
                    data-focus={iso === gridFocus}
                    aria-label={date.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    aria-pressed={iso === value}
                    onClick={() => select(iso)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className={styles.foot}>
              {clearable ? (
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    onChange('');
                    close();
                  }}
                >
                  Limpar
                </button>
              ) : (
                <span />
              )}
              <button type="button" className={styles.link} disabled={disabled(today)} onClick={() => select(today)}>
                Hoje
              </button>
            </div>
          </div>,
          portalTarget(triggerRef),
        )}
    </div>
  );
}
