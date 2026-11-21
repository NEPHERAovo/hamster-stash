import React, { useMemo, useState } from 'react';
import { PaperModal } from '../ui/PaperModal';
import { core } from '../../core';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { exportTransactionsToCsv } from '../../domain/import-export/csvMapper';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';
import { dayjs, todayDate } from '../../utils/date';

export interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportRangeMode = 'all' | 'this_month' | 'last_3m' | 'this_year' | 'custom';

const RANGE_OPTIONS: { value: ExportRangeMode; label: string }[] = [
  { value: 'all', label: '全部数据' },
  { value: 'this_month', label: '本月' },
  { value: 'last_3m', label: '近 3 个月' },
  { value: 'this_year', label: '今年' },
  { value: 'custom', label: '自定义' },
];

export const ExportCsvModal: React.FC<ExportCsvModalProps> = ({ isOpen, onClose }) => {
  const allTransactions = useLedgerStore((s) => s.allTransactions);
  const [rangeMode, setRangeMode] = useState<ExportRangeMode>('all');
  const [customStart, setCustomStart] = useState(() =>
    dayjs().startOf('month').format('YYYY-MM-DD')
  );
  const [customEnd, setCustomEnd] = useState(() => todayDate());
  const [isExporting, setIsExporting] = useState(false);

  const resolvedBounds = useMemo(() => {
    const today = dayjs();
    const todayStr = today.format('YYYY-MM-DD');

    if (rangeMode === 'all') {
      return { start: null as string | null, end: null as string | null, label: '全部历史流水' };
    }
    if (rangeMode === 'this_month') {
      const start = today.startOf('month').format('YYYY-MM-DD');
      return { start, end: todayStr, label: `${start} 至 ${todayStr}` };
    }
    if (rangeMode === 'last_3m') {
      const start = today.subtract(2, 'month').startOf('month').format('YYYY-MM-DD');
      return { start, end: todayStr, label: `${start} 至 ${todayStr}` };
    }
    if (rangeMode === 'this_year') {
      const start = today.startOf('year').format('YYYY-MM-DD');
      return { start, end: todayStr, label: `${start} 至 ${todayStr}` };
    }
    return {
      start: customStart || null,
      end: customEnd || null,
      label: `${customStart || '不限'} 至 ${customEnd || '不限'}`,
    };
  }, [rangeMode, customStart, customEnd]);

  const matchedCount = useMemo(() => {
    const { start, end } = resolvedBounds;
    return allTransactions.filter((t) => {
      if (start && t.date < start) return false;
      if (end && t.date > end) return false;
      return true;
    }).length;
  }, [allTransactions, resolvedBounds]);

  const isRangeInvalid =
    rangeMode === 'custom' && Boolean(customStart && customEnd && customStart > customEnd);

  const handleConfirmExport = async () => {
    if (isRangeInvalid) {
      toast.error('开始日期不能晚于结束日期');
      return;
    }
    if (matchedCount === 0) {
      toast.warning('所选时间范围内暂无流水可导出');
      return;
    }

    setIsExporting(true);
    try {
      await core.init();
      const [txs, cats, accts] = await Promise.all([
        core.txRepo.findAll({ orderBy: 'date', orderDirection: 'desc' }),
        core.catRepo.findAll(),
        core.acctRepo.findAll(),
      ]);

      const { start, end } = resolvedBounds;
      const filtered = txs.filter((t) => {
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
      });

      const csvContent = exportTransactionsToCsv(filtered, cats, accts);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = start && end ? `${start}_${end}` : `all_${todayDate()}`;
      a.download = `HamsterStash_records_${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${filtered.length} 笔 CSV 流水`);
      onClose();
    } catch {
      toast.error('导出 CSV 账本失败');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="导出账本（CSV）"
    >
      <div className="space-y-4 p-4 select-none">
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => {
            const isSelected = rangeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeMode(opt.value)}
                className={cn(
                  'cursor-pointer rounded-(--btn-radius) border px-3 py-1.5 text-xs transition-all',
                  isSelected
                    ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                    : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {rangeMode === 'custom' && (
          <div className="picker-fade-enter grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="font-mono text-[11px] text-(--ink-tertiary)">开始日期</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 font-mono text-xs text-(--ink-primary) outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[11px] text-(--ink-tertiary)">结束日期</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 font-mono text-xs text-(--ink-primary) outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-1 rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/70 p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-(--ink-secondary)">
            <span>导出范围</span>
            <span className="text-(--ink-primary)">{resolvedBounds.label}</span>
          </div>
          <div className="flex items-center justify-between text-(--ink-secondary)">
            <span>预计导出</span>
            <span className="font-semibold text-(--ink-solid)">{matchedCount} 笔流水</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isExporting || isRangeInvalid || matchedCount === 0}
            onClick={handleConfirmExport}
            className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) disabled:opacity-45"
          >
            {isExporting ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </PaperModal>
  );
};

export default ExportCsvModal;
