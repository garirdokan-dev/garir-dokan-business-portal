import type { FieldChange, NewCarRecord, ReconciliationSummary, SheetRow } from '../types';
import type { SheetDesign } from '../utils/sheetDesign';
import {
  COLORS,
  colNumberToLetter,
  extractCellValue,
  normalizeKey,
  numericEqual,
  parseDescription,
  toNumber,
} from '../utils/excelHelpers';
import { BD_ORDER, inputPositions } from '../utils/columnLayout';
import {
  reconcileCore,
  cellFromTemplate,
  type ColMap,
  type CoreContext,
  type SourceRecord,
  type WorkflowConfig,
} from './reconcileCore';

function resolveColumns(m: Record<string, number>): ColMap {
  return inputPositions(m, 'BD') as unknown as ColMap;   // either column order, by header text
}

function detectSourceHeader(ws: any): { headerRowIdx: number; sourceColMap: Record<string, number> } {
  const sourceColMap: Record<string, number> = {};
  let headerRowIdx = 1;
  const maxRow = Math.min(ws.rowCount || 20, 20);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    let found = 0;
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      const v = String(cell.value || '').trim().toUpperCase();
      if (
        v.includes('CHASSIS') ||
        v.includes('CHASIS') ||
        v.includes('VIN') ||
        v.includes('NAME') ||
        v.includes('MODEL') ||
        v.includes('PRICE') ||
        v.includes('COST') ||
        v.includes('LOCATION') ||
        v.includes('LOC') ||
        v.includes('SL')
      ) {
        found++;
      }
    });
    if (found >= 2) {
      headerRowIdx = r;
      row.eachCell({ includeEmpty: false }, (cell: any, colNum: number) => {
        const v = String(cell.value || '').trim().toUpperCase();
        if (v) sourceColMap[v] = colNum;
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
    SL_NO: findCol(['SL NO', 'SL', 'SERIAL'], 1),
    NAME: findCol(['CAR NAME', 'MODEL', 'NAME', 'VEHICLE'], 2),
    DESCRIPTION: findCol(['DESCRIPTION', 'DESC', 'DETAIL', 'SPEC'], 3),
    CHASSIS: findCol(['CHASSIS', 'CHASIS', 'VIN', 'FRAME'], 4),
    YEAR: findCol(['YEAR', 'YR', 'MFG'], 5),
    IMAGE: findCol(['IMAGE', 'PHOTO', 'PICTURE', 'DRIVE', 'LINK'], 6),
    LOCATION: findCol(['LOCATION', 'LOC', 'SHOWROOM', 'YARD', 'DEPOT'], 7),
    PRICE: findCol(['PRICE', 'COST', 'COSTING', 'RATE', 'BDT'], 8),
  };
  const rows: SourceRecord[] = [];
  let lastName = '';
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const chassis = normalizeKey(row.getCell(S.CHASSIS).value).toUpperCase();
    if (!chassis) continue;
    let carName = String(extractCellValue(row.getCell(S.NAME)).value ?? '').trim();
    if (carName) lastName = carName; else carName = lastName;
    const imgExt = extractCellValue(row.getCell(S.IMAGE));
    rows.push({
      key: chassis,
      carName: carName || 'UNKNOWN',
      slNo: extractCellValue(row.getCell(S.SL_NO)).value,
      description: String(extractCellValue(row.getCell(S.DESCRIPTION)).value ?? '').trim(),
      chassis,
      year: extractCellValue(row.getCell(S.YEAR)).value,
      imageHyperlink: imgExt.hyperlink,
      imageText: imgExt.hyperlink ? (imgExt.hyperlinkText || 'PHOTO') : '',
      location: String(extractCellValue(row.getCell(S.LOCATION)).value ?? '').trim(),
      price: extractCellValue(row.getCell(S.PRICE)).value,
      rowNumber: r,
    });
  }
  return rows;
}

function refreshMatched(row: SheetRow, src: SourceRecord, ctx: CoreContext): FieldChange[] {
  const { COL } = ctx;
  const changes: FieldChange[] = [];

  // SL NO follows the NEW STOCK LIST: every car still in the supplier list is renumbered to
  // that list's serial. A car that drops out keeps whatever serial it had at that moment and
  // carries it into the STOCK-OUT section (duplicates there are expected and fine).
  if (src.slNo !== null && src.slNo !== undefined && String(src.slNo).trim() !== '') {
    const slCell = row.cells.get(COL.SL_NO);
    if (slCell) {
      slCell.value = src.slNo;
      slCell.formula = undefined;
    }
  }

  if (src.location) {
    const cell = row.cells.get(COL.LOCATION);
    const oldLoc = cell?.value;
    if (String(oldLoc ?? '').trim() !== String(src.location).trim()) {
      changes.push({ field: 'LOCATION', colName: colNumberToLetter(COL.LOCATION), oldValue: oldLoc, newValue: src.location });
      if (cell) cell.value = src.location;
    }
  }

  if (src.price !== null && src.price !== undefined && src.price !== '') {
    const cell = row.cells.get(COL.COSTING_PRICE);
    const resolved = toNumber(cell?.value);
    const hadFormula = !!cell?.formula;
    if (!numericEqual(resolved, src.price)) {
      changes.push({ field: 'COSTING PRICE', colName: colNumberToLetter(COL.COSTING_PRICE), oldValue: cell?.formula || cell?.value, newValue: src.price });
      if (cell) {
        cell.value = src.price;
        cell.formula = undefined;
        cell.style.numFmt = '0.00';
      }
      if (hadFormula) {
        const priceCell = row.cells.get(COL.PRICE);
        if (priceCell) {
          priceCell.value = null;
          priceCell.formula = undefined;
          priceCell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_HIGHLIGHT } };
          changes.push({ field: 'PRICE (flagged for manual entry)', colName: colNumberToLetter(COL.PRICE), oldValue: 'formula cleared', newValue: 'BLANK + red fill' });
        }
      }
    }
  }

  if (src.imageHyperlink) {
    const cell = row.cells.get(COL.IMAGE!);
    if (cell && cell.hyperlink !== src.imageHyperlink) {
      changes.push({ field: 'IMAGE', colName: colNumberToLetter(COL.IMAGE!), oldValue: cell.hyperlink || cell.value, newValue: src.imageHyperlink });
      cell.value = src.imageText || 'PHOTO';
      cell.hyperlink = src.imageHyperlink;
      cell.hyperlinkText = src.imageText || 'PHOTO';
    }
  }

  return changes;
}

function buildNewRow(src: SourceRecord, template: SheetRow, ctx: CoreContext): { row: SheetRow; record: NewCarRecord } {
  const { COL, asOfDateStr } = ctx;
  const TOTAL = COL.SOURCE_SHEET;
  const cells = new Map<number, ReturnType<typeof cellFromTemplate>>();
  for (let c = 1; c <= TOTAL; c++) cells.set(c, cellFromTemplate(template.cells.get(c), c));

  const p = parseDescription(src.description);
  const set = (col: number, value: any) => { cells.get(col)!.value = value; };

  const year = src.year;

  set(COL.SL_NO, src.slNo);
  set(COL.CAR_NAME, src.carName);
  set(COL.GRADE, p.grade);
  set(COL.YEAR, year);
  set(COL.COLOR, p.color);
  set(COL.POINT, p.point);
  set(COL.MILAGE, p.milage);
  set(COL.DESCRIPTION, p.remainingDescription);
  set(COL.PRICE, null);
  set(COL.CHASSIS, src.chassis);
  set(COL.LOCATION, src.location);
  set(COL.STATUS, 'IN STOCK');
  set(COL.SUPPLIER, null);
  set(COL.LONG_DESCRIPTION, null);
  set(COL.COSTING_PRICE, src.price);
  set(COL.PRICE_DOLLAR, null);
  set(COL.PRICE_BDT, null);
  set(COL.DUTY, null);
  set(COL.DRIVER_CNF, null);
  set(COL.ADDITIONAL_COST, null);
  set(COL.PICTURE_DRIVE, null);
  set(COL.UPLOADED_LINK, null);
  set(COL.SOURCE_SHEET, `STOCK LIST (${asOfDateStr})`);

  cells.get(COL.COSTING_PRICE)!.style.numFmt = '0.00';
  cells.get(COL.PRICE)!.style.fill = { type: 'pattern', pattern: 'none' };

  // Chassis colour is the user's own workflow marker (green = confirmed, blue = pending).
  // A newly added car always lands on the default BLUE fill; the user re-colours it manually.
  const chassisCell = cells.get(COL.CHASSIS)!;
  chassisCell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BLUE_CHASSIS } };

  const imgCell = cells.get(COL.IMAGE!)!;
  if (src.imageHyperlink) {
    imgCell.value = src.imageText || 'PHOTO';
    imgCell.hyperlink = src.imageHyperlink;
    imgCell.hyperlinkText = src.imageText || 'PHOTO';
  } else {
    imgCell.value = null;
    imgCell.hyperlink = undefined;
  }

  const row: SheetRow = {
    key: src.chassis,
    carName: src.carName,
    status: 'IN STOCK',
    section: 'IN_STOCK',
    height: template.height,
    cells,
    isNew: true,
  };

  const record: NewCarRecord = {
    key: src.chassis,
    carName: src.carName,
    year,
    price: src.price,
    grade: p.grade,
    color: p.color,
    point: p.point,
    milage: p.milage,
    location: src.location,
    status: 'IN STOCK',
    sourceSheetTag: `STOCK LIST (${asOfDateStr})`,
  };

  return { row, record };
}

export async function reconcileBDStock(
  customizedFile: File | ArrayBuffer,
  sourceFile: File | ArrayBuffer,
  asOfDate: Date | string,
  onProgress?: (msg: string) => void,
  design: SheetDesign = 'classic',
): Promise<ReconciliationSummary> {
  const cfg: WorkflowConfig = {
    mode: 'BD',
    targetSheetNames: [
      'BD STOCK',
      'BD_STOCK',
      'BD-STOCK',
      'BD STOCK MASTER',
      'BD MASTER',
      'MASTER',
      'Sheet1',
      'SHEET1',
    ],
    sourceSheetNames: [
      'BD_STOCK_LIST',
      'BD STOCK LIST',
      'BD-STOCK-LIST',
      'STOCK LIST',
      'STOCK_LIST',
      'STOCK',
      'BD STOCK',
      'BD_STOCK',
      'Sheet1',
      'SHEET1',
      'Sheet 1',
      'Cars',
      'Car List',
      'Data',
    ],
    totalCols: 24,
    order: BD_ORDER,
    keyCol: (COL) => COL.CHASSIS,
    labelDefaultText: "BD STOCK OUT LISTING CAR'S",
    outputFilenamePrefix: 'BD_Update_Customized_Sheet',
    resolveColumns,
    detectSourceHeader,
    parseSourceRows: (ws, m, h) => parseSourceRows(ws, m, h),
    refreshMatched,
    buildNewRow,
    inStockUsesFormulaChain: false,
    orderInStockBySource: true,   // IN STOCK follows the new BD stock list's order and groups
  };
  return reconcileCore(customizedFile, sourceFile, asOfDate, cfg, onProgress, design);
}
