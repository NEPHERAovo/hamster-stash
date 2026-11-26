import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction, TransactionType } from '../../types/transaction';
import type { CreateAccountInput } from '../account/accountService';
import { mapConfiguredCsvRows, type CsvColumnMapping } from './csvMapper';
import {
  extractExistingImportKeys,
  inferAccountType,
  type BillSource,
} from './billNormalizer';

export interface ExecuteCsvImportInput {
  headers: string[];
  rows: string[][];
  mapping: CsvColumnMapping;
  categoryMapping: Record<string, string>;
  typeMapping: Record<string, TransactionType | 'skip'>;
  defaultAccountId: string;
  defaultExpenseCategoryId: string;
  defaultIncomeCategoryId: string;
  existingCategories: Category[];
  existingAccounts: Account[];
  autoCreateAccounts: boolean;
  source?: BillSource;
  skipClosedAndFullRefunds?: boolean;
  skipDuplicates?: boolean;
  existingTransactions?: Transaction[];
  createAccount: (input: CreateAccountInput) => Promise<Account>;
  importTransactions: (
    records: {
      type: Transaction['type'];
      amount: number;
      date: string;
      createdAt?: string;
      categoryId: string;
      accountId: string;
      note?: string;
      isReimbursable?: boolean;
      ext?: Record<string, unknown>;
    }[],
    syncAccountBalance?: boolean
  ) => Promise<{ importedCount: number }>;
}

export interface ExecuteCsvImportResult {
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  filteredStatusCount: number;
  reimbursableCount: number;
  createdAccountCount: number;
}

export class ImportService {
  async executeCsvImport(
    input: ExecuteCsvImportInput
  ): Promise<ExecuteCsvImportResult> {
    if (input.rows.length === 0) {
      throw new Error('无可用数据');
    }
    if (!input.mapping.dateCol || !input.mapping.amountCol) {
      throw new Error('请至少指定「日期」和「金额」列');
    }

    const existingImportKeys = input.existingTransactions
      ? extractExistingImportKeys(input.existingTransactions)
      : undefined;

    const { records, skippedCount, duplicateCount, filteredStatusCount } = mapConfiguredCsvRows(
      input.headers,
      input.rows,
      {
        mapping: input.mapping,
        categoryMapping: input.categoryMapping,
        typeMapping: input.typeMapping,
        defaultAccountId: input.defaultAccountId,
        defaultExpenseCategoryId: input.defaultExpenseCategoryId,
        defaultIncomeCategoryId: input.defaultIncomeCategoryId,
        existingCategories: input.existingCategories,
        existingAccounts: input.existingAccounts,
        source: input.source,
        skipClosedAndFullRefunds: input.skipClosedAndFullRefunds,
        skipDuplicates: input.skipDuplicates,
        existingImportKeys,
      }
    );

    if (records.length === 0) {
      if (duplicateCount > 0 || filteredStatusCount > 0) {
        return {
          importedCount: 0,
          skippedCount,
          duplicateCount,
          filteredStatusCount,
          reimbursableCount: 0,
          createdAccountCount: 0,
        };
      }
      throw new Error('未解析出有效交易流水');
    }

    let createdAccountCount = 0;
    if (input.autoCreateAccounts && input.mapping.accountCol) {
      const accountByLowerName = new Map<string, string>(
        input.existingAccounts.map((a) => [a.name.trim().toLowerCase(), a.id])
      );

      for (const rec of records) {
        const rawName = rec.rawAccountName?.trim();
        if (!rawName) continue;
        const key = rawName.toLowerCase();
        let targetAccountId = accountByLowerName.get(key);
        if (!targetAccountId) {
          const newAcct = await input.createAccount({
            name: rawName,
            type: inferAccountType(rawName),
            initialBalance: 0,
          });
          targetAccountId = newAcct.id;
          accountByLowerName.set(key, targetAccountId);
          createdAccountCount++;
        }
        rec.accountId = targetAccountId;
      }
    }

    const res = await input.importTransactions(records, true);
    const reimbursableCount = records.filter((r) => r.isReimbursable).length;

    return {
      importedCount: res.importedCount,
      skippedCount,
      duplicateCount,
      filteredStatusCount,
      reimbursableCount,
      createdAccountCount,
    };
  }
}
