import React from 'react';
import type { Category } from '../../types/category';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { PaperButton } from '../ui/PaperButton';
import { cn } from '../../utils/cn';
import { LOAN_FLOW_OPTIONS } from './loanFlowOptions';

export interface CategoryStampGridProps {
  txType: 'expense' | 'income' | 'loan';
  categories: Category[];
  selectedCatId: string;
  selectedLoanFlowId: string;
  isCompact: boolean;
  onSelectCategory: (id: string) => void;
}

export const CategoryStampGrid: React.FC<CategoryStampGridProps> = ({
  txType,
  categories,
  selectedCatId,
  selectedLoanFlowId,
  isCompact,
  onSelectCategory,
}) => {
  return (
    <div className="px-3.5 py-1.5">
      {txType === 'loan' ? (
        <div className="category-grid grid grid-cols-4 gap-0 py-0.5 select-none">
          {LOAN_FLOW_OPTIONS.map((flow, idx) => {
            const isSelected = selectedLoanFlowId === flow.id;
            const IconComp = getCategoryIcon(flow.icon);
            const hasRightBorder = idx < 3;

            return (
              <PaperButton
                key={flow.id}
                variant={isSelected ? 'sunken' : 'ghost'}
                size="compact"
                onClick={() => onSelectCategory(flow.id)}
                className={cn(
                  'relative flex h-auto flex-col items-center justify-center rounded-none border-t-0 border-l-0 px-1 py-2 font-normal',
                  hasRightBorder ? 'border-r border-dotted border-(--rule-hairline)' : 'border-r-0',
                  isSelected && 'z-10 font-semibold text-(--ink-solid) shadow-2xs ring-1 ring-(--rule-hairline) ring-inset'
                )}
              >
                <div className="mb-0.5 flex size-7 shrink-0 items-center justify-center">
                  <IconComp
                    className={cn(
                      'stroke-1.8 size-4.5',
                      flow.isInflow ? 'text-(--color-income)' : 'text-(--color-expense)'
                    )}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] leading-tight">
                  {flow.label}
                </span>
              </PaperButton>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(
            '[scrollbar-width:thin] overflow-x-hidden overflow-y-auto pr-0.5 transition-[max-height] duration-200 ease-out',
            isCompact ? 'max-h-[16vh]' : 'max-h-[38vh]'
          )}
        >
          <div className="category-grid grid grid-cols-4 gap-0 py-0.5 select-none">
            {categories.map((cat, idx) => {
              const isSelected = selectedCatId === cat.id;
              const IconComp = getCategoryIcon(cat.icon);
              const col = idx % 4;
              const row = Math.floor(idx / 4);
              const totalRows = Math.ceil(categories.length / 4);
              const hasRightBorder = col < 3;
              const hasBottomBorder = row < totalRows - 1;
              let iconColor = 'text-(--ink-secondary)';
              if (isSelected) {
                iconColor = 'text-(--ink-solid)';
              } else if (txType === 'income') {
                iconColor = 'text-(--color-income)';
              }

              return (
                <PaperButton
                  key={cat.id}
                  variant={isSelected ? 'sunken' : 'ghost'}
                  size="compact"
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'relative flex h-auto flex-col items-center justify-center rounded-none border-t-0 border-l-0 px-1 py-2 font-normal',
                    hasRightBorder ? 'border-r border-dotted border-(--rule-hairline)' : 'border-r-0',
                    hasBottomBorder ? 'border-b border-dotted border-(--rule-hairline)' : 'border-b-0',
                    isSelected && 'z-10 font-semibold text-(--ink-solid) shadow-2xs ring-1 ring-(--rule-hairline) ring-inset'
                  )}
                >
                  <div className="mb-0.5 flex size-7 shrink-0 items-center justify-center">
                    <IconComp className={cn('stroke-1.8 size-4.5', iconColor)} />
                  </div>
                  <span className="w-full truncate text-center text-[10px] leading-tight">
                    {cat.name}
                  </span>
                </PaperButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
