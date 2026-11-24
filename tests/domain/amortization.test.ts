import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../src/types/transaction';
import {
  getAmortizeConfig,
  diffInMonths,
  computeAmortizedMonthlyAmount,
  computeAmortizedYearlyAmount,
  computePendingInstallments,
  projectTransactionsForMonth,
} from '../../src/domain/finance/amortization';
import { computeMonthSummary } from '../../src/domain/finance/balanceCalculator';

describe('Amortization Domain (分期支出平滑分摊算法)', () => {
  it('正确解析分期配置，非分期或无效月数返回 null', () => {
    const normalTx: Transaction = {
      id: 'tx1',
      type: 'expense',
      amount: 1000,
      categoryId: 'cat1',
      accountId: 'acc1',
      date: '2026-11-01',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };
    expect(getAmortizeConfig(normalTx)).toBeNull();

    const disabledTx: Transaction = {
      ...normalTx,
      ext: { amortize: { enabled: false, months: 6 } },
    };
    expect(getAmortizeConfig(disabledTx)).toBeNull();

    const singleMonthTx: Transaction = {
      ...normalTx,
      ext: { amortize: { enabled: true, months: 1 } },
    };
    expect(getAmortizeConfig(singleMonthTx)).toBeNull();

    const validTx: Transaction = {
      ...normalTx,
      ext: { amortize: { enabled: true, months: 6 } },
    };
    expect(getAmortizeConfig(validTx)).toEqual({
      enabled: true,
      months: 6,
      startMonth: '2026-11',
    });
  });

  it('正确计算跨月差异月份数 diffInMonths', () => {
    expect(diffInMonths('2026-11', '2026-11')).toBe(0);
    expect(diffInMonths('2026-11', '2026-12')).toBe(1);
    expect(diffInMonths('2026-11', '2027-01')).toBe(2);
    expect(diffInMonths('2026-11', '2027-04')).toBe(5);
    expect(diffInMonths('2026-11', '2026-10')).toBe(-1);
  });

  it('平滑分摊：6000元分6期，在各月份准确分摊1000元', () => {
    const rentTx: Transaction = {
      id: 'rent1',
      type: 'expense',
      amount: 600000, // 6000元
      categoryId: 'rent_cat',
      accountId: 'bank_card',
      date: '2026-11-05',
      ext: { amortize: { enabled: true, months: 6 } },
      createdAt: '2026-11-05T10:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    };

    expect(computeAmortizedMonthlyAmount(rentTx, '2026-10')).toBe(0);
    expect(computeAmortizedMonthlyAmount(rentTx, '2026-11')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2026-12')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2027-01')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2027-02')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2027-03')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2027-04')).toBe(100000);
    expect(computeAmortizedMonthlyAmount(rentTx, '2027-05')).toBe(0);

    // 总和完全守恒
    const months = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'];
    const sum = months.reduce((acc, ym) => acc + computeAmortizedMonthlyAmount(rentTx, ym), 0);
    expect(sum).toBe(600000);
  });

  it('分摊余数无损守恒：100元分3期（33.34 + 33.33 + 33.33 = 100.00）', () => {
    const oddTx: Transaction = {
      id: 'odd1',
      type: 'expense',
      amount: 10000, // 100.00元
      categoryId: 'sub_cat',
      accountId: 'alipay',
      date: '2026-11-01',
      ext: { amortize: { enabled: true, months: 3 } },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };

    expect(computeAmortizedMonthlyAmount(oddTx, '2026-11')).toBe(3334);
    expect(computeAmortizedMonthlyAmount(oddTx, '2026-12')).toBe(3333);
    expect(computeAmortizedMonthlyAmount(oddTx, '2027-01')).toBe(3333);
    expect(computeAmortizedMonthlyAmount(oddTx, '2027-02')).toBe(0);

    const sum = 3334 + 3333 + 3333;
    expect(sum).toBe(10000);
  });

  it('跨年分摊汇总：2026-11分6期（2026年占2期2000元，2027年占4期4000元）', () => {
    const rentTx: Transaction = {
      id: 'rent1',
      type: 'expense',
      amount: 600000,
      categoryId: 'rent_cat',
      accountId: 'bank_card',
      date: '2026-11-05',
      ext: { amortize: { enabled: true, months: 6 } },
      createdAt: '2026-11-05T10:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    };

    expect(computeAmortizedYearlyAmount(rentTx, '2026')).toBe(200000);
    expect(computeAmortizedYearlyAmount(rentTx, '2027')).toBe(400000);
    expect(computeAmortizedYearlyAmount(rentTx, '2025')).toBe(0);
    expect(computeAmortizedYearlyAmount(rentTx, '2028')).toBe(0);
  });

  it('calculates pending installment liabilities and remaining periods correctly', () => {
    const tx1: Transaction = {
      id: 'tx_phone',
      type: 'expense',
      amount: 1200000,
      categoryId: 'cat_digi',
      accountId: 'acct_credit',
      date: '2026-06-15',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '2026-06-15T10:00:00Z',
      updatedAt: '2026-06-15T10:00:00Z',
    };

    const tx2: Transaction = {
      id: 'tx_normal',
      type: 'expense',
      amount: 30000,
      categoryId: 'cat_food',
      accountId: 'acct_wx',
      date: '2026-11-10',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    };

    const result = computePendingInstallments([tx1, tx2], '2026-11');
    expect(result.installments.length).toBe(1);
    expect(result.installments[0].months).toBe(12);
    expect(result.installments[0].elapsedMonths).toBe(6);
    expect(result.installments[0].remainingMonths).toBe(6);
    expect(result.installments[0].monthlyAmount).toBe(100000);
    expect(result.installments[0].remainingDebt).toBe(600000);
    expect(result.totalRemainingDebt).toBe(600000);

    const pastResult = computePendingInstallments([tx1], '2027-06');
    expect(pastResult.installments.length).toBe(0);
    expect(pastResult.totalRemainingDebt).toBe(0);
  });

  it('projectTransactionsForMonth: 准确将分期流水投射到各目标月份', () => {
    const normalTx: Transaction = {
      id: 'tx_normal',
      type: 'expense',
      amount: 5000,
      categoryId: 'cat_food',
      accountId: 'acc1',
      date: '2026-11-10',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    };

    const installTx: Transaction = {
      id: 'tx_phone',
      type: 'expense',
      amount: 120000, // 1200元分12期，每月100元
      categoryId: 'cat_digital',
      accountId: 'acc_credit',
      date: '2026-11-15',
      note: '购买手机',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z',
    };

    const allTxs = [normalTx, installTx];

    // 2026-11 (首期)
    const novTxs = projectTransactionsForMonth(allTxs, '2026-11');
    expect(novTxs.length).toBe(2);
    const novInstall = novTxs.find((t) => t.id === 'tx_phone');
    expect(novInstall).toBeDefined();
    expect(novInstall?.amount).toBe(10000); // 100元
    expect(novInstall?.note).toContain('分期 1/12期');

    // 2026-12 (第2期)
    const decTxs = projectTransactionsForMonth(allTxs, '2026-12');
    expect(decTxs.length).toBe(1);
    const decInstall = decTxs[0];
    expect(decInstall.id).toBe('tx_phone_amort_2026-12');
    expect(decInstall.amount).toBe(10000);
    expect(decInstall.date).toBe('2026-12-15');
    expect(decInstall.note).toBe('购买手机 (分期 2/12期)');
    expect((decInstall.ext?.amortize as Record<string, unknown>)?.originalTxId).toBe('tx_phone');

    // 2027-10 (最后一期，第12期)
    const lastTxs = projectTransactionsForMonth(allTxs, '2027-10');
    expect(lastTxs.length).toBe(1);
    expect(lastTxs[0].amount).toBe(10000);
    expect(lastTxs[0].note).toBe('购买手机 (分期 12/12期)');

    // 2027-11 (分期结束)
    const expiredTxs = projectTransactionsForMonth(allTxs, '2027-11');
    expect(expiredTxs.length).toBe(0);
  });

  it('computeMonthSummary: 开启分期平滑时，账本顶部汇总准确计算分期月度额度', () => {
    const installTx: Transaction = {
      id: 'tx_laptop',
      type: 'expense',
      amount: 1200000, // 12000元分12期，每月1000元
      categoryId: 'cat_digital',
      accountId: 'acc_credit',
      date: '2026-11-01',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };

    const salaryTx: Transaction = {
      id: 'tx_salary',
      type: 'income',
      amount: 2000000, // 20000元收入
      categoryId: 'cat_salary',
      accountId: 'acc_bank',
      date: '2026-11-10',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    };

    const allTxs = [installTx, salaryTx];
    const novTxs = allTxs.filter((t) => t.date.startsWith('2026-11'));

    // 开启分期平滑
    const novSummary = computeMonthSummary(novTxs, allTxs, {
      currentMonth: '2026-11',
      isAmortizationEnabled: true,
    });
    expect(novSummary.totalIncome).toBe(2000000);
    expect(novSummary.totalExpense).toBe(100000); // 准确计算为1000元，而非整笔12000元
    expect(novSummary.netBalance).toBe(1900000);

    // 2026-12 月份汇总
    const decTxs: Transaction[] = []; // 本月无其他支出
    const decSummary = computeMonthSummary(decTxs, allTxs, {
      currentMonth: '2026-12',
      isAmortizationEnabled: true,
    });
    expect(decSummary.totalExpense).toBe(100000); // 准确分摊1000元
    expect(decSummary.netBalance).toBe(-100000);

    // 关闭分期平滑时，回退到原生自然月全额统计
    const rawNovSummary = computeMonthSummary(novTxs, allTxs, {
      currentMonth: '2026-11',
      isAmortizationEnabled: false,
    });
    expect(rawNovSummary.totalExpense).toBe(1200000); // 12000元整笔
  });
});
