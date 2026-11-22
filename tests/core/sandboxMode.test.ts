import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isSandboxModeActive,
  getActiveDbName,
  setSandboxMode,
  DB_NAME_PRODUCTION,
  DB_NAME_SANDBOX,
} from '../../src/core/db/schema';
import { getSandboxSeedData } from '../../src/core/db/defaultData';

describe('Sandbox Mode and Database Isolation', () => {
  const originalLocation = window.location;
  const reloadSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    reloadSpy.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        href: 'http://localhost/',
        pathname: '/',
        search: '',
        reload: reloadSpy,
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('defaults to production database when sandbox mode is off', () => {
    expect(isSandboxModeActive()).toBe(false);
    expect(getActiveDbName()).toBe(DB_NAME_PRODUCTION);
  });

  it('activates sandbox mode and targets sandbox database when localStorage flag is set', () => {
    localStorage.setItem('hamsterstash_sandbox_mode', 'true');
    expect(isSandboxModeActive()).toBe(true);
    expect(getActiveDbName()).toBe(DB_NAME_SANDBOX);
  });

  it('sets and removes sandbox mode flags correctly', () => {
    setSandboxMode(true);
    expect(localStorage.getItem('hamsterstash_sandbox_mode')).toBe('true');
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    setSandboxMode(false);
    expect(localStorage.getItem('hamsterstash_sandbox_mode')).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  it('generates enriched sandbox transactions including amortizations, offsets, loans, and initial balances', () => {
    const { sampleAccounts, sampleTransactions } = getSandboxSeedData('2026-11-22T20:00:00.000Z');
    expect(sampleAccounts.length).toBeGreaterThanOrEqual(4);
    expect(sampleTransactions.length).toBeGreaterThanOrEqual(20);

    const amortized = sampleTransactions.filter((t) => t.ext?.amortize);
    expect(amortized.length).toBeGreaterThanOrEqual(2);

    const offsetTxs = sampleTransactions.filter((t) => t.offsetTransactionId);
    expect(offsetTxs.length).toBeGreaterThanOrEqual(1);

    const loans = sampleTransactions.filter((t) => t.type === 'loan');
    expect(loans.length).toBeGreaterThanOrEqual(2);

    const initialBalances = sampleTransactions.filter((t) => t.note === '初始余额');
    expect(initialBalances.length).toBeGreaterThanOrEqual(2);
  });
});
