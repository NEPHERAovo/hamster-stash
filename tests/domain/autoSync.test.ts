import { describe, it, expect } from 'vitest';
import { SyncService, stripInlineVoucherPayloads } from '../../src/domain/sync/syncService';
import type { WebDavConfig } from '../../src/domain/sync/webdavClient';
import type { ExportData } from '../../src/types/adapter';

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

  it('runs auto-sync when never synced or last sync was on a previous logical day after 06:00 AM', () => {
    expect(service.shouldRunDailyAutoSync(validConfig, true, undefined, new Date(2026, 10, 18, 8, 0, 0))).toBe(true);
    const yesterday = new Date(2026, 10, 17, 22, 0, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, yesterday, new Date(2026, 10, 18, 6, 0, 0))).toBe(true);
  });

  it('skips auto-sync late at night after midnight before 06:00 AM morning cutoff', () => {
    const lateEveningSync = new Date(2026, 10, 17, 22, 30, 0).toISOString();
    const pastMidnight = new Date(2026, 10, 18, 0, 30, 0);
    const beforeMorning = new Date(2026, 10, 18, 5, 59, 0);

    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, pastMidnight)).toBe(false);
    expect(service.shouldRunDailyAutoSync(validConfig, true, lateEveningSync, beforeMorning)).toBe(false);
  });

  it('skips auto-sync when already synced in the same logical day', () => {
    const todayMorning = new Date(2026, 10, 18, 8, 30, 0).toISOString();
    expect(service.shouldRunDailyAutoSync(validConfig, true, todayMorning, new Date(2026, 10, 18, 21, 0, 0))).toBe(false);
    expect(service.shouldRunDailyAutoSync(validConfig, true, todayMorning, new Date(2026, 10, 19, 1, 15, 0))).toBe(false);
  });

  it('strips inline base64 voucher payloads while retaining lightweight attachment references', () => {
    const payload: ExportData = {
      version: '4.0.0',
      exportedAt: '2026-11-18T10:00:00.000Z',
      accounts: [],
      categories: [],
      transactions: [
        {
          id: 'tx_1',
          type: 'expense',
          amount: 2500,
          categoryId: 'cat_food',
          accountId: 'acct_default',
          date: '2026-11-18',
          createdAt: '2026-11-18T10:00:00.000Z',
          updatedAt: '2026-11-18T10:00:00.000Z',
          voucher: {
            attachmentId: 'att_abcdef0123456789',
            name: 'invoice.jpg',
            size: '120 KB',
            mimeType: 'image/jpeg',
            fileUrl: 'data:image/jpeg;base64,HUGE_PAYLOAD',
          },
        },
      ],
    };

    const stripped = stripInlineVoucherPayloads(payload);
    expect(stripped.transactions[0].voucher?.attachmentId).toBe('att_abcdef0123456789');
    expect(stripped.transactions[0].voucher?.name).toBe('invoice.jpg');
    expect(stripped.transactions[0].voucher?.fileUrl).toBeUndefined();
    expect(JSON.stringify(stripped)).not.toContain('HUGE_PAYLOAD');
  });
});
