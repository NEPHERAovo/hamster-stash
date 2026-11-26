import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionService } from '../../src/domain/transaction/transactionService';
import { AccountService } from '../../src/domain/account/accountService';
import { DEFAULT_CATEGORIES } from '../../src/core/db/defaultData';
import { parseTabularFile } from '../../src/domain/import-export/csvParser';
import {
  buildDeterministicImportId,
  buildWealthMonthlyTxId,
  classifyWechatCategory,
  composeBillNote,
  detectBillSource,
  extractExistingTransactionMap,
  inferAccountType,
  isWealthDailyEarningRow,
  normalizeBankName,
  normalizePaymentAccount,
  preprocessBillTable,
  shouldSkipBillStatus,
} from '../../src/domain/import-export/billNormalizer';
import {
  extractCategoriesFromCsv,
  extractTransactionTypesFromCsv,
  mapConfiguredCsvRows,
  mapElephantCsvRows,
} from '../../src/domain/import-export/csvMapper';
import { IMPORT_PRESETS } from '../../src/domain/import-export/importPresets';
import { ImportService } from '../../src/domain/import-export/importService';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

function buildDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    createdAt: '',
    updatedAt: '',
  }));
}

describe('WeChat & Alipay Bill Normalizer', () => {
  it('detects bill source from headers and metadata', () => {
    expect(
      detectBillSource([
        '交易时间',
        '交易类型',
        '交易对方',
        '商品',
        '收/支',
        '金额(元)',
        '支付方式',
        '当前状态',
      ])
    ).toBe('wechat');

    expect(
      detectBillSource([
        '交易时间',
        '交易分类',
        '交易对方',
        '对方账号',
        '商品说明',
        '收/支',
        '金额',
        '收/付款方式',
        '交易状态',
      ])
    ).toBe('alipay');

    expect(detectBillSource(['日期', '分类名称', '收支', '金额', '账户'])).toBe('elephant');
    expect(detectBillSource(['Date', 'Amount', 'Memo'])).toBe('standard');
  });

  it('normalizes bank names and payment accounts across WeChat and Alipay', () => {
    expect(normalizeBankName('中国工商银行储蓄卡(9976)')).toBe('工商银行储蓄卡(9976)');
    expect(normalizeBankName('中国建设银行储蓄卡(8760)')).toBe('建设银行储蓄卡(8760)');
    expect(normalizeBankName('中国银行储蓄卡(9155)')).toBe('中国银行储蓄卡(9155)');

    expect(normalizePaymentAccount('wechat', '零钱')).toBe('微信零钱');
    expect(normalizePaymentAccount('wechat', '零钱通')).toBe('微信零钱通');
    expect(normalizePaymentAccount('wechat', '/', '已存入零钱', '收入')).toBe('微信零钱');
    expect(normalizePaymentAccount('wechat', '工商银行储蓄卡(9976)')).toBe('工商银行储蓄卡(9976)');

    expect(normalizePaymentAccount('alipay', '花呗&碰一下立减')).toBe('花呗');
    expect(
      normalizePaymentAccount('alipay', '建设银行储蓄卡(8760)&红包&建设银行立减金&现金抵价券')
    ).toBe('建设银行储蓄卡(8760)');
    expect(normalizePaymentAccount('alipay', '花呗分期(3期)')).toBe('花呗');
    expect(normalizePaymentAccount('alipay', '建设银行信用卡分期(8291) 3期')).toBe(
      '建设银行信用卡(8291)'
    );
    expect(normalizePaymentAccount('alipay', '账户余额')).toBe('支付宝余额');
    expect(normalizePaymentAccount('alipay', '', '交易成功', '收入')).toBe('支付宝余额');

    expect(inferAccountType('花呗')).toBe('credit');
    expect(inferAccountType('建设银行信用卡(8291)')).toBe('credit');
    expect(inferAccountType('微信零钱')).toBe('savings');
    expect(inferAccountType('工商银行储蓄卡(9976)')).toBe('savings');
  });

  it('classifies WeChat transactions deterministically by type and merchant keywords', () => {
    expect(classifyWechatCategory('美团平台商户-退款', '美团平台商户', '/', '收入')).toBe('退款');
    expect(classifyWechatCategory('微信红包', '张三', '/', '收入')).toBe('红包');
    expect(classifyWechatCategory('微信红包', '张三', '/', '支出')).toBe('人情');
    expect(classifyWechatCategory('转账', '李四', '转账备注:微信转账', '支出')).toBe('转账');
    expect(classifyWechatCategory('商户消费', '张满堂市井火锅', '美团收银', '支出')).toBe('餐饮');
    expect(classifyWechatCategory('商户消费', '朴朴超市', '生鲜订单', '支出')).toBe('超市');
    expect(classifyWechatCategory('商户消费', '拼多多', '日用订单', '支出')).toBe('购物');
    expect(classifyWechatCategory('商户消费', '中铁网络', '高铁票', '支出')).toBe('交通');
    expect(classifyWechatCategory('商户消费', '北京利天物业管理有限公司', '物业费', '支出')).toBe(
      '住房'
    );
    expect(classifyWechatCategory('商户消费', '中国电信', '话费充值', '支出')).toBe('通讯');
    expect(classifyWechatCategory('商户消费', '益丰大药房', '药品', '支出')).toBe('医疗');
    expect(classifyWechatCategory('商户消费', '杭州网易雷火科技有限公司', '游戏充值', '支出')).toBe(
      '娱乐'
    );
  });

  it('composes clean notes and filters closed/full-refund statuses', () => {
    expect(composeBillNote('alipay', '任我卤', '经营码交易', '')).toBe('任我卤');
    expect(composeBillNote('wechat', '拼多多', '商户单号XP123456', '已优惠¥0.20')).toBe(
      '拼多多 · 已优惠¥0.20'
    );
    expect(composeBillNote('wechat', '美团', '美团外卖午餐', '/')).toBe('美团外卖午餐');
    expect(composeBillNote('wechat', '🦀', '转账备注:微信转账', '/')).toBe('🦀');

    expect(shouldSkipBillStatus('alipay', '交易关闭', '支出')).toBe(true);
    expect(shouldSkipBillStatus('alipay', '已关闭', '不计收支')).toBe(true);
    expect(shouldSkipBillStatus('alipay', '退款成功', '支出')).toBe(true);
    expect(shouldSkipBillStatus('alipay', '交易成功', '支出')).toBe(false);

    expect(shouldSkipBillStatus('wechat', '已全额退款', '支出')).toBe(true);
    expect(shouldSkipBillStatus('wechat', '对方已退还', '支出')).toBe(true);
    expect(shouldSkipBillStatus('wechat', '支付成功', '支出')).toBe(false);
    expect(shouldSkipBillStatus('wechat', '已退款(¥5.59)', '支出')).toBe(false);
  });

  it('prefers non-archived categories when resolving preset aliases', () => {
    const categories = buildDefaultCategories();
    const stats = extractCategoriesFromCsv(
      ['交易时间', '交易分类', '收/支', '金额'],
      [
        ['2026-11-01', '服饰装扮', '支出', '100'],
        ['2026-11-02', '数码电器', '支出', '200'],
        ['2026-11-03', '餐饮美食', '支出', '30'],
      ],
      '交易分类',
      '收/支',
      categories,
      IMPORT_PRESETS.find((p) => p.id === 'alipay')?.categoryAliases
    );

    const byName = new Map(stats.map((s) => [s.rawName, s.suggestedCategoryId]));
    expect(byName.get('服饰装扮')).toBe('cat_shop');
    expect(byName.get('数码电器')).toBe('cat_shop');
    expect(byName.get('餐饮美食')).toBe('cat_food');
  });

  it('marks WeChat slash neutral direction as skip in extractTransactionTypesFromCsv', () => {
    const types = extractTransactionTypesFromCsv(
      ['收/支'],
      [['支出'], ['收入'], ['/'], ['不计收支']],
      '收/支'
    );
    const map = new Map(types.map((t) => [t.rawName, t.suggestedType]));
    expect(map.get('支出')).toBe('expense');
    expect(map.get('收入')).toBe('income');
    expect(map.get('/')).toBe('skip');
    expect(map.get('不计收支')).toBe('skip');
  });
});

describe('WeChat & Alipay ImportService Integration', () => {
  let adapter: MemoryAdapter;
  let txRepo: TransactionRepository;
  let acctRepo: AccountRepository;
  let catRepo: CategoryRepository;
  let txService: TransactionService;
  let acctService: AccountService;
  let categories: Category[];
  let defaultAccount: Account;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    txRepo = new TransactionRepository(adapter);
    acctRepo = new AccountRepository(adapter);
    catRepo = new CategoryRepository(adapter);
    txService = new TransactionService(txRepo, acctRepo, catRepo);
    acctService = new AccountService(acctRepo, txRepo);

    categories = [];
    for (const c of DEFAULT_CATEGORIES) {
      const created = await catRepo.create(c);
      categories.push(created);
    }
    defaultAccount = await acctRepo.create({
      id: 'acct_default',
      name: '默认账户',
      type: 'savings',
      balance: 0,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
    });
  });

  it('imports preprocessed Alipay rows, creates typed accounts only for effective rows, and deduplicates re-imports', async () => {
    const alipayPreset = IMPORT_PRESETS.find((p) => p.id === 'alipay')!;
    const rawTable = {
      headers: [
        '交易时间',
        '交易分类',
        '交易对方',
        '对方账号',
        '商品说明',
        '收/支',
        '金额',
        '收/付款方式',
        '交易状态',
        '交易订单号',
        '商家订单号',
        '备注',
      ],
      rows: [
        [
          '2026-11-11 15:19:35',
          '餐饮美食',
          '船长海鲜',
          'a@qq.com',
          '碳烤鱿鱼丝',
          '支出',
          '22.18',
          '建设银行储蓄卡(8760)&红包&建设银行立减金',
          '交易成功',
          'ali_order_1',
          'm1',
          '',
        ],
        [
          '2026-11-10 12:00:00',
          '服饰装扮',
          '旗舰店',
          '/',
          '外套',
          '支出',
          '199.00',
          '花呗&碰一下立减',
          '交易成功',
          'ali_order_2',
          'm2',
          '',
        ],
        [
          '2026-11-09 09:00:00',
          '日用百货',
          '超市',
          '/',
          '已取消商品',
          '支出',
          '50.00',
          '不存在的关闭账户',
          '交易关闭',
          'ali_order_closed',
          'm3',
          '',
        ],
        [
          '2026-11-08 06:00:00',
          '投资理财',
          '基金',
          '/',
          '余额宝收益',
          '不计收支',
          '2.99',
          '余额宝',
          '交易成功',
          'ali_order_neutral',
          'm4',
          '',
        ],
      ],
    };

    const preprocessed = preprocessBillTable(rawTable, 'alipay');
    const importService = new ImportService();

    const firstRes = await importService.executeCsvImport({
      headers: preprocessed.headers,
      rows: preprocessed.rows,
      mapping: alipayPreset.defaultMapping,
      categoryMapping: {
        餐饮美食: 'cat_food',
        服饰装扮: 'cat_shop',
      },
      typeMapping: {
        支出: 'expense',
        收入: 'income',
        不计收支: 'skip',
      },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: [defaultAccount],
      autoCreateAccounts: true,
      source: 'alipay',
      skipClosedAndFullRefunds: true,
      skipDuplicates: true,
      existingTransactions: [],
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });

    expect(firstRes.importedCount).toBe(2);
    expect(firstRes.filteredStatusCount).toBe(1);
    expect(firstRes.createdAccountCount).toBe(2);

    const allAccounts = await acctRepo.findAll();
    const huabei = allAccounts.find((a) => a.name === '花呗');
    const ccb = allAccounts.find((a) => a.name === '建设银行储蓄卡(8760)');
    expect(huabei?.type).toBe('credit');
    expect(ccb?.type).toBe('savings');
    expect(allAccounts.find((a) => a.name === '不存在的关闭账户')).toBeUndefined();

    const storedTxs = await txRepo.findAll();
    expect(storedTxs.length).toBe(2);
    expect(new Set(extractExistingTransactionMap(storedTxs).keys())).toEqual(
      new Set(['ali_ali_order_1', 'ali_ali_order_2'])
    );

    const secondRes = await importService.executeCsvImport({
      headers: preprocessed.headers,
      rows: preprocessed.rows,
      mapping: alipayPreset.defaultMapping,
      categoryMapping: {
        餐饮美食: 'cat_food',
        服饰装扮: 'cat_shop',
      },
      typeMapping: {
        支出: 'expense',
        收入: 'income',
        不计收支: 'skip',
      },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: allAccounts,
      autoCreateAccounts: true,
      source: 'alipay',
      skipClosedAndFullRefunds: true,
      skipDuplicates: true,
      existingTransactions: storedTxs,
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });

    expect(secondRes.importedCount).toBe(0);
    expect(secondRes.duplicateCount).toBe(2);
  });

  const sampleDir = 'D:/bill/originalData';
  it.runIf(fs.existsSync(sampleDir))(
    'processes all real WeChat XLSX and Alipay CSV files cleanly with zero duplicates on re-import',
    async () => {
      const files = fs.readdirSync(sampleDir);
      const wxFiles = files.filter((f) => f.includes('微信支付') && f.endsWith('.xlsx')).sort();
      const alipayFiles = files.filter((f) => f.startsWith('支付宝') && f.endsWith('.csv')).sort();

      expect(wxFiles.length).toBe(8);
      expect(alipayFiles.length).toBe(4);

      const wxPreset = IMPORT_PRESETS.find((p) => p.id === 'wechat')!;
      let wxHeaders: string[] = [];
      const wxRows: string[][] = [];
      for (const name of wxFiles) {
        const buf = fs.readFileSync(path.join(sampleDir, name));
        const parsed = await parseTabularFile(new File([buf], name));
        expect(detectBillSource(parsed.headers, parsed.metadataLines)).toBe('wechat');
        const prep = preprocessBillTable(parsed, 'wechat');
        if (wxHeaders.length === 0) wxHeaders = prep.headers;
        wxRows.push(...prep.rows);
      }
      expect(wxRows.length).toBe(2637);

      const alipayPreset = IMPORT_PRESETS.find((p) => p.id === 'alipay')!;
      let aliHeaders: string[] = [];
      const aliRows: string[][] = [];
      for (const name of alipayFiles) {
        const buf = fs.readFileSync(path.join(sampleDir, name));
        const parsed = await parseTabularFile(new File([buf], name));
        expect(detectBillSource(parsed.headers, parsed.metadataLines)).toBe('alipay');
        const prep = preprocessBillTable(parsed, 'alipay');
        if (aliHeaders.length === 0) aliHeaders = prep.headers;
        aliRows.push(...prep.rows);
      }
      expect(aliRows.length).toBe(5029);

      const wxMapped = mapConfiguredCsvRows(wxHeaders, wxRows, {
        mapping: wxPreset.defaultMapping,
        categoryMapping: {},
        typeMapping: { 支出: 'expense', 收入: 'income', '/': 'skip' },
        defaultAccountId: defaultAccount.id,
        defaultExpenseCategoryId: 'cat_other',
        defaultIncomeCategoryId: 'cat_other_in',
        existingCategories: categories,
        existingAccounts: [defaultAccount],
        source: 'wechat',
        skipClosedAndFullRefunds: true,
        skipDuplicates: true,
      });
      expect(wxMapped.records.length).toBeGreaterThan(2000);
      expect(wxMapped.filteredStatusCount).toBeGreaterThan(400);

      const wxDistinctAccounts = new Set(
        wxMapped.records.map((r) => r.rawAccountName).filter(Boolean)
      );
      expect(wxDistinctAccounts.size).toBeLessThanOrEqual(8);

      const aliMapped = mapConfiguredCsvRows(aliHeaders, aliRows, {
        mapping: alipayPreset.defaultMapping,
        categoryMapping: {},
        typeMapping: { 支出: 'expense', 收入: 'income', 不计收支: 'skip' },
        defaultAccountId: defaultAccount.id,
        defaultExpenseCategoryId: 'cat_other',
        defaultIncomeCategoryId: 'cat_other_in',
        existingCategories: categories,
        existingAccounts: [defaultAccount],
        source: 'alipay',
        skipClosedAndFullRefunds: true,
        skipDuplicates: true,
      });
      expect(aliMapped.records.length).toBeGreaterThan(2500);
      expect(aliMapped.filteredStatusCount).toBeGreaterThan(150);

      const aliAccounts = new Set(
        aliMapped.records.map((r) => r.rawAccountName).filter(Boolean)
      );
      for (const acctName of aliAccounts) {
        expect(acctName).not.toContain('&');
        expect(acctName).not.toContain('立减');
        expect(acctName).not.toContain('红包');
      }

      const aliRollupMapped = mapConfiguredCsvRows(aliHeaders, aliRows, {
        mapping: alipayPreset.defaultMapping,
        categoryMapping: {},
        typeMapping: { 支出: 'expense', 收入: 'income', 不计收支: 'skip' },
        defaultAccountId: defaultAccount.id,
        defaultExpenseCategoryId: 'cat_other',
        defaultIncomeCategoryId: 'cat_other_in',
        existingCategories: categories,
        existingAccounts: [defaultAccount],
        source: 'alipay',
        skipClosedAndFullRefunds: true,
        skipDuplicates: true,
        aggregateWealthEarningsMonthly: true,
      });
      const step3Types = extractTransactionTypesFromCsv(
        aliHeaders,
        aliRows,
        alipayPreset.defaultMapping.typeCol,
        {
          categoryColName: alipayPreset.defaultMapping.categoryCol,
          amountColName: alipayPreset.defaultMapping.amountCol,
          statusColName: alipayPreset.defaultMapping.statusCol,
          noteColName: alipayPreset.defaultMapping.noteCol,
          source: 'alipay',
          skipClosedAndFullRefunds: true,
          aggregateWealthEarningsMonthly: true,
        }
      );
      const step3NeutralCount = step3Types.find((t) => t.rawName === '不计收支')?.count ?? 0;
      expect(step3NeutralCount).toBe(aliRollupMapped.neutralCount);
      expect(aliRollupMapped.wealthDailyRowCount).toBe(1226);
      expect(aliRollupMapped.wealthRollupCount).toBeGreaterThanOrEqual(36);
      const rollups = aliRollupMapped.records.filter((r) => r.isWealthMonthlyRollup);
      expect(rollups.length).toBe(aliRollupMapped.wealthRollupCount);
      expect(rollups.every((r) => r.categoryId === 'cat_invest' && r.type === 'income')).toBe(true);
    }
  );

  it('assigns deterministic fingerprint IDs to Elephant CSV rows and deduplicates re-imports even after local edits', async () => {
    const headers = ['日期', '分类名称', '收支', '金额', '账户', '备注', '报销'];
    const rows = [
      ['2026/11/08 12:00', '吃饭', '支出', '15', '默认资产', '午餐', ''],
      ['2026/11/08 12:00', '吃饭', '支出', '15', '默认资产', '午餐', ''],
      ['2026/11/08 21:00', '购物', '支出', '33', '默认资产', '日用品', ''],
    ];

    const mapped = mapElephantCsvRows(headers, rows, {
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: [defaultAccount],
    });

    expect(mapped.records).toHaveLength(3);
    expect(mapped.records[0].id).toMatch(/^csv_standard_[0-9a-f]{16}$/);
    expect(mapped.records[1].id).toMatch(/^csv_standard_[0-9a-f]{16}$/);
    expect(mapped.records[0].id).not.toBe(mapped.records[1].id);
    expect(mapped.records[0].ext).toBeUndefined();

    const elephantPreset = IMPORT_PRESETS.find((p) => p.id === 'elephant')!;
    const importService = new ImportService();
    const res1 = await importService.executeCsvImport({
      headers,
      rows,
      mapping: elephantPreset.defaultMapping,
      categoryMapping: { 吃饭: 'cat_food', 购物: 'cat_shop' },
      typeMapping: { 支出: 'expense' },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: [defaultAccount],
      autoCreateAccounts: false,
      source: 'elephant',
      skipDuplicates: true,
      existingTransactions: [],
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });
    expect(res1.importedCount).toBe(3);

    const stored = await txRepo.findAll();
    expect(stored.every((tx) => tx.id.startsWith('csv_elephant_'))).toBe(true);

    // Simulate local edits to category, note, and owned-items link on one record
    await txService.updateTransaction(stored[0].id, {
      categoryId: 'cat_shop',
      note: '已修改备注',
      ext: {
        ...stored[0].ext,
        'owned-items': { itemId: 'item_edited', itemRole: 'buy', kind: 'physical' },
      },
    });
    const updatedStored = await txRepo.findAll();

    const res2 = await importService.executeCsvImport({
      headers,
      rows,
      mapping: elephantPreset.defaultMapping,
      categoryMapping: { 吃饭: 'cat_food', 购物: 'cat_shop' },
      typeMapping: { 支出: 'expense' },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: [defaultAccount],
      autoCreateAccounts: false,
      source: 'elephant',
      skipDuplicates: true,
      existingTransactions: updatedStored,
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });
    expect(res2.importedCount).toBe(0);
    expect(res2.duplicateCount).toBe(3);
  });

  it('generates deterministic IDs and updates partial-month wealth rollup in place without balance drift', async () => {
    expect(buildDeterministicImportId('wechat', '4500000559')).toBe('wx_4500000559');
    expect(buildDeterministicImportId('alipay', '20261111_abc')).toBe('ali_20261111_abc');
    expect(
      isWealthDailyEarningRow('alipay', {
        category: '投资理财',
        product: '余额宝-2026.11.10-收益发放',
        counterparty: '建信基金管理有限公司',
        direction: '不计收支',
        status: '交易成功',
      })
    ).toBe(true);

    const alipayPreset = IMPORT_PRESETS.find((p) => p.id === 'alipay')!;
    const partialTable = preprocessBillTable(
      {
        headers: [
          '交易时间',
          '交易分类',
          '交易对方',
          '对方账号',
          '商品说明',
          '收/支',
          '金额',
          '收/付款方式',
          '交易状态',
          '交易订单号',
          '商家订单号',
          '备注',
        ],
        rows: [
          [
            '2026-11-01 06:00:00',
            '投资理财',
            '基金',
            '/',
            '余额宝-2026.10.31-收益发放',
            '不计收支',
            '2.50',
            '余额宝',
            '交易成功',
            'yb_1',
            '/',
            '',
          ],
          [
            '2026-11-02 06:00:00',
            '投资理财',
            '基金',
            '/',
            '余额宝-2026.11.01-收益发放',
            '不计收支',
            '3.00',
            '余额宝',
            '交易成功',
            'yb_2',
            '/',
            '',
          ],
        ],
      },
      'alipay'
    );

    const importService = new ImportService();
    const res1 = await importService.executeCsvImport({
      headers: partialTable.headers,
      rows: partialTable.rows,
      mapping: alipayPreset.defaultMapping,
      categoryMapping: {},
      typeMapping: { 不计收支: 'skip' },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: [defaultAccount],
      autoCreateAccounts: true,
      source: 'alipay',
      skipClosedAndFullRefunds: true,
      skipDuplicates: true,
      aggregateWealthEarningsMonthly: true,
      existingTransactions: [],
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });

    expect(res1.importedCount).toBe(1);
    expect(res1.wealthRollupCount).toBe(1);
    expect(res1.wealthDailyRowCount).toBe(2);

    const accountsAfter1 = await acctRepo.findAll();
    const yuebaoAcct1 = accountsAfter1.find((a) => a.name === '余额宝');
    expect(yuebaoAcct1?.balance).toBe(550);

    const fullMonthTable = preprocessBillTable(
      {
        headers: [
          '交易时间',
          '交易分类',
          '交易对方',
          '对方账号',
          '商品说明',
          '收/支',
          '金额',
          '收/付款方式',
          '交易状态',
          '交易订单号',
          '商家订单号',
          '备注',
        ],
        rows: [
          [
            '2026-11-01 06:00:00',
            '投资理财',
            '基金',
            '/',
            '余额宝-2026.10.31-收益发放',
            '不计收支',
            '2.50',
            '余额宝',
            '交易成功',
            'yb_1',
            '/',
            '',
          ],
          [
            '2026-11-02 06:00:00',
            '投资理财',
            '基金',
            '/',
            '余额宝-2026.11.01-收益发放',
            '不计收支',
            '3.00',
            '余额宝',
            '交易成功',
            'yb_2',
            '/',
            '',
          ],
          [
            '2026-11-03 06:00:00',
            '投资理财',
            '基金',
            '/',
            '余额宝-2026.11.02-收益发放',
            '不计收支',
            '4.50',
            '余额宝',
            '交易成功',
            'yb_3',
            '/',
            '',
          ],
        ],
      },
      'alipay'
    );

    const existingTxs1 = await txRepo.findAll();
    const res2 = await importService.executeCsvImport({
      headers: fullMonthTable.headers,
      rows: fullMonthTable.rows,
      mapping: alipayPreset.defaultMapping,
      categoryMapping: {},
      typeMapping: { 不计收支: 'skip' },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: accountsAfter1,
      autoCreateAccounts: true,
      source: 'alipay',
      skipClosedAndFullRefunds: true,
      skipDuplicates: true,
      aggregateWealthEarningsMonthly: true,
      existingTransactions: existingTxs1,
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });

    expect(res2.importedCount).toBe(1);
    const existingTxs2 = await txRepo.findAll();
    expect(existingTxs2.length).toBe(1);
    expect(existingTxs2[0].id).toBe(buildWealthMonthlyTxId('alipay', '2026-11', '余额宝'));
    expect(existingTxs2[0].amount).toBe(1000);

    const yuebaoAcct2 = (await acctRepo.findAll()).find((a) => a.name === '余额宝');
    expect(yuebaoAcct2?.balance).toBe(1000);

    const res3 = await importService.executeCsvImport({
      headers: fullMonthTable.headers,
      rows: fullMonthTable.rows,
      mapping: alipayPreset.defaultMapping,
      categoryMapping: {},
      typeMapping: { 不计收支: 'skip' },
      defaultAccountId: defaultAccount.id,
      defaultExpenseCategoryId: 'cat_other',
      defaultIncomeCategoryId: 'cat_other_in',
      existingCategories: categories,
      existingAccounts: await acctRepo.findAll(),
      autoCreateAccounts: true,
      source: 'alipay',
      skipClosedAndFullRefunds: true,
      skipDuplicates: true,
      aggregateWealthEarningsMonthly: true,
      existingTransactions: existingTxs2,
      createAccount: (input) => acctService.createAccount(input),
      importTransactions: (recs, sync) => txService.importTransactions(recs, sync),
    });
    expect(res3.importedCount).toBe(0);
    expect(res3.duplicateCount).toBe(1);
  });
});
