import type { Transaction, TransactionType } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { generateCsv } from './csvParser';
import {
  buildDeterministicImportId,
  buildFingerprintImportId,
  buildWealthMonthlyTxId,
  extractExistingTransactionMap,
  isWealthDailyEarningRow,
  shouldSkipBillStatus,
  type BillSource,
} from './billNormalizer';
import { centsToYuan } from '../finance/balanceCalculator';
import { parseCsvDateTime } from '../../utils/date';

export type ImportMode = 'wechat' | 'alipay' | 'elephant' | 'standard' | 'preset';
export type SkippedReason = 'neutral' | 'status' | 'duplicate' | 'invalid';

export interface SkippedImportItem {
  reason: SkippedReason;
  reasonLabel: string;
  date: string;
  amount: number;
  rawType?: string;
  rawStatus?: string;
  rawAccountName?: string;
  rawCategoryName?: string;
  note?: string;
}

export interface CsvColumnMapping {
  dateCol?: string;
  amountCol?: string;
  typeCol?: string;
  categoryCol?: string;
  accountCol?: string;
  noteCol?: string;
  reimburseCol?: string;
  statusCol?: string;
  orderIdCol?: string;
}

export interface ExtractedCategoryStat {
  rawName: string;
  count: number;
  dominantType: TransactionType;
  suggestedCategoryId?: string;
}

export interface ExtractedTypeStat {
  rawName: string;
  count: number;
  suggestedType: TransactionType | 'skip';
}

export interface PreFilterSummary {
  filteredStatusCount: number;
  invalidAmountCount: number;
  wealthDailyRowCount: number;
}

export interface TableAnalysisOptions {
  mapping: CsvColumnMapping;
  existingCategories?: Category[];
  presetAliases?: Record<string, string | string[]>;
  source?: BillSource;
  skipClosedAndFullRefunds?: boolean;
  aggregateWealthEarningsMonthly?: boolean;
}

export interface TableAnalysisResult {
  categories: ExtractedCategoryStat[];
  types: ExtractedTypeStat[];
  preFilter: PreFilterSummary;
}

export interface AdvancedImportOptions {
  mapping: CsvColumnMapping;
  categoryMapping: Record<string, string>;
  typeMapping?: Record<string, TransactionType | 'skip'>;
  defaultAccountId: string;
  defaultExpenseCategoryId: string;
  defaultIncomeCategoryId: string;
  existingCategories: Category[];
  existingAccounts: Account[];
  source?: BillSource;
  skipClosedAndFullRefunds?: boolean;
  skipDuplicates?: boolean;
  aggregateWealthEarningsMonthly?: boolean;
  existingTransactions?: Transaction[];
}

export interface StandardImportOptions {
  mapping: CsvColumnMapping;
  defaultAccountId: string;
  defaultExpenseCategoryId: string;
  defaultIncomeCategoryId: string;
  existingCategories: Category[];
  existingAccounts: Account[];
}

export interface ElephantImportOptions {
  defaultAccountId: string;
  defaultExpenseCategoryId: string;
  defaultIncomeCategoryId: string;
  existingCategories: Category[];
  existingAccounts: Account[];
}

export interface PreparedImportRecord {
  id?: string;
  type: TransactionType;
  amount: number;
  date: string;
  createdAt?: string;
  categoryId: string;
  accountId: string;
  rawAccountName?: string;
  rawCategoryName?: string;
  note?: string;
  isReimbursable?: boolean;
  isWealthMonthlyRollup?: boolean;
  rollupItemCount?: number;
  ext?: Record<string, unknown>;
  rawRow: string[];
}

export interface ConfiguredMappingResult {
  records: PreparedImportRecord[];
  skippedItems: SkippedImportItem[];
  skippedCount: number;
  duplicateCount: number;
  filteredStatusCount: number;
  neutralCount: number;
  wealthRollupCount: number;
  wealthDailyRowCount: number;
}

const COLUMN_MATCHERS: [keyof CsvColumnMapping, RegExp[]][] = [
  ['dateCol', [/^日期$/i, /^交易时间$/i, /日期/i, /时间/i, /date/i, /time/i]],
  ['amountCol', [/^金额$/i, /^金额\(元\)$/i, /金额/i, /amount/i, /数额/i, /money/i]],
  ['typeCol', [/^收支$/i, /^收\/支$/i, /收支/i, /^类型$/i, /类型/i, /type/i, /收支类型/i]],
  ['categoryCol', [/^智能分类$/i, /^分类名称$/i, /^交易分类$/i, /^交易类型$/i, /^分类$/i, /^类别$/i, /分类/i, /类目/i, /category/i]],
  ['accountCol', [/^账户渠道$/i, /^账户$/i, /^支付方式$/i, /^收\/付款方式$/i, /^资金渠道$/i, /账户/i, /资产/i, /account/i]],
  ['noteCol', [/^合并备注$/i, /^备注$/i, /^商品$/i, /^商品说明$/i, /说明/i, /描述/i, /商户/i, /note/i, /desc/i]],
  ['reimburseCol', [/^报销$/i, /报销/i, /reimburse/i]],
  ['statusCol', [/^当前状态$/i, /^交易状态$/i, /状态/i]],
  ['orderIdCol', [/^交易单号$/i, /^交易订单号$/i]],
];

const SKIPPED_REASON_LABELS: Record<SkippedReason, string> = {
  neutral: '不计收支',
  status: '已关闭/全额退款',
  duplicate: '重复账单',
  invalid: '金额无效',
};

const TYPE_EXPORT_LABELS: Record<TransactionType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
  loan: '借贷',
  reconcile: '平账',
};

export function inferColumnMapping(headers: string[]): CsvColumnMapping {
  const result: CsvColumnMapping = {};
  for (const [field, patterns] of COLUMN_MATCHERS) {
    for (const pattern of patterns) {
      const hit = headers.find((h) => pattern.test(h.trim()));
      if (hit) {
        result[field] = hit;
        break;
      }
    }
  }
  return result;
}

export function normalizeDateTime(raw: string): { date: string; createdAt?: string } {
  return parseCsvDateTime(raw);
}

export function normalizeDate(raw: string): string {
  return normalizeDateTime(raw).date;
}

export function normalizeAmount(raw: string): { cents: number; inferredType?: TransactionType } {
  let clean = raw.replace(/[¥￥$,\s]/g, '');
  let isNegative = false;
  if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1);
  } else if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }
  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return { cents: 0 };
  return { cents: Math.round(num * 100), inferredType: isNegative ? 'expense' : undefined };
}

export function normalizeTransactionType(
  raw?: string,
  fallback: TransactionType = 'expense'
): TransactionType {
  if (!raw) return fallback;
  const t = raw.trim().toLowerCase();
  if (t.includes('支') || t === 'expense' || t === 'out') return 'expense';
  if (t.includes('收') || t === 'income' || t === 'in') return 'income';
  if (t.includes('转') || t === 'transfer') return 'transfer';
  if (t.includes('借') || t.includes('贷') || t === 'loan') return 'loan';
  if (t.includes('平账') || t === 'reconcile') return 'reconcile';
  return fallback;
}

function findBestCategoryMatch(
  categories: Category[],
  targetName: string,
  dominantType: TransactionType,
  activeOnly = false
): Category | undefined {
  const lower = targetName.trim().toLowerCase();
  const candidates = categories.filter(
    (c) => c.name.trim().toLowerCase() === lower && (!activeOnly || !c.isArchived)
  );
  if (candidates.length === 0) return undefined;
  return (
    candidates.find((c) => !c.isArchived && c.type === dominantType) ??
    candidates.find((c) => !c.isArchived) ??
    candidates.find((c) => c.type === dominantType) ??
    candidates[0]
  );
}

function resolveSuggestedCategoryId(
  rawName: string,
  dominantType: TransactionType,
  existingCategories: Category[],
  presetAliases: Record<string, string | string[]>
): string | undefined {
  const aliasVal = presetAliases[rawName];
  if (aliasVal) {
    const targets = Array.isArray(aliasVal) ? aliasVal : [aliasVal];
    for (const activeOnly of [true, false]) {
      for (const target of targets) {
        const hit = findBestCategoryMatch(existingCategories, target, dominantType, activeOnly);
        if (hit) return hit.id;
      }
    }
  }
  const exact = findBestCategoryMatch(existingCategories, rawName, dominantType);
  if (exact) return exact.id;
  return (
    existingCategories.find(
      (c) => !c.isArchived && c.type === dominantType && (c.name.includes(rawName) || rawName.includes(c.name))
    )?.id ??
    existingCategories.find(
      (c) => c.type === dominantType && (c.name.includes(rawName) || rawName.includes(c.name))
    )?.id
  );
}

function inferSuggestedType(rawName: string): TransactionType | 'skip' {
  const lower = rawName.toLowerCase();
  if (lower.includes('不计') || lower.includes('其他') || lower === 'skip' || lower === '/') return 'skip';
  if (lower.includes('支') || lower === 'expense' || lower === 'out') return 'expense';
  if (lower.includes('收') || lower === 'income' || lower === 'in') return 'income';
  if (lower.includes('转') || lower === 'transfer') return 'transfer';
  if (lower.includes('借') || lower.includes('贷')) return 'loan';
  return 'expense';
}

interface PreFilterContext {
  typeIdx: number;
  catIdx: number;
  amountIdx: number;
  statusIdx: number;
  noteIdx: number;
  productIdx: number;
  counterpartyIdx: number;
  source?: BillSource;
  skipClosedAndFullRefunds: boolean;
  aggregateWealthEarningsMonthly: boolean;
}

function createPreFilterContext(
  headers: string[],
  mapping: Pick<CsvColumnMapping, 'typeCol' | 'categoryCol' | 'amountCol' | 'statusCol' | 'noteCol'>,
  options?: Pick<TableAnalysisOptions, 'source' | 'skipClosedAndFullRefunds' | 'aggregateWealthEarningsMonthly'>
): PreFilterContext {
  const idx = (col?: string) => (col ? headers.indexOf(col) : -1);
  const prodIdx = headers.indexOf('商品说明') >= 0 ? headers.indexOf('商品说明') : headers.indexOf('商品');
  return {
    typeIdx: idx(mapping.typeCol),
    catIdx: idx(mapping.categoryCol),
    amountIdx: idx(mapping.amountCol),
    statusIdx: idx(mapping.statusCol),
    noteIdx: idx(mapping.noteCol),
    productIdx: prodIdx,
    counterpartyIdx: headers.indexOf('交易对方'),
    source: options?.source,
    skipClosedAndFullRefunds: Boolean(options?.skipClosedAndFullRefunds),
    aggregateWealthEarningsMonthly: Boolean(options?.aggregateWealthEarningsMonthly),
  };
}

function classifyRowPreFilter(
  row: string[],
  ctx: PreFilterContext
): {
  disposition: 'keep' | 'empty' | 'status' | 'invalid' | 'wealth';
  cents: number;
  inferredType?: TransactionType;
  rawType?: string;
  rawStatus?: string;
} {
  if (row.length === 0 || row.every((c) => !c.trim())) {
    return { disposition: 'empty', cents: 0 };
  }
  const rawType = ctx.typeIdx >= 0 ? row[ctx.typeIdx]?.trim() : undefined;
  const rawStatus = ctx.statusIdx >= 0 ? row[ctx.statusIdx]?.trim() : undefined;
  const { cents, inferredType } =
    ctx.amountIdx >= 0 ? normalizeAmount(row[ctx.amountIdx] ?? '') : { cents: 0, inferredType: undefined };

  if (ctx.skipClosedAndFullRefunds && ctx.source && shouldSkipBillStatus(ctx.source, rawStatus, rawType)) {
    return { disposition: 'status', cents, inferredType, rawType, rawStatus };
  }
  if (ctx.amountIdx >= 0 && cents <= 0) {
    return { disposition: 'invalid', cents: 0, inferredType, rawType, rawStatus };
  }
  if (ctx.aggregateWealthEarningsMonthly && (ctx.source === 'alipay' || ctx.source === 'wechat')) {
    const rawCat = ctx.catIdx >= 0 ? row[ctx.catIdx]?.trim() : undefined;
    let rawProduct: string | undefined;
    if (ctx.productIdx >= 0) rawProduct = row[ctx.productIdx]?.trim();
    else if (ctx.noteIdx >= 0) rawProduct = row[ctx.noteIdx]?.trim();
    const rawCounterparty = ctx.counterpartyIdx >= 0 ? row[ctx.counterpartyIdx]?.trim() : undefined;
    if (isWealthDailyEarningRow(ctx.source, { category: rawCat, product: rawProduct, counterparty: rawCounterparty, direction: rawType, status: rawStatus })) {
      return { disposition: 'wealth', cents, inferredType, rawType, rawStatus };
    }
  }
  return { disposition: 'keep', cents, inferredType, rawType, rawStatus };
}

export function analyzeImportTable(
  headers: string[],
  rows: string[][],
  options: TableAnalysisOptions
): TableAnalysisResult {
  const ctx = createPreFilterContext(headers, options.mapping, options);
  const preFilter: PreFilterSummary = {
    filteredStatusCount: 0,
    invalidAmountCount: 0,
    wealthDailyRowCount: 0,
  };
  const catStats = new Map<string, { count: number; expenseCount: number; incomeCount: number }>();
  const typeCounts = new Map<string, number>();

  for (const row of rows) {
    const pre = classifyRowPreFilter(row, ctx);
    if (pre.disposition === 'status') {
      preFilter.filteredStatusCount++;
      continue;
    }
    if (pre.disposition === 'invalid') {
      preFilter.invalidAmountCount++;
      continue;
    }
    if (pre.disposition === 'wealth') {
      preFilter.wealthDailyRowCount++;
      continue;
    }
    if (pre.disposition !== 'keep') continue;

    if (ctx.catIdx >= 0) {
      const rawCat = row[ctx.catIdx]?.trim();
      if (rawCat) {
        const stat = catStats.get(rawCat) || { count: 0, expenseCount: 0, incomeCount: 0 };
        stat.count++;
        if (normalizeTransactionType(pre.rawType || '', 'expense') === 'income') stat.incomeCount++;
        else stat.expenseCount++;
        catStats.set(rawCat, stat);
      }
    }
    if (ctx.typeIdx >= 0 && pre.rawType) {
      typeCounts.set(pre.rawType, (typeCounts.get(pre.rawType) || 0) + 1);
    }
  }

  const existingCategories = options.existingCategories ?? [];
  const presetAliases = options.presetAliases ?? {};
  const categories: ExtractedCategoryStat[] = Array.from(catStats.entries())
    .map(([rawName, stat]) => {
      const dominantType: TransactionType = stat.incomeCount > stat.expenseCount ? 'income' : 'expense';
      return {
        rawName,
        count: stat.count,
        dominantType,
        suggestedCategoryId: resolveSuggestedCategoryId(rawName, dominantType, existingCategories, presetAliases),
      };
    })
    .sort((a, b) => b.count - a.count);

  const types: ExtractedTypeStat[] = Array.from(typeCounts.entries())
    .map(([rawName, count]) => ({
      rawName,
      count,
      suggestedType: inferSuggestedType(rawName),
    }))
    .sort((a, b) => b.count - a.count);

  return { categories, types, preFilter };
}

export function extractCategoriesFromCsv(
  headers: string[],
  rows: string[][],
  categoryColName?: string,
  typeColName?: string,
  existingCategories: Category[] = [],
  presetAliases: Record<string, string | string[]> = {}
): ExtractedCategoryStat[] {
  if (!categoryColName || headers.indexOf(categoryColName) < 0) return [];
  return analyzeImportTable(headers, rows, {
    mapping: { categoryCol: categoryColName, typeCol: typeColName },
    existingCategories,
    presetAliases,
  }).categories;
}

export function extractTransactionTypesFromCsv(
  headers: string[],
  rows: string[][],
  typeColName?: string,
  filterOptions?: Pick<TableAnalysisOptions, 'source' | 'skipClosedAndFullRefunds' | 'aggregateWealthEarningsMonthly'> & {
    categoryColName?: string;
    amountColName?: string;
    statusColName?: string;
    noteColName?: string;
  }
): ExtractedTypeStat[] {
  if (!typeColName || headers.indexOf(typeColName) < 0) return [];
  return analyzeImportTable(headers, rows, {
    mapping: {
      typeCol: typeColName,
      categoryCol: filterOptions?.categoryColName,
      amountCol: filterOptions?.amountColName,
      statusCol: filterOptions?.statusColName,
      noteCol: filterOptions?.noteColName,
    },
    source: filterOptions?.source,
    skipClosedAndFullRefunds: filterOptions?.skipClosedAndFullRefunds,
    aggregateWealthEarningsMonthly: filterOptions?.aggregateWealthEarningsMonthly,
  }).types;
}

interface WealthMonthlyBucket {
  yearMonth: string;
  accountName: string;
  totalCents: number;
  count: number;
  latestDate: string;
  latestCreatedAt?: string;
  latestSortKey: string;
}

function resolveInvestCategoryId(categories: Category[], fallbackId: string): string {
  return (
    categories.find((c) => !c.isArchived && c.type === 'income' && c.name === '理财')?.id ??
    categories.find((c) => c.id === 'cat_invest')?.id ??
    categories.find((c) => c.type === 'income' && c.name === '理财')?.id ??
    fallbackId
  );
}

export function mapConfiguredCsvRows(
  headers: string[],
  rows: string[][],
  options: AdvancedImportOptions
): ConfiguredMappingResult {
  const colIdx = (col?: string) => (col ? headers.indexOf(col) : -1);
  const dateIdx = colIdx(options.mapping.dateCol);
  const acctIdx = colIdx(options.mapping.accountCol);
  const reimbIdx = colIdx(options.mapping.reimburseCol);
  const orderIdx = colIdx(options.mapping.orderIdCol);
  const preCtx = createPreFilterContext(headers, options.mapping, options);
  const { catIdx, noteIdx } = preCtx;

  const catMapById = new Map(options.existingCategories.map((c) => [c.id, c]));
  const catMapByName = new Map(options.existingCategories.map((c) => [c.name.trim().toLowerCase(), c]));
  const acctMapByName = new Map(options.existingAccounts.map((a) => [a.name.trim().toLowerCase(), a]));
  const existingById = options.existingTransactions ? extractExistingTransactionMap(options.existingTransactions) : undefined;
  const seenBatchIds = new Set<string>();
  const fpOccurrenceMap = new Map<string, number>();
  const seenWealthOrderIds = new Set<string>();
  const wealthBuckets = new Map<string, WealthMonthlyBucket>();

  const records: PreparedImportRecord[] = [];
  const skippedItems: SkippedImportItem[] = [];
  let skippedCount = 0;
  let duplicateCount = 0;
  let filteredStatusCount = 0;
  let neutralCount = 0;
  let wealthDailyRowCount = 0;

  const recordSkip = (
    reason: SkippedReason,
    info: Omit<SkippedImportItem, 'reason' | 'reasonLabel'>
  ) => {
    skippedCount++;
    if (reason === 'status') filteredStatusCount++;
    else if (reason === 'neutral') neutralCount++;
    else if (reason === 'duplicate') duplicateCount++;
    skippedItems.push({ reason, reasonLabel: SKIPPED_REASON_LABELS[reason], ...info });
  };

  for (const row of rows) {
    const pre = classifyRowPreFilter(row, preCtx);
    if (pre.disposition === 'empty') {
      skippedCount++;
      continue;
    }

    const { rawType, rawStatus, cents, inferredType } = pre;
    const { date, createdAt } = normalizeDateTime(dateIdx >= 0 ? row[dateIdx] : '');
    const rawCat = catIdx >= 0 ? row[catIdx]?.trim() : undefined;
    const note = noteIdx >= 0 ? row[noteIdx]?.trim() || undefined : undefined;
    const candidateAcct = acctIdx >= 0 ? row[acctIdx]?.trim() : undefined;
    const rawAccountName = candidateAcct && candidateAcct !== '/' ? candidateAcct : undefined;
    const rawOrderId = orderIdx >= 0 ? row[orderIdx]?.trim() : undefined;
    const cleanOrderId = rawOrderId && rawOrderId !== '/' ? rawOrderId : undefined;
    const rowMeta = { date, amount: cents, rawType, rawStatus, rawAccountName, rawCategoryName: rawCat, note };

    if (pre.disposition === 'status') {
      recordSkip('status', rowMeta);
      continue;
    }
    if (pre.disposition === 'invalid') {
      recordSkip('invalid', { ...rowMeta, amount: 0 });
      continue;
    }

    if (pre.disposition === 'wealth') {
      if (cleanOrderId && seenWealthOrderIds.has(cleanOrderId)) {
        recordSkip('duplicate', rowMeta);
        continue;
      }
      if (cleanOrderId) seenWealthOrderIds.add(cleanOrderId);

      const yearMonth = date.slice(0, 7);
      const accountName = rawAccountName || (options.source === 'alipay' ? '余额宝' : '微信零钱通');
      const key = `${yearMonth}::${accountName}`;
      const sortKey = createdAt || date;
      const bucket = wealthBuckets.get(key);
      if (bucket) {
        bucket.totalCents += cents;
        bucket.count += 1;
        if (sortKey > bucket.latestSortKey) {
          bucket.latestDate = date;
          bucket.latestCreatedAt = createdAt;
          bucket.latestSortKey = sortKey;
        }
      } else {
        wealthBuckets.set(key, {
          yearMonth,
          accountName,
          totalCents: cents,
          count: 1,
          latestDate: date,
          latestCreatedAt: createdAt,
          latestSortKey: sortKey,
        });
      }
      wealthDailyRowCount++;
      continue;
    }

    let type: TransactionType = inferredType || 'expense';
    const mappedRawType = rawType && options.typeMapping ? options.typeMapping[rawType] : undefined;
    if (mappedRawType === 'skip' || (!mappedRawType && rawType && (rawType === '/' || rawType.includes('不计')))) {
      recordSkip('neutral', rowMeta);
      continue;
    }
    if (mappedRawType) type = mappedRawType;
    else if (rawType) type = normalizeTransactionType(rawType, inferredType || 'expense');

    const effectiveSource: BillSource = options.source ?? 'standard';
    let deterministicId: string;
    if (cleanOrderId && (effectiveSource === 'wechat' || effectiveSource === 'alipay')) {
      deterministicId = buildDeterministicImportId(effectiveSource, cleanOrderId);
    } else {
      const fpKey = [effectiveSource, date, createdAt || '', type, cents, rawCat || '', rawAccountName || '', note || ''].join('|');
      const occurrence = fpOccurrenceMap.get(fpKey) ?? 0;
      fpOccurrenceMap.set(fpKey, occurrence + 1);
      deterministicId = buildFingerprintImportId(effectiveSource, {
        date,
        createdAt,
        type,
        amount: cents,
        rawCategory: rawCat,
        rawAccount: rawAccountName,
        note,
        occurrence,
      });
    }

    if (options.skipDuplicates && (existingById?.has(deterministicId) || seenBatchIds.has(deterministicId))) {
      recordSkip('duplicate', rowMeta);
      continue;
    }
    seenBatchIds.add(deterministicId);

    const fallbackCat = type === 'income' ? options.defaultIncomeCategoryId : options.defaultExpenseCategoryId;
    let categoryId = fallbackCat;
    if (rawCat && options.categoryMapping[rawCat]) categoryId = options.categoryMapping[rawCat];
    else if (rawCat) categoryId = catMapByName.get(rawCat.toLowerCase())?.id ?? fallbackCat;
    if (!catMapById.has(categoryId)) categoryId = fallbackCat;

    const accountId = (rawAccountName && acctMapByName.get(rawAccountName.toLowerCase())?.id) || options.defaultAccountId;
    const reimbVal = reimbIdx >= 0 ? row[reimbIdx]?.trim() : '';
    const isReimbursable = reimbVal === '是' || reimbVal === '报销' || reimbVal === 'true' || reimbVal === '1';

    records.push({
      id: deterministicId,
      type,
      amount: cents,
      date,
      createdAt,
      categoryId,
      accountId,
      rawAccountName,
      rawCategoryName: rawCat,
      note,
      isReimbursable,
      rawRow: row,
    });
  }

  let wealthRollupCount = 0;
  if (wealthBuckets.size > 0 && (options.source === 'alipay' || options.source === 'wechat')) {
    const investCatId = resolveInvestCategoryId(options.existingCategories, options.defaultIncomeCategoryId);
    const sorted = Array.from(wealthBuckets.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    for (const b of sorted) {
      const id = buildWealthMonthlyTxId(options.source, b.yearMonth, b.accountName);
      const rollupNote = `${b.accountName} ${b.yearMonth} 理财收益汇总（共 ${b.count} 笔）`;
      const existingTx = existingById?.get(id);
      if (options.skipDuplicates && existingTx && existingTx.amount === b.totalCents) {
        recordSkip('duplicate', {
          date: b.latestDate,
          amount: b.totalCents,
          rawType: '收入',
          rawAccountName: b.accountName,
          rawCategoryName: '理财',
          note: rollupNote,
        });
        continue;
      }
      records.push({
        id,
        type: 'income',
        amount: b.totalCents,
        date: b.latestDate,
        createdAt: b.latestCreatedAt,
        categoryId: investCatId,
        accountId: acctMapByName.get(b.accountName.toLowerCase())?.id || options.defaultAccountId,
        rawAccountName: b.accountName,
        rawCategoryName: '理财',
        note: rollupNote,
        isWealthMonthlyRollup: true,
        rollupItemCount: b.count,
        rawRow: [],
      });
      wealthRollupCount++;
    }
  }

  return {
    records,
    skippedItems,
    skippedCount,
    duplicateCount,
    filteredStatusCount,
    neutralCount,
    wealthRollupCount,
    wealthDailyRowCount,
  };
}

export function mapStandardCsvRows(
  headers: string[],
  rows: string[][],
  options: StandardImportOptions
): ConfiguredMappingResult {
  return mapConfiguredCsvRows(headers, rows, { ...options, categoryMapping: {} });
}

export function mapElephantCsvRows(
  headers: string[],
  rows: string[][],
  options: ElephantImportOptions
): ConfiguredMappingResult {
  return mapConfiguredCsvRows(headers, rows, {
    mapping: {
      dateCol: '日期',
      categoryCol: '分类名称',
      typeCol: '收支',
      amountCol: '金额',
      accountCol: '账户',
      noteCol: '备注',
      reimburseCol: '报销',
    },
    categoryMapping: { 吃饭: 'cat_food', 超市: 'cat_shop', 交通费: 'cat_transit', 生活: 'cat_home' },
    ...options,
  });
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
): string {
  const headers = ['日期', '分类名称', '收支', '金额', '账户', '备注', '是否报销', '凭证名称'];
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const acctMap = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = transactions.map((tx) => [
    tx.date,
    catMap.get(tx.categoryId) || '其它',
    TYPE_EXPORT_LABELS[tx.type] || '支出',
    centsToYuan(tx.amount),
    acctMap.get(tx.accountId) || '默认账户',
    tx.note || '',
    tx.isReimbursable ? '是' : '否',
    tx.voucher?.name || '',
  ]);
  return generateCsv(headers, rows);
}
