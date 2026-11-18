import type {
  Transaction,
  TransactionType,
  LoanRole,
  LoanStatus,
  VoucherAttachment,
} from '../../types/transaction';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import type { AccountRepository } from '../../core/repositories/AccountRepository';
import type { CategoryRepository } from '../../core/repositories/CategoryRepository';
import { pluginManager } from '../../core/plugin/PluginManager';

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;             // 单位：分
  accountId: string;
  categoryId: string;
  toAccountId?: string;
  date: string;               // YYYY-MM-DD
  note?: string;
  tags?: string[];
  createdAt?: string;

  loanParty?: string;
  loanDirection?: 'lend' | 'borrow';
  loanRole?: LoanRole;
  relatedLoanId?: string;

  isReimbursable?: boolean;
  reimburseTarget?: string;

  offsetTransactionId?: string;

  voucher?: VoucherAttachment;

  ext?: Record<string, unknown>;
}

export interface ReconcileInput {
  accountId: string;
  targetBalance: number;      // 单位：分（目标实际余额）
  date: string;
  note?: string;
}

export interface PendingSettlementSummary {
  lendPendingAmount: number;   // 借出待收总额（单位：分）
  reimbPendingAmount: number;  // 垫付待报销总额（单位：分）
  borrowPendingAmount: number; // 借入待还总额（单位：分）
  netPendingAmount: number;    // 待结算净资产 = (借出待收 + 垫付待报) - 借入待还
  pendingLoans: Transaction[];
  pendingReimbursements: Transaction[];
}

export class TransactionService {
  private txRepo: TransactionRepository;
  private acctRepo: AccountRepository;
  private catRepo: CategoryRepository;

  constructor(
    txRepo: TransactionRepository,
    acctRepo: AccountRepository,
    catRepo: CategoryRepository
  ) {
    this.txRepo = txRepo;
    this.acctRepo = acctRepo;
    this.catRepo = catRepo;
  }

  /**
   * 录入交易（支持普通支出、收入、转账、借贷、垫付报销与凭证）并实时联动资金账户
   */
  async recordTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return pluginManager.runMiddleware(
      'transaction:record',
      { input },
      async ({ input }) => this.internalRecordTransaction(input)
    );
  }

  private async internalRecordTransaction(input: CreateTransactionInput): Promise<Transaction> {
    this.validateTransactionInput(input);

    const fromAccount = await this.acctRepo.findById(input.accountId);
    if (!fromAccount) {
      throw new Error(`账户不存在: ${input.accountId}`);
    }

    if (input.categoryId && !['cat_transfer', 'cat_reconcile'].includes(input.categoryId)) {
      const cat = await this.catRepo.findById(input.categoryId);
      if (!cat) {
        throw new Error(`分类不存在: ${input.categoryId}`);
      }
    }

    if (input.type === 'transfer') {
      if (!input.toAccountId) {
        throw new Error('转账必须指定目标账户');
      }
      if (input.toAccountId === input.accountId) {
        throw new Error('转入账户与转出账户不能相同');
      }
      const toAccount = await this.acctRepo.findById(input.toAccountId);
      if (!toAccount) {
        throw new Error(`目标转入账户不存在: ${input.toAccountId}`);
      }
    }

    let loanDirection = input.loanDirection;
    let loanRole = input.loanRole;
    let loanStatus: LoanStatus | undefined;
    let repaidAmount: number | undefined;

    if (input.type === 'loan') {
      if (!loanDirection || !loanRole) {
        if (input.categoryId === 'cat_lend_out' || input.categoryId === 'lend_out') {
          loanDirection = 'lend';
          loanRole = 'origin';
        } else if (input.categoryId === 'cat_borrow_in' || input.categoryId === 'borrow_in') {
          loanDirection = 'borrow';
          loanRole = 'origin';
        } else if (input.categoryId === 'cat_loan_repay' || input.categoryId === 'loan_repay') {
          loanDirection = 'lend';
          loanRole = 'repayment';
        } else if (input.categoryId === 'cat_debt_clear' || input.categoryId === 'debt_clear') {
          loanDirection = 'borrow';
          loanRole = 'repayment';
        }
      }

      if (loanRole === 'origin') {
        loanStatus = 'pending';
        repaidAmount = 0;
      }
    }

    if (input.type === 'expense') {
      await this.acctRepo.adjustBalance(input.accountId, -input.amount);
    } else if (input.type === 'income') {
      await this.acctRepo.adjustBalance(input.accountId, input.amount);
    } else if (input.type === 'transfer') {
      await this.acctRepo.adjustBalance(input.accountId, -input.amount);
      await this.acctRepo.adjustBalance(input.toAccountId!, input.amount);
    } else if (input.type === 'loan') {
      if (loanDirection === 'lend' && loanRole === 'origin') {
        await this.acctRepo.adjustBalance(input.accountId, -input.amount);
      } else if (loanDirection === 'borrow' && loanRole === 'origin') {
        await this.acctRepo.adjustBalance(input.accountId, input.amount);
      } else if (loanDirection === 'lend' && loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(input.accountId, input.amount);
      } else if (loanDirection === 'borrow' && loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(input.accountId, -input.amount);
      }
    }

    if (input.type === 'loan' && loanRole === 'repayment' && input.relatedLoanId) {
      const orig = await this.txRepo.findById(input.relatedLoanId);
      if (orig && orig.type === 'loan') {
        const nextRepaid = (orig.repaidAmount || 0) + input.amount;
        const nextStatus: LoanStatus = nextRepaid >= orig.amount ? 'settled' : 'partially_repaid';
        await this.txRepo.update(orig.id, {
          repaidAmount: nextRepaid,
          loanStatus: nextStatus,
        });
      }
    }

    return this.txRepo.create({
      type: input.type,
      amount: input.amount,
      accountId: input.accountId,
      categoryId: input.categoryId,
      toAccountId: input.toAccountId,
      date: input.date,
      note: input.note?.trim(),
      tags: input.tags,
      loanParty: input.loanParty?.trim(),
      loanDirection,
      loanRole,
      relatedLoanId: input.relatedLoanId,
      loanStatus,
      repaidAmount,
      isReimbursable: Boolean(input.isReimbursable),
      reimburseTarget: input.reimburseTarget?.trim(),
      reimburseStatus: input.isReimbursable ? 'pending' : undefined,
      offsetTransactionId: input.type === 'income' ? input.offsetTransactionId : undefined,
      voucher: input.voucher,
      ext: input.ext,
      createdAt: input.createdAt,
    });
  }

  /**
   * 平账校准：计算差异并自动生成平账流水
   */
  async reconcileAccount(input: ReconcileInput): Promise<{ transaction?: Transaction; diff: number }> {
    const account = await this.acctRepo.findById(input.accountId);
    if (!account) {
      throw new Error(`账户不存在: ${input.accountId}`);
    }

    const diff = input.targetBalance - account.balance;
    if (diff === 0) {
      return { diff: 0 };
    }

    await this.acctRepo.setBalance(input.accountId, input.targetBalance);

    const tx = await this.txRepo.create({
      type: 'reconcile',
      amount: Math.abs(diff),
      reconcileDiff: diff,
      accountId: input.accountId,
      categoryId: 'cat_reconcile',
      date: input.date,
      note: input.note || (diff > 0 ? '平账调增' : '平账调减'),
    });

    return { transaction: tx, diff };
  }

  /**
   * 结清某笔报销垫付（报销款到账）
   */
  async settleReimbursement(
    txId: string,
    receiveAccountId: string,
    settleDate?: string
  ): Promise<Transaction> {
    const orig = await this.txRepo.findById(txId);
    if (!orig || !orig.isReimbursable) {
      throw new Error(`报销交易不存在或非待报销交易: ${txId}`);
    }

    const today = settleDate || new Date().toISOString().split('T')[0];

    await this.txRepo.update(orig.id, {
      reimburseStatus: 'settled',
    });

    return this.recordTransaction({
      type: 'income',
      amount: orig.amount,
      accountId: receiveAccountId,
      categoryId: 'cat_other_in',
      date: today,
      note: `报销到账: ${orig.note || orig.reimburseTarget || '垫付款项'}`,
      offsetTransactionId: orig.id,
    });
  }

  /**
   * 一键结清剩余借款（产生对应的收回还款或偿还欠款流水）
   */
  async settleLoanOrigin(
    originLoanId: string,
    settleAccountId: string,
    settleDate?: string
  ): Promise<Transaction> {
    const orig = await this.txRepo.findById(originLoanId);
    if (!orig || orig.type !== 'loan' || orig.loanRole !== 'origin') {
      throw new Error(`原始借贷记录不存在: ${originLoanId}`);
    }

    const remaining = orig.amount - (orig.repaidAmount || 0);
    if (remaining <= 0) {
      throw new Error('该笔借贷已完全结清');
    }

    const today = settleDate || new Date().toISOString().split('T')[0];

    const categoryId = orig.loanDirection === 'lend' ? 'cat_loan_repay' : 'cat_debt_clear';

    return this.recordTransaction({
      type: 'loan',
      amount: remaining,
      accountId: settleAccountId,
      categoryId,
      loanDirection: orig.loanDirection,
      loanRole: 'repayment',
      relatedLoanId: orig.id,
      date: today,
      note: `全额结清: ${orig.note || orig.loanParty || '借贷尾款'}`,
    });
  }

  /**
   * 汇总获取往来借贷与报销待收的聚合资产数据
   */
  async getPendingSettlementSummary(): Promise<PendingSettlementSummary> {
    const all = await this.txRepo.findAll();

    let lendPendingAmount = 0;
    let reimbPendingAmount = 0;
    let borrowPendingAmount = 0;

    const pendingLoans: Transaction[] = [];
    const pendingReimbursements: Transaction[] = [];

    for (const t of all) {
      if (t.isReimbursable && t.reimburseStatus === 'pending') {
        reimbPendingAmount += t.amount;
        pendingReimbursements.push(t);
      }

      if (t.type === 'loan' && t.loanRole === 'origin' && t.loanStatus !== 'settled') {
        const remaining = Math.max(0, t.amount - (t.repaidAmount || 0));
        if (remaining > 0) {
          if (t.loanDirection === 'lend') {
            lendPendingAmount += remaining;
          } else if (t.loanDirection === 'borrow') {
            borrowPendingAmount += remaining;
          }
          pendingLoans.push(t);
        }
      }
    }

    const netPendingAmount = lendPendingAmount + reimbPendingAmount - borrowPendingAmount;

    return {
      lendPendingAmount,
      reimbPendingAmount,
      borrowPendingAmount,
      netPendingAmount,
      pendingLoans,
      pendingReimbursements,
    };
  }

  /**
   * 删除交易并回滚账户余额与核销链
   */
  async deleteTransaction(id: string, options?: { unlinkOffsets?: boolean }): Promise<void> {
    return pluginManager.runMiddleware(
      'transaction:delete',
      { id, options },
      async ({ id, options }) => this.internalDeleteTransaction(id, options)
    );
  }

  private async internalDeleteTransaction(id: string, options?: { unlinkOffsets?: boolean }): Promise<void> {
    const tx = await this.txRepo.findById(id);
    if (!tx) {
      throw new Error(`交易记录不存在: ${id}`);
    }

    if (tx.type === 'expense' && options?.unlinkOffsets !== false) {
      const linkedOffsets = await this.txRepo.findOffsetsByExpenseId(id);
      for (const offsetTx of linkedOffsets) {
        await this.txRepo.update(offsetTx.id, {
          offsetTransactionId: undefined,
        });
      }
    }

    if (tx.type === 'expense') {
      await this.acctRepo.adjustBalance(tx.accountId, tx.amount);
    } else if (tx.type === 'income') {
      await this.acctRepo.adjustBalance(tx.accountId, -tx.amount);
    } else if (tx.type === 'transfer') {
      await this.acctRepo.adjustBalance(tx.accountId, tx.amount);
      if (tx.toAccountId) {
        await this.acctRepo.adjustBalance(tx.toAccountId, -tx.amount);
      }
    } else if (tx.type === 'reconcile' && tx.reconcileDiff !== undefined) {
      await this.acctRepo.adjustBalance(tx.accountId, -tx.reconcileDiff);
    } else if (tx.type === 'loan') {
      if (tx.loanDirection === 'lend' && tx.loanRole === 'origin') {
        await this.acctRepo.adjustBalance(tx.accountId, tx.amount);
      } else if (tx.loanDirection === 'borrow' && tx.loanRole === 'origin') {
        await this.acctRepo.adjustBalance(tx.accountId, -tx.amount);
      } else if (tx.loanDirection === 'lend' && tx.loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(tx.accountId, -tx.amount);
      } else if (tx.loanDirection === 'borrow' && tx.loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(tx.accountId, tx.amount);
      }

      if (tx.loanRole === 'repayment' && tx.relatedLoanId) {
        const orig = await this.txRepo.findById(tx.relatedLoanId);
        if (orig) {
          const nextRepaid = Math.max(0, (orig.repaidAmount || 0) - tx.amount);
          const nextStatus: LoanStatus = nextRepaid === 0 ? 'pending' : 'partially_repaid';
          await this.txRepo.update(orig.id, {
            repaidAmount: nextRepaid,
            loanStatus: nextStatus,
          });
        }
      }
    }

    await this.txRepo.delete(id);
  }

  /**
   * 修改交易
   */
  async updateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    return pluginManager.runMiddleware(
      'transaction:update',
      { id, patch },
      async ({ id, patch }) => this.internalUpdateTransaction(id, patch)
    );
  }

  private async internalUpdateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    const oldTx = await this.txRepo.findById(id);
    if (!oldTx) {
      throw new Error(`交易记录不存在: ${id}`);
    }

    await this.deleteTransaction(id, { unlinkOffsets: false });
    return this.recordTransaction({
      ...oldTx,
      ...patch,
      offsetTransactionId:
        patch.offsetTransactionId !== undefined ? patch.offsetTransactionId : oldTx.offsetTransactionId,
      amount: patch.amount !== undefined ? patch.amount : oldTx.amount,
      type: patch.type || oldTx.type,
      accountId: patch.accountId || oldTx.accountId,
      categoryId: patch.categoryId || oldTx.categoryId,
      date: patch.date || oldTx.date,
      createdAt: patch.createdAt || oldTx.createdAt,
    });
  }

  /**
   * 批量导入交易（支持选择是否同步联动更新账户当前余额）
   */
  async importTransactions(
    records: {
      type: TransactionType;
      amount: number;
      date: string;
      createdAt?: string;
      categoryId: string;
      accountId: string;
      note?: string;
      isReimbursable?: boolean;
    }[],
    syncAccountBalance: boolean = true
  ): Promise<{ importedCount: number }> {
    let count = 0;
    for (const r of records) {
      if (syncAccountBalance) {
        if (r.type === 'expense') {
          await this.acctRepo.adjustBalance(r.accountId, -r.amount);
        } else if (r.type === 'income') {
          await this.acctRepo.adjustBalance(r.accountId, r.amount);
        }
      }

      await this.txRepo.create({
        type: r.type,
        amount: r.amount,
        accountId: r.accountId,
        categoryId: r.categoryId,
        date: r.date,
        createdAt: r.createdAt,
        note: r.note,
        isReimbursable: Boolean(r.isReimbursable),
        reimburseStatus: r.isReimbursable ? 'pending' : undefined,
      });
      count++;
    }
    return { importedCount: count };
  }

  private validateTransactionInput(input: CreateTransactionInput): void {
    if (!input.amount || typeof input.amount !== 'number' || input.amount <= 0 || !Number.isInteger(input.amount)) {
      throw new Error('交易金额必须为大于 0 的整型分');
    }

    if (!input.accountId) {
      throw new Error('交易必须指定关联资金账户');
    }

    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('交易日期格式必须为 YYYY-MM-DD');
    }
  }
}
