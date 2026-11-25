import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction, TransactionType } from '../../types/transaction';
import type { CreateAccountInput } from '../account/accountService';
import { mapConfiguredCsvRows, type CsvColumnMapping } from './csvMapper';

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
    }[],
    syncAccountBalance?: boolean
  ) => Promise<{ importedCount: number }>;
}

export interface ExecuteCsvImportResult {
  importedCount: number;
  skippedCount: number;
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

    const currentAccounts = [...input.existingAccounts];
    let createdAccountCount = 0;

    if (input.autoCreateAccounts && input.mapping.accountCol) {
      const acctColIdx = input.headers.indexOf(input.mapping.accountCol);
      if (acctColIdx >= 0) {
        const distinctNames = new Set<string>();
        for (const row of input.rows) {
          const val = row[acctColIdx]?.trim();
          if (val) distinctNames.add(val);
        }

        const existingNames = new Set(
          currentAccounts.map((a) => a.name.trim().toLowerCase())
        );
        for (const rawName of distinctNames) {
          if (!existingNames.has(rawName.toLowerCase())) {
            const newAcct = await input.createAccount({
              name: rawName,
              type: rawName.includes('信用') ? 'credit' : 'savings',
              initialBalance: 0,
            });
            currentAccounts.push(newAcct);
            existingNames.add(rawName.toLowerCase());
            createdAccountCount++;
          }
        }
      }
    }

    const { records, skippedCount } = mapConfiguredCsvRows(
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
        existingAccounts: currentAccounts,
      }
    );

    if (records.length === 0) {
      throw new Error('未解析出有效交易流水');
    }

    const res = await input.importTransactions(records, true);
    const reimbursableCount = records.filter((r) => r.isReimbursable).length;

    return {
      importedCount: res.importedCount,
      skippedCount,
      reimbursableCount,
      createdAccountCount,
    };
  }
}
