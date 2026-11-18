import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { AttachmentStore } from '../../src/core/attachments/attachmentStore';

describe('Content-addressed AttachmentStore', () => {
  let adapter: MemoryAdapter;
  let store: AttachmentStore;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    store = new AttachmentStore(adapter);
  });

  it('deduplicates identical attachment payloads by content hash and excludes them from ledger JSON export', async () => {
    const sampleUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD=';
    const first = await store.saveAttachment({
      name: 'receipt-1.jpg',
      mimeType: 'image/jpeg',
      size: '12 KB',
      dataUrl: sampleUrl,
    });
    const second = await store.saveAttachment({
      name: 'receipt-copy.jpg',
      mimeType: 'image/jpeg',
      size: '12 KB',
      dataUrl: sampleUrl,
    });

    expect(first.id.startsWith('att_')).toBe(true);
    expect(second.id).toBe(first.id);

    const fetched = await store.getAttachment(first.id);
    expect(fetched?.dataUrl).toBe(sampleUrl);

    const all = await store.listAttachments();
    expect(all.length).toBe(1);

    const exported = await adapter.export();
    expect(JSON.stringify(exported)).not.toContain(sampleUrl);
  });
});
