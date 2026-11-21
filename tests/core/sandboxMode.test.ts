import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isSandboxModeActive,
  getActiveDbName,
  setSandboxMode,
  DB_NAME_PRODUCTION,
  DB_NAME_SANDBOX,
} from '../../src/core/db/schema';

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
});
