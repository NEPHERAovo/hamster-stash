import { nowTime } from '../../../utils/date';

export const COMMON_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
export const TIME_ITEM_HEIGHT = 32;

export function normalizeTimeString(rawTime?: string): string {
  if (!rawTime) return nowTime();
  const [h = '00', m = '00'] = rawTime.slice(0, 5).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}
