import React, { useState } from 'react';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { PaperButton, type PaperButtonProps } from './PaperButton';
import {
  PaperDatePickerModal,
  type DateRangeValue,
} from './PaperDatePickerModal';

export interface PaperDateFieldBaseProps {
  placeholder?: string;
  displayText?: string;
  title?: string;
  minDate?: string;
  maxDate?: string;
  size?: PaperButtonProps['size'];
  variant?: 'sunken' | 'secondary';
  iconPosition?: 'left' | 'right';
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export type PaperDateFieldProps =
  | (PaperDateFieldBaseProps & {
      mode?: 'date' | 'datetime';
      value: string;
      onChange: (value: string) => void;
      rangeValue?: never;
      onRangeChange?: never;
    })
  | (PaperDateFieldBaseProps & {
      mode: 'range';
      rangeValue: DateRangeValue;
      onRangeChange: (range: DateRangeValue) => void;
      value?: never;
      onChange?: never;
    });

export const PaperDateField: React.FC<PaperDateFieldProps> = (props) => {
  const {
    placeholder = '选择日期',
    displayText,
    title,
    minDate,
    maxDate,
    size = 'sm',
    variant = 'sunken',
    iconPosition = 'left',
    className,
    disabled = false,
  } = props;
  const ariaLabel = props['aria-label'];
  const [isOpen, setIsOpen] = useState(false);

  const iconClass = cn(
    'shrink-0 text-(--ink-tertiary)',
    size === 'sm' ? 'size-3' : 'size-4'
  );
  const iconNode = <CalendarBlank className={iconClass} />;

  let resolvedText = displayText;
  if (resolvedText === undefined) {
    if (props.mode === 'range') {
      resolvedText = `${props.rangeValue.start} 至 ${props.rangeValue.end}`;
    } else {
      resolvedText = props.value || placeholder;
    }
  }

  return (
    <>
      <PaperButton
        type="button"
        variant={variant}
        size={size}
        fullWidth
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(true)}
        leftIcon={iconPosition === 'left' ? iconNode : undefined}
        rightIcon={iconPosition === 'right' ? iconNode : undefined}
        className={cn(
          iconPosition === 'right' ? 'justify-between font-normal' : 'justify-start gap-2',
          variant === 'sunken' && 'border-(--rule-hairline) px-2.5 hover:border-(--border-strong)',
          'font-mono text-xs text-(--ink-primary)',
          className
        )}
      >
        <span className="truncate">{resolvedText}</span>
      </PaperButton>

      {props.mode === 'range' ? (
        <PaperDatePickerModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          mode="range"
          title={title}
          minDate={minDate}
          maxDate={maxDate}
          rangeValue={props.rangeValue}
          onRangeChange={props.onRangeChange}
        />
      ) : (
        <PaperDatePickerModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          mode={props.mode ?? 'date'}
          title={title}
          minDate={minDate}
          maxDate={maxDate}
          value={props.value}
          onChange={props.onChange}
        />
      )}
    </>
  );
};

export default PaperDateField;
