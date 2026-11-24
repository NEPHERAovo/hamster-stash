import { dayjs } from '../../utils/date';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';

export interface CategoryPredictOptions {
  transactions: Transaction[];
  categories: Category[];
  targetTime?: string | Date;
  txType: 'expense' | 'income';
  lookbackDays?: number;
}

function extractHourDecimal(timeInput?: string | Date): number {
  if (!timeInput) {
    const now = dayjs();
    return now.hour() + now.minute() / 60;
  }
  if (typeof timeInput === 'string' && /^\d{1,2}:\d{2}$/.test(timeInput)) {
    const [h, m] = timeInput.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  const d = dayjs(timeInput);
  if (d.isValid()) {
    return d.hour() + d.minute() / 60;
  }
  const now = dayjs();
  return now.hour() + now.minute() / 60;
}

function getCircularHourDiff(h1: number, h2: number): number {
  const rawDiff = Math.abs(h1 - h2);
  return Math.min(rawDiff, 24 - rawDiff);
}

function getTimeSlotWeight(deltaHours: number): number {
  if (deltaHours <= 1.0) {
    return 3.0;
  }
  if (deltaHours <= 2.0) {
    return 2.0;
  }
  if (deltaHours <= 3.0) {
    return 1.0;
  }
  return 0;
}

function getRecencyWeight(diffDays: number): number {
  if (diffDays <= 30) {
    return 1.5;
  }
  if (diffDays <= 90) {
    return 1.0;
  }
  return 0.6;
}

export function predictFrequentCategory(options: CategoryPredictOptions): string | null {
  const { transactions, categories, targetTime, txType, lookbackDays = 180 } = options;

  const validCategories = categories.filter(
    (c) => c.type === txType && !c.isArchived
  );
  if (validCategories.length === 0) {
    return null;
  }

  const validCatIds = new Set(validCategories.map((c) => c.id));
  const targetHour = extractHourDecimal(targetTime);
  const now = dayjs();

  const slotScores = new Map<string, number>();
  const overallScores = new Map<string, number>();
  const latestTxTimes = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== txType || !validCatIds.has(tx.categoryId)) {
      continue;
    }

    const txDate = tx.date ? dayjs(tx.date) : dayjs(tx.createdAt);
    const diffDays = Math.max(0, now.diff(txDate, 'day'));
    if (diffDays > lookbackDays) {
      continue;
    }

    const recencyWeight = getRecencyWeight(diffDays);
    const currentOverall = overallScores.get(tx.categoryId) ?? 0;
    overallScores.set(tx.categoryId, currentOverall + recencyWeight);

    const txTimeValue = tx.createdAt ? dayjs(tx.createdAt).valueOf() : txDate.valueOf();
    const prevLatest = latestTxTimes.get(tx.categoryId) ?? 0;
    if (txTimeValue > prevLatest) {
      latestTxTimes.set(tx.categoryId, txTimeValue);
    }

    if (tx.createdAt) {
      const parsedCreated = dayjs(tx.createdAt);
      if (parsedCreated.isValid()) {
        const txHour = parsedCreated.hour() + parsedCreated.minute() / 60;
        const delta = getCircularHourDiff(txHour, targetHour);
        const timeWeight = getTimeSlotWeight(delta);
        if (timeWeight > 0) {
          const currentSlot = slotScores.get(tx.categoryId) ?? 0;
          slotScores.set(tx.categoryId, currentSlot + timeWeight * recencyWeight);
        }
      }
    }
  }

  const pickBest = (scores: Map<string, number>): string | null => {
    let bestCatId: string | null = null;
    let highestScore = 0;
    let newestTime = 0;

    for (const [catId, score] of scores.entries()) {
      const time = latestTxTimes.get(catId) ?? 0;
      if (score > highestScore) {
        highestScore = score;
        newestTime = time;
        bestCatId = catId;
      } else if (Math.abs(score - highestScore) < 0.0001 && time > newestTime) {
        newestTime = time;
        bestCatId = catId;
      }
    }

    return bestCatId;
  };

  const bestSlotCatId = pickBest(slotScores);
  if (bestSlotCatId) {
    return bestSlotCatId;
  }

  return pickBest(overallScores);
}
