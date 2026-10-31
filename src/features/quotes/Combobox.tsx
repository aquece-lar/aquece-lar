import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';
import { portalTarget, useFloating } from '@/components/useFloating';
import { matches, normalize } from '@/features/people/useList';
import formStyles from '@/features/people/Form.module.css';
import styles from './Combobox.module.css';

export interface ComboboxOption {
  id: string;
  name: string;
  /** Linha secundária na lista (cidade, região); também entra na busca. */
  hint?: string;
}

interface ComboboxProps {
  id: string;
  options: ComboboxOption[];
  /** Id da opção escolhida; `''` = nenhuma. */
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  invalid?: boolean;
  /** Quando presente, o texto digitado sem correspondência exata vira a opção "Cadastrar …". */
  onCreate?: (text: string) => void;
}

/** Campo que aceita digitar para filtrar e também abre a lista completa. */
export function Combobox({ id, options, value, onChange, placeholder, invalid, onCreate }: ComboboxProps) {
  const selected = options.find((o) => o.id === value);
  const [text, setText] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-lista`;
  const pos = useFloating(open, inputRef, listRef);

  // Acompanha escolhas feitas por fora, como o vendedor sugerido pelo cliente.
  useEffect(() => {
    setText(selected?.name ?? '');
  }, [selected?.name]);

  // Com o nome escolhido no campo, a lista mostra todas as opções.
  const filtered =
    text === (selected?.name ?? '') ? options : options.filter((o) => matches(text, o.name, o.hint ?? ''));
  const typed = text.trim();
  const canCreate = Boolean(onCreate) && typed !== '' && !options.some((o) => normalize(o.name) === normalize(typed));
  // A opção de cadastro fica depois das encontradas, com o índice seguinte.
  const total = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function show() {
    const index = filtered.findIndex((o) => o.id === value);
    setActive(Math.max(0, index));
    setOpen(true);
  }

  function choose(option: ComboboxOption) {
    onChange(option.id);
    setText(option.name);
    setOpen(false);
  }

  function create() {
    setOpen(false);
    onCreate?.(typed);
  }

  // Ao sair do campo: nome exato escolhe, vazio limpa, qualquer outro texto volta ao escolhido.
  function commit() {
    setOpen(false);
    const exact = options.find((o) => normalize(o.name) === normalize(typed));
    if (exact) choose(exact);
    else if (typed === '') onChange('');
    else setText(selected?.name ?? '');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (total === 0 ? 0 : (i + step + total) % total));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
      else if (canCreate && active === filtered.length) create();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setText(selected?.name ?? '');
    }
  }

  const activeId = !open
    ? undefined
    : filtered[active]
      ? `${id}-op-${filtered[active].id}`
      : canCreate && active === filtered.length
        ? `${id}-criar`
        : undefined;

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        id={id}
        className={`${formStyles.input} ${styles.input}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      <button
        type="button"
        className={styles.toggle}
        tabIndex={-1}
        aria-label={open ? 'Fechar lista' : 'Abrir lista'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          if (open) setOpen(false);
          else show();
        }}
      >
        <Icon name="chevDown" size={16} />
      </button>

      {open &&
        createPortal(
          <ul ref={listRef} id={listId} role="listbox" className={styles.list} style={pos}>
            {filtered.map((option, index) => (
              <li
                key={option.id}
                id={`${id}-op-${option.id}`}
                role="option"
                aria-selected={option.id === value}
                data-index={index}
                className={`${styles.option} ${index === active ? styles.active : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span className={styles.optionText}>
                  <span className={styles.name}>{option.name}</span>
                  {option.hint && <span className={styles.hint}>{option.hint}</span>}
                </span>
                {option.id === value && <Icon name="check" size={16} />}
              </li>
            ))}
            {canCreate && (
              <li
                id={`${id}-criar`}
                role="option"
                aria-selected={false}
                data-index={filtered.length}
                className={`${styles.option} ${styles.create} ${active === filtered.length ? styles.active : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={create}
              >
                <span className={styles.optionText}>
                  <span className={styles.name}>
                    <Icon name="plus" size={14} /> Cadastrar “{typed}”
                  </span>
                </span>
              </li>
            )}
            {total === 0 && <li className={styles.empty}>Nenhum resultado para “{typed}”</li>}
          </ul>,
          portalTarget(inputRef),
        )}
    </div>
  );
}
