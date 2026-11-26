import React from 'react';
import { cn } from '../../utils/cn';

export interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'sunken' | 'surface' | 'ghost';
  currencySymbol?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  autoFocus = false,
  disabled = false,
  size = 'md',
  variant = 'sunken',
  currencySymbol = '¥',
  className,
  id,
  'aria-label': ariaLabel = '金额输入',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) {
      onChange(raw);
    }
  };

  const sizeContainerStyles = {
    sm: 'h-8 px-2.5 rounded-(--input-radius) box-border',
    md: 'h-12 px-3.5 rounded-(--radius-md) box-border',
    lg: 'h-14 px-4 rounded-(--radius-md) box-border',
  };

  const sizeSymbolStyles = {
    sm: 'text-xs font-semibold mr-1.5 leading-none',
    md: 'text-lg font-bold mr-2 leading-none',
    lg: 'text-2xl font-bold mr-2.5 leading-none',
  };

  const sizeInputStyles = {
    sm: 'text-xs font-semibold',
    md: 'text-xl font-bold',
    lg: 'text-3xl font-bold tracking-tight',
  };

  const variantStyles = {
    sunken: 'bg-(--paper-sunken) border-(--rule-hairline) focus-within:border-(--ink-primary)',
    surface: 'bg-(--paper-sheet) border-(--rule-hairline) focus-within:border-(--ink-primary) shadow-2xs',
    ghost: 'bg-transparent border-b border-dashed border-(--rule-hairline) focus-within:border-(--ink-primary) rounded-none px-0',
  };

  return (
    <div
      className={cn(
        'flex items-center border transition-all duration-150 select-none',
        sizeContainerStyles[size],
        variantStyles[variant],
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span
        className={cn(
          'shrink-0 font-mono text-(--ink-tertiary) transition-colors select-none',
          sizeSymbolStyles[size]
        )}
      >
        {currencySymbol}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.key === 'Process' || e.keyCode === 229) return;
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'size-full flex-1 border-none bg-transparent py-0 font-mono leading-none text-(--ink-primary) tabular-nums outline-none placeholder:text-(--ink-faint)',
          sizeInputStyles[size]
        )}
      />
    </div>
  );
};

export default AmountInput;
