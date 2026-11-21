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
    <div className="pt-2 pb-1 border-t border-dashed border-(--rule-hairline)/60 space-y-1.5 select-none font-mono text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {AMORTIZE_PRESETS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onSelectMonths(opt.months)}
            className={cn(
              'px-2.5 py-1 text-xs font-mono rounded-(--btn-radius) transition-all cursor-pointer border',
              amortizeMonths === opt.months && !isCustomAmortize
                ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) font-semibold border-transparent shadow-2xs'
                : 'bg-(--paper-sunken)/70 text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) border-(--rule-hairline)/60'
            )}
          >
            {opt.label}
          </button>
        ))}

        {isCustomAmortize ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-(--btn-radius) bg-(--paper-sunken) border border-(--rule-hairline)">
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={120}
              autoFocus
              value={customAmortizeInput}
              onChange={(e) => onCustomAmortizeChange(e.target.value)}
              placeholder="期数"
              className="w-10 bg-transparent text-xs font-mono text-center font-semibold text-(--ink-primary) outline-none"
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
              'px-2.5 py-1 text-xs font-mono rounded-(--btn-radius) transition-all cursor-pointer border',
              amortizeMonths !== null && ![3, 6, 12, 24, 36].includes(amortizeMonths)
                ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) font-semibold border-transparent shadow-2xs'
                : 'bg-(--paper-sunken)/70 text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) border-(--rule-hairline)/60'
            )}
          >
            {amortizeMonths && ![3, 6, 12, 24, 36].includes(amortizeMonths)
              ? `${amortizeMonths}期`
              : '自定义'}
          </button>
        )}
      </div>

      {amortizeMonths && (
        <div className="text-[11px] font-mono text-(--ink-tertiary) px-0.5 text-right">
          <span>
            约 ¥{centsToYuan(Math.floor(yuanToCents(evaluateArithmetic(expr)) / amortizeMonths))} / 月
          </span>
        </div>
      )}
    </div>
  );
};

export default AmortizeTrayPanel;
