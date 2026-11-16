import React from 'react';
import { X } from 'lucide-react';
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
          'relative flex items-center h-10 px-3 border transition-all duration-200 rounded-(--input-radius)',
          variantStyles[variant],
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {leftIcon && (
          <span className="shrink-0 mr-2 text-(--ink-tertiary) flex items-center">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          value={value}
          disabled={disabled}
          className="flex-1 w-full bg-transparent border-none outline-none text-sm text-(--ink-primary) placeholder:text-(--ink-faint)"
          {...props}
        />

        {clearable && hasValue && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 ml-1 p-0.5 rounded-full text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5 stroke-2" />
          </button>
        )}

        {rightIcon && (
          <span className="shrink-0 ml-2 text-(--ink-tertiary) flex items-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

PaperInput.displayName = 'PaperInput';

export default PaperInput;
