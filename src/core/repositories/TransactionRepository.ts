import type { AdapterResolver, QueryOptions } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { STORES } from '../db/schema';
import { BaseRepository } from './BaseRepository';

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(adapterResolver: AdapterResolver) {
    super(adapterResolver, STORES.TRANSACTIONS, {
      useTombstone: true,
      defaultOrderBy: 'date',
      defaultOrderDirection: 'desc',
    });
  }

  override async findAll(options?: QueryOptions): Promise<Transaction[]> {
    return super.findAll({
      orderBy: options?.orderBy || 'date',
      orderDirection: options?.orderDirection || 'desc',
      ...options,
    });
  }

  async findByMonth(yearMonth: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter((tx) => tx.date.startsWith(yearMonth));
  }

  async findByAccount(accountId: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter(
      (tx) => tx.accountId === accountId || tx.toAccountId === accountId
    );
  }

  async findOffsetsByExpenseId(expenseId: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter((tx) => tx.type === 'income' && tx.offsetTransactionId === expenseId);
  }

  async getOffsetTotalByExpenseId(expenseId: string): Promise<number> {
    const offsets = await this.findOffsetsByExpenseId(expenseId);
    return offsets.reduce((sum, tx) => sum + tx.amount, 0);
  }
}
