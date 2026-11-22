import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../src/types/transaction';
import {
  getAmortizeConfig,
  diffInMonths,
  computeAmortizedMonthlyAmount,
  computeAmortizedYearlyAmount,
  computePendingInstallments,
} from '../../src/domain/finance/amortization';

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
});
