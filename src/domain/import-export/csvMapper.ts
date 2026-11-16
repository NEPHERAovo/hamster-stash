import type { Transaction, TransactionType } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { generateCsv } from './csvParser';
import { centsToYuan } from '../finance/balanceCalculator';

export type ImportMode = 'elephant' | 'standard' | 'preset';

export interface CsvColumnMapping {
  dateCol?: string;          // 日期列
  amountCol?: string;        // 金额列
  typeCol?: string;          // 收支类型列
  categoryCol?: string;      // 分类列
  accountCol?: string;       // 账户列
  noteCol?: string;          // 备注列
  reimburseCol?: string;     // 报销列
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
  categoryMapping: Record<string, string>; // rawCategoryName -> categoryId
  typeMapping?: Record<string, TransactionType | 'skip'>; // rawTypeName -> targetType or 'skip'
  defaultAccountId: string;
  defaultExpenseCategoryId: string;
  defaultIncomeCategoryId: string;
  existingCategories: Category[];
  existingAccounts: Account[];
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
  amount: number;            // 整数分
  date: string;              // YYYY-MM-DD
  categoryId: string;
  accountId: string;
  rawAccountName?: string;
  rawCategoryName?: string;
  note?: string;
  isReimbursable?: boolean;
  rawRow: string[];
}

/**
 * 自动根据 CSV 表头智能推断各系统字段对应的列名
 */
export function inferColumnMapping(headers: string[]): CsvColumnMapping {
  const findMatch = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = headers.find((h) => pattern.test(h.trim()));
      if (match) return match;
    }
    return undefined;
  };

  return {
    dateCol: findMatch([/^日期$/i, /日期/i, /时间/i, /date/i, /time/i]),
    amountCol: findMatch([/^金额$/i, /金额/i, /amount/i, /数额/i, /money/i]),
    typeCol: findMatch([/^收支$/i, /收支/i, /^类型$/i, /类型/i, /type/i, /收支类型/i, /^收\/支$/i]),
    categoryCol: findMatch([/^分类名称$/i, /^交易分类$/i, /^交易类型$/i, /^分类$/i, /^类别$/i, /分类/i, /类目/i, /category/i]),
    accountCol: findMatch([/^账户$/i, /^支付方式$/i, /^收\/付款方式$/i, /^资金渠道$/i, /账户/i, /资产/i, /account/i]),
    noteCol: findMatch([/^备注$/i, /^商品$/i, /^商品说明$/i, /说明/i, /描述/i, /商户/i, /note/i, /desc/i]),
    reimburseCol: findMatch([/^报销$/i, /报销/i, /reimburse/i]),
  };
}

/**
 * 标准化解析日期字符串为 YYYY-MM-DD
 */
export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * 标准化金额（支持小数、带¥/$/￥符号、千分位、正负号），返回整数分与方向推断
 */
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

/**
 * 解析收支类型文本
 */
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

/**
 * 统计并提取 CSV 中所有的原始分类名称与出现频次，并推断收支倾向及推荐映射
 */
export function extractCategoriesFromCsv(
  headers: string[],
  rows: string[][],
  categoryColName?: string,
  typeColName?: string,
  existingCategories: Category[] = [],
  presetAliases: Record<string, string> = {}
): ExtractedCategoryStat[] {
  if (!categoryColName) return [];
  const catIdx = headers.indexOf(categoryColName);
  if (catIdx < 0) return [];
  const typeIdx = typeColName ? headers.indexOf(typeColName) : -1;

  const statsMap = new Map<string, { count: number; expenseCount: number; incomeCount: number }>();

  for (const row of rows) {
    const rawCat = row[catIdx]?.trim();
    if (!rawCat) continue;

    const stat = statsMap.get(rawCat) || { count: 0, expenseCount: 0, incomeCount: 0 };
    stat.count++;

    const rawType = typeIdx >= 0 ? row[typeIdx]?.trim() : '';
    const normType = normalizeTransactionType(rawType, 'expense');
    if (normType === 'income') {
      stat.incomeCount++;
    } else {
      stat.expenseCount++;
    }
    statsMap.set(rawCat, stat);
  }

  const catMapByName = new Map<string, Category>();
  for (const c of existingCategories) {
    catMapByName.set(c.name.trim().toLowerCase(), c);
  }

  const result: ExtractedCategoryStat[] = [];
  for (const [rawName, stat] of statsMap.entries()) {
    const dominantType: TransactionType = stat.incomeCount > stat.expenseCount ? 'income' : 'expense';

    let suggestedCatId: string | undefined;
    const aliasTarget = presetAliases[rawName];
    if (aliasTarget) {
      const match = catMapByName.get(aliasTarget.toLowerCase()) || existingCategories.find((c) => c.name === aliasTarget);
      if (match) suggestedCatId = match.id;
    }

    if (!suggestedCatId) {
      const exact = catMapByName.get(rawName.toLowerCase());
      if (exact) suggestedCatId = exact.id;
    }

    if (!suggestedCatId) {
      const fuzzy = existingCategories.find((c) =>
        c.type === dominantType && (c.name.includes(rawName) || rawName.includes(c.name))
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

/**
 * 统计并提取 CSV 中所有的原始收支类型
 */
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
    if (lower.includes('支') || lower === 'expense' || lower === 'out') {
      suggested = 'expense';
    } else if (lower.includes('收') || lower === 'income' || lower === 'in') {
      suggested = 'income';
    } else if (lower.includes('不计') || lower.includes('其他') || lower === 'skip') {
      suggested = 'skip';
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

/**
 * 【高级可配置导入映射引擎】
 * 结合列映射、账单分类显式映射表、收支类型映射表进行批量精准导入
 */
export function mapConfiguredCsvRows(
  headers: string[],
  rows: string[][],
  options: AdvancedImportOptions
): { records: PreparedImportRecord[]; skippedCount: number } {
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

  const catMapById = new Map<string, Category>(options.existingCategories.map((c) => [c.id, c]));
  const catMapByName = new Map<string, Category>(options.existingCategories.map((c) => [c.name.trim().toLowerCase(), c]));
  const acctMapByName = new Map<string, Account>(options.existingAccounts.map((a) => [a.name.trim().toLowerCase(), a]));

  const records: PreparedImportRecord[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (row.length === 0 || row.every((c) => !c.trim())) {
      skippedCount++;
      continue;
    }

    const rawAmount = amountIdx >= 0 ? row[amountIdx] : '';
    const { cents, inferredType } = normalizeAmount(rawAmount);
    if (cents <= 0) {
      skippedCount++;
      continue;
    }

    const rawType = typeIdx >= 0 ? row[typeIdx]?.trim() : undefined;
    let type: TransactionType = inferredType || 'expense';

    if (rawType && options.typeMapping && options.typeMapping[rawType]) {
      const mapped = options.typeMapping[rawType];
      if (mapped === 'skip') {
        skippedCount++;
        continue;
      }
      type = mapped;
    } else if (rawType) {
      type = normalizeTransactionType(rawType, inferredType || 'expense');
    }

    const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
    const date = normalizeDate(rawDate);

    const rawCat = catIdx >= 0 ? row[catIdx]?.trim() : undefined;
    let categoryId = type === 'income' ? options.defaultIncomeCategoryId : options.defaultExpenseCategoryId;

    if (rawCat && options.categoryMapping[rawCat]) {
      categoryId = options.categoryMapping[rawCat];
    } else if (rawCat) {
      const matchByName = catMapByName.get(rawCat.toLowerCase());
      if (matchByName) {
        categoryId = matchByName.id;
      }
    }

    if (!catMapById.has(categoryId)) {
      categoryId = type === 'income' ? options.defaultIncomeCategoryId : options.defaultExpenseCategoryId;
    }

    let accountId = options.defaultAccountId;
    let rawAccountName: string | undefined;
    if (acctIdx >= 0 && row[acctIdx]) {
      rawAccountName = row[acctIdx].trim();
      const acctKey = rawAccountName.toLowerCase();
      if (acctMapByName.has(acctKey)) {
        accountId = acctMapByName.get(acctKey)!.id;
      }
    }

    const note = noteIdx >= 0 ? row[noteIdx]?.trim() : undefined;
    let isReimbursable = false;
    if (reimbIdx >= 0 && row[reimbIdx]) {
      const val = row[reimbIdx].trim();
      isReimbursable = val === '是' || val === '报销' || val === 'true' || val === '1';
    }

    records.push({
      type,
      amount: cents,
      date,
      categoryId,
      accountId,
      rawAccountName,
      rawCategoryName: rawCat,
      note,
      isReimbursable,
      rawRow: row,
    });
  }

  return { records, skippedCount };
}

/**
 * 兼容旧模式：标准 CSV 映射包装
 */
export function mapStandardCsvRows(
  headers: string[],
  rows: string[][],
  options: StandardImportOptions
): { records: PreparedImportRecord[]; skippedCount: number } {
  return mapConfiguredCsvRows(headers, rows, {
    ...options,
    categoryMapping: {},
  });
}

/**
 * 兼容旧模式：小象记账预设映射包装
 */
export function mapElephantCsvRows(
  headers: string[],
  rows: string[][],
  options: ElephantImportOptions
): { records: PreparedImportRecord[]; skippedCount: number } {
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
    '吃饭': 'cat_food',
    '超市': 'cat_shop',
    '交通费': 'cat_transit',
    '生活': 'cat_home',
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

/**
 * 保持向后兼容的通用映射包装函数
 */
export function mapCsvRowsToTransactions(
  headers: string[],
  rows: string[][],
  options: StandardImportOptions
): { records: PreparedImportRecord[]; skippedCount: number } {
  return mapStandardCsvRows(headers, rows, options);
}

/**
 * 导出全部账单数据为标准 CSV 字符串
 */
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
      case 'expense': return '支出';
      case 'income': return '收入';
      case 'transfer': return '转账';
      case 'loan': return '借贷';
      case 'reconcile': return '平账';
      default: return '支出';
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
