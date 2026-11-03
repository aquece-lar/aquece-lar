import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';
import { portalTarget, useFloating } from '@/components/useFloating';
import formStyles from '@/features/people/Form.module.css';
import listStyles from '@/features/quotes/Combobox.module.css';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  /** Linha secundária na lista. */
  hint?: string;
}

interface SelectProps {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  /** Mostra o valor sem deixar trocar. */
  disabled?: boolean;
  'aria-label'?: string;
}

/** Substituto estilizado do <select>: mesma lista do Combobox, sem busca. */
export function Select({ value, options, onChange, id, placeholder = 'Selecione', invalid, disabled, ...aria }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${uid}-lista`;
  const selected = options.find((o) => o.value === value);

  const pos = useFloating(open, buttonRef, listRef);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function show() {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Busca rápida pela primeira letra.
      const letter = event.key.toLowerCase();
      const index = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(letter));
      const first = index >= 0 ? index : options.findIndex((o) => o.label.toLowerCase().startsWith(letter));
      if (first >= 0) {
        if (!open) setOpen(true);
        setActive(first);
      }
    }
  }

  return (
    <div ref={rootRef} className={listStyles.wrap}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`${formStyles.input} ${styles.trigger}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${uid}-op-${active}` : undefined}
        aria-invalid={invalid}
        aria-label={aria['aria-label']}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? styles.value : styles.placeholder}>{selected?.label ?? placeholder}</span>
        <Icon name="chevDown" size={16} />
      </button>

      {open &&
        createPortal(
          <ul ref={listRef} id={listId} role="listbox" className={listStyles.list} style={pos}>
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${uid}-op-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-index={index}
                className={`${listStyles.option} ${index === active ? listStyles.active : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span className={listStyles.optionText}>
                  <span className={listStyles.name}>{option.label}</span>
                  {option.hint && <span className={listStyles.hint}>{option.hint}</span>}
                </span>
                {option.value === value && <Icon name="check" size={16} />}
              </li>
            ))}
          </ul>,
          portalTarget(buttonRef),
        )}
    </div>
  );
}
