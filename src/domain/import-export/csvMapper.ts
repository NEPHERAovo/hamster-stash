import type { Transaction, TransactionType } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { generateCsv } from './csvParser';
import {
  buildExternalImportKey,
  shouldSkipBillStatus,
  type BillSource,
} from './billNormalizer';
import { centsToYuan } from '../finance/balanceCalculator';
import { parseCsvDateTime } from '../../utils/date';

export type ImportMode = 'wechat' | 'alipay' | 'elephant' | 'standard' | 'preset';

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
  existingImportKeys?: Set<string>;
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
  ext?: Record<string, unknown>;
  rawRow: string[];
}

export interface ConfiguredMappingResult {
  records: PreparedImportRecord[];
  skippedCount: number;
  duplicateCount: number;
  filteredStatusCount: number;
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

export function extractCategoriesFromCsv(
  headers: string[],
  rows: string[][],
  categoryColName?: string,
  typeColName?: string,
  existingCategories: Category[] = [],
  presetAliases: Record<string, string | string[]> = {},
  filterOptions?: { statusColName?: string; source?: BillSource; skipClosedAndFullRefunds?: boolean }
): ExtractedCategoryStat[] {
  if (!categoryColName) return [];
  const catIdx = headers.indexOf(categoryColName);
  if (catIdx < 0) return [];
  const typeIdx = typeColName ? headers.indexOf(typeColName) : -1;
  const statusIdx = filterOptions?.statusColName
    ? headers.indexOf(filterOptions.statusColName)
    : -1;

  const statsMap = new Map<string, { count: number; expenseCount: number; incomeCount: number }>();

  for (const row of rows) {
    const rawType = typeIdx >= 0 ? row[typeIdx]?.trim() : '';
    if (filterOptions?.skipClosedAndFullRefunds && filterOptions.source && statusIdx >= 0) {
      if (shouldSkipBillStatus(filterOptions.source, row[statusIdx], rawType)) {
        continue;
      }
    }

    const rawCat = row[catIdx]?.trim();
    if (!rawCat) continue;

    const stat = statsMap.get(rawCat) || { count: 0, expenseCount: 0, incomeCount: 0 };
    stat.count++;

    const normType = normalizeTransactionType(rawType, 'expense');
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
  typeColName?: string
): ExtractedTypeStat[] {
  if (!typeColName) return [];
  const typeIdx = headers.indexOf(typeColName);
  if (typeIdx < 0) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
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
  const amountIdx = getColIndex(options.mapping.amountCol);
  const typeIdx = getColIndex(options.mapping.typeCol);
  const catIdx = getColIndex(options.mapping.categoryCol);
  const acctIdx = getColIndex(options.mapping.accountCol);
  const noteIdx = getColIndex(options.mapping.noteCol);
  const reimbIdx = getColIndex(options.mapping.reimburseCol);
  const statusIdx = getColIndex(options.mapping.statusCol);
  const orderIdx = getColIndex(options.mapping.orderIdCol);

  const catMapById = new Map<string, Category>(options.existingCategories.map((c) => [c.id, c]));
  const catMapByName = new Map<string, Category>(
    options.existingCategories.map((c) => [c.name.trim().toLowerCase(), c])
  );
  const acctMapByName = new Map<string, Account>(
    options.existingAccounts.map((a) => [a.name.trim().toLowerCase(), a])
  );
  const seenBatchKeys = new Set<string>();

  const records: PreparedImportRecord[] = [];
  let skippedCount = 0;
  let duplicateCount = 0;
  let filteredStatusCount = 0;

  for (const row of rows) {
    if (row.length === 0 || row.every((c) => !c.trim())) {
      skippedCount++;
      continue;
    }

    const rawType = typeIdx >= 0 ? row[typeIdx]?.trim() : undefined;
    const rawStatus = statusIdx >= 0 ? row[statusIdx]?.trim() : undefined;

    if (options.skipClosedAndFullRefunds && options.source) {
      if (shouldSkipBillStatus(options.source, rawStatus, rawType)) {
        filteredStatusCount++;
        skippedCount++;
        continue;
      }
    }

    const rawAmount = amountIdx >= 0 ? row[amountIdx] : '';
    const { cents, inferredType } = normalizeAmount(rawAmount);
    if (cents <= 0) {
      skippedCount++;
      continue;
    }

    let type: TransactionType = inferredType || 'expense';

    if (rawType && options.typeMapping && options.typeMapping[rawType]) {
      const mapped = options.typeMapping[rawType];
      if (mapped === 'skip') {
        skippedCount++;
        continue;
      }
      type = mapped;
    } else if (rawType) {
      if (rawType === '/' || rawType.includes('不计')) {
        skippedCount++;
        continue;
      }
      type = normalizeTransactionType(rawType, inferredType || 'expense');
    }

    const rawOrderId = orderIdx >= 0 ? row[orderIdx]?.trim() : undefined;
    const cleanOrderId = rawOrderId && rawOrderId !== '/' ? rawOrderId : undefined;
    let ext: Record<string, unknown> | undefined;

    if (options.source && cleanOrderId) {
      const importKey = buildExternalImportKey(options.source, cleanOrderId);
      if (options.skipDuplicates) {
        if (options.existingImportKeys?.has(importKey) || seenBatchKeys.has(importKey)) {
          duplicateCount++;
          skippedCount++;
          continue;
        }
      }
      seenBatchKeys.add(importKey);
      if (options.source === 'wechat' || options.source === 'alipay') {
        ext = {
          importMeta: {
            source: options.source,
            orderId: cleanOrderId,
          },
        };
      }
    }

    const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
    const { date, createdAt } = normalizeDateTime(rawDate);

    const rawCat = catIdx >= 0 ? row[catIdx]?.trim() : undefined;
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
    let rawAccountName: string | undefined;
    if (acctIdx >= 0 && row[acctIdx]) {
      const candidateAcct = row[acctIdx].trim();
      if (candidateAcct && candidateAcct !== '/') {
        rawAccountName = candidateAcct;
        const acctKey = rawAccountName.toLowerCase();
        if (acctMapByName.has(acctKey)) {
          accountId = acctMapByName.get(acctKey)!.id;
        }
      }
    }

    const note = noteIdx >= 0 ? row[noteIdx]?.trim() || undefined : undefined;
    let isReimbursable = false;
    if (reimbIdx >= 0 && row[reimbIdx]) {
      const val = row[reimbIdx].trim();
      isReimbursable = val === '是' || val === '报销' || val === 'true' || val === '1';
    }

    records.push({
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
      ext,
      rawRow: row,
    });
  }

  return { records, skippedCount, duplicateCount, filteredStatusCount };
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
