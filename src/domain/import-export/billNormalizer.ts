import type { Transaction } from '../../types/transaction';
import type { ParsedCsvResult } from './csvParser';
import { hashString8, hashString16 } from '../../utils/hash';

export type BillSource = 'wechat' | 'alipay' | 'elephant' | 'standard';

export interface BillFilterOptions {
  skipClosedAndFullRefunds: boolean;
  skipDuplicates: boolean;
}

const PROMO_FRAGMENT_RE =
  /^(?:红包|集分宝|积分|超划算|团购神券|商家优惠抵扣|.*立减.*|.*抵价券.*|.*优惠券.*|.*消费券.*|.*购物津贴.*)$/i;
const BOILERPLATE_NOTE_RE = /^(?:收钱码收款|经营码交易|转账备注:微信转账)$/;
const ALIPAY_SKIP_STATUSES = new Set(['交易关闭', '已关闭', '还款失败', '冻结成功', '解冻成功']);
const WECHAT_SKIP_STATUSES = new Set(['已全额退款', '对方已退还']);
const SAFE_ORDER_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const WECHAT_CATEGORY_RULES: [string, RegExp][] = [
  ['餐饮', /美团|火锅|餐饮|饭|面|粉|炸鸡|汉堡|麦当劳|肯德基|星巴克|瑞幸|luckin|coffee|咖啡|奶茶|茶|烧烤|饼|小吃|外卖|食堂|餐厅|美食|饮品|乡村基|卤|烤|粥|饺|烘焙|蛋糕|甜品/i],
  ['超市', /超市|便利|朴朴|永辉|沃尔玛|盒马|山姆|零食|集刻|罗森|全家|7-11|711|好特卖|生鲜|菜市场|百果园|水果/i],
  ['购物', /拼多多|淘宝|天猫|京东|抖音|小红书|得物|唯品会|电商|服饰|优衣库|百货|商城|网购|数码|苹果|小米|华为|旗舰店/i],
  ['交通', /中铁|12306|铁路|火车|高铁|滴滴|高德|打车|出行|地铁|公交|单车|哈啰|青桔|航空|机票|加油|石化|石油|停车|高速|ETC|顺风车/i],
  ['住房', /物业|电网|供电|水务|燃气|电费|水费|房租|租金|宽带/i],
  ['通讯', /中国移动|中国联通|中国电信|话费|手机充值|流量包/i],
  ['医疗', /医院|药房|药店|诊所|体检|医疗|口腔|牙科|卫生/i],
  ['娱乐', /影城|电影|游戏|网易雷火|腾讯|Steam|哔哩哔哩|bilibili|爱奇艺|优酷|音乐|KTV|娱乐|门票|乐园|网吧/i],
];

export function detectBillSource(headers: string[], metadataLines?: string[]): BillSource {
  const h = new Set(headers.map((x) => x.trim()));
  const meta = (metadataLines ?? []).join('\n');

  if ((h.has('交易时间') && h.has('交易类型') && h.has('金额(元)') && h.has('当前状态')) || meta.includes('微信支付账单明细')) {
    return 'wechat';
  }
  if ((h.has('交易时间') && h.has('交易分类') && h.has('商品说明') && h.has('收/付款方式') && h.has('交易状态')) || meta.includes('支付宝')) {
    return 'alipay';
  }
  if (h.has('日期') && h.has('分类名称') && h.has('收支') && h.has('金额')) {
    return 'elephant';
  }
  return 'standard';
}

export function normalizeBankName(raw: string): string {
  return raw.trim().replace(/^中国(工商|建设|农业|邮政储蓄)银行/, '$1银行');
}

export function normalizePaymentAccount(
  source: BillSource,
  rawMethod: string,
  status?: string,
  direction?: string
): string {
  const trimmed = rawMethod.trim();
  if (source === 'wechat') {
    if (trimmed === '零钱' || trimmed === '零钱通') return `微信${trimmed}`;
    if (!trimmed || trimmed === '/') {
      return status && /零钱|到账|收钱/.test(status) ? '微信零钱' : '';
    }
    return normalizeBankName(trimmed);
  }
  if (source === 'alipay') {
    const primary = trimmed
      .split('&')
      .map((p) => p.trim())
      .find((p) => p.length > 0 && p !== '/' && !PROMO_FRAGMENT_RE.test(p));
    if (!primary) return direction?.trim() === '收入' ? '支付宝余额' : '';
    let cleaned = primary.replace(/^云闪付-/, '');
    cleaned = cleaned.startsWith('花呗分期')
      ? '花呗'
      : cleaned.replace(/分期(\([^)]*\))\s*\d+期$/, '$1').replace(/分期\s*\d+期$/, '');
    return cleaned === '账户余额' || cleaned === '余额' ? '支付宝余额' : normalizeBankName(cleaned);
  }
  return trimmed === '/' ? '' : trimmed;
}

export function inferAccountType(accountName: string): 'savings' | 'credit' {
  return /信用|花呗|白条|借呗|分期/i.test(accountName) ? 'credit' : 'savings';
}

export function classifyWechatCategory(
  txType: string,
  counterparty: string,
  product: string,
  direction: string
): string {
  const t = txType.trim();
  if (t.includes('退款')) return '退款';
  if (t.includes('红包')) return direction.trim() === '收入' ? '红包' : '人情';
  if (t === '转账' || t === '二维码收款') return '转账';
  const text = `${counterparty} ${product}`.trim();
  return WECHAT_CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? '其他';
}

function cleanNoteSegment(raw: string | undefined, hasCounterparty: boolean): string {
  const t = raw?.trim() ?? '';
  if (!t || t === '/' || BOILERPLATE_NOTE_RE.test(t)) return '';
  if (hasCounterparty && /^商户单号\s*[A-Za-z0-9]+$/i.test(t)) return '';
  return t;
}

export function composeBillNote(
  _source: BillSource,
  counterparty?: string,
  product?: string,
  remark?: string
): string | undefined {
  const cp = cleanNoteSegment(counterparty, false);
  const prod = cleanNoteSegment(product, Boolean(cp));
  const rem = cleanNoteSegment(remark, Boolean(cp));
  const parts: string[] = [];
  if (cp && prod && prod.startsWith(cp)) parts.push(prod);
  else {
    if (cp) parts.push(cp);
    if (prod && prod !== cp) parts.push(prod);
  }
  if (rem && !parts.includes(rem)) parts.push(rem);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function shouldSkipBillStatus(source: BillSource, status?: string, direction?: string): boolean {
  const s = status?.trim() ?? '';
  if (source === 'alipay') return ALIPAY_SKIP_STATUSES.has(s) || (s === '退款成功' && direction?.trim() === '支出');
  if (source === 'wechat') return WECHAT_SKIP_STATUSES.has(s);
  return false;
}

export function preprocessBillTable(
  parsed: ParsedCsvResult,
  source: BillSource
): { headers: string[]; rows: string[][] } {
  if (source !== 'wechat' && source !== 'alipay') return { headers: parsed.headers, rows: parsed.rows };
  const isWechat = source === 'wechat';
  const baseHeaders = [...parsed.headers];
  if (baseHeaders.includes('账户渠道') && (!isWechat || baseHeaders.includes('智能分类'))) {
    return { headers: baseHeaders, rows: parsed.rows };
  }

  const idx = (name: string) => baseHeaders.indexOf(name);
  const typeIdx = idx('交易类型');
  const cpIdx = idx('交易对方');
  const prodIdx = idx(isWechat ? '商品' : '商品说明');
  const dirIdx = idx('收/支');
  const methodIdx = idx(isWechat ? '支付方式' : '收/付款方式');
  const statusIdx = idx(isWechat ? '当前状态' : '交易状态');
  const remarkIdx = idx('备注');

  const extraHeaders = isWechat ? ['智能分类', '账户渠道', '合并备注'] : ['账户渠道', '合并备注'];
  const rows = parsed.rows.map((row) => {
    const padded = baseHeaders.map((_, i) => row[i] ?? '');
    const get = (i: number) => (i >= 0 ? padded[i] : '');
    const dir = get(dirIdx);
    const cp = get(cpIdx);
    const prod = get(prodIdx);
    const status = get(statusIdx);
    const acct = normalizePaymentAccount(source, get(methodIdx), status, dir);
    const note = composeBillNote(source, cp, prod, get(remarkIdx)) ?? '';
    return isWechat
      ? [...padded, classifyWechatCategory(get(typeIdx), cp, prod, dir), acct, note]
      : [...padded, acct, note];
  });

  return { headers: [...baseHeaders, ...extraHeaders], rows };
}

export function buildFingerprintImportId(
  source: BillSource,
  fields: { date: string; createdAt?: string; type: string; amount: number; rawCategory?: string; rawAccount?: string; note?: string; occurrence: number }
): string {
  const payload = [fields.date, fields.createdAt || '', fields.type, fields.amount, fields.rawCategory || '', fields.rawAccount || '', fields.note || '', fields.occurrence].join('|');
  return `csv_${source}_${hashString16(payload)}`;
}

export function buildDeterministicImportId(source: BillSource, orderId: string): string {
  const clean = orderId.trim();
  let prefix = `csv_${source}`;
  if (source === 'wechat') prefix = 'wx';
  else if (source === 'alipay') prefix = 'ali';
  return `${prefix}_${SAFE_ORDER_ID_RE.test(clean) ? clean : hashString16(clean)}`;
}

export function buildWealthMonthlyTxId(source: BillSource, yearMonth: string, accountName: string): string {
  const shortSrc = source === 'wechat' ? 'wx' : 'ali';
  return `wealth_${shortSrc}_${yearMonth}_${hashString8(accountName.trim() || '理财账户')}`;
}

export function isWealthDailyEarningRow(
  source: BillSource,
  params: { category?: string; product?: string; counterparty?: string; direction?: string; status?: string }
): boolean {
  const dir = params.direction?.trim() ?? '';
  const status = params.status?.trim() ?? '';
  const category = params.category?.trim() ?? '';
  const product = params.product?.trim() ?? '';
  const counterparty = params.counterparty?.trim() ?? '';

  if (source === 'alipay') {
    return (
      dir === '不计收支' &&
      status === '交易成功' &&
      /收益发放|每日收益|日收益/.test(product) &&
      (category === '投资理财' || /余额宝|余利宝|基金|理财/.test(`${product} ${counterparty}`))
    );
  }
  if (source === 'wechat') {
    return (
      dir === '/' &&
      /收益发放|每日收益|日收益/.test(`${product} ${category}`) &&
      /零钱通|理财通|理财/.test(`${product} ${category} ${counterparty}`)
    );
  }
  return false;
}

export function extractExistingTransactionMap(transactions: Transaction[]): Map<string, Transaction> {
  const map = new Map<string, Transaction>();
  for (const tx of transactions) {
    if (!(tx as { deletedAt?: string }).deletedAt) map.set(tx.id, tx);
  }
  return map;
}
