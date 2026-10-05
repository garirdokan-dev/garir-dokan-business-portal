/**
 * Minimal, dependency-free CSV reader for the Raita offer list.
 *
 * The costing tool reads the offer list through ExcelJS worksheets. A CSV file is
 * turned into an in-memory ExcelJS worksheet with the same rows and cells, so the
 * existing reader (header search, column mapping, row parsing) runs unchanged.
 */

/** True when the file should be read as CSV rather than as an .xlsx workbook. */
export function isCsvFile(name: string, type?: string): boolean {
  return /\.csv$/i.test(name) || /(^|\/)(csv|comma-separated-values)$/i.test(type || '');
}

/** Decode CSV bytes: UTF-8 (BOM stripped); falls back to Windows-1252 for Excel "ANSI" exports. */
export function decodeCsvBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\uFFFD')) {
    try { text = new TextDecoder('windows-1252').decode(bytes); } catch { /* keep UTF-8 */ }
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Pick the delimiter (comma, semicolon or tab) that appears most outside quotes in the first lines. */
function detectDelimiter(text: string): string {
  const sample = text.split(/\r\n|\n|\r/).slice(0, 12).join('\n');
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of sample) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

/** RFC 4180 parser: quoted fields, doubled quotes, and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // drop trailing blank lines
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  return rows;
}

/** Plain numbers become numbers (as they would be in the workbook); blanks become empty cells. */
function toCellValue(raw: string): string | number | null {
  const t = raw.trim();
  if (t === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

/** Add a worksheet holding the CSV rows to an ExcelJS workbook and return it. */
export function csvIntoWorkbook(workbook: any, text: string, sheetName = 'Sheet1'): any {
  const ws = workbook.addWorksheet(sheetName);
  for (const r of parseCsv(text)) ws.addRow(r.map(toCellValue));
  return ws;
}
