import React, { useMemo, useState } from 'react';
import { CalendarBlankIcon as CalendarIcon } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { PaperChip } from '../ui/PaperChip';
import { PaperButton } from '../ui/PaperButton';
import { PaperDatePickerModal } from '../ui/PaperDatePickerModal';
import { dataLifecycleService } from '../../domain/data/dataLifecycleService';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { toast } from '../../stores/useToastStore';
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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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
      const { start, end } = resolvedBounds;
      const { csvContent, exportedCount } = await dataLifecycleService.exportCsvRange({
        start,
        end,
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = start && end ? `${start}_${end}` : `all_${todayDate()}`;
      a.download = `HamsterStash_records_${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${exportedCount} 笔 CSV 流水`);
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
      title="导出账本"
    >
      <div className="space-y-4 p-4 select-none">
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <PaperChip
              key={opt.value}
              selected={rangeMode === opt.value}
              onClick={() => setRangeMode(opt.value)}
            >
              {opt.label}
            </PaperChip>
          ))}
        </div>

        {rangeMode === 'custom' && (
          <div className="picker-fade-enter space-y-1">
            <label className="font-mono text-[11px] text-(--ink-tertiary)">自定义范围</label>
            <PaperButton
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setIsDatePickerOpen(true)}
              className="justify-between font-mono text-xs font-normal"
              rightIcon={<CalendarIcon className="size-4 text-(--ink-tertiary)" />}
            >
              <span>{customStart} 至 {customEnd}</span>
            </PaperButton>
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
          <PaperButton
            type="button"
            variant="sunken"
            className="flex-1"
            onClick={onClose}
          >
            取消
          </PaperButton>
          <PaperButton
            type="button"
            variant="primary"
            className="flex-1"
            disabled={isExporting || isRangeInvalid || matchedCount === 0}
            loading={isExporting}
            onClick={handleConfirmExport}
          >
            {isExporting ? '导出中...' : '确认导出'}
          </PaperButton>
        </div>
      </div>

      <PaperDatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        mode="range"
        rangeValue={{ start: customStart, end: customEnd }}
        onRangeChange={(range) => {
          setCustomStart(range.start);
          setCustomEnd(range.end);
        }}
      />
    </PaperModal>
  );
};

export default ExportCsvModal;
