import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionService } from '../../src/domain/transaction/transactionService';

describe('Loan Linking & Reimbursement Settlement Business Logic', () => {
  let adapter: MemoryAdapter;
  let txRepo: TransactionRepository;
  let acctRepo: AccountRepository;
  let catRepo: CategoryRepository;
  let txService: TransactionService;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();

    txRepo = new TransactionRepository(adapter);
    acctRepo = new AccountRepository(adapter);
    catRepo = new CategoryRepository(adapter);

    txService = new TransactionService(txRepo, acctRepo, catRepo);

    await acctRepo.create({
      id: 'acct_wechat',
      name: '微信零钱',
      type: 'savings',
      balance: 100000, // 1000.00 元
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
    });

    await acctRepo.create({
      id: 'acct_bank',
      name: '招商银行卡',
      type: 'savings',
      balance: 500000, // 5000.00 元
      currency: 'CNY',
      icon: 'landmark',
      sortOrder: 2,
    });

    await catRepo.create({
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'utensils',
      color: 'var(--cat-food)',
      sortOrder: 1,
    });
    await catRepo.create({
      id: 'cat_lend_out',
      name: '借给他人',
      type: 'loan',
      icon: 'arrow-up-right',
      color: 'var(--color-accent)',
      sortOrder: 2,
    });
    await catRepo.create({
      id: 'cat_loan_repay',
      name: '收回还款',
      type: 'loan',
      icon: 'check-circle-2',
      color: 'var(--color-accent)',
      sortOrder: 3,
    });
    await catRepo.create({
      id: 'cat_other_in',
      name: '其他收入',
      type: 'income',
      icon: 'plus-circle',
      color: 'var(--color-income)',
      sortOrder: 4,
    });
  });

  describe('借出款项与多期关联核销链 (Loan Lending & Repayment Chain)', () => {
    it('借出初始款扣减资金并初始化为 pending', async () => {
      const orig = await txService.recordTransaction({
        type: 'loan',
        amount: 50000, // 500.00 元
        accountId: 'acct_wechat',
        categoryId: 'cat_lend_out',
        date: '2026-10-07',
        loanParty: '张三',
        loanDirection: 'lend',
        loanRole: 'origin',
        note: '借给张三周转',
      });

      expect(orig.loanStatus).toBe('pending');
      expect(orig.repaidAmount).toBe(0);

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(50000);
    });

    it('关联部分还款：增加账户余额并将原借款流转为 partially_repaid', async () => {
      const orig = await txService.recordTransaction({
        type: 'loan',
        amount: 50000,
        accountId: 'acct_wechat',
        categoryId: 'cat_lend_out',
        date: '2026-10-07',
        loanParty: '张三',
        loanDirection: 'lend',
        loanRole: 'origin',
      });

      const repay1 = await txService.recordTransaction({
        type: 'loan',
        amount: 20000,
        accountId: 'acct_wechat',
        categoryId: 'cat_loan_repay',
        date: '2026-10-08',
        loanDirection: 'lend',
        loanRole: 'repayment',
        relatedLoanId: orig.id,
        note: '张三第一期还款',
      });

      expect(repay1.id).toBeDefined();

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(70000);

      const updatedOrig = await txRepo.findById(orig.id);
      expect(updatedOrig?.loanStatus).toBe('partially_repaid');
      expect(updatedOrig?.repaidAmount).toBe(20000);
    });

    it('一键结清剩余款项：全额还款并将原始借款流转为 settled', async () => {
      const orig = await txService.recordTransaction({
        type: 'loan',
        amount: 50000,
        accountId: 'acct_wechat',
        categoryId: 'cat_lend_out',
        date: '2026-10-07',
        loanParty: '张三',
        loanDirection: 'lend',
        loanRole: 'origin',
      });

      await txService.recordTransaction({
        type: 'loan',
        amount: 20000,
        accountId: 'acct_wechat',
        categoryId: 'cat_loan_repay',
        date: '2026-10-08',
        loanDirection: 'lend',
        loanRole: 'repayment',
        relatedLoanId: orig.id,
      });

      const settleTx = await txService.settleLoanOrigin(orig.id, 'acct_wechat', '2026-10-09');
      expect(settleTx.amount).toBe(30000);

      const finalOrig = await txRepo.findById(orig.id);
      expect(finalOrig?.loanStatus).toBe('settled');
      expect(finalOrig?.repaidAmount).toBe(50000);

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(100000);
    });
  });

  describe('待报销垫付与回款结算 (Reimbursement Flow)', () => {
    it('录入待报销垫付支出，扣减账户并标记为 pending', async () => {
      const reimbTx = await txService.recordTransaction({
        type: 'expense',
        amount: 48000, // 480.00 元
        accountId: 'acct_bank',
        categoryId: 'cat_food',
        date: '2026-10-08',
        note: '出差垫付客饭',
        isReimbursable: true,
        reimburseTarget: '公司财务部',
      });

      expect(reimbTx.isReimbursable).toBe(true);
      expect(reimbTx.reimburseStatus).toBe('pending');

      const acct = await acctRepo.findById('acct_bank');
      expect(acct?.balance).toBe(452000);
    });

    it('结清报销款：原垫付标记为 settled 并产生回款收入流水', async () => {
      const reimbTx = await txService.recordTransaction({
        type: 'expense',
        amount: 48000,
        accountId: 'acct_bank',
        categoryId: 'cat_food',
        date: '2026-10-08',
        note: '出差垫付客饭',
        isReimbursable: true,
      });

      const incomeTx = await txService.settleReimbursement(reimbTx.id, 'acct_wechat', '2026-10-10');
      expect(incomeTx.type).toBe('income');
      expect(incomeTx.amount).toBe(48000);

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(148000);

      const updatedReimb = await txRepo.findById(reimbTx.id);
      expect(updatedReimb?.reimburseStatus).toBe('settled');
    });
  });

  describe('聚合待结算资产包汇总 (Pending Settlement Aggregation)', () => {
    it('精准汇总借出待收、垫付待报销与待结算净资产', async () => {
      const loan = await txService.recordTransaction({
        type: 'loan',
        amount: 50000,
        accountId: 'acct_wechat',
        categoryId: 'cat_lend_out',
        date: '2026-10-07',
        loanDirection: 'lend',
        loanRole: 'origin',
      });
      await txService.recordTransaction({
        type: 'loan',
        amount: 20000,
        accountId: 'acct_wechat',
        categoryId: 'cat_loan_repay',
        date: '2026-10-08',
        loanDirection: 'lend',
        loanRole: 'repayment',
        relatedLoanId: loan.id,
      });

      await txService.recordTransaction({
        type: 'expense',
        amount: 48000,
        accountId: 'acct_bank',
        categoryId: 'cat_food',
        date: '2026-10-08',
        isReimbursable: true,
      });

      const summary = await txService.getPendingSettlementSummary();
      expect(summary.lendPendingAmount).toBe(30000);  // 借出待收 ¥300.00
      expect(summary.reimbPendingAmount).toBe(48000); // 垫付待报销 ¥480.00
      expect(summary.netPendingAmount).toBe(78000);   // 待结算净额 +¥780.00
      expect(summary.pendingLoans.length).toBe(1);
      expect(summary.pendingReimbursements.length).toBe(1);
    });

    it('allows toggling reimbursement feature switch on and off in preference store', async () => {
      const { usePreferenceStore } = await import('../../src/stores/usePreferenceStore');
      const store = usePreferenceStore.getState();
      expect(store.isReimbursementEnabled).toBe(true);

      store.setReimbursementEnabled(false);
      expect(usePreferenceStore.getState().isReimbursementEnabled).toBe(false);

      store.setReimbursementEnabled(true);
      expect(usePreferenceStore.getState().isReimbursementEnabled).toBe(true);
    });

    it('allows toggling amortization feature switch on and off in preference store', async () => {
      const { usePreferenceStore } = await import('../../src/stores/usePreferenceStore');
      const store = usePreferenceStore.getState();
      expect(store.isAmortizationEnabled).toBe(false);

      store.setAmortizationEnabled(true);
      expect(usePreferenceStore.getState().isAmortizationEnabled).toBe(true);

      store.setAmortizationEnabled(false);
      expect(usePreferenceStore.getState().isAmortizationEnabled).toBe(false);
    });
  });
});
