import { parseXlsx } from './xlsxParser';

export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
  metadataLines?: string[];
}

export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasUtf8Bom =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const target = hasUtf8Bom ? bytes.subarray(3) : bytes;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(target);
  } catch {
    return new TextDecoder('gb18030').decode(target);
  }
}

export function extractTableFromRows(rows: string[][]): ParsedCsvResult {
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const candidate = rows[r];
    if (candidate.length >= 3) {
      const lineStr = candidate.join(' ');
      const hasTime = /时间|日期|date|time/i.test(lineStr);
      const hasMoneyOrType = /金额|数额|类型|收支|分类|类别|账户|商品|对方|amount|type/i.test(lineStr);
      if (hasTime && hasMoneyOrType) {
        headerRowIndex = r;
        break;
      }
    }
  }

  const metadataLines =
    headerRowIndex > 0
      ? rows
          .slice(0, headerRowIndex)
          .map((r) => r.map((c) => c.trim()).filter(Boolean).join(' '))
          .filter(Boolean)
      : undefined;

  const headers = rows[headerRowIndex].map((h) => h.replace(/^"|"$/g, '').trim());
  while (headers.length > 0 && headers[headers.length - 1] === '') {
    headers.pop();
  }

  const dataRows = rows
    .slice(headerRowIndex + 1)
    .map((r) => r.slice(0, headers.length))
    .filter((r) => r.some((cell) => cell.trim().length > 0));

  return {
    headers,
    rows: dataRows,
    metadataLines: metadataLines && metadataLines.length > 0 ? metadataLines : undefined,
  };
}

export function parseCsv(text: string): ParsedCsvResult {
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuote = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i += 2;
        continue;
      } else {
        insideQuote = !insideQuote;
        i++;
        continue;
      }
    }

    if (!insideQuote && char === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
      i++;
      continue;
    }

    if (!insideQuote && (char === '\r' || char === '\n')) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentCell += char;
    i++;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return extractTableFromRows(rows);
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Response(file).arrayBuffer();
}

export async function parseTabularFile(file: File): Promise<ParsedCsvResult> {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  const isOle2 =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;

  const lowerName = file.name.toLowerCase();
  if (isOle2 || (lowerName.endsWith('.xls') && !isZip)) {
    throw new Error('暂不支持旧版 .xls 格式，请导出 .xlsx 或 .csv 文件');
  }

  if (isZip || lowerName.endsWith('.xlsx')) {
    return parseXlsx(buffer);
  }

  return parseCsv(decodeTextBuffer(buffer));
}

/**
 * 将表头和数据行转换为标准 CSV 字符串（带 UTF-8 BOM，防止 Excel 乱码）
 */
export function generateCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const escapeCell = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(','));

  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}
