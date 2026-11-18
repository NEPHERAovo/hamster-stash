import React, { useMemo, useState } from 'react';
import { PaperModal } from '../ui/PaperModal';
import { core } from '../../core';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { exportTransactionsToCsv } from '../../domain/import-export/csvMapper';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportRangeMode = 'all' | 'this_month' | 'last_3m' | 'this_year' | 'custom';

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => formatLocalDate(new Date()));
  const [isExporting, setIsExporting] = useState(false);

  const resolvedBounds = useMemo(() => {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    if (rangeMode === 'all') {
      return { start: null as string | null, end: null as string | null, label: '全部历史流水' };
    }
    if (rangeMode === 'this_month') {
      const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end: todayStr, label: `${start} 至 ${todayStr}` };
    }
    if (rangeMode === 'last_3m') {
      const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const start = formatLocalDate(startDate);
      return { start, end: todayStr, label: `${start} 至 ${todayStr}` };
    }
    if (rangeMode === 'this_year') {
      const start = `${today.getFullYear()}-01-01`;
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
      const suffix = start && end ? `${start}_${end}` : `all_${formatLocalDate(new Date())}`;
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
      subtitle="选择需要导出的时间范围"
    >
      <div className="p-4 space-y-4 select-none">
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => {
            const isSelected = rangeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeMode(opt.value)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-(--btn-radius) border transition-all cursor-pointer',
                  isSelected
                    ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) border-transparent font-semibold'
                    : 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline) hover:text-(--ink-primary)'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {rangeMode === 'custom' && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-(--ink-tertiary)">开始日期</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-(--ink-tertiary)">结束日期</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) outline-none"
              />
            </div>
          </div>
        )}

        <div className="p-3 rounded-(--radius-sm) bg-(--paper-sunken)/70 border border-dashed border-(--rule-hairline) text-xs font-mono space-y-1">
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
            className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isExporting || isRangeInvalid || matchedCount === 0}
            onClick={handleConfirmExport}
            className="flex-1 h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer disabled:opacity-45"
          >
            {isExporting ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </PaperModal>
  );
};

export default ExportCsvModal;
