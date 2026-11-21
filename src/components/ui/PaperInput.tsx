import React from 'react';
import { XIcon as X } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export interface PaperInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  variant?: 'sunken' | 'surface' | 'ghost';
}

export const PaperInput = React.forwardRef<HTMLInputElement, PaperInputProps>(
  (
    {
      className,
      leftIcon,
      rightIcon,
      clearable = false,
      onClear,
      variant = 'sunken',
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      sunken: 'bg-(--paper-sunken) border-(--rule-hairline) focus-within:border-(--border-strong)',
      surface: 'paper-glass-blur bg-(--paper-sheet) border-(--rule-hairline) focus-within:border-(--border-strong) shadow-(--shadow-xs)',
      ghost: 'bg-transparent border-transparent focus-within:border-(--rule-strong) focus-within:bg-(--paper-sheet)',
    };

    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div
        className={cn(
          'relative flex h-10 items-center rounded-(--input-radius) border px-3 transition-all duration-200',
          variantStyles[variant],
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        {leftIcon && (
          <span className="mr-2 flex shrink-0 items-center text-(--ink-tertiary)">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          value={value}
          disabled={disabled}
          className="w-full flex-1 border-none bg-transparent text-sm text-(--ink-primary) outline-none placeholder:text-(--ink-faint)"
          {...props}
        />

        {clearable && hasValue && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 shrink-0 cursor-pointer rounded-full p-0.5 text-(--ink-tertiary) transition-colors hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
          >
            <X className="size-3.5 stroke-2" />
          </button>
        )}

        {rightIcon && (
          <span className="ml-2 flex shrink-0 items-center text-(--ink-tertiary)">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

PaperInput.displayName = 'PaperInput';

export default PaperInput;
