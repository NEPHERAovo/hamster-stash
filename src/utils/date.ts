import dayjs, { type ConfigType, type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

const LOCAL_DATE_TIME_RE =
  /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?)?$/;

const TIMEZONE_SUFFIX_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const pad2 = (value: string) => value.padStart(2, '0');

export { dayjs };
export type { ConfigType, Dayjs };

export function todayDate(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function currentYearMonth(): string {
  return dayjs().format('YYYY-MM');
}

export function nowTime(): string {
  return dayjs().format('HH:mm');
}

export function formatDate(input: ConfigType | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const d = dayjs(input);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
}

export function formatMonth(input: ConfigType | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const d = dayjs(input);
  return d.isValid() ? d.format('YYYY-MM') : '';
}

export function formatTime(input: ConfigType | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const d = dayjs(input);
  return d.isValid() ? d.format('HH:mm') : '';
}

export function formatMonthDayTime(input: ConfigType | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const d = dayjs(input);
  return d.isValid() ? d.format('MM-DD HH:mm') : '';
}

export function addDaysToToday(offsetDays: number): string {
  return dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
}

export function stepYearMonth(yearMonth: string, offsetMonths: number): string {
  const base = dayjs(`${yearMonth}-01`, 'YYYY-MM-DD', true);
  if (!base.isValid()) return currentYearMonth();
  return base.add(offsetMonths, 'month').format('YYYY-MM');
}

export function parseLocalDate(dateStr: string): Dayjs {
  const strict = dayjs(dateStr, 'YYYY-MM-DD', true);
  if (strict.isValid()) return strict;
  return dayjs(dateStr);
}

export function combineLocalDateTimeToIso(dateStr: string, timeStr: string): string {
  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();

  for (const fmt of ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-M-D H:m:s', 'YYYY-M-D H:m']) {
    const parsed = dayjs(`${trimmedDate} ${trimmedTime}`, fmt, true);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
  }

  const dateOnly = dayjs(trimmedDate, 'YYYY-MM-DD', true);
  if (dateOnly.isValid()) {
    return dateOnly.hour(12).minute(0).second(0).millisecond(0).toISOString();
  }

  return dayjs().toISOString();
}

export function parseCsvDateTime(raw: string): { date: string; createdAt?: string } {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { date: todayDate() };
  }

  if (TIMEZONE_SUFFIX_RE.test(normalized)) {
    const isoParsed = dayjs(normalized);
    if (isoParsed.isValid()) {
      return {
        date: isoParsed.format('YYYY-MM-DD'),
        createdAt: isoParsed.toISOString(),
      };
    }
  }

  const match = normalized.match(LOCAL_DATE_TIME_RE);
  if (match) {
    const datePart = `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
    if (match[4] !== undefined && match[5] !== undefined) {
      const timePart = `${pad2(match[4])}:${pad2(match[5])}:${pad2(match[6] ?? '0')}`;
      const parsedDateTime = dayjs(`${datePart} ${timePart}`, 'YYYY-MM-DD HH:mm:ss', true);
      if (parsedDateTime.isValid()) {
        return {
          date: parsedDateTime.format('YYYY-MM-DD'),
          createdAt: parsedDateTime.toISOString(),
        };
      }
    }

    const parsedDate = dayjs(datePart, 'YYYY-MM-DD', true);
    if (parsedDate.isValid()) {
      return { date: parsedDate.format('YYYY-MM-DD') };
    }
  }

  return { date: todayDate() };
}

export function getIsoWeekBounds(input?: ConfigType): {
  start: Dayjs;
  end: Dayjs;
  weekNumber: number;
  weekYear: number;
} {
  const d = dayjs(input);
  const start = d.startOf('isoWeek');
  const end = d.endOf('isoWeek');
  return {
    start,
    end,
    weekNumber: start.isoWeek(),
    weekYear: start.isoWeekYear(),
  };
}
