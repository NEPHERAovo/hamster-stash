import React from 'react';
import { ArrowLeftIcon as ArrowLeft, ArrowRightIcon as ArrowRight, PlusIcon as Plus } from '@phosphor-icons/react';
import { PaperButton } from '../../ui/PaperButton';
import { PaperSelect } from '../../ui/PaperSelect';
import type {
  ExtractedCategoryStat,
  ExtractedTypeStat,
  PreFilterSummary,
} from '../../../domain/import-export/csvMapper';
import type { Category } from '../../../types/category';
import type { TransactionType } from '../../../types/transaction';

export interface ImportStep3CategoryMatchProps {
  categories: Category[];
  extractedCategoryStats: ExtractedCategoryStat[];
  extractedTypeStats: ExtractedTypeStat[];
  preFilterSummary?: PreFilterSummary;
  categoryMapping: Record<string, string>;
  typeMapping: Record<string, TransactionType | 'skip'>;
  defaultExpenseCat: string;
  defaultIncomeCat: string;
  isCreatingCategory: boolean;
  onChangeCategoryMapping: (next: Record<string, string>) => void;
  onChangeTypeMapping: (next: Record<string, TransactionType | 'skip'>) => void;
  onCreateCategoryForRaw: (rawName: string, dominantType: TransactionType) => void;
  onBatchCreateMissingCategories: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export const ImportStep3CategoryMatch: React.FC<ImportStep3CategoryMatchProps> = ({
  categories,
  extractedCategoryStats,
  extractedTypeStats,
  preFilterSummary,
  categoryMapping,
  typeMapping,
  defaultExpenseCat,
  defaultIncomeCat,
  isCreatingCategory,
  onChangeCategoryMapping,
  onChangeTypeMapping,
  onCreateCategoryForRaw,
  onBatchCreateMissingCategories,
  onPrev,
  onNext,
}) => {
  const hasPreFilter = Boolean(
    preFilterSummary &&
      (preFilterSummary.filteredStatusCount > 0 ||
        preFilterSummary.wealthDailyRowCount > 0 ||
        preFilterSummary.invalidAmountCount > 0)
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3 text-xs shadow-xs">
        <span className="text-[11px] text-(--ink-secondary)">
          共解析出 {extractedCategoryStats.length} 个分类
        </span>
        <PaperButton
          variant="secondary"
          size="compact"
          leftIcon={<Plus className="size-3 text-(--color-income)" />}
          onClick={onBatchCreateMissingCategories}
          disabled={isCreatingCategory}
        >
          批量新建未匹配分类
        </PaperButton>
      </div>

      {extractedCategoryStats.length === 0 ? (
        <div className="rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) py-8 text-center text-xs text-(--ink-tertiary)">
          未指定分类列，将统一使用默认分类入库。
        </div>
      ) : (
        <div className="max-h-90 divide-y divide-(--rule-hairline) overflow-hidden overflow-y-auto rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
          {extractedCategoryStats.map((stat) => {
            const currentMappedCatId =
              categoryMapping[stat.rawName] ||
              stat.suggestedCategoryId ||
              (stat.dominantType === 'income' ? defaultIncomeCat : defaultExpenseCat);
            const isExactExistInSystem = categories.some(
              (c) => c.name.trim().toLowerCase() === stat.rawName.trim().toLowerCase()
            );

            return (
              <div key={stat.rawName} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                <div className="flex min-w-20 shrink-0 items-center gap-1.5">
                  <span className="max-w-32 leading-snug font-semibold break-words text-(--ink-primary)">
                    {stat.rawName}
                  </span>
                  <span className="text-[10px] text-(--ink-tertiary) tabular-nums">
                    ({stat.count})
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0 text-(--ink-tertiary)" />
                  <PaperSelect
                    value={currentMappedCatId}
                    onChange={(e) =>
                      onChangeCategoryMapping({
                        ...categoryMapping,
                        [stat.rawName]: e.target.value,
                      })
                    }
                    containerClassName="min-w-0 flex-1"
                    className="bg-(--paper-sunken)"
                  >
                    <optgroup label="支出">
                      {categories.filter((c) => c.type === 'expense').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="收入">
                      {categories.filter((c) => c.type === 'income').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  </PaperSelect>
                </div>

                {!isExactExistInSystem && (
                  <PaperButton
                    variant="secondary"
                    size="xs"
                    leftIcon={<Plus className="size-3 text-(--color-income)" />}
                    onClick={() => onCreateCategoryForRaw(stat.rawName, stat.dominantType)}
                    disabled={isCreatingCategory}
                    title="新建分类"
                  >
                    新建
                  </PaperButton>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasPreFilter && preFilterSummary && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) px-3.5 py-2.5 font-mono text-[11px] text-(--ink-secondary) tabular-nums shadow-xs">
          <span>已按规则预过滤</span>
          {preFilterSummary.filteredStatusCount > 0 && (
            <span>关闭/退款 {preFilterSummary.filteredStatusCount} 笔</span>
          )}
          {preFilterSummary.wealthDailyRowCount > 0 && (
            <span>理财日收益 {preFilterSummary.wealthDailyRowCount} 笔按月汇总</span>
          )}
          {preFilterSummary.invalidAmountCount > 0 && (
            <span>无效金额 {preFilterSummary.invalidAmountCount} 笔</span>
          )}
        </div>
      )}

      {extractedTypeStats.length > 0 && (
        <div className="divide-y divide-(--rule-hairline) rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-xs shadow-xs">
          {extractedTypeStats.map((t) => {
            const currentMappedType = typeMapping[t.rawName] || t.suggestedType;
            return (
              <div key={t.rawName} className="flex items-center justify-between gap-2 p-2.5">
                <span className="font-semibold text-(--ink-primary)">
                  {t.rawName} <span className="text-[10px] text-(--ink-tertiary)">({t.count}笔)</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="size-3.5 text-(--ink-tertiary)" />
                  <PaperSelect
                    value={currentMappedType}
                    onChange={(e) =>
                      onChangeTypeMapping({
                        ...typeMapping,
                        [t.rawName]: e.target.value as TransactionType | 'skip',
                      })
                    }
                    containerClassName="w-24"
                    className="bg-(--paper-sunken)"
                  >
                    <option value="expense">支出</option>
                    <option value="income">收入</option>
                    <option value="transfer">转账</option>
                    <option value="loan">借贷</option>
                    <option value="skip">跳过</option>
                  </PaperSelect>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <PaperButton variant="secondary" size="sm" onClick={onPrev}>
          <ArrowLeft className="mr-1 size-3.5" />
          <span>上一步</span>
        </PaperButton>
        <PaperButton variant="ink" size="sm" onClick={onNext}>
          <span>下一步：确认导入</span>
          <ArrowRight className="ml-1 size-3.5" />
        </PaperButton>
      </div>
    </div>
  );
};
