import { describe, it, expect } from 'vitest';

async function loadBumpHelper() {
  const mod = (await import('../../scripts/bump-version.mjs')) as unknown as {
    computeNextVersion: (currentVersion: string, now?: Date) => string;
    formatShanghaiDateYYMMDD: (now?: Date) => string;
  };
  return mod;
}

describe('bump-version script', () => {
  it('increments the two-digit sequence when building again on the same Shanghai date', async () => {
    const { computeNextVersion } = await loadBumpHelper();
    const sameDay = new Date('2026-11-26T10:00:00.000+08:00');

    expect(computeNextVersion('1.0.26112601', sameDay)).toBe('1.0.26112602');
    expect(computeNextVersion('1.0.26112609', sameDay)).toBe('1.0.26112610');
  });

  it('resets the daily sequence to 01 on a new Shanghai calendar day and preserves major.minor', async () => {
    const { computeNextVersion } = await loadBumpHelper();
    const nextDay = new Date('2026-11-27T08:00:00.000+08:00');

    expect(computeNextVersion('1.0.26112609', nextDay)).toBe('1.0.26112701');
    expect(computeNextVersion('2.3.26112604', nextDay)).toBe('2.3.26112701');
  });

  it('uses Asia/Shanghai timezone boundaries across UTC midnight', async () => {
    const { computeNextVersion, formatShanghaiDateYYMMDD } = await loadBumpHelper();
    const shanghaiMidnightCrossed = new Date('2026-11-26T16:30:00.000Z');

    expect(formatShanghaiDateYYMMDD(shanghaiMidnightCrossed)).toBe('261127');
    expect(computeNextVersion('1.0.26112602', shanghaiMidnightCrossed)).toBe('1.0.26112701');
  });
});
