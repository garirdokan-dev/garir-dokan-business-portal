/**
 * Column order of the BD, Japan and Combined workbooks.
 *
 * The tools always write the order below (October 2026). They read a master in this order or in
 * the order used before (PRICE in I, CHASSIS in J, the cost columns in O–T): every column is found
 * by its header text, so either kind of master can be uploaded and the output comes out in the
 * new order. Formulas that move with their cells are rewritten to the new column letters.
 */
import { colLetterToNumber, colNumberToLetter } from './excelHelpers';

export type ColumnRole =
  | 'SL_NO' | 'CAR_NAME' | 'GRADE' | 'YEAR' | 'COLOR' | 'POINT' | 'MILAGE' | 'DESCRIPTION'
  | 'CHASSIS' | 'PRICE_DOLLAR' | 'PRICE_BDT' | 'DUTY' | 'DRIVER_CNF' | 'ADDITIONAL_COST'
  | 'COSTING_PRICE' | 'PRICE' | 'LONG_DESCRIPTION' | 'LOCATION' | 'STATUS' | 'SUPPLIER'
  | 'PICTURE_DRIVE' | 'UPLOADED_LINK' | 'IMAGE' | 'SOURCE_SHEET';

export type ColumnPositions = Partial<Record<ColumnRole, number>>;

/** The order every BD and Combined workbook is written in (24 columns, A–X). */
export const BD_ORDER: ColumnRole[] = [
  'SL_NO', 'CAR_NAME', 'GRADE', 'YEAR', 'COLOR', 'POINT', 'MILAGE', 'DESCRIPTION',
  'CHASSIS', 'PRICE_DOLLAR', 'PRICE_BDT', 'DUTY', 'DRIVER_CNF', 'ADDITIONAL_COST',
  'COSTING_PRICE', 'PRICE', 'LONG_DESCRIPTION', 'LOCATION', 'STATUS', 'SUPPLIER',
  'PICTURE_DRIVE', 'UPLOADED_LINK', 'IMAGE', 'SOURCE_SHEET',
];
/** Japan has no IMAGE column (23 columns, A–W). */
export const JAPAN_ORDER: ColumnRole[] = BD_ORDER.filter(r => r !== 'IMAGE');

/* The order used before October 2026 — only a fallback for a header that cannot be found. */
const OLD_BD_ORDER: ColumnRole[] = [
  'SL_NO', 'CAR_NAME', 'GRADE', 'YEAR', 'COLOR', 'POINT', 'MILAGE', 'DESCRIPTION',
  'PRICE', 'CHASSIS', 'LOCATION', 'STATUS', 'SUPPLIER', 'LONG_DESCRIPTION',
  'COSTING_PRICE', 'PRICE_DOLLAR', 'PRICE_BDT', 'DUTY', 'DRIVER_CNF', 'ADDITIONAL_COST',
  'PICTURE_DRIVE', 'UPLOADED_LINK', 'IMAGE', 'SOURCE_SHEET',
];
const OLD_JAPAN_ORDER: ColumnRole[] = OLD_BD_ORDER.filter(r => r !== 'IMAGE');

/** Header texts (upper case) that name each column. */
const HEADER_NAMES: Record<ColumnRole, string[]> = {
  SL_NO: ['SL NO'], CAR_NAME: ['CAR NAME'], GRADE: ['GRADE'], YEAR: ['YEAR'],
  COLOR: ['COLOR'], POINT: ['POINT'], MILAGE: ['MILAGE', 'MILEAGE'], DESCRIPTION: ['DESCRIPTION'],
  CHASSIS: ['CHASSIS'], PRICE_DOLLAR: ['PRICE (DOLLAR)'], PRICE_BDT: ['PRICE (BDT)'], DUTY: ['DUTY'],
  DRIVER_CNF: ['DRIVER + CNF'], ADDITIONAL_COST: ['ADDITIONAL COST'], COSTING_PRICE: ['COSTING PRICE'],
  PRICE: ['PRICE'], LONG_DESCRIPTION: ['LONG DESCRIPTION'], LOCATION: ['LOCATION'], STATUS: ['STATUS'],
  SUPPLIER: ['SUPPLIRE', 'SUPPLIER'], PICTURE_DRIVE: ['PICTURE(DRIVE LINK)'], UPLOADED_LINK: ['UPLOADED LINK'],
  IMAGE: ['IMAGE'], SOURCE_SHEET: ['SOURCE SHEET'],
};

export const orderFor = (mode: 'BD' | 'JAPAN'): ColumnRole[] => (mode === 'JAPAN' ? JAPAN_ORDER : BD_ORDER);

/** Where each column is written: its place in the order. */
export function outputPositions(order: ColumnRole[]): ColumnPositions {
  const out: ColumnPositions = {};
  order.forEach((role, i) => { out[role] = i + 1; });
  return out;
}

/**
 * Where each column sits in an uploaded master, from its header row
 * (`headerMap` = upper-case header text → 1-based column).
 */
export function inputPositions(headerMap: Record<string, number>, mode: 'BD' | 'JAPAN'): ColumnPositions {
  const order = orderFor(mode);
  // a header that cannot be found falls back to the position of the layout the sheet looks like
  const newLayout = headerMap['CHASSIS'] === order.indexOf('CHASSIS') + 1;
  const fallback = newLayout ? order : (mode === 'JAPAN' ? OLD_JAPAN_ORDER : OLD_BD_ORDER);
  const out: ColumnPositions = {};
  for (const role of order) {
    const found = HEADER_NAMES[role].map(h => headerMap[h]).find(c => typeof c === 'number' && c > 0);
    out[role] = found || fallback.indexOf(role) + 1;
  }
  return out;
}

/** Input column → output column, for the columns both have. */
export function columnMove(input: ColumnPositions, output: ColumnPositions, order: ColumnRole[]): Map<number, number> {
  const move = new Map<number, number>();
  for (const role of order) {
    const from = input[role], to = output[role];
    if (from && to && !move.has(from)) move.set(from, to);
  }
  return move;
}

export const isSameLayout = (move: Map<number, number>): boolean => [...move].every(([a, b]) => a === b);

/** Rewrite the column letters of a formula for cells that moved (e.g. =SUM(Q5:S5) → =SUM(K5:M5)). */
export function moveFormula(formula: string, move: Map<number, number>): string {
  if (!formula || isSameLayout(move)) return formula;
  return formula.replace(/(^|[^A-Za-z0-9_$.!])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g,
    (whole, pre, abs1, letters, abs2, row) => {
      const to = move.get(colLetterToNumber(letters));
      return to ? `${pre}${abs1}${colNumberToLetter(to)}${abs2}${row}` : whole;
    });
}

/* ------------------------------------------------------------------ *
 * The header row and title rows of the output                         *
 * ------------------------------------------------------------------ */
function mergesOnRow(ws: any, r: number): string[] {
  const out: string[] = [];
  for (const m of Object.values(ws._merges || {}) as any[]) {
    if (m && m.top <= r && m.bottom >= r && typeof m.range === 'string') out.push(m.range);
  }
  return out;
}

/**
 * Put the header cells in the output order (text and look move together), and merge the title
 * rows above the header from A to the PRICE column.
 */
export function layoutHeaderAndTitle(
  ws: any, headerRow: number, input: ColumnPositions, output: ColumnPositions, order: ColumnRole[],
): void {
  const hdr = ws.getRow(headerRow);
  const move = columnMove(input, output, order);
  if (!isSameLayout(move)) {
    const taken = order.map(role => {
      const cell = hdr.getCell(input[role]!);
      return { to: output[role]!, value: cell.value, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : {} };
    });
    for (const t of taken) {
      const cell = hdr.getCell(t.to);
      cell.value = t.value;
      cell.style = t.style;
    }
  }

  const last = output.PRICE;
  if (!last || last < 2) return;
  const copy = (s: any) => (s ? JSON.parse(JSON.stringify(s)) : {});
  for (let r = 1; r < headerRow; r++) {
    const ranges = mergesOnRow(ws, r);
    const target = `A${r}:${colNumberToLetter(last)}${r}`;
    if (ranges.length === 1 && ranges[0] === target) continue;
    const row = ws.getRow(r);
    const a = row.getCell(1).value;
    if (!ranges.length && (a === null || a === undefined || String(a) === '')) continue;
    // the covered cells draw the merged block's top/bottom edges (and the last one its right edge),
    // so they take the look the old covered cells had; unmerging would otherwise clear it
    const oldEnd = ranges.length ? (Object.values(ws._merges || {}) as any[]).find(m => m.range === ranges[0])?.right : undefined;
    const middle = oldEnd && oldEnd > 2 ? copy(row.getCell(2).style) : null;
    const end = oldEnd && oldEnd > 1 ? copy(row.getCell(oldEnd).style) : null;
    for (const range of ranges) { try { ws.unMergeCells(range); } catch { /* already separate */ } }
    if (middle && end) {
      for (let c = 2; c < last; c++) row.getCell(c).style = copy(middle);
      row.getCell(last).style = copy(end);
    }
    try { ws.mergeCellsWithoutStyle(r, 1, r, last); } catch { /* overlapping merge — leave the row as it is */ }
  }
}
