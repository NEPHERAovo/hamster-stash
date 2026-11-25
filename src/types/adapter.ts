import type { Transaction } from './transaction';
import type { Account } from './account';
import type { Category } from './category';

export interface StoredEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface QueryOptions {
  filters?: Record<string, unknown>;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  settings?: Record<string, unknown>;
  plugins?: {
    data: unknown[];
    settings?: Record<string, unknown>;
  };
}

export interface ExportOptions {
  includeTombstones?: boolean;
}

export interface DataAdapter {
  readonly id: string;
  initialize(): Promise<void>;
  destroy(): Promise<void>;

  get<T extends StoredEntity>(store: string, id: string): Promise<T | null>;
  getAll<T extends StoredEntity>(store: string): Promise<T[]>;
  put<T extends StoredEntity>(store: string, entity: T): Promise<void>;
  remove(store: string, id: string): Promise<void>;
  clearStore(store: string): Promise<void>;
  clearAll(): Promise<void>;
  replaceAll(entries: Record<string, StoredEntity[]>): Promise<void>;
  runInTransaction<T>(stores: string[], fn: () => Promise<T>): Promise<T>;
}

export type AdapterResolver = DataAdapter | (() => DataAdapter);
