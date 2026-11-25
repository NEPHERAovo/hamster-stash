import type { AdapterResolver, DataAdapter } from '../../types/adapter';
import {
  AttachmentRepository,
  type AttachmentRecord,
} from '../repositories/AttachmentRepository';

export type { AttachmentRecord };

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
  private adapterResolver?: AdapterResolver;
  private ensureReady?: () => Promise<void>;

  constructor(adapter?: AdapterResolver, ensureReady?: () => Promise<void>) {
    this.adapterResolver = adapter;
    this.ensureReady = ensureReady;
  }

  bindAdapter(adapter: AdapterResolver, ensureReady?: () => Promise<void>): void {
    this.adapterResolver = adapter;
    this.ensureReady = ensureReady;
  }

  private async getRepo(): Promise<AttachmentRepository> {
    if (this.ensureReady) {
      await this.ensureReady();
    }
    const resolved: DataAdapter | undefined =
      typeof this.adapterResolver === 'function' ? this.adapterResolver() : this.adapterResolver;
    if (!resolved) {
      throw new Error('AttachmentStore adapter is not configured.');
    }
    return new AttachmentRepository(resolved);
  }

  async saveAttachment(input: {
    id?: string;
    name: string;
    mimeType: string;
    size: string;
    dataUrl: string;
  }): Promise<AttachmentRecord> {
    const repo = await this.getRepo();
    const id = input.id || (await computeAttachmentId(input.dataUrl));
    const existing = await repo.findById(id);
    if (existing) {
      return existing;
    }
    return repo.create({
      id,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      dataUrl: input.dataUrl,
    });
  }

  async getAttachment(id: string): Promise<AttachmentRecord | null> {
    const repo = await this.getRepo();
    return repo.findById(id);
  }

  async listAttachments(): Promise<AttachmentRecord[]> {
    const repo = await this.getRepo();
    return repo.findAll();
  }
}

export const attachmentStore = new AttachmentStore();
