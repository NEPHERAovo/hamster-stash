import type { Transaction } from '../../types/transaction';
import type { ParsedCsvResult } from './csvParser';

export type BillSource = 'wechat' | 'alipay' | 'elephant' | 'standard';

export interface BillFilterOptions {
  skipClosedAndFullRefunds: boolean;
  skipDuplicates: boolean;
}

const PROMO_FRAGMENT_RE =
  /^(?:红包|集分宝|积分|超划算|团购神券|商家优惠抵扣|.*立减.*|.*抵价券.*|.*优惠券.*|.*消费券.*|.*购物津贴.*)$/i;

const BOILERPLATE_NOTE_RE = /^(?:收钱码收款|经营码交易|转账备注:微信转账)$/;

const WECHAT_CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  {
    category: '餐饮',
    pattern:
      /美团|火锅|餐饮|饭|面|粉|炸鸡|汉堡|麦当劳|肯德基|星巴克|瑞幸|luckin|coffee|咖啡|奶茶|茶|烧烤|饼|小吃|外卖|食堂|餐厅|美食|饮品|乡村基|卤|烤|粥|饺|烘焙|蛋糕|甜品/i,
  },
  {
    category: '超市',
    pattern:
      /超市|便利|朴朴|永辉|沃尔玛|盒马|山姆|零食|集刻|罗森|全家|7-11|711|好特卖|生鲜|菜市场|百果园|水果/i,
  },
  {
    category: '购物',
    pattern:
      /拼多多|淘宝|天猫|京东|抖音|小红书|得物|唯品会|电商|服饰|优衣库|百货|商城|网购|数码|苹果|小米|华为|旗舰店/i,
  },
  {
    category: '交通',
    pattern:
      /中铁|12306|铁路|火车|高铁|滴滴|高德|打车|出行|地铁|公交|单车|哈啰|青桔|航空|机票|加油|石化|石油|停车|高速|ETC|顺风车/i,
  },
  {
    category: '住房',
    pattern: /物业|电网|供电|水务|燃气|电费|水费|房租|租金|宽带/i,
  },
  {
    category: '通讯',
    pattern: /中国移动|中国联通|中国电信|话费|手机充值|流量包/i,
  },
  {
    category: '医疗',
    pattern: /医院|药房|药店|诊所|体检|医疗|口腔|牙科|卫生/i,
  },
  {
    category: '娱乐',
    pattern: /影城|电影|游戏|网易雷火|腾讯|Steam|哔哩哔哩|bilibili|爱奇艺|优酷|音乐|KTV|娱乐|门票|乐园|网吧/i,
  },
];

export function detectBillSource(headers: string[], metadataLines?: string[]): BillSource {
  const headerSet = new Set(headers.map((h) => h.trim()));
  const metaText = (metadataLines ?? []).join('\n');

  if (
    (headerSet.has('交易时间') &&
      headerSet.has('交易类型') &&
      headerSet.has('金额(元)') &&
      headerSet.has('当前状态')) ||
    metaText.includes('微信支付账单明细')
  ) {
    return 'wechat';
  }

  if (
    (headerSet.has('交易时间') &&
      headerSet.has('交易分类') &&
      headerSet.has('商品说明') &&
      headerSet.has('收/付款方式') &&
      headerSet.has('交易状态')) ||
    metaText.includes('支付宝')
  ) {
    return 'alipay';
  }

  if (
    headerSet.has('日期') &&
    headerSet.has('分类名称') &&
    headerSet.has('收支') &&
    headerSet.has('金额')
  ) {
    return 'elephant';
  }

  return 'standard';
}

export function normalizeBankName(raw: string): string {
  return raw
    .trim()
    .replace(/^中国工商银行/, '工商银行')
    .replace(/^中国建设银行/, '建设银行')
    .replace(/^中国农业银行/, '农业银行')
    .replace(/^中国邮政储蓄银行/, '邮储银行');
}

export function normalizePaymentAccount(
  source: BillSource,
  rawMethod: string,
  status?: string,
  direction?: string
): string {
  const trimmed = rawMethod.trim();

  if (source === 'wechat') {
    if (trimmed === '零钱') return '微信零钱';
    if (trimmed === '零钱通') return '微信零钱通';
    if (!trimmed || trimmed === '/') {
      if (status && (status.includes('零钱') || status.includes('到账') || status.includes('收钱'))) {
        return '微信零钱';
      }
      return '';
    }
    return normalizeBankName(trimmed);
  }

  if (source === 'alipay') {
    if (!trimmed || trimmed === '/') {
      return direction?.trim() === '收入' ? '支付宝余额' : '';
    }

    const parts = trimmed
      .split('&')
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !PROMO_FRAGMENT_RE.test(p));

    const primary = parts[0] ?? '';
    if (!primary) {
      return direction?.trim() === '收入' ? '支付宝余额' : '';
    }

    let cleaned = primary.replace(/^云闪付-/, '');
    if (cleaned.startsWith('花呗分期')) {
      cleaned = '花呗';
    } else {
      cleaned = cleaned.replace(/分期(\([^)]*\))\s*\d+期$/, '$1').replace(/分期\s*\d+期$/, '');
    }

    if (cleaned === '账户余额' || cleaned === '余额') {
      return '支付宝余额';
    }

    return normalizeBankName(cleaned);
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
  const typeTrimmed = txType.trim();
  if (typeTrimmed.includes('退款')) return '退款';
  if (typeTrimmed.includes('红包')) {
    return direction.trim() === '收入' ? '红包' : '人情';
  }
  if (typeTrimmed === '转账' || typeTrimmed === '二维码收款') {
    return '转账';
  }

  const text = `${counterparty} ${product}`.trim();
  for (const rule of WECHAT_CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return rule.category;
    }
  }

  return '其他';
}

function cleanNoteSegment(raw: string | undefined, hasCounterparty: boolean): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '/' || BOILERPLATE_NOTE_RE.test(trimmed)) {
    return '';
  }
  if (hasCounterparty && /^商户单号\s*[A-Za-z0-9]+$/i.test(trimmed)) {
    return '';
  }
  return trimmed;
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
  if (cp && prod && prod.startsWith(cp)) {
    parts.push(prod);
  } else {
    if (cp) parts.push(cp);
    if (prod && prod !== cp) parts.push(prod);
  }

  if (rem && !parts.includes(rem)) {
    parts.push(rem);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function shouldSkipBillStatus(
  source: BillSource,
  status?: string,
  direction?: string
): boolean {
  const s = status?.trim() ?? '';
  const d = direction?.trim() ?? '';

  if (source === 'alipay') {
    if (
      s === '交易关闭' ||
      s === '已关闭' ||
      s === '还款失败' ||
      s === '冻结成功' ||
      s === '解冻成功'
    ) {
      return true;
    }
    return s === '退款成功' && d === '支出';
  }

  if (source === 'wechat') {
    return s === '已全额退款' || s === '对方已退还';
  }

  return false;
}

export function preprocessBillTable(
  parsed: ParsedCsvResult,
  source: BillSource
): { headers: string[]; rows: string[][] } {
  if (source !== 'wechat' && source !== 'alipay') {
    return { headers: parsed.headers, rows: parsed.rows };
  }

  const baseHeaders = [...parsed.headers];
  const idx = (name: string) => baseHeaders.indexOf(name);

  if (source === 'wechat') {
    if (baseHeaders.includes('智能分类') && baseHeaders.includes('账户渠道')) {
      return { headers: baseHeaders, rows: parsed.rows };
    }
    const typeIdx = idx('交易类型');
    const cpIdx = idx('交易对方');
    const prodIdx = idx('商品');
    const dirIdx = idx('收/支');
    const methodIdx = idx('支付方式');
    const statusIdx = idx('当前状态');
    const remarkIdx = idx('备注');

    const headers = [...baseHeaders, '智能分类', '账户渠道', '合并备注'];
    const rows = parsed.rows.map((row) => {
      const padded = baseHeaders.map((_, i) => row[i] ?? '');
      const txType = typeIdx >= 0 ? padded[typeIdx] : '';
      const cp = cpIdx >= 0 ? padded[cpIdx] : '';
      const prod = prodIdx >= 0 ? padded[prodIdx] : '';
      const dir = dirIdx >= 0 ? padded[dirIdx] : '';
      const method = methodIdx >= 0 ? padded[methodIdx] : '';
      const status = statusIdx >= 0 ? padded[statusIdx] : '';
      const remark = remarkIdx >= 0 ? padded[remarkIdx] : '';

      const smartCat = classifyWechatCategory(txType, cp, prod, dir);
      const normAcct = normalizePaymentAccount('wechat', method, status, dir);
      const mergedNote = composeBillNote('wechat', cp, prod, remark) ?? '';

      return [...padded, smartCat, normAcct, mergedNote];
    });

    return { headers, rows };
  }

  if (baseHeaders.includes('账户渠道') && baseHeaders.includes('合并备注')) {
    return { headers: baseHeaders, rows: parsed.rows };
  }

  const cpIdx = idx('交易对方');
  const prodIdx = idx('商品说明');
  const dirIdx = idx('收/支');
  const methodIdx = idx('收/付款方式');
  const statusIdx = idx('交易状态');
  const remarkIdx = idx('备注');

  const headers = [...baseHeaders, '账户渠道', '合并备注'];
  const rows = parsed.rows.map((row) => {
    const padded = baseHeaders.map((_, i) => row[i] ?? '');
    const cp = cpIdx >= 0 ? padded[cpIdx] : '';
    const prod = prodIdx >= 0 ? padded[prodIdx] : '';
    const dir = dirIdx >= 0 ? padded[dirIdx] : '';
    const method = methodIdx >= 0 ? padded[methodIdx] : '';
    const status = statusIdx >= 0 ? padded[statusIdx] : '';
    const remark = remarkIdx >= 0 ? padded[remarkIdx] : '';

    const normAcct = normalizePaymentAccount('alipay', method, status, dir);
    const mergedNote = composeBillNote('alipay', cp, prod, remark) ?? '';

    return [...padded, normAcct, mergedNote];
  });

  return { headers, rows };
}

export function buildExternalImportKey(source: BillSource, orderId: string): string {
  return `${source}:${orderId.trim()}`;
}

export function extractExistingImportKeys(transactions: Transaction[]): Set<string> {
  const keys = new Set<string>();
  for (const tx of transactions) {
    if (!tx.ext || typeof tx.ext !== 'object') continue;
    const importMeta = (tx.ext as Record<string, unknown>).importMeta;
    if (!importMeta || typeof importMeta !== 'object') continue;
    const metaObj = importMeta as Record<string, unknown>;
    const source = typeof metaObj.source === 'string' ? metaObj.source.trim() : '';
    const orderId = typeof metaObj.orderId === 'string' ? metaObj.orderId.trim() : '';
    if (source && orderId) {
      keys.add(buildExternalImportKey(source as BillSource, orderId));
    }
  }
  return keys;
}
