import { STORES } from '../db/schema';
import type { AdapterResolver, StoredEntity } from '../../types/adapter';
import { BaseRepository } from './BaseRepository';

export interface AttachmentRecord extends StoredEntity {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  dataUrl: string;
}

export class AttachmentRepository extends BaseRepository<AttachmentRecord> {
  constructor(adapterResolver: AdapterResolver) {
    super(adapterResolver, STORES.ATTACHMENTS, {
      useTombstone: false,
      idPrefix: 'att',
    });
  }
}
