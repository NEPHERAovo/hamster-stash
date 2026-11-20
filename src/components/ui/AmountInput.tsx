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
    sm: 'h-10 px-3 rounded-(--input-radius)',
    md: 'h-12 px-3.5 rounded-(--radius-md)',
    lg: 'h-14 px-4 rounded-(--radius-md)',
  };

  const sizeSymbolStyles = {
    sm: 'text-sm font-semibold mr-1.5',
    md: 'text-lg font-bold mr-2',
    lg: 'text-2xl font-bold mr-2.5',
  };

  const sizeInputStyles = {
    sm: 'text-sm font-semibold',
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
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'font-mono select-none text-(--ink-tertiary) shrink-0 transition-colors',
          sizeSymbolStyles[size]
        )}
      >
        {currencySymbol}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'flex-1 w-full bg-transparent font-mono tabular-nums outline-none text-(--ink-primary) placeholder:text-(--ink-faint)',
          sizeInputStyles[size]
        )}
      />
    </div>
  );
};

export default AmountInput;
