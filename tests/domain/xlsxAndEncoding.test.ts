import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  decodeTextBuffer,
  extractTableFromRows,
  parseTabularFile,
} from '../../src/domain/import-export/csvParser';
import { formatExcelSerialDateTime, parseXlsx } from '../../src/domain/import-export/xlsxParser';

function createMinimalZip(entries: { name: string; data: Uint8Array; compress?: boolean }[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const payload = entry.compress ? new Uint8Array(zlib.deflateRawSync(entry.data)) : entry.data;
    const method = entry.compress ? 8 : 0;

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

  const totalSize = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out.buffer;
}

function buildTestWeChatXlsxBuffer(): ArrayBuffer {
  const enc = new TextEncoder();
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="12" uniqueCount="12">
  <si><t>微信支付账单明细</t></si>
  <si><t>交易时间</t></si>
  <si><t>交易类型</t></si>
  <si><t>交易对方</t></si>
  <si><t>商品</t></si>
  <si><t>收/支</t></si>
  <si><t>金额(元)</t></si>
  <si><t>支付方式</t></si>
  <si><t>当前状态</t></si>
  <si><t>商户消费</t></si>
  <si><t>美团</t></si>
  <si><t>零钱</t></si>
</sst>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/>
  </numFmts>
  <cellXfs count="2">
    <xf numFmtId="0" xfId="0"/>
    <xf numFmtId="164" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="0"/>
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2">
      <c r="A2" t="s"><v>1</v></c>
      <c r="B2" t="s"><v>2</v></c>
      <c r="C2" t="s"><v>3</v></c>
      <c r="D2" t="s"><v>4</v></c>
      <c r="E2" t="s"><v>5</v></c>
      <c r="F2" t="s"><v>6</v></c>
      <c r="G2" t="s"><v>7</v></c>
      <c r="H2" t="s"><v>8</v></c>
    </row>
    <row r="3">
      <c r="A3" s="1"><v>46335.85625</v></c>
      <c r="B3" t="s"><v>9</v></c>
      <c r="C3" t="s"><v>10</v></c>
      <c r="D3" t="inlineStr"><is><t>外卖订单</t></is></c>
      <c r="E3" t="str"><v>支出</v></c>
      <c r="F3"><v>32.96</v></c>
      <c r="G3" t="s"><v>11</v></c>
      <c r="H3" t="str"><v>支付成功</v></c>
    </row>
  </sheetData>
</worksheet>`;

  return createMinimalZip([
    { name: 'xl/sharedStrings.xml', data: enc.encode(sharedStrings), compress: true },
    { name: 'xl/styles.xml', data: enc.encode(styles), compress: true },
    { name: 'xl/workbook.xml', data: enc.encode(workbook), compress: true },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(rels), compress: true },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet1), compress: true },
  ]);
}

describe('Text Encoding & XLSX Parser', () => {
  it('decodes UTF-8 with BOM and falls back to GB18030 for GBK bytes', () => {
    const utf8WithBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('交易时间,金额')]);
    expect(decodeTextBuffer(utf8WithBom.buffer)).toBe('交易时间,金额');

    // GBK bytes for "交易时间,金额"
    const gbkBytes = new Uint8Array([
      0xbd, 0xbb, 0xd2, 0xd7, 0xca, 0xb1, 0xbc, 0xe4, 0x2c, 0xbd, 0xf0, 0xb6, 0xee,
    ]);
    expect(decodeTextBuffer(gbkBytes.buffer)).toBe('交易时间,金额');
  });

  it('drops trailing empty header column from Alipay-style CSV rows', () => {
    const res = extractTableFromRows([
      ['支付宝电子客户回单'],
      ['交易时间', '交易分类', '金额', ''],
      ['2026-11-11 15:19:35', '餐饮美食', '22.18', ''],
    ]);
    expect(res.headers).toEqual(['交易时间', '交易分类', '金额']);
    expect(res.rows[0]).toEqual(['2026-11-11 15:19:35', '餐饮美食', '22.18']);
    expect(res.metadataLines).toEqual(['支付宝电子客户回单']);
  });

  it('converts Excel serial timestamps accurately for 1900 and 1904 epochs', () => {
    expect(formatExcelSerialDateTime(46335.85625)).toBe('2026-11-09 20:33:00');
    expect(formatExcelSerialDateTime(46332.831041666665)).toBe('2026-11-06 19:56:42');
    expect(formatExcelSerialDateTime(1, true)).toBe('1904-01-02 00:00:00');
  });

  it('parses compressed XLSX files including shared strings, inline strings, and serial dates', async () => {
    const xlsxBuf = buildTestWeChatXlsxBuffer();
    const res = await parseXlsx(xlsxBuf);
    expect(res.metadataLines).toEqual(['微信支付账单明细']);
    expect(res.headers).toEqual([
      '交易时间',
      '交易类型',
      '交易对方',
      '商品',
      '收/支',
      '金额(元)',
      '支付方式',
      '当前状态',
    ]);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]).toEqual([
      '2026-11-09 20:33:00',
      '商户消费',
      '美团',
      '外卖订单',
      '支出',
      '32.96',
      '零钱',
      '支付成功',
    ]);
  });

  it('routes parseTabularFile for xlsx and rejects legacy xls files', async () => {
    const xlsxBuf = buildTestWeChatXlsxBuffer();
    const xlsxFile = new File([xlsxBuf], 'wechat.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const parsedXlsx = await parseTabularFile(xlsxFile);
    expect(parsedXlsx.rows[0][0]).toBe('2026-11-09 20:33:00');

    const oleHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const xlsFile = new File([oleHeader], 'legacy.xls', { type: 'application/vnd.ms-excel' });
    await expect(parseTabularFile(xlsFile)).rejects.toThrow(
      '暂不支持旧版 .xls 格式，请导出 .xlsx 或 .csv 文件'
    );
  });

  const sampleDir = 'D:/bill/originalData';
  it.runIf(fs.existsSync(sampleDir))(
    'parses real WeChat XLSX and Alipay GB18030 CSV sample files without errors',
    async () => {
      const wxPath = `${sampleDir}/微信支付账单流水文件(20260705-20261111)_20261111202402.xlsx`;
      const wxBuf = fs.readFileSync(wxPath);
      const wxFile = new File([wxBuf], 'wx.xlsx');
      const wxParsed = await parseTabularFile(wxFile);
      expect(wxParsed.headers).toContain('交易时间');
      expect(wxParsed.rows.length).toBe(168);
      expect(wxParsed.rows[0][0]).toBe('2026-11-09 20:33:00');

      const alipayPath = `${sampleDir}/支付宝交易明细(20260705-20261111).csv`;
      const alipayBuf = fs.readFileSync(alipayPath);
      const alipayFile = new File([alipayBuf], 'alipay.csv');
      const alipayParsed = await parseTabularFile(alipayFile);
      expect(alipayParsed.headers).toContain('交易分类');
      expect(alipayParsed.headers).not.toContain('');
      expect(alipayParsed.rows.length).toBe(406);
      expect(alipayParsed.rows[0][1]).toBe('餐饮美食');
      expect(alipayParsed.rows.some((r) => r.join('').includes('\uFFFD'))).toBe(false);
    }
  );
});
