import type {
  Transaction,
  TransactionType,
  LoanRole,
  LoanStatus,
  VoucherAttachment,
} from '../../types/transaction';
import type { MiddlewareRunner } from '../../types/middleware';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import type { AccountRepository } from '../../core/repositories/AccountRepository';
import type { CategoryRepository } from '../../core/repositories/CategoryRepository';
import { STORES } from '../../core/db/schema';
import { todayDate, currentYearMonth } from '../../utils/date';
import { computePendingInstallments, type ActiveInstallment } from '../finance/amortization';
import { buildOffsetMap } from '../finance/balanceCalculator';

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  accountId: string;
  categoryId: string;
  toAccountId?: string;
  date: string;
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
  targetBalance: number;
  date: string;
  note?: string;
}

export interface PendingSettlementSummary {
  lendPendingAmount: number;
  reimbPendingAmount: number;
  borrowPendingAmount: number;
  installmentPendingAmount: number;
  netPendingAmount: number;
  pendingLoans: Transaction[];
  pendingReimbursements: Transaction[];
  pendingInstallments: ActiveInstallment[];
}

export class TransactionService {
  private txRepo: TransactionRepository;
  private acctRepo: AccountRepository;
  private catRepo: CategoryRepository;
  private runMiddleware?: MiddlewareRunner;

  constructor(
    txRepo: TransactionRepository,
    acctRepo: AccountRepository,
    catRepo: CategoryRepository,
    runMiddleware?: MiddlewareRunner
  ) {
    this.txRepo = txRepo;
    this.acctRepo = acctRepo;
    this.catRepo = catRepo;
    this.runMiddleware = runMiddleware;
  }

  private executeMiddleware<P, R>(
    hookName: string,
    payload: P,
    handler: (payload: P) => Promise<R>
  ): Promise<R> {
    if (this.runMiddleware) {
      return this.runMiddleware(hookName, payload, handler);
    }
    return handler(payload);
  }

  async listTransactions(): Promise<Transaction[]> {
    return this.txRepo.findAll({ orderBy: 'date', orderDirection: 'desc' });
  }

  async recordTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return this.executeMiddleware(
      'transaction:record',
      { input },
      async ({ input: finalInput }) => this.internalRecordTransaction(finalInput)
    );
  }

  private async validateTransactionReferences(input: CreateTransactionInput): Promise<void> {
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
  }

  private resolveLoanMetadata(
    type: TransactionType,
    categoryId: string,
    direction?: 'lend' | 'borrow',
    role?: LoanRole
  ): { loanDirection?: 'lend' | 'borrow'; loanRole?: LoanRole } {
    if (type !== 'loan') {
      return { loanDirection: undefined, loanRole: undefined };
    }
    let loanDirection = direction;
    let loanRole = role;
    if (!loanDirection || !loanRole) {
      if (categoryId === 'cat_lend_out' || categoryId === 'lend_out') {
        loanDirection = 'lend';
        loanRole = 'origin';
      } else if (categoryId === 'cat_borrow_in' || categoryId === 'borrow_in') {
        loanDirection = 'borrow';
        loanRole = 'origin';
      } else if (categoryId === 'cat_loan_repay' || categoryId === 'loan_repay') {
        loanDirection = 'lend';
        loanRole = 'repayment';
      } else if (categoryId === 'cat_debt_clear' || categoryId === 'debt_clear') {
        loanDirection = 'borrow';
        loanRole = 'repayment';
      }
    }
    return { loanDirection, loanRole };
  }

  private async applyAccountAndLoanEffects(
    tx: Pick<
      Transaction,
      | 'type'
      | 'amount'
      | 'accountId'
      | 'toAccountId'
      | 'reconcileDiff'
      | 'loanDirection'
      | 'loanRole'
      | 'relatedLoanId'
    >,
    sign: 1 | -1
  ): Promise<void> {
    if (tx.type === 'expense') {
      await this.acctRepo.adjustBalance(tx.accountId, -sign * tx.amount);
    } else if (tx.type === 'income') {
      await this.acctRepo.adjustBalance(tx.accountId, sign * tx.amount);
    } else if (tx.type === 'transfer') {
      await this.acctRepo.adjustBalance(tx.accountId, -sign * tx.amount);
      if (tx.toAccountId) {
        await this.acctRepo.adjustBalance(tx.toAccountId, sign * tx.amount);
      }
    } else if (tx.type === 'reconcile' && tx.reconcileDiff !== undefined) {
      await this.acctRepo.adjustBalance(tx.accountId, sign * tx.reconcileDiff);
    } else if (tx.type === 'loan') {
      if (tx.loanDirection === 'lend' && tx.loanRole === 'origin') {
        await this.acctRepo.adjustBalance(tx.accountId, -sign * tx.amount);
      } else if (tx.loanDirection === 'borrow' && tx.loanRole === 'origin') {
        await this.acctRepo.adjustBalance(tx.accountId, sign * tx.amount);
      } else if (tx.loanDirection === 'lend' && tx.loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(tx.accountId, sign * tx.amount);
      } else if (tx.loanDirection === 'borrow' && tx.loanRole === 'repayment') {
        await this.acctRepo.adjustBalance(tx.accountId, -sign * tx.amount);
      }

      if (tx.loanRole === 'repayment' && tx.relatedLoanId) {
        const orig = await this.txRepo.findById(tx.relatedLoanId);
        if (orig && orig.type === 'loan') {
          const nextRepaid = Math.max(0, (orig.repaidAmount || 0) + sign * tx.amount);
          let nextStatus: LoanStatus = 'pending';
          if (nextRepaid >= orig.amount) {
            nextStatus = 'settled';
          } else if (nextRepaid > 0) {
            nextStatus = 'partially_repaid';
          }
          await this.txRepo.update(orig.id, {
            repaidAmount: nextRepaid,
            loanStatus: nextStatus,
          });
        }
      }
    }
  }

  private async executeRecordTransaction(input: CreateTransactionInput): Promise<Transaction> {
    await this.validateTransactionReferences(input);

    const { loanDirection, loanRole } = this.resolveLoanMetadata(
      input.type,
      input.categoryId,
      input.loanDirection,
      input.loanRole
    );
    const loanStatus: LoanStatus | undefined =
      input.type === 'loan' && loanRole === 'origin' ? 'pending' : undefined;
    const repaidAmount: number | undefined =
      input.type === 'loan' && loanRole === 'origin' ? 0 : undefined;

    await this.applyAccountAndLoanEffects(
      {
        type: input.type,
        amount: input.amount,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        loanDirection,
        loanRole,
        relatedLoanId: input.relatedLoanId,
      },
      1
    );

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

  private async internalRecordTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return this.txRepo.runInTransaction(
      [STORES.ACCOUNTS, STORES.CATEGORIES, STORES.TRANSACTIONS],
      () => this.executeRecordTransaction(input)
    );
  }

  async reconcileAccount(input: ReconcileInput): Promise<{ transaction?: Transaction; diff: number }> {
    return this.txRepo.runInTransaction(
      [STORES.ACCOUNTS, STORES.TRANSACTIONS],
      async () => {
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
    );
  }

  async settleReimbursement(
    txId: string,
    receiveAccountId: string,
    settleDate?: string
  ): Promise<Transaction> {
    const orig = await this.txRepo.findById(txId);
    if (!orig || !orig.isReimbursable) {
      throw new Error(`报销交易不存在或非待报销交易: ${txId}`);
    }

    const today = settleDate || todayDate();
    const incomeInput: CreateTransactionInput = {
      type: 'income',
      amount: orig.amount,
      accountId: receiveAccountId,
      categoryId: 'cat_other_in',
      date: today,
      note: `报销到账: ${orig.note || orig.reimburseTarget || '垫付款项'}`,
      offsetTransactionId: orig.id,
    };

    return this.executeMiddleware(
      'transaction:record',
      { input: incomeInput },
      async ({ input: finalInput }) =>
        this.txRepo.runInTransaction(
          [STORES.ACCOUNTS, STORES.CATEGORIES, STORES.TRANSACTIONS],
          async () => {
            await this.txRepo.update(orig.id, {
              reimburseStatus: 'settled',
            });
            return this.executeRecordTransaction(finalInput);
          }
        )
    );
  }

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

    const today = settleDate || todayDate();
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

    const offsetMap = buildOffsetMap(all);
    const { totalRemainingDebt, installments } = computePendingInstallments(all, currentYearMonth(), offsetMap);

    const netPendingAmount = lendPendingAmount + reimbPendingAmount - (borrowPendingAmount + totalRemainingDebt);

    return {
      lendPendingAmount,
      reimbPendingAmount,
      borrowPendingAmount,
      installmentPendingAmount: totalRemainingDebt,
      netPendingAmount,
      pendingLoans,
      pendingReimbursements,
      pendingInstallments: installments,
    };
  }

  async deleteTransaction(id: string, options?: { unlinkOffsets?: boolean }): Promise<void> {
    const existing = await this.txRepo.findById(id);
    return this.executeMiddleware(
      'transaction:delete',
      { id, options, deletedTx: existing ?? undefined },
      async ({ id: targetId, options: targetOptions }) =>
        this.internalDeleteTransaction(targetId, targetOptions)
    );
  }

  private async internalDeleteTransaction(id: string, options?: { unlinkOffsets?: boolean }): Promise<void> {
    return this.txRepo.runInTransaction(
      [STORES.ACCOUNTS, STORES.TRANSACTIONS],
      async () => {
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

        await this.applyAccountAndLoanEffects(tx, -1);
        await this.txRepo.delete(id);
      }
    );
  }

  async updateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    const previousTx = await this.txRepo.findById(id);
    return this.executeMiddleware(
      'transaction:update',
      { id, patch, previousTx: previousTx ?? undefined },
      async ({ id: targetId, patch: targetPatch }) =>
        this.internalUpdateTransaction(targetId, targetPatch)
    );
  }

  private async internalUpdateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    return this.txRepo.runInTransaction(
      [STORES.ACCOUNTS, STORES.CATEGORIES, STORES.TRANSACTIONS],
      async () => {
        const oldTx = await this.txRepo.findById(id);
        if (!oldTx) {
          throw new Error(`交易记录不存在: ${id}`);
        }

        const nextType = patch.type || oldTx.type;
        const nextAmount = patch.amount !== undefined ? patch.amount : oldTx.amount;
        const nextAccountId = patch.accountId || oldTx.accountId;
        const nextCategoryId = patch.categoryId || oldTx.categoryId;
        const nextDate = patch.date || oldTx.date;
        const nextToAccountId = 'toAccountId' in patch ? patch.toAccountId : oldTx.toAccountId;
        const nextNote = 'note' in patch ? patch.note?.trim() : oldTx.note;
        const nextTags = 'tags' in patch ? patch.tags : oldTx.tags;
        const nextLoanParty = 'loanParty' in patch ? patch.loanParty?.trim() : oldTx.loanParty;
        const nextIsReimbursable = 'isReimbursable' in patch ? Boolean(patch.isReimbursable) : Boolean(oldTx.isReimbursable);
        const nextReimburseTarget = 'reimburseTarget' in patch ? patch.reimburseTarget?.trim() : oldTx.reimburseTarget;
        let nextOffsetTxId: string | undefined;
        if (nextType === 'income') {
          nextOffsetTxId = 'offsetTransactionId' in patch ? patch.offsetTransactionId : oldTx.offsetTransactionId;
        }
        const nextVoucher = 'voucher' in patch ? patch.voucher : oldTx.voucher;
        const nextExt = 'ext' in patch ? patch.ext : oldTx.ext;
        const nextRelatedLoanId = 'relatedLoanId' in patch ? patch.relatedLoanId : oldTx.relatedLoanId;

        const rawDirection = 'loanDirection' in patch ? patch.loanDirection : oldTx.loanDirection;
        const rawRole = 'loanRole' in patch ? patch.loanRole : oldTx.loanRole;
        const { loanDirection, loanRole } = this.resolveLoanMetadata(nextType, nextCategoryId, rawDirection, rawRole);

        const candidateInput: CreateTransactionInput = {
          type: nextType,
          amount: nextAmount,
          accountId: nextAccountId,
          categoryId: nextCategoryId,
          toAccountId: nextToAccountId,
          date: nextDate,
          note: nextNote,
          tags: nextTags,
          loanParty: nextLoanParty,
          loanDirection,
          loanRole,
          relatedLoanId: nextRelatedLoanId,
          isReimbursable: nextIsReimbursable,
          reimburseTarget: nextReimburseTarget,
          offsetTransactionId: nextOffsetTxId,
          voucher: nextVoucher,
          ext: nextExt,
          createdAt: patch.createdAt || oldTx.createdAt,
        };

        await this.validateTransactionReferences(candidateInput);

        await this.applyAccountAndLoanEffects(oldTx, -1);

        if (oldTx.type === 'expense' && nextType !== 'expense') {
          const linkedOffsets = await this.txRepo.findOffsetsByExpenseId(id);
          for (const offsetTx of linkedOffsets) {
            await this.txRepo.update(offsetTx.id, {
              offsetTransactionId: undefined,
            });
          }
        }

        await this.applyAccountAndLoanEffects(
          {
            type: nextType,
            amount: nextAmount,
            accountId: nextAccountId,
            toAccountId: nextToAccountId,
            reconcileDiff: oldTx.reconcileDiff,
            loanDirection,
            loanRole,
            relatedLoanId: nextRelatedLoanId,
          },
          1
        );

        let loanStatus: LoanStatus | undefined;
        let repaidAmount: number | undefined;
        if (nextType === 'loan' && loanRole === 'origin') {
          repaidAmount = oldTx.repaidAmount || 0;
          if (repaidAmount >= nextAmount) {
            loanStatus = 'settled';
          } else if (repaidAmount > 0) {
            loanStatus = 'partially_repaid';
          } else {
            loanStatus = 'pending';
          }
        }

        const reimburseStatus = nextIsReimbursable ? oldTx.reimburseStatus || 'pending' : undefined;

        return this.txRepo.update(id, {
          type: nextType,
          amount: nextAmount,
          accountId: nextAccountId,
          categoryId: nextCategoryId,
          toAccountId: nextType === 'transfer' ? nextToAccountId : undefined,
          date: nextDate,
          note: nextNote,
          tags: nextTags,
          loanParty: nextLoanParty,
          loanDirection,
          loanRole,
          relatedLoanId: nextType === 'loan' ? nextRelatedLoanId : undefined,
          loanStatus,
          repaidAmount,
          isReimbursable: nextIsReimbursable,
          reimburseTarget: nextReimburseTarget,
          reimburseStatus,
          offsetTransactionId: nextOffsetTxId,
          voucher: nextVoucher,
          ext: nextExt,
          createdAt: patch.createdAt || oldTx.createdAt,
        });
      }
    );
  }

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
      ext?: Record<string, unknown>;
    }[],
    syncAccountBalance: boolean = true
  ): Promise<{ importedCount: number }> {
    return this.txRepo.runInTransaction(
      [STORES.ACCOUNTS, STORES.TRANSACTIONS],
      async () => {
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
            ext: r.ext,
          });
          count++;
        }
        return { importedCount: count };
      }
    );
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
