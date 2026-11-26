import React, { useMemo, useState } from 'react';
import {
  WarningCircleIcon as AlertCircle,
  ArrowLeftIcon as ArrowLeft,
  ArrowsClockwiseIcon as RefreshCw,
  FolderSimpleIcon as FolderSync,
} from '@phosphor-icons/react';
import { PaperButton } from '../../ui/PaperButton';
import { PaperChip } from '../../ui/PaperChip';
import { PaperSelect } from '../../ui/PaperSelect';
import { PaperSwitch } from '../../ui/PaperSwitch';
import { SegToggle } from '../../ui/SegToggle';
import { centsToYuan } from '../../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../../utils/categoryIcons';
import { formatTime } from '../../../utils/date';
import { cn } from '../../../utils/cn';
import type {
  PreparedImportRecord,
  SkippedImportItem,
  SkippedReason,
} from '../../../domain/import-export/csvMapper';
import type { Account } from '../../../types/account';
import type { Category } from '../../../types/category';

export interface ImportStep4PreviewProps {
  accounts: Account[];
  categories: Category[];
  defaultAccountId: string;
  onChangeDefaultAccountId: (id: string) => void;
  autoCreateAccounts: boolean;
  onChangeAutoCreateAccounts: (checked: boolean) => void;
  isReimbursementEnabled: boolean;
  previewData: PreparedImportRecord[];
  totalRowsCount: number;
  effectiveCount?: number;
  skippedCount?: number;
  duplicateCount?: number;
  filteredStatusCount?: number;
  neutralCount?: number;
  wealthRollupCount?: number;
  wealthDailyRowCount?: number;
  skippedItems?: SkippedImportItem[];
  isImporting: boolean;
  onPrev: () => void;
  onConfirmImport: () => void;
}

export const ImportStep4Preview: React.FC<ImportStep4PreviewProps> = ({
  accounts,
  categories,
  defaultAccountId,
  onChangeDefaultAccountId,
  autoCreateAccounts,
  onChangeAutoCreateAccounts,
  isReimbursementEnabled,
  previewData,
  totalRowsCount,
  effectiveCount,
  skippedCount = 0,
  duplicateCount = 0,
  filteredStatusCount = 0,
  neutralCount = 0,
  wealthRollupCount = 0,
  skippedItems = [],
  isImporting,
  onPrev,
  onConfirmImport,
}) => {
  const finalImportCount = effectiveCount ?? totalRowsCount;
  const [activeTab, setActiveTab] = useState<'preview' | 'skipped'>('preview');
  const [skippedFilter, setSkippedFilter] = useState<'all' | SkippedReason>('all');
  const [showAllSkipped, setShowAllSkipped] = useState(false);

  const filteredSkipped = useMemo(() => {
    if (skippedFilter === 'all') return skippedItems;
    return skippedItems.filter((item) => item.reason === skippedFilter);
  }, [skippedItems, skippedFilter]);

  const filterChips = useMemo(() => {
    const counts = {
      neutral: 0,
      status: 0,
      duplicate: 0,
      invalid: 0,
    };
    for (const item of skippedItems) {
      counts[item.reason] += 1;
    }
    const items: { key: 'all' | SkippedReason; label: string; count: number }[] = [
      { key: 'all', label: '全部', count: skippedItems.length },
      { key: 'neutral', label: '不计收支', count: counts.neutral },
      { key: 'status', label: '关闭/退款', count: counts.status },
      { key: 'duplicate', label: '重复', count: counts.duplicate },
    ];
    return items.filter((item) => item.key === 'all' || item.count > 0);
  }, [skippedItems]);

  const visibleSkipped = showAllSkipped ? filteredSkipped : filteredSkipped.slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 text-xs shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="block font-semibold text-(--ink-primary)">默认入账账户</span>
            <span className="text-[10px] text-(--ink-tertiary)">未指定账户时归属此项</span>
          </div>
          <PaperSelect
            value={defaultAccountId}
            onChange={(e) => onChangeDefaultAccountId(e.target.value)}
            containerClassName="max-w-40"
            className="bg-(--paper-sunken)"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </PaperSelect>
        </div>

        <div className="flex items-center justify-between border-t border-(--rule-hairline) pt-2.5">
          <span className="font-semibold text-(--ink-primary)">
            自动创建表格中出现的新账户
          </span>
          <PaperSwitch
            checked={autoCreateAccounts}
            onChange={onChangeAutoCreateAccounts}
            aria-label="自动创建表格中出现的新账户"
          />
        </div>
      </div>

      {(skippedCount > 0 || duplicateCount > 0 || wealthRollupCount > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) px-3.5 py-2.5 font-mono text-[11px] tabular-nums shadow-xs">
          <span className="inline-flex items-center rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 font-semibold text-(--ink-primary)">
            待导入 {finalImportCount} 笔
          </span>
          {wealthRollupCount > 0 && (
            <span className="inline-flex items-center rounded-(--badge-radius) bg-(--color-income-bg) px-2 py-0.5 text-(--color-income)">
              含理财月结 {wealthRollupCount} 笔
            </span>
          )}
          {neutralCount > 0 && (
            <span className="inline-flex items-center rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 text-(--ink-secondary)">
              不计收支 {neutralCount} 笔
            </span>
          )}
          {filteredStatusCount > 0 && (
            <span className="inline-flex items-center rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 text-(--ink-secondary)">
              关闭/退款 {filteredStatusCount} 笔
            </span>
          )}
          {duplicateCount > 0 && (
            <span className="inline-flex items-center rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 text-(--ink-secondary)">
              重复 {duplicateCount} 笔
            </span>
          )}
          {neutralCount === 0 && filteredStatusCount === 0 && skippedCount > 0 && (
            <span className="inline-flex items-center rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 text-(--ink-secondary)">
              过滤/跳过 {skippedCount} 笔
            </span>
          )}
        </div>
      )}

      {skippedItems.length > 0 && (
        <SegToggle
          size="sm"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'preview', label: `待导入 (${finalImportCount})` },
            { value: 'skipped', label: `不计收支/跳过 (${skippedItems.length})` },
          ]}
        />
      )}

      {previewData.some((r) => r.isReimbursable) && !isReimbursementEnabled && (
        <div className="flex items-center gap-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken) p-2.5 text-[11px] text-(--ink-secondary)">
          <AlertCircle className="size-3.5 shrink-0 text-(--ink-tertiary)" />
          <span>表格中包含待报销流水。当前设置中已停用报销功能，导入后可随时在设置中开启报销查看。</span>
        </div>
      )}

      {activeTab === 'preview' ? (
        <div className="divide-y divide-(--rule-hairline) overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
          <div className="bg-(--paper-sunken) px-3.5 py-2 text-[11px] font-semibold text-(--ink-tertiary)">
            数据预览 (前 {previewData.length} 笔)
          </div>
          {previewData.map((rec, i) => {
            const cat = categories.find((c) => c.id === rec.categoryId);
            const acct = accounts.find((a) => a.id === rec.accountId);
            const Icon = getCategoryIcon(cat?.icon || 'shopping-cart');
            const formattedTime = formatTime(rec.createdAt);
            const timePart = formattedTime ? ` ${formattedTime}` : '';

            return (
              <div key={i} className="flex items-start justify-between gap-2.5 p-2.5 text-xs">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                    <Icon className="stroke-1.8 size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-(--ink-primary)">
                        {cat?.name || rec.rawCategoryName || '默认'}
                      </span>
                      {rec.isWealthMonthlyRollup && (
                        <span className="rounded-(--badge-radius) bg-(--color-income-bg) px-1.5 py-0.5 text-[10px] font-medium text-(--color-income)">
                          月度汇总
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] leading-snug break-words text-(--ink-tertiary)">
                      {rec.date}
                      {timePart} · {rec.rawAccountName || acct?.name || '默认'}
                      {rec.note && ` · ${rec.note}`}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      'font-mono text-sm font-bold tabular-nums',
                      rec.type === 'income' ? 'text-(--color-income)' : 'text-(--color-expense)'
                    )}
                  >
                    {rec.type === 'income' ? '+' : '-'} ¥{centsToYuan(rec.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => (
              <PaperChip
                key={chip.key}
                size="xs"
                selected={skippedFilter === chip.key}
                onClick={() => {
                  setSkippedFilter(chip.key);
                  setShowAllSkipped(false);
                }}
              >
                {chip.label} ({chip.count})
              </PaperChip>
            ))}
          </div>

          <div className="max-h-80 divide-y divide-(--rule-hairline) overflow-y-auto rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
            {visibleSkipped.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2.5 p-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 text-[10px] font-medium text-(--ink-secondary)">
                      {item.reasonLabel}
                    </span>
                    <span className="font-semibold break-words text-(--ink-primary)">
                      {item.note || item.rawCategoryName || item.rawType || '未命名记录'}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] leading-snug break-words text-(--ink-tertiary)">
                    {item.date}
                    {item.rawAccountName && ` · ${item.rawAccountName}`}
                    {item.rawStatus && ` · ${item.rawStatus}`}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-xs font-semibold text-(--ink-secondary) tabular-nums">
                  ¥{centsToYuan(item.amount)}
                </div>
              </div>
            ))}
            {filteredSkipped.length > 30 && !showAllSkipped && (
              <div className="p-2 text-center">
                <PaperButton
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowAllSkipped(true)}
                >
                  展开全部 ({filteredSkipped.length} 笔)
                </PaperButton>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <PaperButton
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={isImporting}
        >
          <ArrowLeft className="mr-1 size-3.5" />
          <span>上一步</span>
        </PaperButton>
        <PaperButton
          variant="ink"
          size="sm"
          disabled={isImporting || finalImportCount === 0}
          onClick={onConfirmImport}
        >
          {isImporting ? (
            <>
              <RefreshCw className="mr-1 size-3.5 animate-spin" />
              <span>导入中...</span>
            </>
          ) : (
            <>
              <FolderSync className="mr-1 size-3.5" />
              <span>确认导入 ({finalImportCount} 笔)</span>
            </>
          )}
        </PaperButton>
      </div>
    </div>
  );
};
