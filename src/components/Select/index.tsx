import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  id,
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const listId = id ? `${id}-list` : `${autoId}-list`;

  const selected = options.find(o => o.value === value);
  const hasError = className.includes('is-error');

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        document.getElementById(listId)?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open, listId]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const menu = open && menuPos ? (
    <ul
      className="select-menu"
      id={listId}
      role="listbox"
      aria-label={placeholder}
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
      }}
    >
      {options.map(opt => (
        <li key={opt.value || '__empty'} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={value === opt.value}
            className={`select-option ${value === opt.value ? 'sel' : ''}`}
            onClick={() => pick(opt.value)}
          >
            {opt.label}
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className={`select-wrap ${open ? 'open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`select-trigger ${hasError ? 'is-error' : ''} ${className.replace('is-error', '').trim()}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          if (!open) updateMenuPosition();
          setOpen(o => !o);
        }}
      >
        <span className={selected ? 'select-value' : 'select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="select-chevron" aria-hidden="true" />
      </button>

      {menu && createPortal(menu, document.querySelector('.bank-app') ?? document.body)}
    </div>
  );
}
