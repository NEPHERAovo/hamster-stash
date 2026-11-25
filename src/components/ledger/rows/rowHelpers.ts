import { dayjs, formatTime, parseLocalDate } from '../../../utils/date';
import { cn } from '../../../utils/cn';

export function formatRowDateTime(dateStr?: string, createdAt?: string, showDate = false): string {
  const clock = formatTime(createdAt) || '12:00';
  if (!showDate || !dateStr) return clock;
  const parsed = parseLocalDate(dateStr);
  if (!parsed.isValid()) return `${dateStr} ${clock}`;
  const isSameYear = parsed.year() === dayjs().year();
  return `${parsed.format(isSameYear ? 'MM-DD' : 'YYYY-MM-DD')} ${clock}`;
}

export function getBaseRowClass(isFresh = false, isLastInGroup = false, className?: string): string {
  return cn(
    'entry-row relative flex cursor-pointer items-center justify-between px-3.5 py-2 transition-all duration-150 select-none',
    'border-b border-dashed border-(--rule-hairline)/60 hover:bg-(--paper-hover)/50 active:bg-(--paper-sunken)/40',
    isFresh && 'fresh-entry',
    isLastInGroup && 'border-b-0',
    className
  );
}
