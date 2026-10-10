import type { CellStyle, ParseDescriptionResult } from '../types';

export const COLORS = {
  TEAL_SEPARATOR: 'FF31859B', // Separator row fill
  RED_LABEL: 'FFE2062B',      // Label row fill (distinct red)
  RED_HIGHLIGHT: 'FFFF0000',  // Highlight red for stock-out car name & broken formulas
  WHITE_TEXT: 'FFFFFFFF',     // White font
  GREEN_CHASSIS: 'FFB6D7A8',  // Chassis confirmed
  BLUE_CHASSIS: 'FFCFE2F3',   // Chassis pending
  CHARCOAL_TEXT: 'FF262626',
  HEADER_TEXT: 'FFFFFFFF',
};

/**
 * Returns the ExcelJS library instance (from window if loaded via CDN, or via npm).
 */
export async function getExcelJS() {
  // Always use the ExcelJS bundled with this app. In the combined Operations Desk the
  // "Japan to BD Convert" tool loads a separate CDN copy onto window.ExcelJS; ignoring it
  // keeps the stock tools on exactly the same library they used when they ran standalone.
  const excelModule = await import('exceljs');
  return excelModule.default || excelModule;
}

/**
 * Convert 1-based column number to Excel column letter (e.g. 1 -> A, 24 -> X)
 */
export function colNumberToLetter(colNum: number): string {
  let temp = colNum;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Convert Excel column letter to 1-based column number (e.g. A -> 1, X -> 24)
 */
export function colLetterToNumber(letter: string): number {
  let col = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col;
}

/**
 * Section 4.3: Description-parsing algorithm
 * Splits one combined DESCRIPTION cell into GRADE / Color / Milage / Point / remaining-DESCRIPTION
 */
export function parseDescription(raw: any): ParseDescriptionResult {
  const emptyResult: ParseDescriptionResult = {
    grade: '',
    color: '',
    milage: '',
    point: '',
    remainingDescription: '',
  };

  if (!raw || typeof raw !== 'string') {
    return emptyResult;
  }

  // 1. Split raw on commas. Trim whitespace/newlines. Drop empty pieces.
  const pieces = raw
    .split(',')
    .map((p) => p.replace(/[\r\n]+/g, ' ').trim())
    .filter((p) => p.length > 0);

  if (pieces.length === 0) {
    return emptyResult;
  }

  let idx = 0;

  // 2. First piece -> Color. If very next piece is exactly TWO TONE or TWO-TONE, append it.
  let color = pieces[idx++];
  if (idx < pieces.length) {
    const nextClean = pieces[idx].toUpperCase().replace(/\s+/g, ' ').trim();
    if (nextClean === 'TWO TONE' || nextClean === 'TWO-TONE') {
      color = `${color}, ${pieces[idx]}`;
      idx++;
    }
  }

  // 3. Next piece -> Grade (if available)
  let grade = '';
  if (idx < pieces.length) {
    grade = pieces[idx++];
  }

  // Remaining pieces
  const remaining = pieces.slice(idx);

  let milage = '';
  let point = '';
  let remainingDescription = '';

  if (remaining.length === 1) {
    // 5. If exactly one piece remains after Color+Grade:
    // it's Milage if it contains "KM", otherwise Point (Milage stays blank)
    const piece = remaining[0];
    if (piece.toUpperCase().includes('KM')) {
      milage = piece;
    } else {
      point = piece;
    }
  } else if (remaining.length >= 2) {
    // 4. last piece -> Point, second-to-last -> Milage, everything else in between -> remaining DESCRIPTION
    point = remaining[remaining.length - 1];
    milage = remaining[remaining.length - 2];
    if (remaining.length > 2) {
      remainingDescription = remaining.slice(0, remaining.length - 2).join(', ');
    }
  }

  return {
    grade,
    color,
    milage,
    point,
    remainingDescription,
  };
}

/**
 * Deep-clones cell styling plain-object fields to prevent reference leakage across cells.
 */
export function cloneCellStyle(cell: any): CellStyle {
  if (!cell) return {};
  const style: CellStyle = {};

  if (cell.font) {
    try {
      style.font = JSON.parse(JSON.stringify(cell.font));
    } catch {
      style.font = { ...cell.font };
    }
  }

  if (cell.fill) {
    try {
      style.fill = JSON.parse(JSON.stringify(cell.fill));
    } catch {
      style.fill = { ...cell.fill };
    }
  }

  if (cell.border) {
    try {
      style.border = JSON.parse(JSON.stringify(cell.border));
    } catch {
      style.border = { ...cell.border };
    }
  }

  if (cell.alignment) {
    try {
      style.alignment = JSON.parse(JSON.stringify(cell.alignment));
    } catch {
      style.alignment = { ...cell.alignment };
    }
  }

  if (cell.numFmt) {
    style.numFmt = cell.numFmt;
  }

  return style;
}

/**
 * Applies cloned style onto an ExcelJS cell.
 */
export function applyCellStyle(cell: any, style: CellStyle) {
  if (!cell) return;
  const s = style || {};
  // IMPORTANT: assign ONE fresh composite style object per cell (cell.style = {...}).
  // Setting cell.font/fill/border individually lets ExcelJS de-duplicate them into shared
  // style indices; a later merge or fill on any sibling then corrupts unrelated rows.
  const composed: any = {
    font: s.font ? JSON.parse(JSON.stringify(s.font)) : { name: 'Oswald', size: 11 },
    fill: s.fill ? JSON.parse(JSON.stringify(s.fill)) : { type: 'pattern', pattern: 'none' },
    border: s.border ? JSON.parse(JSON.stringify(s.border)) : {},
    alignment: s.alignment ? JSON.parse(JSON.stringify(s.alignment)) : {},
    numFmt: s.numFmt || 'General',
  };
  cell.style = composed;
}

/**
 * Safely extracts value, formula, and hyperlink from an ExcelJS cell.
 */
export function extractCellValue(cell: any): {
  value: any;
  formula?: string;
  hyperlink?: string;
  hyperlinkText?: string;
} {
  if (!cell) {
    return { value: null };
  }

  const raw = cell.value;
  let formula: string | undefined = undefined;
  let hyperlink: string | undefined = undefined;
  let hyperlinkText: string | undefined = undefined;
  let resolvedValue: any = raw;

  // Sometimes exceljs provides .formula string getter directly for shared clones
  if (cell.formula) {
    formula = cell.formula;
  }

  if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
    if ('formula' in raw || 'sharedFormula' in raw) {
      if (!formula && raw.formula) {
        formula = raw.formula;
      }
      resolvedValue = raw.result !== undefined ? raw.result : null;
      // Handle error objects
      if (resolvedValue && typeof resolvedValue === 'object' && 'error' in resolvedValue) {
        resolvedValue = resolvedValue.error;
      }
    } else if ('hyperlink' in raw) {
      hyperlink = raw.hyperlink;
      hyperlinkText = raw.text || 'PHOTO';
      resolvedValue = hyperlinkText;
    } else if ('richText' in raw) {
      resolvedValue = raw.richText.map((rt: any) => rt.text).join('');
    } else if ('text' in raw) {
      resolvedValue = raw.text;
    } else if ('error' in raw) {
      resolvedValue = raw.error;
    } else {
      // Fallback: prevent any unhandled ExcelJS object (like sharedFormula) from being passed through
      resolvedValue = '';
    }
  }

  return {
    value: resolvedValue,
    formula,
    hyperlink,
    hyperlinkText,
  };
}

/**
 * Section 4.5: Retarget formula references to new row number.
 * Finds any <ColumnLetter><oldRowNumber> and replaces with <ColumnLetter><newRowNumber>.
 */
export function retargetFormula(formula: string, oldRow: number, newRow: number): string {
  if (!formula || oldRow === newRow) return formula;
  // Match column letters followed by old row number, delimited by non-alphanumeric or edges
  // e.g. SUM(Q12:S12) -> SUM(Q15:S15)
  // e.g. P12*127 -> P15*127
  const pattern = new RegExp(`(?<=[^A-Z0-9]|^)([A-Z]+)${oldRow}(?=[^0-9]|$)`, 'g');
  return formula.replace(pattern, `$1${newRow}`);
}

/**
 * Formats a date into DD-Mon-YYYY format (e.g. 06-Sep-2026).
 */
export function formatDateForTag(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) {
    const today = new Date();
    return formatValidDate(today);
  }
  return formatValidDate(d);
}

function formatValidDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats a Date object into YYYY-MM-DD for HTML input[type="date"]
 */
export function formatDateForInput(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Clean string for comparison
 */
export function normalizeKey(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    // If it's a whole number, format without decimals e.g. 12.0 -> "12"
    if (Number.isInteger(val)) return String(val).trim();
    return String(val).trim();
  }
  const str = String(val).trim();
  // If string looks like a whole number ending in .0 (e.g. "15.0"), clean to "15"
  if (/^\d+\.0+$/.test(str)) {
    return str.split('.')[0];
  }
  return str;
}

/* ============================================================
 * v2 additions — numeric coercion + in-browser formula results
 * ============================================================ */

/** Coerce any cell value (number, numeric-string, formula-result, blank) to a number (0 if not numeric). */
export function toNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if ('result' in v) return toNumber((v as any).result);
    if ('value' in v) return toNumber((v as any).value);
    return 0;
  }
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

/** True when two values are numerically equal within a small tolerance. */
export function numericEqual(a: any, b: any, tol = 0.005): boolean {
  const na = Number(a), nb = Number(b);
  if (isNaN(na) || isNaN(nb)) return false;
  return Math.abs(na - nb) < tol;
}

/** Strip a leading '=' from a formula string (ExcelJS stores formulas without it). */
export function stripEquals(f: string): string {
  return f && f.startsWith('=') ? f.slice(1) : f;
}

export interface FindWorksheetOptions {
  preferredNames?: string[];
  kind?: 'customized' | 'source';
  mode?: 'BD' | 'JAPAN' | 'COMBINE';
}

/**
 * Deterministically locates the target or source worksheet within an ExcelJS Workbook.
 * Works even when:
 *  - Sheet names differ in casing, spaces, underscores, or hyphens (e.g. "BD STOCK LIST" vs "BD_STOCK_LIST")
 *  - Workbook sheet IDs were renumbered (ExcelJS getWorksheet(1) searches ws.id === 1, not index 0)
 *  - Sheets have custom names or were exported from third-party tools
 *  - Content-based heuristic scores worksheets by car inventory header keywords
 */
export function findWorksheet(wb: any, options: FindWorksheetOptions = {}): any {
  if (!wb) return null;
  const sheets: any[] = Array.isArray(wb.worksheets) ? wb.worksheets : [];
  if (sheets.length === 0) return null;

  const preferred = options.preferredNames || [];
  const kind = options.kind || 'source';
  const mode = options.mode || 'BD';

  const clean = (s: any) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_\-.]+/g, '');

  // 1. Exact case-sensitive match against preferred names
  for (const name of preferred) {
    const ws = sheets.find((w) => w.name === name);
    if (ws) return ws;
  }

  // 2. Normalized match against preferred names (ignoring casing, spaces, dashes, underscores)
  const cleanPreferred = preferred.map(clean);
  for (const cp of cleanPreferred) {
    if (!cp) continue;
    const ws = sheets.find((w) => clean(w.name) === cp);
    if (ws) return ws;
  }

  // 3. Keyword matching on sheet name
  let nameKeywords: string[] = [];
  if (kind === 'customized') {
    if (mode === 'BD') {
      nameKeywords = ['bdstock', 'bd_stock', 'bd', 'master', 'customized', 'tracker', 'update'];
    } else if (mode === 'JAPAN') {
      nameKeywords = ['japanstock', 'japan_stock', 'japan', 'raita', 'master', 'customized', 'tracker'];
    } else {
      nameKeywords = ['bd', 'japan', 'stock', 'master', 'tracker'];
    }
  } else {
    // source
    if (mode === 'BD') {
      nameKeywords = [
        'bdstocklist',
        'bd_stock_list',
        'stocklist',
        'stock_list',
        'bdstock',
        'stock',
        'carlist',
        'cars',
        'inventory',
        'sheet1',
        'sheet',
      ];
    } else if (mode === 'JAPAN') {
      nameKeywords = [
        'mystocklist',
        'mystock',
        'raitamystocklist',
        'raitastock',
        'raita',
        'stocklist',
        'japanstock',
        'japan',
        'stock',
        'sheet1',
        'sheet',
      ];
    } else {
      nameKeywords = ['stocklist', 'stock', 'list', 'cars', 'sheet1'];
    }
  }

  for (const kw of nameKeywords) {
    const target = clean(kw);
    const ws = sheets.find((w) => clean(w.name).includes(target));
    if (ws) return ws;
  }

  // 4. Content-based scanning across all worksheets (inspect first 20 rows for header signals)
  let bestSheet: any = null;
  let bestScore = -1;

  for (const ws of sheets) {
    const rowCount = ws.actualRowCount || ws.rowCount || 0;
    if (rowCount === 0) continue;

    let score = 0;
    const scanLimit = Math.min(rowCount, 20);

    for (let r = 1; r <= scanLimit; r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell: any) => {
        const val = clean(String(cell.value || ''));
        if (!val) return;

        if (kind === 'customized') {
          if (val.includes('status')) score += 10;
          if (val.includes('costingprice') || val.includes('costing')) score += 10;
          if (val.includes('stockout') || val.includes('instock')) score += 10;
          if (val.includes('chassis') || val.includes('chasis')) score += 7;
          if (val.includes('carname') || val === 'name' || val.includes('model')) score += 5;
          if (val.includes('slno') || val === 'sl') score += 3;
        } else {
          // source sheet
          if (mode === 'BD') {
            if (val.includes('chassis') || val.includes('chasis') || val.includes('vin')) score += 12;
            if (val.includes('carname') || val === 'model' || val === 'name' || val.includes('vehicle')) score += 6;
            if (val.includes('price') || val.includes('cost') || val.includes('rate')) score += 5;
            if (val.includes('location') || val === 'loc' || val.includes('showroom')) score += 5;
            if (val.includes('year') || val === 'yr') score += 4;
            if (val.includes('slno') || val === 'sl') score += 3;
            if (val.includes('description') || val === 'desc') score += 3;
            if (val.includes('image') || val.includes('photo') || val.includes('picture')) score += 3;
          } else {
            // Japan source
            if (val.includes('raita')) score += 12;
            if (val.includes('slno') || val === 'sl') score += 8;
            if (val.includes('carname') || val === 'model' || val === 'name') score += 6;
            if (val.includes('duty')) score += 6;
            if (val.includes('driver') || val.includes('cnf')) score += 6;
            if (val.includes('price')) score += 5;
            if (val.includes('year') || val === 'yr') score += 4;
            if (val.includes('description') || val === 'desc') score += 3;
          }
        }
      });
    }

    if (score > bestScore) {
      bestScore = score;
      bestSheet = ws;
    }
  }

  if (bestSheet && bestScore >= 5) {
    return bestSheet;
  }

  // 5. Fallback: First visible sheet that actually has rows
  const visibleWithRows = sheets.find(
    (w) => w.state !== 'hidden' && w.state !== 'veryHidden' && (w.actualRowCount || w.rowCount || 0) > 0
  );
  if (visibleWithRows) return visibleWithRows;

  // 6. Fallback: Any sheet with rows
  const anyWithRows = sheets.find((w) => (w.actualRowCount || w.rowCount || 0) > 0);
  if (anyWithRows) return anyWithRows;

  // 7. Ultimate fallback: First sheet in the workbook
  return sheets[0] || null;
}

/* ==========================================================================
 * SHEET LAYOUT — column widths, row heights and alignment for the finished
 * BD / Japan / Combined workbooks. Applied last, so it governs every row the
 * reconcilers wrote, whatever the uploaded master looked like.
 * ========================================================================== */

/** Widths keyed by the column's role, so BD (24 cols) and Japan (23 cols) both land correctly. */
const WIDTH_BY_ROLE: Record<string, number> = {
  SL_NO: 8,            SL: 8,
  CAR_NAME: 21.75,     NAME: 21.75,
  GRADE: 14,
  YEAR: 9.3,
  COLOR: 15,
  POINT: 10.3,
  MILAGE: 11,          MILE: 11,
  DESCRIPTION: 60,     DESC: 60,
  PRICE: 13,
  CHASSIS: 17,
  LOCATION: 17,        LOC: 17,
  STATUS: 12,
  SUPPLIER: 13,
  LONG_DESCRIPTION: 40, LONGDESC: 40,
  PICTURE_DRIVE: 25,   PICTURE: 25,
};
/** Everything from COSTING PRICE to the last column that is not named above. */
const TAIL_WIDTH = 20;
/** Width of the DESCRIPTION column, for designs that measure row heights themselves. */
export const DESCRIPTION_WIDTH = WIDTH_BY_ROLE.DESCRIPTION;

export const HEADER_ROW_HEIGHTS = [25.5, 34, 31, 30];
/** A wrapped description line is worth this much height, plus a little breathing room. */
const LINE_HEIGHT = 24;
const ROW_PADDING = 10;

/**
 * How many lines a description occupies in a cell of the given column width.
 *
 * The text is measured in the sheet's own font instead of counting characters: these sheets
 * use Oswald, a condensed face where far more characters fit per line than the column-width
 * number suggests, so character counting made rows much taller than they needed to be.
 */
const measurers = new Map<string, { width: (t: string) => number; mdw: number } | null>();

function getMeasurer(fontName: string, fontSizePt: number) {
  const key = `${fontName}|${fontSizePt}`;
  if (measurers.has(key)) return measurers.get(key)!;
  let m: { width: (t: string) => number; mdw: number } | null = null;
  try {
    if (typeof document !== 'undefined') {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.font = `${fontSizePt}pt "${fontName}", sans-serif`;
        const digits = '0123456789'.split('').map(d => ctx.measureText(d).width);
        m = { width: (t: string) => ctx.measureText(t).width, mdw: Math.max(...digits) };
      }
    }
  } catch { m = null; }
  if (!m) {
    // outside a browser (tests): Oswald averages ~0.40 em per character, ~0.53 em per digit
    const em = fontSizePt * (96 / 72);
    m = { width: (t: string) => t.length * em * 0.4, mdw: em * 0.53 };
  }
  measurers.set(key, m);
  return m;
}

/** Excel turns a column width into pixels using the widest digit of the workbook font. */
function usablePixels(colWidth: number, mdw: number): number {
  const px = Math.trunc(((256 * colWidth + Math.trunc(128 / mdw)) / 256) * mdw);
  return Math.max(px - 5, 10);   // cell padding on both sides
}

export function wrappedLineCount(
  text: any,
  colWidth: number,
  fontName = 'Oswald',
  fontSizePt = 11,
): number {
  const t = String(text ?? '').replace(/\r/g, '');
  if (!t.trim()) return 1;
  const m = getMeasurer(fontName, fontSizePt);
  const limit = usablePixels(colWidth, m.mdw);
  let lines = 0;
  for (const para of t.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let line = '';
    let n = 1;
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      // 3% allowance: Excel lays text out slightly tighter than the browser measures it, and
      // the user's sheets show borderline lines fitting where a strict compare would wrap them
      if (line && m.width(candidate) > limit * 1.03) { n += 1; line = w; } else { line = candidate; }
    }
    lines += n;
  }
  return Math.max(1, lines);
}

/** Row height for a car row, from its description. */
export function carRowHeight(
  description: any,
  fontName = 'Oswald',
  fontSizePt = 11,
  descriptionWidth = WIDTH_BY_ROLE.DESCRIPTION,
): number {
  return wrappedLineCount(description, descriptionWidth, fontName, fontSizePt) * LINE_HEIGHT + ROW_PADDING;
}

/**
 * Apply the column widths, the four header row heights, centre alignment everywhere and
 * the no-wrap rule on PICTURE (DRIVE LINK).
 * `colMap` maps a role name to its 1-based column number; missing roles are skipped.
 */
export function applySheetLayout(
  ws: any,
  colMap: Record<string, number | undefined>,
  totalCols: number,
  lastRow: number,
): void {
  // --- column widths ---
  const roleOfCol = new Map<number, string>();
  for (const [role, col] of Object.entries(colMap)) {
    if (typeof col === 'number' && col >= 1) roleOfCol.set(col, role);
  }
  for (let c = 1; c <= totalCols; c++) {
    const role = roleOfCol.get(c);
    const width = role && WIDTH_BY_ROLE[role] !== undefined ? WIDTH_BY_ROLE[role] : TAIL_WIDTH;
    ws.getColumn(c).width = width;
  }

  // --- the four header rows ---
  HEADER_ROW_HEIGHTS.forEach((h, i) => { ws.getRow(i + 1).height = h; });

  // --- alignment for every cell, and no wrapping on the drive-link column ---
  const noWrapCol = colMap.PICTURE_DRIVE ?? colMap.PICTURE;
  const wrapCols = new Set([
    colMap.DESCRIPTION ?? colMap.DESC,
    colMap.LONG_DESCRIPTION ?? colMap.LONGDESC,
  ].filter(Boolean) as number[]);
  // these read as text, not as figures, so they sit on the left edge
  const leftCols = new Set([
    colMap.DESCRIPTION ?? colMap.DESC,
    colMap.PICTURE_DRIVE ?? colMap.PICTURE,
    colMap.SOURCE_SHEET ?? colMap.SOURCE,
  ].filter(Boolean) as number[]);
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      const wrapText = c === noWrapCol ? false : (wrapCols.has(c) ? true : !!cell.alignment?.wrapText);
      // replace the whole style object: setting single properties makes ExcelJS share style
      // indexes between cells, which corrupts fills on neighbouring rows
      const style = cell.style ? JSON.parse(JSON.stringify(cell.style)) : {};
      const horizontal = r > HEADER_ROW_HEIGHTS.length && leftCols.has(c) ? 'left' : 'center';
      style.alignment = { horizontal, vertical: 'middle', wrapText };
      cell.style = style;
    }
  }
}
