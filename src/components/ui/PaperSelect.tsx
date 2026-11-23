import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CaretDownIcon as CaretDown, CheckIcon as Check } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { useCloseWatcher } from '../../hooks/useCloseWatcher';

export interface PaperSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface PaperSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'onChange'> {
  options?: PaperSelectOption[];
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>, value?: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  variant?: 'sunken' | 'surface';
  containerClassName?: string;
  buttonClassName?: string;
}

function getReactNodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getReactNodeText).join('');
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return getReactNodeText(props.children);
  }
  return '';
}

export const PaperSelect = React.forwardRef<HTMLSelectElement, PaperSelectProps>(
  (
    {
      className,
      buttonClassName,
      containerClassName,
      children,
      disabled,
      size = 'md',
      variant = 'sunken',
      options,
      value,
      onChange,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
    const [maxListHeight, setMaxListHeight] = useState<number>(224);
    const containerRef = useRef<HTMLDivElement>(null);

    const parsedOptions = useMemo<PaperSelectOption[]>(() => {
      if (options && options.length > 0) return options;

      const list: PaperSelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          const childProps = child.props as {
            value?: string;
            children?: React.ReactNode;
            disabled?: boolean;
          };
          const val = childProps.value !== undefined ? String(childProps.value) : '';
          const text = getReactNodeText(childProps.children);
          const lbl = text || val;
          list.push({
            value: val,
            label: lbl,
            disabled: childProps.disabled,
          });
        }
      });
      return list;
    }, [options, children]);

    const selectedOption = useMemo(() => {
      return parsedOptions.find((opt) => opt.value === String(value));
    }, [parsedOptions, value]);

    const displayLabel = useMemo(() => {
      if (selectedOption) return selectedOption.label;
      if (placeholder) return placeholder;
      if (parsedOptions.length > 0) return parsedOptions[0]?.label ?? '';
      return '';
    }, [selectedOption, placeholder, parsedOptions]);

    const updatePlacement = useCallback(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;

      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        setPlacement('top');
        setMaxListHeight(Math.min(224, Math.max(100, Math.floor(spaceAbove))));
      } else {
        setPlacement('bottom');
        setMaxListHeight(Math.min(224, Math.max(100, Math.floor(spaceBelow))));
      }
    }, []);

    const toggleOpen = () => {
      if (disabled) return;
      if (!isOpen) {
        updatePlacement();
      }
      setIsOpen((prev) => !prev);
    };

    const handleSelect = (val: string) => {
      setIsOpen(false);
      if (onChange) {
        const fakeEvent = {
          target: { value: val, name: props.name },
          currentTarget: { value: val, name: props.name },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(fakeEvent, val);
      }
    };

    useCloseWatcher({
      isOpen,
      onClose: () => setIsOpen(false),
    });

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }, [isOpen]);

    const sizeStyles = {
      sm: 'h-8 px-2.5 text-xs',
      md: 'h-10 px-3 text-sm',
    };

    const variantStyles = {
      sunken:
        'bg-(--paper-sunken) border-(--rule-hairline) hover:border-(--border-strong)',
      surface:
        'bg-(--paper-sheet) border-(--rule-hairline) shadow-2xs hover:border-(--border-strong)',
    };

    return (
      <div
        ref={containerRef}
        className={cn('relative w-full select-none', containerClassName)}
      >
        <select
          ref={ref}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
          name={props.name}
          disabled={disabled}
        >
          {parsedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          id={id}
          type="button"
          role="combobox"
          value={value}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={toggleOpen}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between rounded-(--input-radius) border text-left font-mono transition-colors focus-visible:ring-1 focus-visible:ring-(--ink-primary) focus-visible:outline-none',
            sizeStyles[size],
            variantStyles[variant],
            disabled && 'cursor-not-allowed opacity-50',
            buttonClassName,
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedOption?.icon}
            <span
              className={cn(
                'truncate',
                selectedOption
                  ? 'text-(--ink-primary)'
                  : 'text-(--ink-tertiary)'
              )}
            >
              {displayLabel}
            </span>
          </span>
          <CaretDown
            className={cn(
              'size-3.5 shrink-0 stroke-2 text-(--ink-tertiary) transition-transform duration-200',
              isOpen && 'rotate-180 text-(--ink-primary)'
            )}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            style={{ maxHeight: `${maxListHeight}px` }}
            className={cn(
              'paper-card absolute left-0 z-50 w-full overflow-y-auto rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-1 shadow-lg select-none',
              placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            {parsedOptions.map((opt) => {
              const isSelected = opt.value === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-(--radius-xs) px-2.5 py-2 font-mono text-xs transition-colors',
                    isSelected
                      ? 'bg-(--paper-sunken) font-semibold text-(--ink-primary)'
                      : 'text-(--ink-secondary) hover:bg-(--paper-sunken)/70 hover:text-(--ink-primary)',
                    opt.disabled && 'pointer-events-none opacity-40'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 stroke-2 text-(--ink-primary)" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

PaperSelect.displayName = 'PaperSelect';

export default PaperSelect;