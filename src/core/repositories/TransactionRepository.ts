import type { DataAdapter, QueryOptions } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { STORES } from '../db/schema';

export class TransactionRepository {
  private adapter: DataAdapter;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.adapter.read<Transaction>(STORES.TRANSACTIONS, id);
  }

  async findAll(options?: QueryOptions): Promise<Transaction[]> {
    return this.adapter.query<Transaction>(STORES.TRANSACTIONS, {
      orderBy: options?.orderBy || 'date',
      orderDirection: options?.orderDirection || 'desc',
      ...options,
    });
  }

  /**
   * 按月份查询（格式：YYYY-MM）
   */
  async findByMonth(yearMonth: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter((tx) => tx.date.startsWith(yearMonth));
  }

  /**
   * 按账户查询（关联流出账户或流入账户）
   */
  async findByAccount(accountId: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter(
      (tx) => tx.accountId === accountId || tx.toAccountId === accountId
    );
  }

  /**
   * 查找抵扣某笔支出的所有收入流水
   */
  async findOffsetsByExpenseId(expenseId: string): Promise<Transaction[]> {
    const all = await this.findAll();
    return all.filter((tx) => tx.type === 'income' && tx.offsetTransactionId === expenseId);
  }

  /**
   * 计算某笔支出已被抵扣的总金额（单位：分）
   */
  async getOffsetTotalByExpenseId(expenseId: string): Promise<number> {
    const offsets = await this.findOffsetsByExpenseId(expenseId);
    return offsets.reduce((sum, tx) => sum + tx.amount, 0);
  }

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<Transaction> {
    return this.adapter.create<Transaction>(STORES.TRANSACTIONS, data);
  }

  async update(id: string, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<Transaction> {
    return this.adapter.update<Transaction>(STORES.TRANSACTIONS, id, data);
  }

  async delete(id: string): Promise<void> {
    return this.adapter.delete(STORES.TRANSACTIONS, id);
  }
}
