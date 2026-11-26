import zlib from 'node:zlib';

const GBK_BYTE_MAP: Record<string, number[]> = {
  交: [0xbd, 0xbb], 易: [0xd2, 0xd7], 时: [0xca, 0xb1], 间: [0xbc, 0xe4],
  分: [0xb7, 0xd6], 类: [0xc0, 0xe0], 对: [0xb6, 0xd4], 方: [0xb7, 0xbd],
  商: [0xc9, 0xcc], 品: [0xc6, 0xb7], 说: [0xcb, 0xb5], 明: [0xc3, 0xf7],
  收: [0xca, 0xd5], 支: [0xd6, 0xa7], 金: [0xbd, 0xf0], 额: [0xb6, 0xee],
  付: [0xb8, 0xb6], 款: [0xbf, 0xee], 式: [0xca, 0xbd], 状: [0xd7, 0xb4],
  态: [0xcc, 0xac], 订: [0xb6, 0xa9], 单: [0xb5, 0xa5], 号: [0xba, 0xc5],
  备: [0xb1, 0xb8], 注: [0xd7, 0xa2], 餐: [0xb2, 0xcd], 饮: [0xd2, 0xfb],
  美: [0xc3, 0xc0], 食: [0xca, 0xb3], 出: [0xb3, 0xf6], 花: [0xbb, 0xa8],
  呗: [0xdf, 0xc2], 碰: [0xc5, 0xf6], 一: [0xd2, 0xbb], 下: [0xcf, 0xc2],
  立: [0xc1, 0xa2], 减: [0xbc, 0xf5], 成: [0xb3, 0xc9], 功: [0xb9, 0xa6],
  关: [0xb9, 0xd8], 闭: [0xb1, 0xd5], 不: [0xb2, 0xbb], 计: [0xbc, 0xc6],
  投: [0xcd, 0xb6], 资: [0xd7, 0xca], 理: [0xc0, 0xed], 财: [0xb2, 0xc6],
  余: [0xd3, 0xe0], 宝: [0xb1, 0xa6], 益: [0xd2, 0xe6], 发: [0xb7, 0xa2],
  放: [0xb7, 0xc5], 午: [0xce, 0xe7], 转: [0xd7, 0xaa], 入: [0xc8, 0xeb],
};

export function encodeGbkMockAlipayCsv(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    if (GBK_BYTE_MAP[ch]) bytes.push(...GBK_BYTE_MAP[ch]);
    else bytes.push(ch.charCodeAt(0) & 0xff);
  }
  return new Uint8Array(bytes);
}

export function createMinimalZip(
  entries: { name: string; data: Uint8Array; compress?: boolean }[]
): ArrayBuffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const shouldCompress = entry.compress ?? true;
    const payload = shouldCompress ? new Uint8Array(zlib.deflateRawSync(entry.data)) : entry.data;
    const method = shouldCompress ? 8 : 0;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localParts.push(local, payload);
    centralParts.push(central);
    offset += local.length + payload.length;
  }

  const centralSize = centralParts.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out.buffer;
}

export function buildMinimalWeChatXlsx(): Uint8Array {
  const enc = new TextEncoder();
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>交易时间</t></si><si><t>交易类型</t></si><si><t>交易对方</t></si><si><t>商品</t></si><si><t>收/支</t></si><si><t>金额(元)</t></si><si><t>支付方式</t></si><si><t>当前状态</t></si><si><t>交易单号</t></si><si><t>商户消费</t></si><si><t>美团</t></si><si><t>外卖午餐</t></si><si><t>支出</t></si><si><t>零钱</t></si><si><t>支付成功</t></si><si><t>已全额退款</t></si></sst>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><cellXfs count="2"><xf numFmtId="0" xfId="0"/><xf numFmtId="164" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c><c r="G1" t="s"><v>6</v></c><c r="H1" t="s"><v>7</v></c><c r="I1" t="s"><v>8</v></c></row><row r="2"><c r="A2" s="1"><v>46335.85625</v></c><c r="B2" t="s"><v>9</v></c><c r="C2" t="s"><v>10</v></c><c r="D2" t="s"><v>11</v></c><c r="E2" t="s"><v>12</v></c><c r="F2"><v>28.5</v></c><c r="G2" t="s"><v>13</v></c><c r="H2" t="s"><v>14</v></c><c r="I2" t="str"><v>wx_order_1</v></c></row><row r="3"><c r="A3" s="1"><v>46335.85625</v></c><c r="B3" t="s"><v>9</v></c><c r="C3" t="s"><v>10</v></c><c r="D3" t="s"><v>11</v></c><c r="E3" t="s"><v>12</v></c><c r="F3"><v>99.0</v></c><c r="G3" t="s"><v>13</v></c><c r="H3" t="s"><v>15</v></c><c r="I3" t="str"><v>wx_order_refund</v></c></row></sheetData></worksheet>`;

  return new Uint8Array(
    createMinimalZip([
      { name: 'xl/sharedStrings.xml', data: enc.encode(sharedStrings) },
      { name: 'xl/styles.xml', data: enc.encode(styles) },
      { name: 'xl/workbook.xml', data: enc.encode(workbook) },
      { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(rels) },
      { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet1) },
    ])
  );
}

export const ALIPAY_HEADERS = [
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
];

export function makeAlipayRow(fields: {
  time: string;
  category?: string;
  counterparty?: string;
  product: string;
  direction: string;
  amount: string;
  method?: string;
  status?: string;
  orderId: string;
  remark?: string;
}): string[] {
  return [
    fields.time,
    fields.category ?? '投资理财',
    fields.counterparty ?? '基金',
    '/',
    fields.product,
    fields.direction,
    fields.amount,
    fields.method ?? '余额宝',
    fields.status ?? '交易成功',
    fields.orderId,
    '/',
    fields.remark ?? '',
  ];
}
