import { describe, it, expect, beforeEach } from 'vitest';
import { parseCsv, generateCsv } from '../../src/domain/import-export/csvParser';
import {
  inferColumnMapping,
  normalizeDate,
  normalizeDateTime,
  normalizeAmount,
  normalizeTransactionType,
  mapStandardCsvRows,
  mapElephantCsvRows,
  mapConfiguredCsvRows,
  extractCategoriesFromCsv,
  exportTransactionsToCsv,
} from '../../src/domain/import-export/csvMapper';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionService } from '../../src/domain/transaction/transactionService';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('CSV Parser & Generator', () => {
  it('should parse standard CSV with quotes and commas inside cells', () => {
    const csv = `"日期","分类名称","收支","金额","账户","备注"\r\n"2026/10/08 19:19","生活","支出","35","默认资产","💇‍♂️"\r\n"2026/10/06 19:18","超市","支出","42.5","默认资产","寿司, 香酥鸡, 薯片"`;
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['日期', '分类名称', '收支', '金额', '账户', '备注']);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual(['2026/10/08 19:19', '生活', '支出', '35', '默认资产', '💇‍♂️']);
    expect(result.rows[1][5]).toBe('寿司, 香酥鸡, 薯片');
  });

  it('should generate standard CSV with UTF-8 BOM', () => {
    const headers = ['日期', '金额'];
    const rows = [['2026-10-08', '35.00']];
    const generated = generateCsv(headers, rows);

    expect(generated.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
    expect(generated).toContain('"日期","金额"');
    expect(generated).toContain('"2026-10-08","35.00"');
  });

  it('should detect real header row when metadata lines precede the table (e.g. WeChat / Alipay)', () => {
    const wechatCsv = `微信支付账单明细\r\n微信商户流水单号: 123456\r\n----------------------\r\n交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注\r\n2026-10-08 12:00:00,商户消费,美团,外卖,支出,38.50,零钱,支付成功,wx123,m123,/`;
    const res = parseCsv(wechatCsv);

    expect(res.headers).toContain('交易时间');
    expect(res.headers).toContain('金额(元)');
    expect(res.headers).toContain('收/支');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0][3]).toBe('外卖');
  });
});

describe('Import Modes: Elephant Stash vs Standard CSV', () => {
  const elephantHeaders = ['日期', '分类名称', '收支', '金额', '账户', '备注', '报销'];

  const categories: Category[] = [
    { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: '', sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'cat_shop', name: '购物', type: 'expense', icon: 'shopping-cart', color: '', sortOrder: 2, createdAt: '', updatedAt: '' },
    { id: 'cat_home', name: '居住', type: 'expense', icon: 'house', color: '', sortOrder: 3, createdAt: '', updatedAt: '' },
    { id: 'cat_transit', name: '交通', type: 'expense', icon: 'train-front', color: '', sortOrder: 4, createdAt: '', updatedAt: '' },
    { id: 'cat_salary', name: '工资', type: 'income', icon: 'wallet', color: '', sortOrder: 5, createdAt: '', updatedAt: '' },
  ];
  const accounts: Account[] = [
    { id: 'acct_default', name: '默认资产', type: 'savings', balance: 100000, currency: 'CNY', icon: 'wallet', sortOrder: 1, createdAt: '', updatedAt: '' },
  ];

  it('Elephant Mode: maps alias categories ("吃饭" -> 餐饮, "生活" -> 居住, "超市" -> 购物) without manual configuration', () => {
    const elephantRows = [
      ['2026/10/08 19:19', '生活', '支出', '35', '默认资产', '理发', ''],
      ['2026/10/07 21:19', '吃饭', '支出', '21', '默认资产', '炸串', ''],
      ['2026/10/06 19:18', '超市', '支出', '42.5', '默认资产', '零食', ''],
      ['2026/09/26 23:19', '交通费', '支出', '9', '默认资产', '地铁', ''],
    ];

    const { records, skippedCount } = mapElephantCsvRows(elephantHeaders, elephantRows, {
      defaultAccountId: 'acct_default',
      defaultExpenseCategoryId: 'cat_shop',
      defaultIncomeCategoryId: 'cat_salary',
      existingCategories: categories,
      existingAccounts: accounts,
    });

    expect(skippedCount).toBe(0);
    expect(records.length).toBe(4);

    expect(records[0].categoryId).toBe('cat_home'); // 生活 -> 居住
    expect(records[0].amount).toBe(3500);
    expect(records[1].categoryId).toBe('cat_food'); // 吃饭 -> 餐饮
    expect(records[1].amount).toBe(2100);
    expect(records[2].categoryId).toBe('cat_shop'); // 超市 -> 购物
    expect(records[3].categoryId).toBe('cat_transit'); // 交通费 -> 交通
  });

  it('Standard Mode: strictly follows user-mapped columns and does not apply Elephant-specific aliases', () => {
    const genericHeaders = ['交易时间', '类目', '类型', '花费', '扣款渠道', '备注'];
    const genericRows = [
      ['2026-10-08', '餐饮', '支出', '35', '默认资产', '午餐'],
      ['2026-10-07', '生活', '支出', '20', '默认资产', '日常'], // "生活"在标准模式下若没有同名分类，回退默认分类，不强行转成居住
    ];

    const mapping = {
      dateCol: '交易时间',
      categoryCol: '类目',
      typeCol: '类型',
      amountCol: '花费',
      accountCol: '扣款渠道',
      noteCol: '备注',
    };

    const { records } = mapStandardCsvRows(genericHeaders, genericRows, {
      mapping,
      defaultAccountId: 'acct_default',
      defaultExpenseCategoryId: 'cat_shop',
      defaultIncomeCategoryId: 'cat_salary',
      existingCategories: categories,
      existingAccounts: accounts,
    });

    expect(records.length).toBe(2);
    expect(records[0].categoryId).toBe('cat_food'); // 餐饮 精确命中
    expect(records[1].categoryId).toBe('cat_shop'); // 生活 没有同名，回退 defaultExpenseCategoryId (cat_shop)
  });

  it('inferColumnMapping helper infers common column names', () => {
    const mapping = inferColumnMapping(['交易时间', '金额(元)', '收支类型', '消费类目', '资金账户', '备注']);
    expect(mapping.dateCol).toBe('交易时间');
    expect(mapping.amountCol).toBe('金额(元)');
    expect(mapping.typeCol).toBe('收支类型');
    expect(mapping.categoryCol).toBe('消费类目');
    expect(mapping.accountCol).toBe('资金账户');
    expect(mapping.noteCol).toBe('备注');
  });

  it('normalizes dates, amounts and types', () => {
    expect(normalizeDate('2026/10/08 19:19')).toBe('2026-10-08');
    expect(normalizeAmount('42.5').cents).toBe(4250);
    expect(normalizeTransactionType('支出')).toBe('expense');
    expect(normalizeTransactionType('收入')).toBe('income');
  });

  it('parses datetime strings into exact local createdAt timestamps while leaving date-only strings unset', () => {
    const withHm = normalizeDateTime('2026/10/08 19:19');
    expect(withHm.date).toBe('2026-10-08');
    expect(withHm.createdAt).toBeDefined();
    const hmDate = new Date(withHm.createdAt!);
    expect(hmDate.getHours()).toBe(19);
    expect(hmDate.getMinutes()).toBe(19);
    expect(hmDate.getSeconds()).toBe(0);

    const withHms = normalizeDateTime('2026-10-08 09:05:30');
    expect(withHms.date).toBe('2026-10-08');
    const hmsDate = new Date(withHms.createdAt!);
    expect(hmsDate.getHours()).toBe(9);
    expect(hmsDate.getMinutes()).toBe(5);
    expect(hmsDate.getSeconds()).toBe(30);

    const dateOnly = normalizeDateTime('2026-10-08');
    expect(dateOnly.date).toBe('2026-10-08');
    expect(dateOnly.createdAt).toBeUndefined();
  });

  it('exports transactions to standard CSV format', () => {
    const txs = [
      {
        id: 'tx_1',
        type: 'expense' as const,
        amount: 3500,
        categoryId: 'cat_food',
        accountId: 'acct_default',
        date: '2026-10-08',
        note: '理发',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const csvOutput = exportTransactionsToCsv(txs, categories, accounts);
    expect(csvOutput).toContain('"日期","分类名称","收支","金额","账户","备注","是否报销","凭证名称"');
    expect(csvOutput).toContain('"2026-10-08","餐饮","支出","35.00","默认资产","理发","否",""');
  });

  it('extractCategoriesFromCsv counts frequency and suggests category mappings', () => {
    const headers = ['日期', '分类', '收支', '金额'];
    const rows = [
      ['2026-10-01', '聚餐', '支出', '100'],
      ['2026-10-02', '聚餐', '支出', '80'],
      ['2026-10-03', '打车', '支出', '30'],
      ['2026-10-04', '兼职', '收入', '500'],
    ];

    const stats = extractCategoriesFromCsv(headers, rows, '分类', '收支', categories, {
      '聚餐': '餐饮',
      '打车': '交通',
    });

    expect(stats.length).toBe(3);
    expect(stats[0].rawName).toBe('聚餐');
    expect(stats[0].count).toBe(2);
    expect(stats[0].suggestedCategoryId).toBe('cat_food'); // 别名命中了餐饮
    expect(stats[1].rawName).toBe('打车');
    expect(stats[1].suggestedCategoryId).toBe('cat_transit'); // 别名命中了交通
    expect(stats[2].rawName).toBe('兼职');
    expect(stats[2].dominantType).toBe('income');
  });

  it('mapConfiguredCsvRows maps explicitly configured categories and respects type mapping', () => {
    const headers = ['日期', '原始分类', '收支', '金额'];
    const rows = [
      ['2026-10-01', '聚餐', '支出', '100'],
      ['2026-10-02', '发工资', '收入', '5000'],
      ['2026-10-03', '资金划转', '不计收支', '1000'],
    ];

    const { records, skippedCount } = mapConfiguredCsvRows(headers, rows, {
      mapping: {
        dateCol: '日期',
        categoryCol: '原始分类',
        typeCol: '收支',
        amountCol: '金额',
      },
      categoryMapping: {
        '聚餐': 'cat_food',
        '发工资': 'cat_salary',
      },
      typeMapping: {
        '不计收支': 'skip',
      },
      defaultAccountId: 'acct_default',
      defaultExpenseCategoryId: 'cat_shop',
      defaultIncomeCategoryId: 'cat_salary',
      existingCategories: categories,
      existingAccounts: accounts,
    });

    expect(skippedCount).toBe(1); // '不计收支' 被标记为 skip 跳过
    expect(records.length).toBe(2);
    expect(records[0].categoryId).toBe('cat_food');
    expect(records[0].amount).toBe(10000);
    expect(records[1].categoryId).toBe('cat_salary');
    expect(records[1].type).toBe('income');
    expect(records[1].amount).toBe(500000);
  });
});

describe('All Data Participates in Account Calculation & Reconcile Flow', () => {
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
      balance: 500000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
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
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'wallet',
      color: 'var(--color-income)',
      sortOrder: 1,
    });
  });

  it('imported transactions always participate in account balance calculation', async () => {
    const records = [
      { type: 'expense' as const, amount: 3500, date: '2026-10-08', categoryId: 'cat_food', accountId: 'acct_wechat', note: '理发' },
      { type: 'expense' as const, amount: 2500, date: '2026-10-07', categoryId: 'cat_food', accountId: 'acct_wechat', note: '餐饮' },
      { type: 'income' as const, amount: 10000, date: '2026-10-06', categoryId: 'cat_salary', accountId: 'acct_wechat', note: '奖金' },
    ];

    const res = await txService.importTransactions(records, true);
    expect(res.importedCount).toBe(3);

    const acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(504000);
  });

  it('user can subsequently reconcile the account (平账校准) to actual balance', async () => {
    const records = [
      { type: 'expense' as const, amount: 300000, date: '2026-10-08', categoryId: 'cat_food', accountId: 'acct_wechat', note: '历史旧账' },
    ];
    await txService.importTransactions(records, true);

    let acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(200000); // 500000 - 300000

    const reconcileResult = await txService.reconcileAccount({
      accountId: 'acct_wechat',
      targetBalance: 480000,
      date: '2026-10-09',
      note: '盘点平账校准',
    });

    expect(reconcileResult.diff).toBe(280000); // +2800 元

    acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(480000); // 对齐为 4800 元

    const tx = await txRepo.findById(reconcileResult.transaction!.id);
    expect(tx?.type).toBe('reconcile');
    expect(tx?.amount).toBe(280000);
  });

  it('editing a transaction (updateTransaction) correctly recalculates account balance delta', async () => {
    const tx = await txService.recordTransaction({
      type: 'expense',
      amount: 10000,
      accountId: 'acct_wechat',
      categoryId: 'cat_food',
      date: '2026-10-08',
      note: '原始支出',
    });

    let acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(490000); // 500000 - 10000

    const updated = await txService.updateTransaction(tx.id, {
      amount: 6000,
      note: '修改后支出',
    });

    expect(updated.amount).toBe(6000);
    acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(494000);
  });

  it('deleting a transaction (deleteTransaction) rolls back account balance', async () => {
    const tx = await txService.recordTransaction({
      type: 'expense',
      amount: 15000,
      accountId: 'acct_wechat',
      categoryId: 'cat_food',
      date: '2026-10-08',
    });

    let acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(485000);

    await txService.deleteTransaction(tx.id);

    acct = await acctRepo.findById('acct_wechat');
    expect(acct?.balance).toBe(500000);
  });

  it('importTransactions persists original datetime timestamps from Elephant CSV rows', async () => {
    const categories: Category[] = [
      { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: '', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];
    const accounts: Account[] = [
      { id: 'acct_wechat', name: '微信零钱', type: 'savings', balance: 500000, currency: 'CNY', icon: 'wallet', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];

    const { records } = mapElephantCsvRows(
      ['日期', '分类名称', '收支', '金额', '账户', '备注'],
      [['2026/10/08 19:19', '吃饭', '支出', '25.5', '微信零钱', '晚餐']],
      {
        defaultAccountId: 'acct_wechat',
        defaultExpenseCategoryId: 'cat_food',
        defaultIncomeCategoryId: 'cat_food',
        existingCategories: categories,
        existingAccounts: accounts,
      }
    );

    await txService.importTransactions(records, true);
    const all = await txRepo.findAll();
    expect(all.length).toBe(1);
    const storedDate = new Date(all[0].createdAt);
    expect(all[0].date).toBe('2026-10-08');
    expect(storedDate.getHours()).toBe(19);
    expect(storedDate.getMinutes()).toBe(19);
  });
});
