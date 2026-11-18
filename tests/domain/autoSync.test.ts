import { describe, it, expect } from 'vitest';
import { SyncService } from '../../src/domain/sync/syncService';
import type { WebDavConfig } from '../../src/domain/sync/webdavClient';

describe('WebDAV daily auto-sync scheduler', () => {
  const service = new SyncService();
  const validConfig: WebDavConfig = {
    url: 'https://dav.example.com/dav/',
    username: 'demo',
    password: 'secret',
  };

  it('skips auto-sync when disabled or credentials are incomplete', () => {
    expect(service.shouldRunDailyAutoSync(validConfig, false, undefined, '2026-11-18')).toBe(false);
    expect(service.shouldRunDailyAutoSync(null, true, undefined, '2026-11-18')).toBe(false);
    expect(
      service.shouldRunDailyAutoSync({ url: 'https://dav.example.com', username: '', password: '' }, true, undefined, '2026-11-18')
    ).toBe(false);
  });

  it('runs auto-sync when never synced or last sync was on a previous local day', () => {
    expect(service.shouldRunDailyAutoSync(validConfig, true, undefined, '2026-11-18')).toBe(true);
    const yesterday = new Date(2026, 10, 17, 22, 0, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, yesterday, '2026-11-18')).toBe(true);
  });

  it('skips auto-sync when already synced today', () => {
    const todayMorning = new Date(2026, 10, 18, 8, 30, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, todayMorning, '2026-11-18')).toBe(false);
  });
});
