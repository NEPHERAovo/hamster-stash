import { describe, it, expect } from 'vitest';
import {
  dayjs,
  formatDate,
  formatMonth,
  formatTime,
  formatMonthDayTime,
  stepYearMonth,
  addDaysToDate,
  parseLocalDate,
  combineLocalDateTimeToIso,
  parseCsvDateTime,
  getIsoWeekBounds,
} from '../../src/utils/date';

describe('Date utility wrapper (dayjs)', () => {
  it('formats dates, months, times, and month-day-time safely', () => {
    const sample = new Date(2026, 9, 8, 9, 5, 0);
    expect(formatDate(sample)).toBe('2026-10-08');
    expect(formatMonth(sample)).toBe('2026-10');
    expect(formatTime(sample)).toBe('09:05');
    expect(formatMonthDayTime(sample)).toBe('10-08 09:05');

    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatTime('invalid-date')).toBe('');
    expect(formatMonthDayTime(null)).toBe('');
  });

  it('steps year-month safely across year boundaries without day overflow', () => {
    expect(stepYearMonth('2026-01', -1)).toBe('2025-12');
    expect(stepYearMonth('2026-12', 1)).toBe('2027-01');
    expect(stepYearMonth('2026-03', -1)).toBe('2026-02');
    expect(stepYearMonth('2026-10', -3)).toBe('2026-07');
  });

  it('calculates shifted dates from a specified base date safely', () => {
    expect(addDaysToDate('2026-09-15', -30)).toBe('2026-08-16');
    expect(addDaysToDate('2026-09-15', 30)).toBe('2026-10-15');
    expect(addDaysToDate('2026-01-05', -10)).toBe('2025-12-26');
  });

  it('combines local date and time into an ISO timestamp without UTC shift', () => {
    const iso = combineLocalDateTimeToIso('2026-10-08', '19:19');
    expect(formatDate(iso)).toBe('2026-10-08');
    expect(formatTime(iso)).toBe('19:19');

    const earlyMorningIso = combineLocalDateTimeToIso('2026-10-08', '00:15');
    expect(formatDate(earlyMorningIso)).toBe('2026-10-08');
    expect(formatTime(earlyMorningIso)).toBe('00:15');
  });

  it('parses diverse CSV datetime strings and leaves date-only values without createdAt', () => {
    const slashHm = parseCsvDateTime('2026/10/08 19:19');
    expect(slashHm.date).toBe('2026-10-08');
    expect(slashHm.createdAt).toBeDefined();
    expect(formatTime(slashHm.createdAt)).toBe('19:19');

    const singleDigit = parseCsvDateTime('2026/9/5 9:05');
    expect(singleDigit.date).toBe('2026-09-05');
    expect(formatTime(singleDigit.createdAt)).toBe('09:05');

    const dashHms = parseCsvDateTime('2026-10-08 08:05:30');
    expect(dashHms.date).toBe('2026-10-08');
    expect(dayjs(dashHms.createdAt).second()).toBe(30);

    const dotHm = parseCsvDateTime('2026.10.08 14:22');
    expect(dotHm.date).toBe('2026-10-08');
    expect(formatTime(dotHm.createdAt)).toBe('14:22');

    const dateOnly = parseCsvDateTime('2026-10-08');
    expect(dateOnly.date).toBe('2026-10-08');
    expect(dateOnly.createdAt).toBeUndefined();

    const isoUtc = parseCsvDateTime('2026-10-08T11:19:00.000Z');
    expect(isoUtc.createdAt).toBe('2026-10-08T11:19:00.000Z');
  });

  it('computes ISO Monday-to-Sunday week bounds accurately including Sundays', () => {
    const friday = parseLocalDate('2026-10-09');
    const fridayWeek = getIsoWeekBounds(friday);
    expect(fridayWeek.start.format('YYYY-MM-DD')).toBe('2026-10-05');
    expect(fridayWeek.end.format('YYYY-MM-DD')).toBe('2026-10-11');

    const sunday = parseLocalDate('2026-10-11');
    const sundayWeek = getIsoWeekBounds(sunday);
    expect(sundayWeek.start.format('YYYY-MM-DD')).toBe('2026-10-05');
    expect(sundayWeek.end.format('YYYY-MM-DD')).toBe('2026-10-11');
    expect(sundayWeek.weekNumber).toBe(fridayWeek.weekNumber);
  });
});
