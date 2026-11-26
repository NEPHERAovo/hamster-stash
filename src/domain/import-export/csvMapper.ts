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

export function inferColumnMapping(headers: string[]): CsvColumnMapping {
  const findMatch = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = headers.find((h) => pattern.test(h.trim()));
      if (match) return match;
    }
    return undefined;
  };

  return {
    dateCol: findMatch([/^日期$/i, /^交易时间$/i, /日期/i, /时间/i, /date/i, /time/i]),
    amountCol: findMatch([/^金额$/i, /^金额\(元\)$/i, /金额/i, /amount/i, /数额/i, /money/i]),
    typeCol: findMatch([/^收支$/i, /^收\/支$/i, /收支/i, /^类型$/i, /类型/i, /type/i, /收支类型/i]),
    categoryCol: findMatch([
      /^智能分类$/i,
      /^分类名称$/i,
      /^交易分类$/i,
      /^交易类型$/i,
      /^分类$/i,
      /^类别$/i,
      /分类/i,
      /类目/i,
      /category/i,
    ]),
    accountCol: findMatch([
      /^账户渠道$/i,
      /^账户$/i,
      /^支付方式$/i,
      /^收\/付款方式$/i,
      /^资金渠道$/i,
      /账户/i,
      /资产/i,
      /account/i,
    ]),
    noteCol: findMatch([
      /^合并备注$/i,
      /^备注$/i,
      /^商品$/i,
      /^商品说明$/i,
      /说明/i,
      /描述/i,
      /商户/i,
      /note/i,
      /desc/i,
    ]),
    reimburseCol: findMatch([/^报销$/i, /报销/i, /reimburse/i]),
    statusCol: findMatch([/^当前状态$/i, /^交易状态$/i, /状态/i]),
    orderIdCol: findMatch([/^交易单号$/i, /^交易订单号$/i]),
  };
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
  if (isNaN(num) || num <= 0) {
    return { cents: 0 };
  }

  const cents = Math.round(num * 100);
  return {
    cents,
    inferredType: isNegative ? 'expense' : undefined,
  };
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
  existingCategories: Category[],
  targetName: string,
  dominantType: TransactionType,
  activeOnly = false
): Category | undefined {
  const lowerTarget = targetName.trim().toLowerCase();
  const candidates = existingCategories.filter(
    (c) => c.name.trim().toLowerCase() === lowerTarget && (!activeOnly || !c.isArchived)
  );
  if (candidates.length === 0) return undefined;

  return (
    candidates.find((c) => !c.isArchived && c.type === dominantType) ??
    candidates.find((c) => !c.isArchived) ??
    candidates.find((c) => c.type === dominantType) ??
    candidates[0]
  );
}

export interface CsvPreFilterOptions {
  amountColName?: string;
  statusColName?: string;
  noteColName?: string;
  source?: BillSource;
  skipClosedAndFullRefunds?: boolean;
  aggregateWealthEarningsMonthly?: boolean;
}

export interface PreFilterSummary {
  filteredStatusCount: number;
  invalidAmountCount: number;
  wealthDailyRowCount: number;
}

type PreFilterDisposition = 'keep' | 'empty' | 'status' | 'invalid' | 'wealth';

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
  cols: {
    typeColName?: string;
    categoryColName?: string;
    amountColName?: string;
    statusColName?: string;
    noteColName?: string;
  },
  options?: Pick<
    CsvPreFilterOptions,
    'source' | 'skipClosedAndFullRefunds' | 'aggregateWealthEarningsMonthly'
  >
): PreFilterContext {
  const idx = (colName?: string): number => (colName ? headers.indexOf(colName) : -1);
  const productIdx =
    headers.indexOf('商品说明') >= 0 ? headers.indexOf('商品说明') : headers.indexOf('商品');

  return {
    typeIdx: idx(cols.typeColName),
    catIdx: idx(cols.categoryColName),
    amountIdx: idx(cols.amountColName),
    statusIdx: idx(cols.statusColName),
    noteIdx: idx(cols.noteColName),
    productIdx,
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
  disposition: PreFilterDisposition;
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
  const amountResult =
    ctx.amountIdx >= 0
      ? normalizeAmount(row[ctx.amountIdx] ?? '')
      : { cents: 0, inferredType: undefined };

  if (ctx.skipClosedAndFullRefunds && ctx.source) {
    if (shouldSkipBillStatus(ctx.source, rawStatus, rawType)) {
      return {
        disposition: 'status',
        cents: amountResult.cents,
        inferredType: amountResult.inferredType,
        rawType,
        rawStatus,
      };
    }
  }

  if (ctx.amountIdx >= 0 && amountResult.cents <= 0) {
    return {
      disposition: 'invalid',
      cents: 0,
      inferredType: amountResult.inferredType,
      rawType,
      rawStatus,
    };
  }

  if (
    ctx.aggregateWealthEarningsMonthly &&
    (ctx.source === 'alipay' || ctx.source === 'wechat')
  ) {
    const rawCat = ctx.catIdx >= 0 ? row[ctx.catIdx]?.trim() : undefined;
    let rawProduct: string | undefined;
    if (ctx.productIdx >= 0) {
      rawProduct = row[ctx.productIdx]?.trim();
    } else if (ctx.noteIdx >= 0) {
      rawProduct = row[ctx.noteIdx]?.trim();
    }
    const rawCounterparty = ctx.counterpartyIdx >= 0 ? row[ctx.counterpartyIdx]?.trim() : undefined;

    if (
      isWealthDailyEarningRow(ctx.source, {
        category: rawCat,
        product: rawProduct,
        counterparty: rawCounterparty,
        direction: rawType,
        status: rawStatus,
      })
    ) {
      return {
        disposition: 'wealth',
        cents: amountResult.cents,
        inferredType: amountResult.inferredType,
        rawType,
        rawStatus,
      };
    }
  }

  return {
    disposition: 'keep',
    cents: amountResult.cents,
    inferredType: amountResult.inferredType,
    rawType,
    rawStatus,
  };
}

export function summarizePreFilterCounts(
  headers: string[],
  rows: string[][],
  mapping: CsvColumnMapping,
  options: Pick<
    CsvPreFilterOptions,
    'source' | 'skipClosedAndFullRefunds' | 'aggregateWealthEarningsMonthly'
  >
): PreFilterSummary {
  const ctx = createPreFilterContext(
    headers,
    {
      typeColName: mapping.typeCol,
      categoryColName: mapping.categoryCol,
      amountColName: mapping.amountCol,
      statusColName: mapping.statusCol,
      noteColName: mapping.noteCol,
    },
    options
  );

  let filteredStatusCount = 0;
  let invalidAmountCount = 0;
  let wealthDailyRowCount = 0;

  for (const row of rows) {
    const res = classifyRowPreFilter(row, ctx);
    if (res.disposition === 'status') filteredStatusCount++;
    else if (res.disposition === 'invalid') invalidAmountCount++;
    else if (res.disposition === 'wealth') wealthDailyRowCount++;
  }

  return { filteredStatusCount, invalidAmountCount, wealthDailyRowCount };
}

export function extractCategoriesFromCsv(
  headers: string[],
  rows: string[][],
  categoryColName?: string,
  typeColName?: string,
  existingCategories: Category[] = [],
  presetAliases: Record<string, string | string[]> = {},
  filterOptions?: CsvPreFilterOptions
): ExtractedCategoryStat[] {
  if (!categoryColName) return [];
  const catIdx = headers.indexOf(categoryColName);
  if (catIdx < 0) return [];

  const ctx = createPreFilterContext(
    headers,
    {
      typeColName,
      categoryColName,
      amountColName: filterOptions?.amountColName,
      statusColName: filterOptions?.statusColName,
      noteColName: filterOptions?.noteColName,
    },
    filterOptions
  );

  const statsMap = new Map<string, { count: number; expenseCount: number; incomeCount: number }>();

  for (const row of rows) {
    const pre = classifyRowPreFilter(row, ctx);
    if (pre.disposition !== 'keep') {
      continue;
    }

    const rawCat = row[catIdx]?.trim();
    if (!rawCat) continue;

    const stat = statsMap.get(rawCat) || { count: 0, expenseCount: 0, incomeCount: 0 };
    stat.count++;

    const normType = normalizeTransactionType(pre.rawType || '', 'expense');
    if (normType === 'income') {
      stat.incomeCount++;
    } else {
      stat.expenseCount++;
    }
    statsMap.set(rawCat, stat);
  }

  const result: ExtractedCategoryStat[] = [];
  for (const [rawName, stat] of statsMap.entries()) {
    const dominantType: TransactionType = stat.incomeCount > stat.expenseCount ? 'income' : 'expense';

    let suggestedCatId: string | undefined;
    const aliasValue = presetAliases[rawName];
    if (aliasValue) {
      const aliasTargets = Array.isArray(aliasValue) ? aliasValue : [aliasValue];
      for (const target of aliasTargets) {
        const activeMatch = findBestCategoryMatch(existingCategories, target, dominantType, true);
        if (activeMatch) {
          suggestedCatId = activeMatch.id;
          break;
        }
      }
      if (!suggestedCatId) {
        for (const target of aliasTargets) {
          const fallbackMatch = findBestCategoryMatch(existingCategories, target, dominantType);
          if (fallbackMatch) {
            suggestedCatId = fallbackMatch.id;
            break;
          }
        }
      }
    }

    if (!suggestedCatId) {
      const exact = findBestCategoryMatch(existingCategories, rawName, dominantType);
      if (exact) suggestedCatId = exact.id;
    }

    if (!suggestedCatId) {
      const fuzzy =
        existingCategories.find(
          (c) =>
            !c.isArchived &&
            c.type === dominantType &&
            (c.name.includes(rawName) || rawName.includes(c.name))
        ) ??
        existingCategories.find(
          (c) => c.type === dominantType && (c.name.includes(rawName) || rawName.includes(c.name))
        );
      if (fuzzy) suggestedCatId = fuzzy.id;
    }

    result.push({
      rawName,
      count: stat.count,
      dominantType,
      suggestedCategoryId: suggestedCatId,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export function extractTransactionTypesFromCsv(
  headers: string[],
  rows: string[][],
  typeColName?: string,
  filterOptions?: CsvPreFilterOptions & { categoryColName?: string }
): ExtractedTypeStat[] {
  if (!typeColName) return [];
  const typeIdx = headers.indexOf(typeColName);
  if (typeIdx < 0) return [];

  const ctx = createPreFilterContext(
    headers,
    {
      typeColName,
      categoryColName: filterOptions?.categoryColName,
      amountColName: filterOptions?.amountColName,
      statusColName: filterOptions?.statusColName,
      noteColName: filterOptions?.noteColName,
    },
    filterOptions
  );

  const counts = new Map<string, number>();
  for (const row of rows) {
    const pre = classifyRowPreFilter(row, ctx);
    if (pre.disposition !== 'keep') {
      continue;
    }
    const rawType = row[typeIdx]?.trim();
    if (!rawType) continue;
    counts.set(rawType, (counts.get(rawType) || 0) + 1);
  }

  const result: ExtractedTypeStat[] = [];
  for (const [rawName, count] of counts.entries()) {
    let suggested: TransactionType | 'skip' = 'expense';
    const lower = rawName.toLowerCase();
    if (
      lower.includes('不计') ||
      lower.includes('其他') ||
      lower === 'skip' ||
      lower === '/'
    ) {
      suggested = 'skip';
    } else if (lower.includes('支') || lower === 'expense' || lower === 'out') {
      suggested = 'expense';
    } else if (lower.includes('收') || lower === 'income' || lower === 'in') {
      suggested = 'income';
    } else if (lower.includes('转') || lower === 'transfer') {
      suggested = 'transfer';
    } else if (lower.includes('借') || lower.includes('贷')) {
      suggested = 'loan';
    }

    result.push({
      rawName,
      count,
      suggestedType: suggested,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

const SKIPPED_REASON_LABELS: Record<SkippedReason, string> = {
  neutral: '不计收支',
  status: '已关闭/全额退款',
  duplicate: '重复账单',
  invalid: '金额无效',
};

interface WealthMonthlyBucket {
  yearMonth: string;
  accountName: string;
  totalCents: number;
  count: number;
  latestDate: string;
  latestCreatedAt?: string;
  latestSortKey: string;
}

function resolveInvestCategoryId(
  existingCategories: Category[],
  fallbackIncomeCategoryId: string
): string {
  const match =
    existingCategories.find((c) => !c.isArchived && c.type === 'income' && c.name === '理财') ??
    existingCategories.find((c) => c.id === 'cat_invest') ??
    existingCategories.find((c) => c.type === 'income' && c.name === '理财');
  return match?.id || fallbackIncomeCategoryId;
}

export function mapConfiguredCsvRows(
  headers: string[],
  rows: string[][],
  options: AdvancedImportOptions
): ConfiguredMappingResult {
  const getColIndex = (colName?: string): number => {
    if (!colName) return -1;
    return headers.indexOf(colName);
  };

  const dateIdx = getColIndex(options.mapping.dateCol);
  const acctIdx = getColIndex(options.mapping.accountCol);
  const reimbIdx = getColIndex(options.mapping.reimburseCol);
  const orderIdx = getColIndex(options.mapping.orderIdCol);
  const preCtx = createPreFilterContext(
    headers,
    {
      typeColName: options.mapping.typeCol,
      categoryColName: options.mapping.categoryCol,
      amountColName: options.mapping.amountCol,
      statusColName: options.mapping.statusCol,
      noteColName: options.mapping.noteCol,
    },
    {
      source: options.source,
      skipClosedAndFullRefunds: options.skipClosedAndFullRefunds,
      aggregateWealthEarningsMonthly: options.aggregateWealthEarningsMonthly,
    }
  );
  const { catIdx, noteIdx } = preCtx;

  const catMapById = new Map<string, Category>(options.existingCategories.map((c) => [c.id, c]));
  const catMapByName = new Map<string, Category>(
    options.existingCategories.map((c) => [c.name.trim().toLowerCase(), c])
  );
  const acctMapByName = new Map<string, Account>(
    options.existingAccounts.map((a) => [a.name.trim().toLowerCase(), a])
  );
  const existingById = options.existingTransactions
    ? extractExistingTransactionMap(options.existingTransactions)
    : undefined;
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

  const pushSkipped = (
    reason: SkippedReason,
    info: {
      date: string;
      amount: number;
      rawType?: string;
      rawStatus?: string;
      rawAccountName?: string;
      rawCategoryName?: string;
      note?: string;
    }
  ) => {
    skippedItems.push({
      reason,
      reasonLabel: SKIPPED_REASON_LABELS[reason],
      ...info,
    });
  };

  for (const row of rows) {
    const pre = classifyRowPreFilter(row, preCtx);
    if (pre.disposition === 'empty') {
      skippedCount++;
      continue;
    }

    const rawType = pre.rawType;
    const rawStatus = pre.rawStatus;
    const cents = pre.cents;
    const inferredType = pre.inferredType;
    const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
    const { date, createdAt } = normalizeDateTime(rawDate);
    const rawCat = catIdx >= 0 ? row[catIdx]?.trim() : undefined;
    const note = noteIdx >= 0 ? row[noteIdx]?.trim() || undefined : undefined;
    const candidateAcct = acctIdx >= 0 ? row[acctIdx]?.trim() : undefined;
    const rawAccountName = candidateAcct && candidateAcct !== '/' ? candidateAcct : undefined;
    const rawOrderId = orderIdx >= 0 ? row[orderIdx]?.trim() : undefined;
    const cleanOrderId = rawOrderId && rawOrderId !== '/' ? rawOrderId : undefined;

    if (pre.disposition === 'status') {
      filteredStatusCount++;
      skippedCount++;
      pushSkipped('status', {
        date,
        amount: cents,
        rawType,
        rawStatus,
        rawAccountName,
        rawCategoryName: rawCat,
        note,
      });
      continue;
    }

    if (pre.disposition === 'invalid') {
      skippedCount++;
      pushSkipped('invalid', {
        date,
        amount: 0,
        rawType,
        rawStatus,
        rawAccountName,
        rawCategoryName: rawCat,
        note,
      });
      continue;
    }

    if (pre.disposition === 'wealth') {
      if (cleanOrderId) {
        if (seenWealthOrderIds.has(cleanOrderId)) {
          duplicateCount++;
          skippedCount++;
          pushSkipped('duplicate', {
            date,
            amount: cents,
            rawType,
            rawStatus,
            rawAccountName,
            rawCategoryName: rawCat,
            note,
          });
          continue;
        }
        seenWealthOrderIds.add(cleanOrderId);
      }

      const yearMonth = date.slice(0, 7);
      const bucketAccountName =
        rawAccountName || (options.source === 'alipay' ? '余额宝' : '微信零钱通');
      const bucketKey = `${yearMonth}::${bucketAccountName}`;
      const sortKey = createdAt || date;
      const existingBucket = wealthBuckets.get(bucketKey);

      if (existingBucket) {
        existingBucket.totalCents += cents;
        existingBucket.count += 1;
        if (sortKey > existingBucket.latestSortKey) {
          existingBucket.latestDate = date;
          existingBucket.latestCreatedAt = createdAt;
          existingBucket.latestSortKey = sortKey;
        }
      } else {
        wealthBuckets.set(bucketKey, {
          yearMonth,
          accountName: bucketAccountName,
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

    if (rawType && options.typeMapping && options.typeMapping[rawType]) {
      const mapped = options.typeMapping[rawType];
      if (mapped === 'skip') {
        neutralCount++;
        skippedCount++;
        pushSkipped('neutral', {
          date,
          amount: cents,
          rawType,
          rawStatus,
          rawAccountName,
          rawCategoryName: rawCat,
          note,
        });
        continue;
      }
      type = mapped;
    } else if (rawType) {
      if (rawType === '/' || rawType.includes('不计')) {
        neutralCount++;
        skippedCount++;
        pushSkipped('neutral', {
          date,
          amount: cents,
          rawType,
          rawStatus,
          rawAccountName,
          rawCategoryName: rawCat,
          note,
        });
        continue;
      }
      type = normalizeTransactionType(rawType, inferredType || 'expense');
    }

    const effectiveSource: BillSource = options.source ?? 'standard';
    let deterministicId: string;

    if (cleanOrderId && (effectiveSource === 'wechat' || effectiveSource === 'alipay')) {
      deterministicId = buildDeterministicImportId(effectiveSource, cleanOrderId);
    } else {
      const baseFpKey = [
        effectiveSource,
        date,
        createdAt || '',
        type,
        String(cents),
        rawCat || '',
        rawAccountName || '',
        note || '',
      ].join('|');
      const occurrence = fpOccurrenceMap.get(baseFpKey) ?? 0;
      fpOccurrenceMap.set(baseFpKey, occurrence + 1);
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

    if (options.skipDuplicates) {
      const isExisting =
        Boolean(existingById?.has(deterministicId)) ||
        seenBatchIds.has(deterministicId);
      if (isExisting) {
        duplicateCount++;
        skippedCount++;
        pushSkipped('duplicate', {
          date,
          amount: cents,
          rawType,
          rawStatus,
          rawAccountName,
          rawCategoryName: rawCat,
          note,
        });
        continue;
      }
    }
    seenBatchIds.add(deterministicId);

    let categoryId =
      type === 'income' ? options.defaultIncomeCategoryId : options.defaultExpenseCategoryId;

    if (rawCat && options.categoryMapping[rawCat]) {
      categoryId = options.categoryMapping[rawCat];
    } else if (rawCat) {
      const matchByName = catMapByName.get(rawCat.toLowerCase());
      if (matchByName) {
        categoryId = matchByName.id;
      }
    }

    if (!catMapById.has(categoryId)) {
      categoryId =
        type === 'income' ? options.defaultIncomeCategoryId : options.defaultExpenseCategoryId;
    }

    let accountId = options.defaultAccountId;
    if (rawAccountName) {
      const acctKey = rawAccountName.toLowerCase();
      if (acctMapByName.has(acctKey)) {
        accountId = acctMapByName.get(acctKey)!.id;
      }
    }

    let isReimbursable = false;
    if (reimbIdx >= 0 && row[reimbIdx]) {
      const val = row[reimbIdx].trim();
      isReimbursable = val === '是' || val === '报销' || val === 'true' || val === '1';
    }

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
  if (
    wealthBuckets.size > 0 &&
    (options.source === 'alipay' || options.source === 'wechat')
  ) {
    const investCategoryId = resolveInvestCategoryId(
      options.existingCategories,
      options.defaultIncomeCategoryId
    );
    const sortedBuckets = Array.from(wealthBuckets.values()).sort((a, b) =>
      b.yearMonth.localeCompare(a.yearMonth)
    );

    for (const bucket of sortedBuckets) {
      const id = buildWealthMonthlyTxId(options.source, bucket.yearMonth, bucket.accountName);
      const rollupNote = `${bucket.accountName} ${bucket.yearMonth} 理财收益汇总（共 ${bucket.count} 笔）`;

      const existingTx = existingById?.get(id);
      const isAlreadySameRollup =
        Boolean(options.skipDuplicates) &&
        Boolean(existingTx) &&
        existingTx!.amount === bucket.totalCents;

      if (isAlreadySameRollup) {
        duplicateCount++;
        skippedCount++;
        pushSkipped('duplicate', {
          date: bucket.latestDate,
          amount: bucket.totalCents,
          rawType: '收入',
          rawAccountName: bucket.accountName,
          rawCategoryName: '理财',
          note: rollupNote,
        });
        continue;
      }

      const matchedAccount = acctMapByName.get(bucket.accountName.toLowerCase());
      records.push({
        id,
        type: 'income',
        amount: bucket.totalCents,
        date: bucket.latestDate,
        createdAt: bucket.latestCreatedAt,
        categoryId: investCategoryId,
        accountId: matchedAccount?.id || options.defaultAccountId,
        rawAccountName: bucket.accountName,
        rawCategoryName: '理财',
        note: rollupNote,
        isWealthMonthlyRollup: true,
        rollupItemCount: bucket.count,
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
  return mapConfiguredCsvRows(headers, rows, {
    ...options,
    categoryMapping: {},
  });
}

export function mapElephantCsvRows(
  headers: string[],
  rows: string[][],
  options: ElephantImportOptions
): ConfiguredMappingResult {
  const elephantMapping: CsvColumnMapping = {
    dateCol: '日期',
    categoryCol: '分类名称',
    typeCol: '收支',
    amountCol: '金额',
    accountCol: '账户',
    noteCol: '备注',
    reimburseCol: '报销',
  };

  const aliases: Record<string, string> = {
    吃饭: 'cat_food',
    超市: 'cat_shop',
    交通费: 'cat_transit',
    生活: 'cat_home',
  };

  return mapConfiguredCsvRows(headers, rows, {
    mapping: elephantMapping,
    categoryMapping: aliases,
    defaultAccountId: options.defaultAccountId,
    defaultExpenseCategoryId: options.defaultExpenseCategoryId,
    defaultIncomeCategoryId: options.defaultIncomeCategoryId,
    existingCategories: options.existingCategories,
    existingAccounts: options.existingAccounts,
  });
}

export function mapCsvRowsToTransactions(
  headers: string[],
  rows: string[][],
  options: StandardImportOptions
): ConfiguredMappingResult {
  return mapStandardCsvRows(headers, rows, options);
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[]
): string {
  const headers = ['日期', '分类名称', '收支', '金额', '账户', '备注', '是否报销', '凭证名称'];

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const acctMap = new Map(accounts.map((a) => [a.id, a.name]));

  const getTypeLabel = (t: TransactionType): string => {
    switch (t) {
      case 'expense':
        return '支出';
      case 'income':
        return '收入';
      case 'transfer':
        return '转账';
      case 'loan':
        return '借贷';
      case 'reconcile':
        return '平账';
      default:
        return '支出';
    }
  };

  const rows = transactions.map((tx) => [
    tx.date,
    catMap.get(tx.categoryId) || '其它',
    getTypeLabel(tx.type),
    centsToYuan(tx.amount),
    acctMap.get(tx.accountId) || '默认账户',
    tx.note || '',
    tx.isReimbursable ? '是' : '否',
    tx.voucher?.name || '',
  ]);

  return generateCsv(headers, rows);
}
