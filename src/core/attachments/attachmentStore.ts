import { core } from '../index';
import { STORES } from '../db/schema';
import type { DataAdapter, StoredEntity } from '../../types/adapter';

export interface AttachmentRecord extends StoredEntity {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  dataUrl: string;
}

function fallbackHashHex(content: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export async function computeAttachmentId(dataUrl: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const encoded = new TextEncoder().encode(dataUrl);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const bytes = new Uint8Array(digest).slice(0, 8);
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `att_${hex}`;
    } catch {
      void 0;
    }
  }
  return `att_${fallbackHashHex(dataUrl)}`;
}

export class AttachmentStore {
  private customAdapter?: DataAdapter;

  constructor(adapter?: DataAdapter) {
    this.customAdapter = adapter;
  }

  private async getAdapter(): Promise<DataAdapter> {
    if (this.customAdapter) return this.customAdapter;
    await core.init();
    return core.adapter;
  }

  async saveAttachment(input: {
    id?: string;
    name: string;
    mimeType: string;
    size: string;
    dataUrl: string;
  }): Promise<AttachmentRecord> {
    const adapter = await this.getAdapter();
    const id = input.id || (await computeAttachmentId(input.dataUrl));
    const existing = await adapter.read<AttachmentRecord>(STORES.ATTACHMENTS, id);
    if (existing) {
      return existing;
    }
    return adapter.create<AttachmentRecord>(STORES.ATTACHMENTS, {
      id,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      dataUrl: input.dataUrl,
    });
  }

  async getAttachment(id: string): Promise<AttachmentRecord | null> {
    const adapter = await this.getAdapter();
    return adapter.read<AttachmentRecord>(STORES.ATTACHMENTS, id);
  }

  async listAttachments(): Promise<AttachmentRecord[]> {
    const adapter = await this.getAdapter();
    return adapter.query<AttachmentRecord>(STORES.ATTACHMENTS);
  }
}

export const attachmentStore = new AttachmentStore();
