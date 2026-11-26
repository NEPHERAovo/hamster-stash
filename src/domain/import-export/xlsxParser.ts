import { extractTableFromRows, type ParsedCsvResult } from './csvParser';

interface ZipEntryMeta {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47, 55, 56, 57, 58]);
const EXCEL_EPOCH_1900_MS = Date.UTC(1899, 11, 30);
const EXCEL_EPOCH_1904_MS = Date.UTC(1904, 0, 1);

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatExcelSerialDateTime(serial: number, use1904Epoch = false): string {
  const dt = new Date((use1904Epoch ? EXCEL_EPOCH_1904_MS : EXCEL_EPOCH_1900_MS) + Math.round(serial * 86400) * 1000);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:${pad2(dt.getUTCSeconds())}`;
}

const xmlNodes = (parent: Document | Element, tag: string): Element[] =>
  Array.from(parent.getElementsByTagNameNS('*', tag));

const collectXmlText = (node: Element): string =>
  xmlNodes(node, 't').map((n) => n.textContent ?? '').join('');

const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

function parseZipDirectory(buffer: ArrayBuffer): Map<string, ZipEntryMeta> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('无效的 XLSX 文件结构');

  const entries = new Map<string, ZipEntryMeta>();
  const total = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');

  for (let i = 0; i < total && offset + 46 <= bytes.length && view.getUint32(offset, true) === 0x02014b50; i++) {
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    entries.set(utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLen)), {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipEntryText(buffer: ArrayBuffer, entry?: ZipEntryMeta): Promise<string | null> {
  if (!entry) return null;
  const view = new DataView(buffer);
  const lf = entry.localHeaderOffset;
  if (lf + 30 > buffer.byteLength || view.getUint32(lf, true) !== 0x04034b50) {
    throw new Error('XLSX 文件数据损坏');
  }
  const start = lf + 30 + view.getUint16(lf + 26, true) + view.getUint16(lf + 28, true);
  const compressed = new Uint8Array(buffer, start, entry.compressedSize);

  let raw: Uint8Array;
  if (entry.method === 0) {
    raw = compressed;
  } else if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器环境不支持解压 XLSX 文件');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const writePromise = writer.write(new Uint8Array(compressed)).then(() => writer.close());
    raw = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    await writePromise;
  } else {
    throw new Error(`不支持的 XLSX 压缩方式: ${entry.method}`);
  }
  return new TextDecoder('utf-8').decode(raw);
}

function parseDateStyleIndices(xml: string | null): Set<number> {
  const dateStyles = new Set<number>();
  if (!xml) return dateStyles;
  const doc = parseXml(xml);
  const customFmts = new Map<number, string>();
  for (const node of xmlNodes(doc, 'numFmt')) {
    const id = node.getAttribute('numFmtId');
    const code = node.getAttribute('formatCode');
    if (id && code) customFmts.set(Number(id), code);
  }
  const cellXfs = xmlNodes(doc, 'cellXfs')[0];
  if (!cellXfs) return dateStyles;
  xmlNodes(cellXfs, 'xf').forEach((xf, idx) => {
    const numFmtId = Number(xf.getAttribute('numFmtId') ?? '0');
    const code = customFmts.get(numFmtId);
    const cleanedCode = code?.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    if (BUILTIN_DATE_FMTS.has(numFmtId) || (cleanedCode && /(?:y{2,4}|m{1,5}|d{1,4}|h{1,2}|s{1,2})/i.test(cleanedCode))) {
      dateStyles.add(idx);
    }
  });
  return dateStyles;
}

function colRefToIndex(ref: string): number {
  let idx = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) idx = idx * 26 + (c - 64);
    else if (c >= 97 && c <= 122) idx = idx * 26 + (c - 96);
    else break;
  }
  return idx - 1;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedCsvResult> {
  const entries = parseZipDirectory(buffer);
  const [sharedStringsXml, stylesXml, workbookXml, relsXml] = await Promise.all([
    readZipEntryText(buffer, entries.get('xl/sharedStrings.xml')),
    readZipEntryText(buffer, entries.get('xl/styles.xml')),
    readZipEntryText(buffer, entries.get('xl/workbook.xml')),
    readZipEntryText(buffer, entries.get('xl/_rels/workbook.xml.rels')),
  ]);

  let use1904Epoch = false;
  let firstRelId = '';
  if (workbookXml) {
    const wbDoc = parseXml(workbookXml);
    const date1904 = xmlNodes(wbDoc, 'workbookPr')[0]?.getAttribute('date1904');
    use1904Epoch = date1904 === '1' || date1904 === 'true';
    const sheet = xmlNodes(wbDoc, 'sheet')[0];
    firstRelId =
      sheet?.getAttribute('r:id') ??
      sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      '';
  }

  let sheetPath = '';
  if (firstRelId && relsXml) {
    const rel = xmlNodes(parseXml(relsXml), 'Relationship').find((r) => r.getAttribute('Id') === firstRelId);
    const target = (rel?.getAttribute('Target') ?? '').replace(/^\/+/, '');
    const normalized = target.startsWith('xl/') ? target : `xl/${target}`;
    if (entries.has(normalized)) sheetPath = normalized;
  }
  if (!sheetPath) {
    sheetPath = Array.from(entries.keys())
      .filter((n) => n.startsWith('xl/worksheets/sheet') && n.endsWith('.xml'))
      .sort()[0] ?? '';
  }
  const sheetXml = sheetPath ? await readZipEntryText(buffer, entries.get(sheetPath)) : null;
  if (!sheetXml) throw new Error('无法读取 XLSX 工作表内容');

  const sharedStrings = sharedStringsXml ? xmlNodes(parseXml(sharedStringsXml), 'si').map(collectXmlText) : [];
  const dateStyles = parseDateStyleIndices(stylesXml);
  const rows: string[][] = [];

  for (const rowNode of xmlNodes(parseXml(sheetXml), 'row')) {
    const cells = new Map<number, string>();
    let maxCol = -1;
    let fallbackCol = 0;

    for (const cell of xmlNodes(rowNode, 'c')) {
      const ref = cell.getAttribute('r');
      const colIdx = ref ? colRefToIndex(ref) : fallbackCol;
      fallbackCol = colIdx + 1;
      if (colIdx > maxCol) maxCol = colIdx;

      const t = cell.getAttribute('t') ?? '';
      const vText = xmlNodes(cell, 'v')[0]?.textContent ?? '';
      let val = '';

      if (t === 's') {
        const idx = Number(vText);
        val = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
      } else if (t === 'inlineStr') {
        const isNode = xmlNodes(cell, 'is')[0];
        val = isNode ? collectXmlText(isNode) : '';
      } else if (t === 'str' || t === 'e') {
        val = vText;
      } else if (t === 'b') {
        val = vText === '1' ? 'TRUE' : 'FALSE';
      } else if (vText !== '') {
        const styleIdx = Number(cell.getAttribute('s') ?? '-1');
        const numVal = Number(vText);
        val = !Number.isNaN(numVal) && dateStyles.has(styleIdx)
          ? formatExcelSerialDateTime(numVal, use1904Epoch)
          : vText;
      }
      cells.set(colIdx, val.trim());
    }

    if (maxCol >= 0) {
      const rowArr = Array.from({ length: maxCol + 1 }, (_, i) => cells.get(i) ?? '');
      if (rowArr.some((c) => c.length > 0)) rows.push(rowArr);
    }
  }

  const result = extractTableFromRows(rows);
  const dateColIdx = result.headers.findIndex((h) => /^(?:交易时间|日期|时间)$/.test(h));
  if (dateColIdx >= 0) {
    for (const row of result.rows) {
      const cell = row[dateColIdx];
      if (cell && /^\d+(?:\.\d+)?$/.test(cell)) {
        const serial = Number(cell);
        if (serial > 20000 && serial < 80000) row[dateColIdx] = formatExcelSerialDateTime(serial, use1904Epoch);
      }
    }
  }
  return result;
}
