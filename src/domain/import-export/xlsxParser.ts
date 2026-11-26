import { extractTableFromRows, type ParsedCsvResult } from './csvParser';

interface ZipEntryMeta {
  fileName: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const BUILTIN_DATE_FMT_IDS = new Set<number>([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47, 55, 56, 57, 58,
]);

const EXCEL_EPOCH_1900_MS = Date.UTC(1899, 11, 30);
const EXCEL_EPOCH_1904_MS = Date.UTC(1904, 0, 1);

function isDateFormatCode(formatCode: string): boolean {
  const cleaned = formatCode
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '');
  return /(?:y{2,4}|m{1,5}|d{1,4}|h{1,2}|s{1,2})/i.test(cleaned);
}

// Excel serial numbers represent wall-clock date/time; reading UTC fields from the UTC epoch avoids host timezone drift.
export function formatExcelSerialDateTime(serial: number, use1904Epoch = false): string {
  const epochMs = use1904Epoch ? EXCEL_EPOCH_1904_MS : EXCEL_EPOCH_1900_MS;
  const totalSeconds = Math.round(serial * 86400);
  const dt = new Date(epochMs + totalSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = dt.getUTCFullYear();
  const m = pad(dt.getUTCMonth() + 1);
  const d = pad(dt.getUTCDate());
  const hh = pad(dt.getUTCHours());
  const mm = pad(dt.getUTCMinutes());
  const ss = pad(dt.getUTCSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function findEocdOffset(bytes: Uint8Array, view: DataView): number {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

function parseZipDirectory(buffer: ArrayBuffer): Map<string, ZipEntryMeta> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEocdOffset(bytes, view);
  if (eocdOffset < 0) {
    throw new Error('无效的 XLSX 文件结构');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, ZipEntryMeta>();

  let offset = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    entries.set(fileName, {
      fileName,
      method,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

async function inflateDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器环境不支持解压 XLSX 文件');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(new Uint8Array(data)).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  await writePromise;
  const output = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.length;
  }
  return output;
}

async function readZipEntryText(
  buffer: ArrayBuffer,
  entry: ZipEntryMeta | undefined
): Promise<string | null> {
  if (!entry) return null;
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const lfOffset = entry.localHeaderOffset;

  if (lfOffset + 30 > bytes.length || view.getUint32(lfOffset, true) !== 0x04034b50) {
    throw new Error('XLSX 文件数据损坏');
  }

  const nameLen = view.getUint16(lfOffset + 26, true);
  const extraLen = view.getUint16(lfOffset + 28, true);
  const dataStart = lfOffset + 30 + nameLen + extraLen;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  let raw: Uint8Array;
  if (entry.method === 0) {
    raw = compressed;
  } else if (entry.method === 8) {
    raw = await inflateDeflateRaw(compressed);
  } else {
    throw new Error(`不支持的 XLSX 压缩方式: ${entry.method}`);
  }

  return new TextDecoder('utf-8').decode(raw);
}

function parseXmlDoc(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = parseXmlDoc(xml);
  const siList = doc.getElementsByTagNameNS('*', 'si');
  const result: string[] = [];
  for (let i = 0; i < siList.length; i++) {
    const tList = siList[i].getElementsByTagNameNS('*', 't');
    let text = '';
    for (let j = 0; j < tList.length; j++) {
      text += tList[j].textContent ?? '';
    }
    result.push(text);
  }
  return result;
}

function parseDateStyleIndices(xml: string | null): Set<number> {
  const dateStyles = new Set<number>();
  if (!xml) return dateStyles;

  const doc = parseXmlDoc(xml);
  const customFormats = new Map<number, string>();
  const numFmtNodes = doc.getElementsByTagNameNS('*', 'numFmt');
  for (let i = 0; i < numFmtNodes.length; i++) {
    const idAttr = numFmtNodes[i].getAttribute('numFmtId');
    const codeAttr = numFmtNodes[i].getAttribute('formatCode');
    if (idAttr && codeAttr) {
      customFormats.set(Number(idAttr), codeAttr);
    }
  }

  const cellXfsList = doc.getElementsByTagNameNS('*', 'cellXfs');
  if (cellXfsList.length === 0) return dateStyles;

  const xfNodes = cellXfsList[0].getElementsByTagNameNS('*', 'xf');
  for (let i = 0; i < xfNodes.length; i++) {
    const numFmtId = Number(xfNodes[i].getAttribute('numFmtId') ?? '0');
    const customCode = customFormats.get(numFmtId);
    if (BUILTIN_DATE_FMT_IDS.has(numFmtId) || (customCode && isDateFormatCode(customCode))) {
      dateStyles.add(i);
    }
  }

  return dateStyles;
}

function resolveFirstSheetPath(
  entries: Map<string, ZipEntryMeta>,
  workbookXml: string | null,
  relsXml: string | null
): { sheetPath: string; use1904Epoch: boolean } {
  let use1904Epoch = false;
  let firstRelId = '';

  if (workbookXml) {
    const wbDoc = parseXmlDoc(workbookXml);
    const wbPr = wbDoc.getElementsByTagNameNS('*', 'workbookPr')[0];
    const date1904 = wbPr?.getAttribute('date1904');
    use1904Epoch = date1904 === '1' || date1904 === 'true';

    const firstSheet = wbDoc.getElementsByTagNameNS('*', 'sheet')[0];
    if (firstSheet) {
      firstRelId =
        firstSheet.getAttribute('r:id') ??
        firstSheet.getAttributeNS(
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'id'
        ) ??
        '';
    }
  }

  if (firstRelId && relsXml) {
    const relsDoc = parseXmlDoc(relsXml);
    const rels = relsDoc.getElementsByTagNameNS('*', 'Relationship');
    for (let i = 0; i < rels.length; i++) {
      if (rels[i].getAttribute('Id') === firstRelId) {
        const target = (rels[i].getAttribute('Target') ?? '').replace(/^\/+/, '');
        const normalized = target.startsWith('xl/') ? target : `xl/${target}`;
        if (entries.has(normalized)) {
          return { sheetPath: normalized, use1904Epoch };
        }
      }
    }
  }

  const fallback = Array.from(entries.keys())
    .filter((name) => name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml'))
    .sort()[0];

  if (!fallback) {
    throw new Error('XLSX 文件中未找到工作表');
  }

  return { sheetPath: fallback, use1904Epoch };
}

function colRefToIndex(ref: string): number {
  let colIdx = 0;
  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      colIdx = colIdx * 26 + (code - 64);
    } else if (code >= 97 && code <= 122) {
      colIdx = colIdx * 26 + (code - 96);
    } else {
      break;
    }
  }
  return colIdx - 1;
}

function parseWorksheetRows(
  sheetXml: string,
  sharedStrings: string[],
  dateStyleIndices: Set<number>,
  use1904Epoch: boolean
): string[][] {
  const doc = parseXmlDoc(sheetXml);
  const rowNodes = doc.getElementsByTagNameNS('*', 'row');
  const rows: string[][] = [];

  for (let r = 0; r < rowNodes.length; r++) {
    const cellNodes = rowNodes[r].getElementsByTagNameNS('*', 'c');
    const cells = new Map<number, string>();
    let maxCol = -1;
    let fallbackCol = 0;

    for (let c = 0; c < cellNodes.length; c++) {
      const cell = cellNodes[c];
      const ref = cell.getAttribute('r');
      const colIdx = ref ? colRefToIndex(ref) : fallbackCol;
      fallbackCol = colIdx + 1;
      if (colIdx > maxCol) maxCol = colIdx;

      const cellType = cell.getAttribute('t') ?? '';
      const styleAttr = cell.getAttribute('s');
      const vNode = cell.getElementsByTagNameNS('*', 'v')[0];
      const vText = vNode?.textContent ?? '';

      let value = '';
      if (cellType === 's') {
        const idx = Number(vText);
        value = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
      } else if (cellType === 'inlineStr') {
        const isNode = cell.getElementsByTagNameNS('*', 'is')[0];
        if (isNode) {
          const tNodes = isNode.getElementsByTagNameNS('*', 't');
          for (let j = 0; j < tNodes.length; j++) {
            value += tNodes[j].textContent ?? '';
          }
        }
      } else if (cellType === 'str' || cellType === 'e') {
        value = vText;
      } else if (cellType === 'b') {
        value = vText === '1' ? 'TRUE' : 'FALSE';
      } else if (vText !== '') {
        const styleIdx = styleAttr !== null ? Number(styleAttr) : -1;
        const numVal = Number(vText);
        if (!Number.isNaN(numVal) && dateStyleIndices.has(styleIdx)) {
          value = formatExcelSerialDateTime(numVal, use1904Epoch);
        } else {
          value = vText;
        }
      }

      cells.set(colIdx, value.trim());
    }

    if (maxCol >= 0) {
      const rowArray: string[] = [];
      for (let i = 0; i <= maxCol; i++) {
        rowArray.push(cells.get(i) ?? '');
      }
      if (rowArray.some((cell) => cell.length > 0)) {
        rows.push(rowArray);
      }
    }
  }

  return rows;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedCsvResult> {
  const entries = parseZipDirectory(buffer);
  const [sharedStringsXml, stylesXml, workbookXml, relsXml] = await Promise.all([
    readZipEntryText(buffer, entries.get('xl/sharedStrings.xml')),
    readZipEntryText(buffer, entries.get('xl/styles.xml')),
    readZipEntryText(buffer, entries.get('xl/workbook.xml')),
    readZipEntryText(buffer, entries.get('xl/_rels/workbook.xml.rels')),
  ]);

  const { sheetPath, use1904Epoch } = resolveFirstSheetPath(entries, workbookXml, relsXml);
  const sheetXml = await readZipEntryText(buffer, entries.get(sheetPath));
  if (!sheetXml) {
    throw new Error('无法读取 XLSX 工作表内容');
  }

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const dateStyleIndices = parseDateStyleIndices(stylesXml);
  const rows = parseWorksheetRows(sheetXml, sharedStrings, dateStyleIndices, use1904Epoch);
  const result = extractTableFromRows(rows);

  const dateColIdx = result.headers.findIndex((h) => /^(?:交易时间|日期|时间)$/.test(h));
  if (dateColIdx >= 0) {
    for (const row of result.rows) {
      const cell = row[dateColIdx];
      if (cell && /^\d+(?:\.\d+)?$/.test(cell)) {
        const serial = Number(cell);
        if (serial > 20000 && serial < 80000) {
          row[dateColIdx] = formatExcelSerialDateTime(serial, use1904Epoch);
        }
      }
    }
  }

  return result;
}
