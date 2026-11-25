import type { Transaction } from '../types/transaction';
import type { Category } from '../types/category';
import type { Account } from '../types/account';
import { centsToYuan } from '../domain/finance/balanceCalculator';

const STRIP_NOISE_RE = /[\s·\-_/\\,.¥￥,，。]/g;

function normalizeText(input: string): string {
  return input.toLowerCase().replace(STRIP_NOISE_RE, '');
}

function isOrderedSubsequence(query: string, target: string): boolean {
  if (!query) return true;
  if (query.length > target.length) return false;
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++;
    }
  }
  return qi === query.length;
}

export function fuzzyMatchField(fieldValue: string, rawToken: string): boolean {
  const token = rawToken.trim().toLowerCase();
  if (!token) return true;
  const target = fieldValue.trim().toLowerCase();
  if (!target) return false;

  if (target.includes(token)) return true;

  const cleanToken = normalizeText(token);
  const cleanTarget = normalizeText(target);
  if (!cleanToken) return true;
  if (cleanTarget.includes(cleanToken)) return true;

  if (/\d/.test(cleanToken) || cleanToken.length < 2) {
    return false;
  }

  return isOrderedSubsequence(cleanToken, cleanTarget);
}

function buildDateCandidates(dateStr: string): string[] {
  if (!dateStr) return [];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return [dateStr];

  const [y, m, d] = parts;
  const mNum = String(Number(m));
  const dNum = String(Number(d));

  return [
    dateStr,
    `${y}.${m}.${d}`,
    `${y}/${m}/${d}`,
    `${y}${m}${d}`,
    `${m}-${d}`,
    `${m}.${d}`,
    `${m}/${d}`,
    `${m}月${d}日`,
    `${mNum}月${dNum}日`,
    `${y}年${mNum}月${dNum}日`,
  ];
}

function buildAmountCandidates(amountCents: number): string[] {
  const formatted = centsToYuan(amountCents);
  const rawYuan = String(amountCents / 100);
  const list = [formatted, rawYuan, `¥${formatted}`, `¥${rawYuan}`];
  if (formatted.endsWith('.00')) {
    list.push(formatted.slice(0, -3));
  }
  return list;
}

function getTypeLabel(type: Transaction['type']): string {
  if (type === 'income') return '收入';
  if (type === 'transfer') return '转账';
  if (type === 'loan') return '借贷';
  if (type === 'reconcile') return '平账';
  return '支出';
}

export function buildTransactionSearchFields(
  tx: Transaction,
  catMap: Map<string, Category>,
  acctMap: Map<string, Account>
): string[] {
  const fields: string[] = [];

  if (tx.note) fields.push(tx.note);

  const cat = catMap.get(tx.categoryId);
  if (cat?.name) fields.push(cat.name);

  const acct = acctMap.get(tx.accountId);
  if (acct?.name) fields.push(acct.name);

  if (tx.toAccountId) {
    const toAcct = acctMap.get(tx.toAccountId);
    if (toAcct?.name) fields.push(toAcct.name);
  }

  if (tx.loanParty) fields.push(tx.loanParty);

  fields.push(getTypeLabel(tx.type));

  if (tx.isReimbursable) {
    fields.push(tx.reimburseStatus === 'settled' ? '报销 已报销' : '报销 待报销');
  }
  if (tx.offsetTransactionId) {
    fields.push('抵扣 aa');
  }
  if (tx.ext?.amortize) {
    fields.push('分期');
  }

  fields.push(...buildAmountCandidates(tx.amount));
  fields.push(...buildDateCandidates(tx.date));

  return fields;
}

export function fuzzyMatchTransaction(
  tx: Transaction,
  query: string,
  catMap: Map<string, Category>,
  acctMap: Map<string, Account>
): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const fields = buildTransactionSearchFields(tx, catMap, acctMap);

  return tokens.every((token) => fields.some((field) => fuzzyMatchField(field, token)));
}
