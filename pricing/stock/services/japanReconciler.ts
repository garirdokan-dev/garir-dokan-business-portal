import type { FieldChange, NewCarRecord, ReconciliationSummary, SheetRow } from '../types';
import type { SheetDesign } from '../utils/sheetDesign';
import {
  COLORS,
  colNumberToLetter,
  extractCellValue,
  normalizeKey,
  parseDescription,
} from '../utils/excelHelpers';
import { JAPAN_ORDER, inputPositions } from '../utils/columnLayout';
import {
  reconcileCore,
  cellFromTemplate,
  type ColMap,
  type CoreContext,
  type SourceRecord,
  type WorkflowConfig,
} from './reconcileCore';

function resolveColumns(m: Record<string, number>): ColMap {
  return inputPositions(m, 'JAPAN') as unknown as ColMap;   // either column order, by header text
}

function detectSourceHeader(ws: any): { headerRowIdx: number; sourceColMap: Record<string, number> } {
  const sourceColMap: Record<string, number> = {};
  let headerRowIdx = 1;
  const clean = (v: string) => v.replace(/[.\s]+$/, '').trim(); // strip trailing dots/space ("SL NO." -> "SL NO")
  const maxRow = Math.min(ws.rowCount || 20, 20);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    let hasSL = false, hasCar = false;
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      const v = clean(String(cell.value || '').trim().toUpperCase());
      if (v === 'SL NO' || v === 'SL' || v.includes('SERIAL')) hasSL = true;
      if (v.includes('CAR NAME') || v === 'MODEL' || v === 'CAR' || v === 'NAME') hasCar = true;
    });
    if (hasSL && hasCar) {
      headerRowIdx = r;
      row.eachCell({ includeEmpty: false }, (cell: any, colNum: number) => {
        const raw = String(cell.value || '').trim().toUpperCase();
        const v = clean(raw);
        // the plain "SL NO"/"SL" wins the SL NO slot (never "RAITA SL NO.")
        if (v === 'SL NO' || v === 'SL') { if (!sourceColMap['SL NO']) sourceColMap['SL NO'] = colNum; }
        else if (raw) sourceColMap[raw] = colNum;
      });
      break;
    }
  }
  return { headerRowIdx, sourceColMap };
}

function parseSourceRows(ws: any, m: Record<string, number>, headerRowIdx: number): SourceRecord[] {
  const findCol = (keywords: string[], fallback: number): number => {
    const norm = (v: string) => v.replace(/[\s_.\-]+/g, '').toUpperCase();
    const entries = Object.entries(m);
    // Pass 1 — EXACT header match for every keyword first. This must come before any
    // substring matching, otherwise a decorated header ("RAITA SL NO.") would swallow
    // the real one ("SL NO.") and the wrong column would be read.
    for (const kw of keywords) {
      const cleanKw = norm(kw);
      for (const [colName, colIdx] of entries) {
        if (norm(colName) === cleanKw) return colIdx;
      }
    }
    // Pass 2 — substring match, shortest header wins (the least-decorated one).
    for (const kw of keywords) {
      const cleanKw = norm(kw);
      let best: number | null = null; let bestLen = Infinity;
      for (const [colName, colIdx] of entries) {
        const cleanCol = norm(colName);
        if (cleanCol.includes(cleanKw) && cleanCol.length < bestLen) { best = colIdx; bestLen = cleanCol.length; }
      }
      if (best !== null) return best;
    }
    return fallback;
  };

  const S = {
    SL_NO: findCol(['SL NO', 'SL', 'SERIAL'], 2),
    CAR_NAME: findCol(['CAR NAME', 'NAME', 'MODEL', 'VEHICLE'], 3),
    YEAR: findCol(['YEAR', 'YR', 'MFG'], 4),
    DESCRIPTION: findCol(['DESCRIPTION', 'DESC', 'DETAIL'], 5),
    PRICE_USD: findCol(['PRICE (USD)', 'PRICE USD', 'USD'], 7),
    DRIVER_CNF: findCol(['DRIVER + CNF', 'DRIVER+CNF', 'CNF', 'DRIVER CNF'], 9),
    DUTY: findCol(['DUTY', 'TAX'], 10),
    TOTAL: findCol(['TOTAL', 'TOTAL COSTING', 'TOTAL COST'], 11),
    ADDITIONAL_COST: findCol(['ADDITIONAL COST', 'ADDITIONAL', 'EXTRA COST'], 12),
  };
  const rows: SourceRecord[] = [];
  let lastName = '';
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sl = normalizeKey(row.getCell(S.SL_NO).value).toUpperCase();
    if (!sl) continue;
    let carName = String(extractCellValue(row.getCell(S.CAR_NAME)).value ?? '').trim();
    if (carName) lastName = carName; else carName = lastName;
    rows.push({
      key: sl,
      carName: carName || 'UNKNOWN',
      rawSlNo: extractCellValue(row.getCell(S.SL_NO)).value,
      year: extractCellValue(row.getCell(S.YEAR)).value,
      description: String(extractCellValue(row.getCell(S.DESCRIPTION)).value ?? '').trim(),
      priceUSD: extractCellValue(row.getCell(S.PRICE_USD)).value,
      duty: extractCellValue(row.getCell(S.DUTY)).value,
      driverCnf: extractCellValue(row.getCell(S.DRIVER_CNF)).value,
      additionalCost: extractCellValue(row.getCell(S.ADDITIONAL_COST)).value,
      totalCosting: extractCellValue(row.getCell(S.TOTAL)).value,
      rowNumber: r,
    });
  }
  return rows;
}

/** The derived costing chain, written with the output's column letters ({r} = the row). */
const costingChain = (COL: ColMap) => {
  const L = colNumberToLetter;
  return {
    bdt: `${L(COL.PRICE_DOLLAR)}{r}*127`,                                 // PRICE (BDT) = PRICE (DOLLAR) × 127
    costing: `SUM(${L(COL.PRICE_BDT)}{r}:${L(COL.DRIVER_CNF)}{r})`,       // COSTING = BDT + DUTY + DRIVER + CNF
    price: `SUM(${L(COL.COSTING_PRICE)}{r}+${L(COL.ADDITIONAL_COST)}{r})`, // PRICE = COSTING + ADDITIONAL COST
  };
};

function refreshMatched(row: SheetRow, src: SourceRecord, ctx: CoreContext): FieldChange[] {
  const { COL, asOfDateStr } = ctx;
  const changes: FieldChange[] = [];

  const updateWithNote = (col: number, field: string, letter: string, newVal: any) => {
    if (newVal === null || newVal === undefined || newVal === '') return;
    const cell = row.cells.get(col);
    if (!cell) return;
    const oldVal = cell.formula ? undefined : cell.value;
    const isDifferent =
      typeof oldVal === 'number' && typeof newVal === 'number'
        ? Math.abs(oldVal - newVal) > 0.005
        : String(oldVal ?? '').trim() !== String(newVal ?? '').trim();
    if (isDifferent) {
      changes.push({ field, colName: letter, oldValue: oldVal, newValue: newVal });
      cell.value = newVal;
      cell.formula = undefined;
      const note = `Previous value (before ${asOfDateStr} update): ${oldVal}`;
      cell.note = cell.note ? `${cell.note}\n${note}` : note;
    }
  };

  const L = colNumberToLetter;
  updateWithNote(COL.PRICE_DOLLAR, 'PRICE (DOLLAR)', L(COL.PRICE_DOLLAR), src.priceUSD);
  updateWithNote(COL.DUTY, 'DUTY', L(COL.DUTY), src.duty);
  updateWithNote(COL.DRIVER_CNF, 'DRIVER + CNF', L(COL.DRIVER_CNF), src.driverCnf);
  updateWithNote(COL.ADDITIONAL_COST, 'ADDITIONAL COST', L(COL.ADDITIONAL_COST), src.additionalCost);

  // Always rebuild the derived formula chain at the row's final position.
  const f = costingChain(COL);
  const q = row.cells.get(COL.PRICE_BDT); if (q) { q.formula = f.bdt; q.value = null; }
  const o = row.cells.get(COL.COSTING_PRICE); if (o) { o.formula = f.costing; o.value = null; }
  const i = row.cells.get(COL.PRICE); if (i) { i.formula = f.price; i.value = null; }

  return changes;
}

function buildNewRow(src: SourceRecord, template: SheetRow, ctx: CoreContext): { row: SheetRow; record: NewCarRecord } {
  const { COL, asOfDateStr } = ctx;
  const TOTAL = COL.SOURCE_SHEET;
  const cells = new Map<number, ReturnType<typeof cellFromTemplate>>();
  for (let c = 1; c <= TOTAL; c++) cells.set(c, cellFromTemplate(template.cells.get(c), c));

  const p = parseDescription(src.description);
  const set = (col: number, value: any) => { cells.get(col)!.value = value; };

  set(COL.SL_NO, src.rawSlNo);
  set(COL.CAR_NAME, src.carName);
  set(COL.GRADE, p.grade);
  set(COL.YEAR, src.year);
  set(COL.COLOR, p.color);
  set(COL.POINT, p.point);
  set(COL.MILAGE, p.milage);
  set(COL.DESCRIPTION, p.remainingDescription);
  set(COL.CHASSIS, null);
  set(COL.LOCATION, 'JP');
  set(COL.STATUS, 'IN STOCK');
  set(COL.SUPPLIER, 'RAITA');
  set(COL.LONG_DESCRIPTION, null);
  set(COL.PRICE_DOLLAR, src.priceUSD);
  set(COL.DUTY, src.duty);
  set(COL.DRIVER_CNF, src.driverCnf);
  set(COL.ADDITIONAL_COST, src.additionalCost);
  set(COL.PICTURE_DRIVE, null);
  set(COL.UPLOADED_LINK, null);
  set(COL.SOURCE_SHEET, `RAITA INTERNATIONAL LIST (${asOfDateStr})`);

  // derived formula chain
  const f = costingChain(COL);
  cells.get(COL.PRICE_BDT)!.formula = f.bdt; cells.get(COL.PRICE_BDT)!.value = null;
  cells.get(COL.COSTING_PRICE)!.formula = f.costing; cells.get(COL.COSTING_PRICE)!.value = null;
  cells.get(COL.PRICE)!.formula = f.price; cells.get(COL.PRICE)!.value = null;

  // chassis blank -> BLUE (pending; RAITA source never carries chassis)
  const chassisCell = cells.get(COL.CHASSIS)!;
  chassisCell.value = null;
  chassisCell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BLUE_CHASSIS } };

  const row: SheetRow = {
    key: src.key,
    carName: src.carName,
    status: 'IN STOCK',
    section: 'IN_STOCK',
    height: template.height,
    cells,
    isNew: true,
  };

  const record: NewCarRecord = {
    key: src.key,
    carName: src.carName,
    year: src.year,
    price: src.priceUSD ? `$${src.priceUSD}` : (src.totalCosting || ''),
    grade: p.grade,
    color: p.color,
    point: p.point,
    milage: p.milage,
    location: 'JP',
    status: 'IN STOCK',
    sourceSheetTag: `RAITA INTERNATIONAL LIST (${asOfDateStr})`,
  };

  return { row, record };
}

/* ------------------------------------------------------------------ *
 * Identity fingerprint — Mileage + Year + Colour + Point.             *
 * RAITA can renumber a car's SL between lists, so the car's own       *
 * attributes take priority when deciding "is this the same car?".     *
 * ------------------------------------------------------------------ */
const squash = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = String(v).trim().toUpperCase().replace(/[\s,]+/g, '');
  return x || null;
};
const mileNum = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).toUpperCase().match(/(\d[\d,]*)/);
  return m ? m[1].replace(/,/g, '') : null;
};
const yearOf = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isInteger(v)) return String(v);
  return String(v).trim();
};
/** All four parts must be present — an incomplete fingerprint returns null. */
const fpJoin = (mile: any, year: any, color: any, point: any): string | null => {
  const m = mileNum(mile), y = yearOf(year), c = squash(color), p = squash(point);
  if (!m || !y || !c || !p) return null;
  return `${m}|${y}|${c}|${p}`;
};

function sourceFingerprint(src: SourceRecord): string | null {
  const parsed = parseDescription(String(src.description || ''));
  return fpJoin(parsed.milage, src.year, parsed.color, parsed.point);
}

function rowFingerprint(row: SheetRow, COL: ColMap): string | null {
  const val = (c: number) => row.cells.get(c)?.value;
  return fpJoin(val(COL.MILAGE), val(COL.YEAR), val(COL.COLOR), val(COL.POINT));
}

export async function reconcileJapanStock(
  customizedFile: File | ArrayBuffer,
  sourceFile: File | ArrayBuffer,
  asOfDate: Date | string,
  onProgress?: (msg: string) => void,
  design: SheetDesign = 'classic',
): Promise<ReconciliationSummary> {
  const cfg: WorkflowConfig = {
    mode: 'JAPAN',
    targetSheetNames: [
      'JAPAN STOCK',
      'JAPAN_STOCK',
      'JAPAN-STOCK',
      'JAPAN',
      'JAPAN MASTER',
      'Sheet1',
      'SHEET1',
    ],
    sourceSheetNames: [
      'MY STOCK LIST',
      'MY_STOCK_LIST',
      'STOCK LIST',
      'STOCK_LIST',
      'RAITA MY STOCK LIST',
      'RAITA_MY_STOCK_LIST',
      'RAITA',
      'STOCK',
      'JAPAN STOCK',
      'Sheet1',
      'SHEET1',
      'Sheet 1',
      'Cars',
      'Car List',
    ],
    totalCols: 23,
    order: JAPAN_ORDER,
    keyCol: (COL) => COL.SL_NO,
    labelDefaultText: "JAPAN STOCK OUT LISTING CAR'S",
    outputFilenamePrefix: 'Japan_Customized_Sheet',
    resolveColumns,
    detectSourceHeader,
    parseSourceRows: (ws, m, h) => parseSourceRows(ws, m, h),
    refreshMatched,
    buildNewRow,
    inStockUsesFormulaChain: true,
    orderInStockBySource: true,   // IN STOCK follows the new supplier list's order and groups
    sourceFingerprint,
    rowFingerprint,
  };
  return reconcileCore(customizedFile, sourceFile, asOfDate, cfg, onProgress, design);
}
