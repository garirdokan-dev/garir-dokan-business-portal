/**
 * Excel design of the finished BD / Japan / Combined workbooks.
 *
 * The tools always build the sheet the classic way first. When another design is chosen, this
 * step repaints the finished sheet. Only the look changes: values, formulas, notes, row order,
 * serials, column widths and the colours that carry a meaning stay exactly as the tool wrote them.
 * Meaningful colours are:
 *   - the chassis fill (green = confirmed, blue = pending, or any other the operator used)
 *   - red cells: a stock-out car name, a transferred row, a price flagged for manual entry
 *   - link text in the picture / link columns
 *
 * A workbook made in one design can be uploaded next month and the output asked for in the other.
 * Brand repaints everything it owns. Classic leaves a classic sheet untouched and puts the classic
 * look back on any part that still carries the Brand look: title band, header, car rows and the
 * stock-out title.
 */
import { carRowHeight, DESCRIPTION_WIDTH } from './excelHelpers';

export type SheetDesign = 'classic' | 'brand';

export const SHEET_DESIGN_NAMES: Record<SheetDesign, string> = {
  classic: 'Classic',
  brand: 'Brand Black & Red',
};

/** What the tool wrote on each row below the header, so every row is painted for its role. */
export type LaidRowKind = 'car' | 'separator' | 'divider' | 'gap' | 'stockOutTitle';
export interface LaidRow {
  row: number;
  kind: LaidRowKind;
  /** Which master the car row came from. Decides the classic PRICE format when restoring. */
  origin?: 'BD' | 'JP';
}

/** 1-based column numbers of the columns a design treats specially. */
export interface DesignColumns {
  name: number;
  description: number;
  longDescription?: number;
  price: number;
  chassis: number;
  location: number;
  status: number;
  supplier: number;
}

export interface DesignTarget {
  ws: any;
  headerRow: number;
  totalCols: number;
  rows: LaidRow[];
  cols: DesignColumns;
}

/* ------------------------------------------------------------------ *
 * Colours                                                             *
 * ------------------------------------------------------------------ */
const RED = 'FFFF0000';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';

const BRAND = {
  text: 'FF262626',
  name: 'FF111111',
  description: 'FF4D4D4D',
  chassisText: 'FF1F2937',
  inStock: 'FF2E7D32',
  stockOut: 'FFC00000',
  zebra: 'FFFAFAFA',
  grid: 'FFE0E0E0',
  band: 'FF111111',               // title band and group separators
  accent: 'FFE2062B',             // "OFFER LIST" and the stock-out title
  bandSmall: 'FFA6A6A6',          // top line of the title band
  bandContact: 'FFD9D9D9',        // contact line of the title band
  header: 'FF9D1414',
  headerGrid: 'FFB84A4A',
  priceFormat: '#,##0;-#,##0;"—"', // thousands separators; an uncosted car shows a dash, not 0
};

const CLASSIC = {
  titleFills: ['FFBFBFBF', 'FFE2062B', 'FFFFFFFF'],
  band: 'FFCFE2F3',               // LOCATION … LONG DESCRIPTION
  header: 'FF31859B',
  stockOutTitle: 'FFE2062B',
  link: 'FF1155CC',
  priceFormat: { BD: '###,###', JP: '#,##0.00' } as Record<'BD' | 'JP', string>,
};

/** Indent 1 takes roughly this much of a column's width (Excel: one step = 3 spaces). */
const INDENT_WIDTH = 1.3;
/** The title band and the stock-out title span the offer columns, A … LONG DESCRIPTION. */
const OFFER_SPAN = 14;
/** The classic title rows and stock-out title span A … I. */
const CLASSIC_SPAN = 9;

/* header words the Brand design spells out in capitals (and Classic puts back) */
const BRAND_HEADER: Record<string, string> = { MILAGE: 'MILEAGE', SUPPLIRE: 'SUPPLIER' };
const CLASSIC_HEADER: Record<string, string> = {
  COLOR: 'Color', POINT: 'Point', MILEAGE: 'Milage', MILAGE: 'Milage', SUPPLIER: 'SUPPLIRE',
};

const LINK_COLOURS = new Set(['FF1155CC', 'FF0000FF', 'FF0563C1']);

/* ------------------------------------------------------------------ *
 * Small helpers                                                       *
 * ------------------------------------------------------------------ */
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const solid = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const solidBoth = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } });
const NO_FILL = { type: 'pattern', pattern: 'none' };
const box = (argb: string) => {
  const side = { style: 'thin', color: { argb } };
  return { left: { ...side }, right: { ...side }, top: { ...side }, bottom: { ...side } };
};

function fillArgb(fill: any): string | null {
  if (!fill || fill.pattern !== 'solid') return null;
  const argb = fill.fgColor?.argb;
  return typeof argb === 'string' ? argb.toUpperCase() : null;
}

/** Plain text of a cell value, rich text included. */
function plainText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return String(v.text ?? '');
    if ('result' in v) return String(v.result ?? '');
    return '';
  }
  return String(v);
}

function isLinkFont(font: any): boolean {
  if (!font) return false;
  if (font.underline) return true;
  const c = font.color;
  return !!c && ((typeof c.argb === 'string' && LINK_COLOURS.has(c.argb.toUpperCase())) || c.theme === 10);
}

/**
 * A fill that belongs to the design rather than to the car: no fill, white, the Brand zebra, and
 * the classic light-blue band outside the chassis column. Anything else is kept by both designs.
 */
function isBackground(argb: string | null, col: number, cols: DesignColumns): boolean {
  if (!argb) return true;
  if (argb === WHITE || argb === BRAND.zebra) return true;
  return argb === CLASSIC.band && col !== cols.chassis;
}

/** Replace the whole style object: setting single properties lets ExcelJS share style records. */
function setStyle(cell: any, s: { font?: any; fill?: any; border?: any; alignment?: any; numFmt?: string }) {
  cell.style = {
    font: s.font ? clone(s.font) : { name: 'Oswald', size: 11 },
    fill: s.fill ? clone(s.fill) : clone(NO_FILL),
    border: s.border ? clone(s.border) : {},
    alignment: s.alignment ? clone(s.alignment) : {},
    numFmt: s.numFmt || 'General',
  };
}

function mergesOnRow(ws: any, r: number): string[] {
  const out: string[] = [];
  for (const m of Object.values(ws._merges || {}) as any[]) {
    if (m && m.top <= r && m.bottom >= r && typeof m.range === 'string') out.push(m.range);
  }
  return out;
}
function unmergeRow(ws: any, r: number) {
  for (const range of mergesOnRow(ws, r)) {
    try { ws.unMergeCells(range); } catch { /* already separate */ }
  }
}
/** Merge A..lastCol on one row, keeping the style each covered cell was just given. */
function mergeSpan(ws: any, r: number, lastCol: number) {
  if (lastCol < 2) return;
  try { ws.mergeCellsWithoutStyle(r, 1, r, lastCol); } catch { /* overlapping merge — leave the cells as they are */ }
}

/* ------------------------------------------------------------------ *
 * Entry point                                                         *
 * ------------------------------------------------------------------ */
export function applySheetDesign(design: SheetDesign, t: DesignTarget): void {
  if (design === 'brand') paintBrand(t);
  else restoreClassic(t);
}

/* ================================================================== *
 * Brand Black & Red                                                   *
 * ================================================================== */
type TitleRole = 'top' | 'name' | 'contact';
const titleRole = (r: number, text: string): TitleRole =>
  /OFFER\s+LIST\s*$/i.test(text) ? 'name' : r === 1 ? 'top' : 'contact';

function paintBrand(t: DesignTarget) {
  const { ws, headerRow, totalCols, rows, cols } = t;
  const span = Math.min(OFFER_SPAN, totalCols);

  /* ---- title band ---- */
  for (let r = 1; r < headerRow; r++) {
    const row = ws.getRow(r);
    unmergeRow(ws, r);
    const a = row.getCell(1);
    const text = plainText(a.value).replace(/\s+/g, ' ').trim();
    const role = titleRole(r, text);
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      if (c > 1) cell.value = null;
      setStyle(cell, {
        fill: solidBoth(BRAND.band),
        font: { name: 'Oswald', size: 11, color: { argb: WHITE } },
        alignment: c === 1 ? { horizontal: 'center', vertical: 'middle', wrapText: true } : {},
        numFmt: cell.style?.numFmt,
      });
    }
    if (role === 'top') {
      setStyle(a, { fill: solidBoth(BRAND.band), font: { name: 'Oswald', size: 11, color: { argb: BRAND.bandSmall } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
      a.value = text || null;
      row.height = 22;
    } else if (role === 'name') {
      const big = { name: 'Oswald', size: 28, bold: true };
      setStyle(a, { fill: solidBoth(BRAND.band), font: { ...big, color: { argb: WHITE } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
      const m = text.match(/^(.*?)\s*(OFFER\s+LIST)$/i);
      a.value = m && m[1]
        ? { richText: [
            { text: `${m[1]}  `, font: { ...big, color: { argb: WHITE } } },
            { text: m[2], font: { ...big, color: { argb: BRAND.accent } } },
          ] }
        : text;
      row.height = 46;
    } else {
      setStyle(a, { fill: solidBoth(BRAND.band), font: { name: 'Oswald', size: 11, color: { argb: BRAND.bandContact } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
      a.value = text || null;
      row.height = 26;
    }
  }

  /* ---- column header ---- */
  const hdr = ws.getRow(headerRow);
  for (let c = 1; c <= totalCols; c++) {
    const cell = hdr.getCell(c);
    if (typeof cell.value === 'string' && cell.value.trim()) {
      const up = cell.value.trim().toUpperCase();
      cell.value = BRAND_HEADER[up] || up;
    }
    setStyle(cell, {
      font: { name: 'Oswald', size: 12, bold: true, color: { argb: WHITE } },
      fill: solidBoth(BRAND.header),
      border: box(BRAND.headerGrid),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: !!cell.style?.alignment?.wrapText },
      numFmt: cell.style?.numFmt,
    });
  }
  hdr.height = 32;

  /* ---- rows below the header ---- */
  let carIndex = 0;
  for (const laid of rows) {
    const row = ws.getRow(laid.row);
    if (laid.kind === 'car') {
      carIndex += 1;
      paintBrandCar(row, carIndex % 2 === 0, totalCols, cols);
      row.height = carRowHeight(plainText(row.getCell(cols.description).value), 'Oswald', 11, DESCRIPTION_WIDTH - INDENT_WIDTH);
    } else if (laid.kind === 'separator') {
      for (let c = 1; c <= totalCols; c++) setStyle(row.getCell(c), { fill: solid(BRAND.band) });
      row.height = 5;
    } else if (laid.kind === 'divider') {
      for (let c = 1; c <= totalCols; c++) {
        setStyle(row.getCell(c), { border: { bottom: { style: 'thin', color: { argb: BRAND.grid } } } });
      }
      row.height = 4;
    } else if (laid.kind === 'stockOutTitle') {
      unmergeRow(ws, laid.row);
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        if (c > 1) cell.value = null;
        setStyle(cell, { fill: solidBoth(BRAND.accent) });
      }
      setStyle(row.getCell(1), {
        fill: solidBoth(BRAND.accent),
        font: { name: 'Oswald', size: 14, bold: true, color: { argb: WHITE } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
      row.height = 30;
    }
  }

  /* merges last, once every cell has its final style */
  for (let r = 1; r < headerRow; r++) mergeSpan(ws, r, span);
  for (const laid of rows) if (laid.kind === 'stockOutTitle') mergeSpan(ws, laid.row, span);
}

function paintBrandCar(row: any, banded: boolean, totalCols: number, cols: DesignColumns) {
  for (let c = 1; c <= totalCols; c++) {
    const cell = row.getCell(c);
    const old = cell.style || {};
    const oldFill = fillArgb(old.fill);
    const keepFill = isBackground(oldFill, c, cols) ? null : old.fill;
    const red = oldFill === RED;

    let colour: any = { argb: BRAND.text };
    let bold = false;
    if (c === cols.name) { colour = { argb: BRAND.name }; bold = true; }
    else if (c === cols.description || c === cols.longDescription) colour = { argb: BRAND.description };
    else if (c === cols.price) bold = true;
    if (c === cols.status) {
      const s = plainText(cell.value).toUpperCase();
      if (s.includes('OUT')) { colour = { argb: BRAND.stockOut }; bold = true; }
      else if (s.includes('IN STOCK')) { colour = { argb: BRAND.inStock }; bold = true; }
    }
    const link = isLinkFont(old.font);
    if (link && old.font?.color) colour = clone(old.font.color);
    if (keepFill && c === cols.chassis && !red) colour = { argb: BRAND.chassisText };
    if (red) {
      colour = { argb: WHITE };
      if (c === cols.name || c === cols.status) bold = true;
    }

    const font: any = { name: 'Oswald', size: 11, color: colour };
    if (bold) font.bold = true;
    if (old.font?.underline) font.underline = old.font.underline;

    const alignment: any = {
      horizontal: old.alignment?.horizontal || 'center',
      vertical: 'middle',
      wrapText: !!old.alignment?.wrapText,
    };
    if (c === cols.name || c === cols.description || c === cols.longDescription) {
      alignment.horizontal = 'left'; alignment.indent = 1;
    } else if (c === cols.price) {
      alignment.horizontal = 'right'; alignment.indent = 1;
    }

    setStyle(cell, {
      font,
      fill: keepFill ? keepFill : banded ? solid(BRAND.zebra) : NO_FILL,
      border: box(BRAND.grid),
      alignment,
      numFmt: c === cols.price ? BRAND.priceFormat : old.numFmt,
    });
  }
}

/* ================================================================== *
 * Classic — only parts that still carry the Brand look are touched     *
 * ================================================================== */
function restoreClassic(t: DesignTarget) {
  const { ws, headerRow, totalCols, rows, cols } = t;
  const span = Math.min(CLASSIC_SPAN, totalCols);
  const titleRows: number[] = [];

  /* ---- title rows ---- */
  for (let r = 1; r < headerRow; r++) {
    const row = ws.getRow(r);
    if (fillArgb(row.getCell(1).style?.fill) !== BRAND.band) continue;
    titleRows.push(r);
    unmergeRow(ws, r);
    const text = plainText(row.getCell(1).value).replace(/\s+/g, ' ').trim();
    const role = titleRole(r, text);
    const fill = role === 'top' ? CLASSIC.titleFills[0] : role === 'name' ? CLASSIC.titleFills[1] : CLASSIC.titleFills[2];
    const ink = role === 'name' ? { argb: WHITE } : { theme: 1 };
    const thin = { style: 'thin', color: { argb: BLACK } };
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      const numFmt = cell.style?.numFmt;
      if (c > 1) cell.value = null;
      if (c === 1) {
        setStyle(cell, {
          font: { name: 'Oswald', size: role === 'name' ? 24 : 18, color: ink },
          fill: solidBoth(fill),
          border: { left: thin, top: thin, bottom: thin },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          numFmt,
        });
      } else if (c <= span) {
        // covered by the merge; only its top and bottom edges show
        setStyle(cell, {
          font: { name: 'Arial', size: 10 },
          border: c === span ? { right: thin, top: thin, bottom: thin } : { top: thin, bottom: thin },
          alignment: { horizontal: 'center', vertical: 'middle' },
          numFmt,
        });
      } else {
        const big = c <= OFFER_SPAN;
        const noFill = role === 'contact' && c >= 20;   // the classic contact row stops at column S
        setStyle(cell, {
          font: { name: 'Oswald', size: big ? (role === 'name' ? 22 : role === 'top' ? 19 : 18) : 11, color: big ? ink : { theme: 1 } },
          fill: noFill ? NO_FILL : solidBoth(fill),
          border: box(BLACK),
          alignment: big ? { horizontal: 'center', vertical: 'middle', wrapText: true } : { horizontal: 'center', vertical: 'middle' },
          numFmt,
        });
      }
    }
    row.getCell(1).value = text || null;
  }

  /* ---- column header ---- */
  const hdr = ws.getRow(headerRow);
  if (fillArgb(hdr.getCell(1).style?.fill) === BRAND.header) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = hdr.getCell(c);
      if (typeof cell.value === 'string' && cell.value.trim()) {
        const up = cell.value.trim().toUpperCase();
        if (CLASSIC_HEADER[up]) cell.value = CLASSIC_HEADER[up];
      }
      setStyle(cell, {
        font: { name: 'Oswald', size: 14, color: { argb: WHITE } },
        fill: solidBoth(CLASSIC.header),
        border: box(BLACK),
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: !!cell.style?.alignment?.wrapText },
        numFmt: cell.style?.numFmt,
      });
    }
  }

  /* ---- car rows and the stock-out title ---- */
  const titlesToMerge: number[] = [];
  for (const laid of rows) {
    const row = ws.getRow(laid.row);
    if (laid.kind === 'car') {
      if (rowHasBrandGrid(row, totalCols)) restoreClassicCar(row, laid.origin || 'BD', totalCols, cols);
    } else if (laid.kind === 'stockOutTitle') {
      if (!row.getCell(1).style?.font?.bold) continue;     // a classic title is never bold
      // the alignment is the sheet layout's, as on a classic sheet (unmerging clears covered cells)
      const layoutAlign: any[] = [];
      for (let c = 1; c <= totalCols; c++) layoutAlign[c] = clone(row.getCell(c).style?.alignment);
      unmergeRow(ws, laid.row);
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        if (c > 1) cell.value = null;
        setStyle(cell, {
          font: c === 1 ? { name: 'Oswald', size: 14, color: { argb: WHITE } } : undefined,
          fill: c <= span ? solidBoth(CLASSIC.stockOutTitle) : undefined,
          alignment: layoutAlign[c],
        });
      }
      row.height = 29.25;
      titlesToMerge.push(laid.row);
    }
  }

  for (const r of titleRows) mergeSpan(ws, r, span);
  for (const r of titlesToMerge) mergeSpan(ws, r, span);
}

function rowHasBrandGrid(row: any, totalCols: number): boolean {
  for (let c = 1; c <= totalCols; c++) {
    const b = row.getCell(c).style?.border;
    const argb = b?.top?.color?.argb || b?.left?.color?.argb;
    if (typeof argb === 'string' && argb.toUpperCase() === BRAND.grid) return true;
  }
  return false;
}

function restoreClassicCar(row: any, origin: 'BD' | 'JP', totalCols: number, cols: DesignColumns) {
  const bandCols = new Set([cols.location, cols.status, cols.supplier, cols.longDescription].filter(Boolean) as number[]);
  for (let c = 1; c <= totalCols; c++) {
    const cell = row.getCell(c);
    const old = cell.style || {};
    // a cell with no border at all was written blank by the tool itself (e.g. IMAGE on a Japan
    // row of the combined sheet) and already looks classic
    if (!old.border || !Object.keys(old.border).length) continue;
    const oldFill = fillArgb(old.fill);
    const keepFill = isBackground(oldFill, c, cols) ? null : old.fill;
    const red = oldFill === RED;

    const font: any = { name: 'Oswald', size: 11, color: { theme: 1 } };
    if (isLinkFont(old.font)) {
      const c0 = old.font?.color;
      const linkColour = !!c0 && (c0.theme === 10 || (typeof c0.argb === 'string' && LINK_COLOURS.has(c0.argb.toUpperCase())));
      font.color = linkColour ? clone(c0) : { argb: CLASSIC.link };   // a link on a red row was painted white
      if (old.font?.underline) font.underline = old.font.underline;
    }
    if (red && c === cols.name) font.color = { argb: WHITE };

    let numFmt = old.numFmt;
    if (c === cols.price && numFmt === BRAND.priceFormat) numFmt = CLASSIC.priceFormat[origin];

    setStyle(cell, {
      font,
      fill: keepFill ? keepFill : bandCols.has(c) ? solidBoth(CLASSIC.band) : NO_FILL,
      border: box(BLACK),
      alignment: old.alignment,          // the sheet layout already set the classic alignment
      numFmt,
    });
  }
}
