import React from 'react';
import { evaluateArithmetic } from '../../utils/math';
import { yuanToCents, centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';

export interface AmortizeTrayPanelProps {
  expr: string;
  amortizeMonths: number | null;
  isCustomAmortize: boolean;
  customAmortizeInput: string;
  onSelectMonths: (months: number | null) => void;
  onCustomAmortizeToggle: (active: boolean, initialVal: string) => void;
  onCustomAmortizeChange: (val: string) => void;
}

const AMORTIZE_PRESETS = [
  { label: '不分期', months: null },
  { label: '3期', months: 3 },
  { label: '6期', months: 6 },
  { label: '12期', months: 12 },
  { label: '24期', months: 24 },
  { label: '36期', months: 36 },
];

export const AmortizeTrayPanel: React.FC<AmortizeTrayPanelProps> = ({
  expr,
  amortizeMonths,
  isCustomAmortize,
  customAmortizeInput,
  onSelectMonths,
  onCustomAmortizeToggle,
  onCustomAmortizeChange,
}) => {
  return (
    <div className="picker-fade-enter space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs select-none">
      <div className="flex flex-wrap items-center gap-1.5">
        {AMORTIZE_PRESETS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onSelectMonths(opt.months)}
            className={cn(
              'cursor-pointer rounded-(--btn-radius) border px-2.5 py-1 font-mono text-xs transition-all',
              amortizeMonths === opt.months && !isCustomAmortize
                ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg) shadow-2xs'
                : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
            )}
          >
            {opt.label}
          </button>
        ))}

        {isCustomAmortize ? (
          <div className="flex items-center gap-1 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2 py-0.5">
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={120}
              autoFocus
              value={customAmortizeInput}
              onChange={(e) => onCustomAmortizeChange(e.target.value)}
              placeholder="期数"
              className="w-10 bg-transparent text-center font-mono text-xs font-semibold text-(--ink-primary) outline-none"
            />
            <span className="text-[11px] text-(--ink-tertiary)">期</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              const initVal =
                amortizeMonths && ![3, 6, 12, 24, 36].includes(amortizeMonths)
                  ? String(amortizeMonths)
                  : '';
              onCustomAmortizeToggle(true, initVal);
            }}
            className={cn(
              'cursor-pointer rounded-(--btn-radius) border px-2.5 py-1 font-mono text-xs transition-all',
              amortizeMonths !== null && ![3, 6, 12, 24, 36].includes(amortizeMonths)
                ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg) shadow-2xs'
                : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
            )}
          >
            {amortizeMonths && ![3, 6, 12, 24, 36].includes(amortizeMonths)
              ? `${amortizeMonths}期`
              : '自定义'}
          </button>
        )}
      </div>

      {amortizeMonths && (
        <div className="px-0.5 text-right font-mono text-[11px] text-(--ink-tertiary)">
          <span>
            约 ¥{centsToYuan(Math.floor(yuanToCents(evaluateArithmetic(expr)) / amortizeMonths))} / 月
          </span>
        </div>
      )}
    </div>
  );
};

export default AmortizeTrayPanel;
