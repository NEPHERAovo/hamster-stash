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

export interface DataAdapter {
  readonly id: string;
  initialize(): Promise<void>;
  destroy(): Promise<void>;

  create<T extends StoredEntity>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }
  ): Promise<T>;
  read<T extends StoredEntity>(collection: string, id: string): Promise<T | null>;
  update<T extends StoredEntity>(collection: string, id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  delete(collection: string, id: string): Promise<void>;

  query<T extends StoredEntity>(collection: string, options?: QueryOptions): Promise<T[]>;

  export(): Promise<ExportData>;
  import(data: ExportData): Promise<void>;
}
