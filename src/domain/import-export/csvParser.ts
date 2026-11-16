/**
 * CSV 解析与生成工具（支持 RFC 4180、双引号转义、中文与 UTF-8 BOM）
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
}

/**
 * 解析 CSV 文本为二维数组结构
 */
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

  const headers = rows[headerRowIndex].map((h) => h.replace(/^"|"$/g, '').trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  return { headers, rows: dataRows };
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
