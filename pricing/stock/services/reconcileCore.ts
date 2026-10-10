import type {
  CarGroup,
  CellData,
  FieldChange,
  NewCarRecord,
  ReconciliationSummary,
  SheetRow,
  StockOutCarRecord,
  UpdatedCarRecord,
  Mode,
} from '../types';
import { readNotesFromXlsx, noteFor, type NoteMap } from '../utils/noteReader';
import { applySheetLayout, carRowHeight } from '../utils/excelHelpers';
import { applySheetDesign, type LaidRow, type SheetDesign } from '../utils/sheetDesign';
import {
  COLORS,
  applyCellStyle,
  cloneCellStyle,
  colNumberToLetter,
  extractCellValue,
  findWorksheet,
  formatDateForTag,
  getExcelJS,
  normalizeKey,
  retargetFormula,
  stripEquals,
  toNumber,
} from '../utils/excelHelpers';

/* ------------------------------------------------------------------ *
 * Column map shared by both workflows (BD = 24 cols, Japan = 23 cols) *
 * ------------------------------------------------------------------ */
export interface ColMap {
  SL_NO: number; CAR_NAME: number; GRADE: number; YEAR: number; COLOR: number;
  POINT: number; MILAGE: number; DESCRIPTION: number; PRICE: number; CHASSIS: number;
  LOCATION: number; STATUS: number; SUPPLIER: number; LONG_DESCRIPTION: number;
  COSTING_PRICE: number; PRICE_DOLLAR: number; PRICE_BDT: number; DUTY: number;
  DRIVER_CNF: number; ADDITIONAL_COST: number; PICTURE_DRIVE: number; UPLOADED_LINK: number;
  IMAGE?: number; SOURCE_SHEET: number;
}

export interface CoreContext {
  COL: ColMap;
  asOfDateStr: string;
  warnings: string[];
}

/** A parsed source record. Concrete workflows populate the fields they use. */
export interface SourceRecord {
  key: string;
  carName: string;
  rowNumber: number;
  [k: string]: any;
}

export interface WorkflowConfig {
  mode: Mode;
  targetSheetNames: string[];
  sourceSheetNames: string[];
  totalCols: number;
  keyCol: (COL: ColMap) => number;         // which customized-sheet column is the match key
  labelDefaultText: string;
  outputFilenamePrefix: string;

  resolveColumns: (customColMap: Record<string, number>) => ColMap;
  detectSourceHeader: (ws: any) => { headerRowIdx: number; sourceColMap: Record<string, number> };
  parseSourceRows: (ws: any, sourceColMap: Record<string, number>, headerRowIdx: number, ctx: CoreContext) => SourceRecord[];

  /** Refresh an existing matched row in place. Return the list of field changes. */
  refreshMatched: (row: SheetRow, src: SourceRecord, ctx: CoreContext) => FieldChange[];
  /** Build a brand-new row from a source record, cloning the template row's styles. */
  buildNewRow: (src: SourceRecord, template: SheetRow, ctx: CoreContext) => { row: SheetRow; record: NewCarRecord };

  /** IN-STOCK rows carry the live Q/O/I formula chain (Japan = true, BD = false). */
  inStockUsesFormulaChain: boolean;

  /**
   * When true the IN-STOCK section follows the new source list exactly: the list's first car
   * becomes the sheet's first car, and groups are the list's consecutive runs of one car name
   * (a separator after each). STOCK-OUT keeps its own order. Used by the BD workflow.
   */
  orderInStockBySource?: boolean;

  /**
   * Identity fingerprint (Mileage + Year + Colour + Point). Supplied by workflows whose key
   * is NOT a stable identity — Japan's SL NO can be renumbered by the supplier, so the car's
   * own attributes take priority over the SL when deciding "is this the same car?".
   * Return null when any component is missing (then the key is used, with a warning).
   */
  sourceFingerprint?: (s: SourceRecord) => string | null;
  rowFingerprint?: (row: SheetRow, COL: ColMap) => string | null;
}

const DEFAULT_FONT = { name: 'Oswald', size: 11 };

/* Build a blank cell with clean default styling. */
function blankCell(colIndex: number): CellData {
  return {
    colIndex,
    colLetter: colNumberToLetter(colIndex),
    value: null,
    style: {},
  };
}

/* Clone the visual style of a template cell into a fresh CellData (no value). */
export function cellFromTemplate(template: CellData | undefined, colIndex: number): CellData {
  const c = blankCell(colIndex);
  if (template && template.style) {
    c.style = JSON.parse(JSON.stringify(template.style));
  }
  return c;
}

export async function reconcileCore(
  customizedFile: File | ArrayBuffer,
  sourceFile: File | ArrayBuffer,
  asOfDate: Date | string,
  cfg: WorkflowConfig,
  onProgress?: (msg: string) => void,
  design: SheetDesign = 'classic',
): Promise<ReconciliationSummary> {
  const ExcelJS = await getExcelJS();
  const asOfDateStr = formatDateForTag(asOfDate);
  const warnings: string[] = [];

  onProgress?.('Loading Excel workbooks into memory…');

  const customBuf: ArrayBuffer = customizedFile instanceof File ? await customizedFile.arrayBuffer() : (customizedFile as ArrayBuffer);
  const wbCustom = new ExcelJS.Workbook();
  await wbCustom.xlsx.load(customBuf);
  // ExcelJS drops note TEXT on load — read the real notes straight from the xlsx parts
  let realNotes: NoteMap | null = null;
  try { realNotes = await readNotesFromXlsx(customBuf); } catch { realNotes = null; }

  const wsCustom = findWorksheet(wbCustom, {
    preferredNames: cfg.targetSheetNames,
    kind: 'customized',
    mode: cfg.mode,
  });
  if (!wsCustom) {
    const available = (wbCustom.worksheets || []).map((w: any) => `"${w.name}"`).join(', ');
    throw new Error(
      'Could not locate the target worksheet in the customized workbook.' +
      (available ? ` Found sheets: [${available}].` : ' Workbook appears empty.')
    );
  }

  const wbSource = new ExcelJS.Workbook();
  await wbSource.xlsx.load(
    sourceFile instanceof File ? await sourceFile.arrayBuffer() : sourceFile
  );
  const wsSource = findWorksheet(wbSource, {
    preferredNames: cfg.sourceSheetNames,
    kind: 'source',
    mode: cfg.mode,
  });
  if (!wsSource) {
    const available = (wbSource.worksheets || []).map((w: any) => `"${w.name}"`).join(', ');
    throw new Error(
      'Could not locate the stock-list worksheet in the source file.' +
      (available ? ` Found sheets: [${available}].` : ' Workbook appears empty.')
    );
  }

  onProgress?.('Scanning header rows and columns…');

  /* ---- detect customized-sheet header row + column map ---- */
  let customHeaderRowIdx = -1;
  const customColMap: Record<string, number> = {};
  for (let r = 1; r <= 15; r++) {
    const row = wsCustom.getRow(r);
    let hasSL = false, hasCarName = false, hasChassis = false;
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      const val = String(cell.value || '').trim().toUpperCase();
      if (val === 'SL NO' || val === 'SL' || val === 'SL.') hasSL = true;
      if (val.includes('CAR NAME') || val === 'NAME') hasCarName = true;
      if (val.includes('CHASSIS')) hasChassis = true;
    });
    if (hasCarName && (hasSL || hasChassis)) {
      customHeaderRowIdx = r;
      row.eachCell({ includeEmpty: false }, (cell: any, colNum: number) => {
        const val = String(cell.value || '').trim().toUpperCase();
        if (val) customColMap[val] = colNum;
      });
      break;
    }
  }
  if (customHeaderRowIdx === -1) {
    warnings.push('Could not detect the header row in the customized sheet; defaulting to row 4.');
    customHeaderRowIdx = 4;
  }

  // Guard against a swapped upload: the master tracker always has STATUS + COSTING PRICE
  // columns; the flat stock list does not. If neither is present, the wrong file was dropped
  // into the "Current Customized Sheet" slot.
  const hasStatusCol = Object.keys(customColMap).some((k) => k.includes('STATUS'));
  const hasCostingCol = Object.keys(customColMap).some(
    (k) => k.includes('COSTING') || k.includes('PRICE (BDT)') || k.includes('DUTY') || k.includes('DRIVER')
  );
  if (!hasStatusCol && !hasCostingCol) {
    throw new Error(
      'The "Current Customized Sheet" slot does not look like your master tracker ' +
      '(no STATUS or COSTING PRICE columns were found). It may be the flat New Stock List — ' +
      'please check that the two upload slots are not swapped.'
    );
  }

  const COL = cfg.resolveColumns(customColMap);
  const TOTAL_COLS = cfg.totalCols;
  const ctx: CoreContext = { COL, asOfDateStr, warnings };

  /* ---- source header + rows ---- */
  const { headerRowIdx: sourceHeaderRowIdx, sourceColMap } = cfg.detectSourceHeader(wsSource);
  onProgress?.('Parsing new source stock records…');
  const sourceRows = cfg.parseSourceRows(wsSource, sourceColMap, sourceHeaderRowIdx, ctx);

  onProgress?.('Analyzing customized sheet groups & sections…');

  // Pre-flight sanity check on the SOURCE list (guards against swapped/empty files).
  if (!sourceRows || sourceRows.length === 0) {
    throw new Error(
      `No stock records were found in the New Stock List. Please confirm you uploaded the correct ` +
      `${cfg.mode === 'BD' ? 'BD_STOCK_LIST' : 'supplier (RAITA-style MY STOCK LIST)'} file, and that it has a ` +
      `header row containing ${cfg.mode === 'BD' ? '"CHASSIS" and "NAME"' : '"SL NO" and "CAR NAME"'}.`
    );
  }


  /* ---- locate label row (IN/OUT divider) ---- */
  let labelRowIdx = -1;
  const captured = {
    labelText: cfg.labelDefaultText,
    labelHeight: 29.25,
    labelFont: undefined as any,
    labelFill: undefined as any,
    labelAlignment: undefined as any,
    labelSpan: 9,
    sepFills: [] as any[],
    sepHeight: 14.25,   // fixed for every workflow
    gapCount: 0,
    gapHeight: 24,
  };

  const fillHexOf = (cell: any): string | null => {
    const fill = cell.fill as any;
    return fill?.fgColor?.argb || fill?.bgColor?.argb || null;
  };

  for (let r = customHeaderRowIdx + 1; r <= wsCustom.rowCount; r++) {
    const row = wsCustom.getRow(r);
    const cellA = row.getCell(1);
    const textVal = String(cellA.value || '').trim().toUpperCase();
    const fillHex = fillHexOf(cellA);
    if (textVal.includes('STOCK OUT') || textVal.includes('LISTING CAR')) {
      labelRowIdx = r;
      captured.labelText = String(cellA.value || '').trim() || captured.labelText;
      if (row.height) captured.labelHeight = row.height;
      captured.labelFont = cellA.font ? JSON.parse(JSON.stringify(cellA.font)) : undefined;
      captured.labelFill = cellA.fill ? JSON.parse(JSON.stringify(cellA.fill)) : undefined;
      captured.labelAlignment = cellA.alignment ? JSON.parse(JSON.stringify(cellA.alignment)) : undefined;
      // detect merge span for the label
      const merges: string[] = (wsCustom as any).model?.merges || [];
      for (const m of merges) {
        const mm = m.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (mm && parseInt(mm[2], 10) === r) {
          captured.labelSpan = mm[3].split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0);
        }
      }
      break;
    }
    // secondary detection by distinct red label fill
    if (fillHex && fillHex.toUpperCase().includes('E2062B')) {
      labelRowIdx = r;
      captured.labelText = String(cellA.value || '').trim() || captured.labelText;
      if (row.height) captured.labelHeight = row.height;
      captured.labelFont = cellA.font ? JSON.parse(JSON.stringify(cellA.font)) : undefined;
      captured.labelFill = cellA.fill ? JSON.parse(JSON.stringify(cellA.fill)) : undefined;
      captured.labelAlignment = cellA.alignment ? JSON.parse(JSON.stringify(cellA.alignment)) : undefined;
      break;
    }
  }

  const isSeparatorRow = (row: any): boolean => {
    let hasTeal = false, hasContent = false;
    for (let c = 1; c <= Math.min(6, TOTAL_COLS); c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (v !== null && v !== undefined && String(v).trim() !== '') hasContent = true;
      const fillHex = fillHexOf(cell);
      // teal in the classic design, black in the Brand design
      if (fillHex && /31859B|111111/.test(fillHex.toUpperCase())) hasTeal = true;
    }
    return hasTeal && !hasContent;
  };

  const captureSeparatorStyle = (row: any) => {
    if (captured.sepFills.length) return;
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const f = row.getCell(c).fill;
      captured.sepFills.push(f ? JSON.parse(JSON.stringify(f)) : { type: 'pattern', pattern: 'none' });
    }
    // Separator height is fixed at 14.25 for BD, Japan and Combined alike — do NOT
    // inherit the uploaded sheet's height (Japan sheets carry 24, which looks too thick).
    // (row height intentionally not copied here)
  };

  /* ---- read a data row into the model, capturing full per-cell style ---- */
  const keyCol = cfg.keyCol(COL);
  const readSheetRow = (row: any, rowNum: number, section: 'IN_STOCK' | 'STOCK_OUT'): SheetRow => {
    const cells = new Map<number, CellData>();
    let keyVal = '', carNameVal = '', statusVal = '';
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = row.getCell(c);
      const ext = extractCellValue(cell);
      const style = cloneCellStyle(cell);
      if (c === keyCol) keyVal = normalizeKey(ext.value).toUpperCase();
      if (c === COL.CAR_NAME) carNameVal = String(ext.value || '').trim();
      if (c === COL.STATUS) statusVal = String(ext.value || '').trim();
      cells.set(c, {
        colIndex: c,
        colLetter: colNumberToLetter(c),
        value: ext.value,
        formula: ext.formula ? stripEquals(ext.formula) : undefined,
        hyperlink: ext.hyperlink,
        hyperlinkText: ext.hyperlinkText,
        style,
        note: (() => {
          const real = noteFor(realNotes, wsCustom.name, `${colNumberToLetter(c)}${rowNum}`);
          if (real) return real;
          if (!cell.note) return undefined;
          if (typeof cell.note === 'string') return cell.note;
          if (cell.note.texts) { const t = cell.note.texts.map((x: any) => x.text).join(''); return t || undefined; }
          return undefined;
        })(),
      });
    }
    return {
      key: keyVal,
      carName: carNameVal || 'UNKNOWN',
      status: statusVal || (section === 'IN_STOCK' ? 'IN STOCK' : 'STOCK OUT'),
      section,
      originalRowNumber: rowNum,
      height: row.height,
      cells,
    };
  };

  /* ---- parse groups for a section ---- */
  const parseSection = (lo: number, hi: number, section: 'IN_STOCK' | 'STOCK_OUT'): { groups: CarGroup[]; gapCount: number } => {
    const groups: CarGroup[] = [];
    let cur: SheetRow[] = [];
    let curName = '';
    let gapCount = 0;
    for (let r = lo; r <= hi; r++) {
      const row = wsCustom.getRow(r);
      if (isSeparatorRow(row)) {
        captureSeparatorStyle(row);
        if (cur.length) { groups.push({ carName: curName || cur[0].carName, section, rows: cur }); cur = []; curName = ''; }
        continue;
      }
      // blank (gap) row?
      let blank = true;
      for (let c = 1; c <= 10; c++) {
        const v = row.getCell(c).value;
        if (v !== null && v !== undefined && String(v).trim() !== '') { blank = false; break; }
      }
      if (blank) { gapCount++; continue; }
      const sr = readSheetRow(row, r, section);
      if (sr.key || (sr.carName && sr.carName !== 'UNKNOWN')) {
        cur.push(sr);
        if (!curName && sr.carName) curName = sr.carName;
      }
    }
    if (cur.length) groups.push({ carName: curName || cur[0].carName, section, rows: cur });
    return { groups, gapCount };
  };

  const inStockEnd = labelRowIdx > 0 ? labelRowIdx - 1 : wsCustom.rowCount;
  const inParsed = parseSection(customHeaderRowIdx + 1, inStockEnd, 'IN_STOCK');
  let inStockGroups = inParsed.groups;
  captured.gapCount = Math.max(0, inParsed.gapCount);

  let stockOutGroups: CarGroup[] = [];
  if (labelRowIdx > 0) {
    stockOutGroups = parseSection(labelRowIdx + 1, wsCustom.rowCount, 'STOCK_OUT').groups;
  }

  // Pre-flight sanity check on the CUSTOMIZED master (guards against swapped files).
  if (inStockGroups.length === 0 && stockOutGroups.length === 0) {
    throw new Error(
      'No car rows were found in the Current Customized Sheet. Please confirm you uploaded the correct ' +
      `master workbook (the ${cfg.mode === 'BD' ? '"BD STOCK"' : '"JAPAN STOCK"'} tracker with IN STOCK / STOCK OUT sections), ` +
      'and that the two upload slots are not swapped.'
    );
  }

  // representative template row for brand-new groups (first IN-STOCK data row).
  // Deep-snapshot it NOW — the classification loop below may relocate this very row
  // (painting its name cell red/white), which must not leak into cloned new rows.
  const cloneRowSnapshot = (row: SheetRow | undefined): SheetRow | undefined => {
    if (!row) return undefined;
    const cells = new Map<number, CellData>();
    row.cells.forEach((cd, c) => {
      cells.set(c, { ...cd, style: cd.style ? JSON.parse(JSON.stringify(cd.style)) : {} });
    });
    return { ...row, cells };
  };
  const representativeRow: SheetRow | undefined = cloneRowSnapshot(inStockGroups[0]?.rows[0]);

  onProgress?.(`Reconciling ${cfg.mode} records (New / Matched / Stock-out)…`);

  /* ---- lookup maps + classification ---- */
  const sourceMap = new Map<string, SourceRecord>();
  for (const s of sourceRows) if (s.key) sourceMap.set(s.key, s);

  const inStockKeys = new Set<string>();
  for (const g of inStockGroups) for (const row of g.rows) if (row.key) inStockKeys.add(row.key);
  const stockOutKeys = new Set<string>();
  for (const g of stockOutGroups) for (const row of g.rows) if (row.key) stockOutKeys.add(row.key);

  // "returned" cars: present in source but currently only in the stock-out section
  const returnedKeys: string[] = [];
  for (const s of sourceRows) {
    if (s.key && !inStockKeys.has(s.key) && stockOutKeys.has(s.key)) returnedKeys.push(s.key);
  }
  if (returnedKeys.length) {
    warnings.push(
      `${returnedKeys.length} car(s) appear in the new stock list but are currently in the STOCK-OUT section ` +
      `(${returnedKeys.slice(0, 8).join(', ')}${returnedKeys.length > 8 ? '…' : ''}). ` +
      `They were left in STOCK-OUT untouched — move them back to IN STOCK manually if they have returned.`
    );
  }

  const newCars: NewCarRecord[] = [];
  const updatedCars: UpdatedCarRecord[] = [];
  const stockOutCars: StockOutCarRecord[] = [];

  /* ---- 0. pair IN-STOCK rows with source rows ----
   * With a fingerprint (Japan): the car's own attributes outrank the SL, so a renumbered car
   * is still recognised, and an SL reused by a different car never merges two cars together.
   * Without one (BD): the chassis is a true identity, so plain key equality is used.
   */
  const useFp = !!(cfg.sourceFingerprint && cfg.rowFingerprint);
  const inRows: SheetRow[] = [];
  for (const g of inStockGroups) for (const r of g.rows) inRows.push(r);

  const pairOf = new Map<SheetRow, SourceRecord>();
  const usedSources = new Set<SourceRecord>();
  const slChanged: string[] = [];
  const slReused: string[] = [];
  const looseMatched: string[] = [];

  if (useFp) {
    const srcFp = new Map<SourceRecord, string | null>();
    for (const sr of sourceRows) srcFp.set(sr, cfg.sourceFingerprint!(sr));
    const rowFp = new Map<SheetRow, string | null>();
    for (const r of inRows) rowFp.set(r, cfg.rowFingerprint!(r, COL));

    // Pass A — SL and fingerprint both agree (the clean case)
    for (const r of inRows) {
      const fp = rowFp.get(r);
      if (!fp || !r.key) continue;
      for (const sr of sourceRows) {
        if (usedSources.has(sr)) continue;
        if (sr.key === r.key && srcFp.get(sr) === fp) { pairOf.set(r, sr); usedSources.add(sr); break; }
      }
    }
    // Pass B — same car, different SL (supplier renumbered it)
    for (const r of inRows) {
      if (pairOf.has(r)) continue;
      const fp = rowFp.get(r);
      if (!fp) continue;
      const cands = sourceRows.filter((sr) => !usedSources.has(sr) && srcFp.get(sr) === fp);
      if (cands.length === 1) {
        pairOf.set(r, cands[0]); usedSources.add(cands[0]);
        slChanged.push(`${r.key || '?'} → ${cands[0].key || '?'}`);
      }
    }
    // Pass C — SL matches but the car is different, or the fingerprint is incomplete
    for (const r of inRows) {
      if (pairOf.has(r)) continue;
      if (!r.key) continue;
      const sr = sourceRows.find((x) => !usedSources.has(x) && x.key === r.key);
      if (!sr) continue;
      const a = rowFp.get(r), b = srcFp.get(sr);
      if (a && b && a !== b) { slReused.push(r.key); continue; }   // different car — never merge
      pairOf.set(r, sr); usedSources.add(sr);                      // incomplete data — key only
      looseMatched.push(r.key);
    }
  } else {
    for (const r of inRows) {
      if (!r.key) continue;
      const sr = sourceMap.get(r.key);
      if (sr && !usedSources.has(sr)) { pairOf.set(r, sr); usedSources.add(sr); }
    }
  }

  if (slChanged.length) {
    warnings.push(
      `${slChanged.length} car(s) kept their identity but were renumbered in the new list ` +
      `(${slChanged.slice(0, 8).join(', ')}${slChanged.length > 8 ? '…' : ''}). ` +
      `Matched on Mileage + Year + Colour + Point, and the SL was updated to the new list's number.`
    );
  }
  if (slReused.length) {
    warnings.push(
      `${slReused.length} SL number(s) now belong to a DIFFERENT car in the new list ` +
      `(${slReused.slice(0, 8).join(', ')}${slReused.length > 8 ? '…' : ''}). ` +
      `Nothing was merged: the old car moved to STOCK-OUT keeping its own serial, and the new car was added separately.`
    );
  }
  if (looseMatched.length) {
    warnings.push(
      `${looseMatched.length} car(s) were matched by SL alone because Mileage/Year/Colour/Point were incomplete ` +
      `(${looseMatched.slice(0, 8).join(', ')}${looseMatched.length > 8 ? '…' : ''}) — please verify these rows.`
    );
  }

  /* ---- 1. matched refresh vs stock-out relocation ---- */
  const rowsToMoveToStockOut: SheetRow[] = [];
  for (const group of inStockGroups) {
    const remaining: SheetRow[] = [];
    for (const row of group.rows) {
      const key = row.key;
      const paired = pairOf.get(row);
      if (!key && !paired) { remaining.push(row); continue; }
      if (paired) {
        const changes = cfg.refreshMatched(row, paired, ctx);
        if (changes.length) {
          updatedCars.push({
            key: key || paired.key, carName: row.carName, changes,
            formulasRebuilt: cfg.inStockUsesFormulaChain ? ['PRICE (BDT)', 'COSTING PRICE', 'PRICE'] : undefined,
          });
        }
        remaining.push(row);
      } else {
        // relocate to stock-out
        row.section = 'STOCK_OUT';
        row.status = 'STOCK OUT';
        row.isRelocatedToStockOut = true;
        const statusCell = row.cells.get(COL.STATUS);
        if (statusCell) statusCell.value = 'STOCK OUT';
        const nameCell = row.cells.get(COL.CAR_NAME);
        if (nameCell) {
          nameCell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_HIGHLIGHT } };
          const prevFont = nameCell.style.font || {};
          nameCell.style.font = {
            ...prevFont,
            name: prevFont.name || 'Oswald',
            size: prevFont.size || 11,
            color: { argb: COLORS.WHITE_TEXT },
          };
        }
        stockOutCars.push({ key: key || '', carName: row.carName, groupName: group.carName, previousSection: 'IN STOCK' });
        rowsToMoveToStockOut.push(row);
      }
    }
    group.rows = remaining;
  }
  inStockGroups = inStockGroups.filter((g) => g.rows.length > 0);

  /* ---- 2. build & place new rows ---- */
  const newRowBySource = new Map<SourceRecord, SheetRow>();
  const findGroup = (groups: CarGroup[], name: string): CarGroup | null => {
    const target = name.trim().toUpperCase();
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].carName.trim().toUpperCase() === target) return groups[i];
    }
    return null;
  };

  const addedNewKeys = new Set<string>();
  const duplicateSourceKeys: string[] = [];
  const reappeared: string[] = [];

  /** A car that is in the STOCK-OUT section but shows up again in the new list. */
  const flagReappearedStockOut = (sr: SourceRecord) => {
    if (!useFp) return;
    const fp = cfg.sourceFingerprint!(sr);
    if (!fp) return;
    for (const g of stockOutGroups) {
      for (const row of g.rows) {
        if (cfg.rowFingerprint!(row, COL) !== fp) continue;
        // paint the whole stock-out row red so it is obvious this unit is listed again
        row.cells.forEach((cd) => {
          if (cd) cd.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_HIGHLIGHT } };
        });
        const chCell = row.cells.get(COL.CHASSIS);
        if (chCell) {
          const note = `This car appears again in the new stock list (SL ${sr.key}) — verify whether it really returned.`;
          chCell.note = chCell.note ? `${chCell.note}\n${note}` : note;
        }
        reappeared.push(`${row.key || '?'} → SL ${sr.key}`);
        return;
      }
    }
  };

  for (const s of sourceRows) {
    if (!s.key) continue;
    if (usedSources.has(s)) continue;                     // already paired with an IN-STOCK row
    if (!useFp && stockOutKeys.has(s.key)) continue;      // BD: key already sits in STOCK-OUT
    if (addedNewKeys.has(s.key) && !useFp) { duplicateSourceKeys.push(s.key); continue; }
    addedNewKeys.add(s.key);
    flagReappearedStockOut(s);
    // template = last row of matching IN group, else representative row
    const matchGroup = findGroup(inStockGroups, s.carName);
    const template = (matchGroup && matchGroup.rows[matchGroup.rows.length - 1]) || representativeRow;
    if (!template) {
      warnings.push(`No template row available to build new car ${s.key}; skipped.`);
      continue;
    }
    const { row: newRow, record } = cfg.buildNewRow(s, template, ctx);
    newRowBySource.set(s, newRow);
    // A brand-new car is always IN STOCK — guarantee its name cell never carries
    // the stock-out red fill / white font (which a relocated fallback template could carry).
    const nameCd = newRow.cells.get(COL.CAR_NAME);
    if (nameCd) {
      const fillArgb = nameCd.style?.fill?.fgColor?.argb;
      if (fillArgb === COLORS.RED_HIGHLIGHT) nameCd.style.fill = { type: 'pattern', pattern: 'none' };
      if (nameCd.style?.font?.color?.argb === COLORS.WHITE_TEXT) {
        nameCd.style.font = { ...nameCd.style.font, color: { argb: COLORS.CHARCOAL_TEXT } };
      }
    }
    const g = findGroup(inStockGroups, s.carName);
    if (g) g.rows.push(newRow);
    else inStockGroups.push({ carName: s.carName, section: 'IN_STOCK', rows: [newRow] });
    newCars.push(record);
  }

  if (reappeared.length) {
    warnings.push(
      `${reappeared.length} car(s) in the new stock list are already sitting in the STOCK-OUT section ` +
      `(${reappeared.slice(0, 8).join(', ')}${reappeared.length > 8 ? '…' : ''}). ` +
      `Those STOCK-OUT rows were highlighted in red and the car was added to IN STOCK from the new list — check which copy you want to keep.`
    );
  }
  if (duplicateSourceKeys.length) {
    const uniq = Array.from(new Set(duplicateSourceKeys));
    warnings.push(
      `${uniq.length} ${cfg.mode === 'BD' ? 'chassis number' : 'SL number'}(s) appeared more than once in the New Stock List ` +
      `(${uniq.slice(0, 8).join(', ')}${uniq.length > 8 ? '…' : ''}). Each was added only once — please check the source list for duplicate data-entry.`
    );
  }

  /* ---- 3. insert relocated rows into stock-out groups ---- */
  for (const moved of rowsToMoveToStockOut) {
    const g = findGroup(stockOutGroups, moved.carName);
    if (g) g.rows.push(moved);
    else stockOutGroups.push({ carName: moved.carName, section: 'STOCK_OUT', rows: [moved] });
  }

  onProgress?.('Rebuilding sheet, applying styles, retargeting & recalculating formulas…');

  /* ---- 4. (optional) IN STOCK follows the new source list's order and grouping ---- */
  if (cfg.orderInStockBySource) {
    const rowBySource = new Map<SourceRecord, SheetRow>();
    for (const [row, src] of pairOf) if (row.section === 'IN_STOCK') rowBySource.set(src, row);
    for (const [src, row] of newRowBySource) rowBySource.set(src, row);
    const sameName = (a: string, b: string) => (a || '').trim().toUpperCase() === (b || '').trim().toUpperCase();
    const placed = new Set<SheetRow>();
    const ordered: CarGroup[] = [];
    let current: CarGroup | null = null;
    for (const src of sourceRows) {                       // top to bottom, exactly as listed
      const row = rowBySource.get(src);
      if (!row || placed.has(row)) continue;
      placed.add(row);
      if (current && sameName(current.carName, src.carName)) current.rows.push(row);
      else { current = { carName: src.carName, section: 'IN_STOCK', rows: [row] }; ordered.push(current); }
    }
    // Anything still IN STOCK that is not on the list (e.g. a row with no chassis) stays, at the end.
    const leftovers: SheetRow[] = [];
    for (const g of inStockGroups) for (const row of g.rows) if (!placed.has(row)) leftovers.push(row);
    let tail: CarGroup | null = null;
    for (const row of leftovers) {
      if (tail && sameName(tail.carName, row.carName)) tail.rows.push(row);
      else { tail = { carName: row.carName, section: 'IN_STOCK', rows: [row] }; ordered.push(tail); }
    }
    if (leftovers.length) {
      warnings.push(
        `${leftovers.length} IN-STOCK row(s) are not on the new stock list (for example a blank chassis) ` +
        `and were kept at the end of IN STOCK.`
      );
    }
    inStockGroups = ordered;
  }

  /* ================= RENDER ================= */

  // unmerge everything below the header
  const merges: string[] = ((wsCustom as any).model?.merges || []).slice();
  for (const m of merges) {
    const mm = m.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
    if (mm && parseInt(mm[1], 10) > customHeaderRowIdx) {
      try { wsCustom.unMergeCells(m); } catch { /* ignore */ }
    }
  }

  const oldMaxRow = wsCustom.rowCount;

  // hard-reset a physical cell to a clean slate (prevents stale style/value/note leakage)
  const resetCell = (cell: any) => {
    cell.value = null;
    try { if (cell.note) cell.note = undefined as any; } catch { /* ignore */ }
    cell.style = {
      font: { ...DEFAULT_FONT },
      fill: { type: 'pattern', pattern: 'none' },
      border: {},
      alignment: {},
      numFmt: 'General',
    };
  };

  // wipe the whole data range first
  for (let r = customHeaderRowIdx + 1; r <= oldMaxRow + 2; r++) {
    const row = wsCustom.getRow(r);
    for (let c = 1; c <= TOTAL_COLS; c++) resetCell(row.getCell(c));
    row.height = undefined as any;
  }

  const num = (m: Map<number, CellData>, col: number, fallback: number): number => {
    const cd = m.get(col);
    if (!cd) return fallback;
    if (cd.formula) return fallback; // resolved separately in the chain
    return toNumber(cd.value);
  };

  // compute the Q/O/I chain results (same math LibreOffice would produce)
  const computeChain = (cells: Map<number, CellData>): Record<number, number> => {
    const res: Record<number, number> = {};
    const P = num(cells, COL.PRICE_DOLLAR, 0);
    let Q = num(cells, COL.PRICE_BDT, 0);
    if (cells.get(COL.PRICE_BDT)?.formula) { Q = P * 127; res[COL.PRICE_BDT] = Q; }
    let O = num(cells, COL.COSTING_PRICE, 0);
    if (cells.get(COL.COSTING_PRICE)?.formula) {
      O = Q + num(cells, COL.DUTY, 0) + num(cells, COL.DRIVER_CNF, 0);
      res[COL.COSTING_PRICE] = O;
    }
    if (cells.get(COL.PRICE)?.formula) {
      res[COL.PRICE] = O + num(cells, COL.ADDITIONAL_COST, 0);
    }
    return res;
  };

  let currentRow = customHeaderRowIdx + 1;
  // what each written row is, for the Excel design step at the end
  const laid: LaidRow[] = [];
  const origin = cfg.mode === 'JAPAN' ? 'JP' : 'BD';

  const writeRow = (rowObj: SheetRow) => {
    laid.push({ row: currentRow, kind: 'car', origin });
    const excelRow = wsCustom.getRow(currentRow);
    // a car row is as tall as its own DESCRIPTION needs, not the height it had in the master
    const descCell = rowObj.cells.get(COL.DESCRIPTION);
    excelRow.height = carRowHeight(
      descCell?.value,
      descCell?.style?.font?.name || 'Oswald',
      descCell?.style?.font?.size || 11,
    );
    const oldRowNum = rowObj.originalRowNumber;
    const chain = computeChain(rowObj.cells);

    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cd = rowObj.cells.get(c);
      const cell = excelRow.getCell(c);
      if (!cd) continue;

      if (cd.formula) {
        let f = cd.formula;
        // formulas produced by builders contain the literal {r} placeholder
        if (f.includes('{r}')) f = f.replace(/\{r\}/g, String(currentRow));
        else if (oldRowNum) f = retargetFormula(f, oldRowNum, currentRow);
        const result = chain[c];
        cell.value = result !== undefined ? { formula: f, result } : { formula: f };
      } else if (cd.hyperlink) {
        cell.value = { text: cd.hyperlinkText || String(cd.value ?? 'PHOTO'), hyperlink: cd.hyperlink };
      } else {
        cell.value = cd.value === undefined ? null : cd.value;
      }

      applyCellStyle(cell, cd.style);
      if (cd.note) cell.note = cd.note;
    }
    currentRow++;
  };

  const writeSeparator = () => {
    laid.push({ row: currentRow, kind: 'separator' });
    const row = wsCustom.getRow(currentRow);
    row.height = captured.sepHeight;
    // The separator bar must run the FULL width (A..X) with no column grid-lines showing,
    // regardless of how narrow it was in the uploaded file.
    const tealFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = {
        fill: JSON.parse(JSON.stringify(tealFill)),
        border: {},
        font: { ...DEFAULT_FONT },
        alignment: {},
        numFmt: 'General',
      };
    }
    // No mergeCells: ExcelJS merges corrupt neighbouring rows' fills, and a full-width
    // solid fill with no borders looks identical to a merged bar.
    currentRow++;
  };

  // IN STOCK groups
  for (const group of inStockGroups) {
    for (const row of group.rows) writeRow(row);
    writeSeparator();
  }

  // gap rows
  const gaps = captured.gapCount > 0 ? captured.gapCount : 2;
  for (let i = 0; i < gaps; i++) {
    laid.push({ row: currentRow, kind: 'gap' });
    const row = wsCustom.getRow(currentRow);
    row.height = captured.gapHeight;
    for (let c = 1; c <= TOTAL_COLS; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = { fill: { type: 'pattern', pattern: 'none' }, border: {}, font: { ...DEFAULT_FONT }, alignment: {}, numFmt: 'General' };
    }
    currentRow++;
  }

  // label row (merged A..span; fill only across the merge)
  const labelSpan = Math.min(captured.labelSpan || 9, TOTAL_COLS);
  laid.push({ row: currentRow, kind: 'stockOutTitle' });
  const labelRow = wsCustom.getRow(currentRow);
  labelRow.height = captured.labelHeight;
  const labelFill = captured.labelFill || { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_LABEL } };
  const labelFont = captured.labelFont || { name: 'Oswald', size: 14, color: { argb: COLORS.WHITE_TEXT } };
  const labelAlign = captured.labelAlignment || { vertical: 'middle', horizontal: 'center' };
  const labelCell = labelRow.getCell(1);
  labelCell.value = captured.labelText;
  labelCell.style = {
    font: JSON.parse(JSON.stringify(labelFont)),
    fill: JSON.parse(JSON.stringify(labelFill)),
    alignment: JSON.parse(JSON.stringify(labelAlign)),
    border: {},
    numFmt: 'General',
  };
  for (let c = 2; c <= labelSpan; c++) {
    const cell = labelRow.getCell(c);
    cell.value = null;
    cell.style = { fill: JSON.parse(JSON.stringify(labelFill)), font: { ...DEFAULT_FONT }, border: {}, alignment: {}, numFmt: 'General' };
  }
  try { wsCustom.mergeCells(`A${currentRow}:${colNumberToLetter(labelSpan)}${currentRow}`); } catch { /* ignore */ }
  currentRow++;

  // STOCK OUT groups (trailing separator after each, matching the source layout)
  for (const group of stockOutGroups) {
    for (const row of group.rows) writeRow(row);
    writeSeparator();
  }

  // clear any residual rows left over from a previously longer sheet
  for (let r = currentRow; r <= oldMaxRow + 2; r++) {
    const row = wsCustom.getRow(r);
    for (let c = 1; c <= TOTAL_COLS; c++) resetCell(row.getCell(c));
    row.height = undefined as any;
  }

  onProgress?.('Generating downloadable .xlsx file…');
  /* ---- final layout: column widths, header row heights, centre alignment ---- */
  applySheetLayout(wsCustom, COL as unknown as Record<string, number | undefined>, TOTAL_COLS, currentRow);
  /* ---- the chosen Excel design (Classic leaves a classic sheet exactly as written) ---- */
  applySheetDesign(design, {
    ws: wsCustom, headerRow: customHeaderRowIdx, totalCols: TOTAL_COLS, rows: laid,
    cols: {
      name: COL.CAR_NAME, description: COL.DESCRIPTION, longDescription: COL.LONG_DESCRIPTION,
      price: COL.PRICE, chassis: COL.CHASSIS, location: COL.LOCATION, status: COL.STATUS, supplier: COL.SUPPLIER,
    },
  });

  const outputBuffer = await wbCustom.xlsx.writeBuffer();
  const outputBlob = new Blob([outputBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const totalInSheet =
    inStockGroups.reduce((a, g) => a + g.rows.length, 0) +
    stockOutGroups.reduce((a, g) => a + g.rows.length, 0);

  return {
    mode: cfg.mode,
    asOfDate: asOfDateStr,
    newCount: newCars.length,
    updatedCount: updatedCars.length,
    stockOutCount: stockOutCars.length,
    totalRowsCount: totalInSheet,
    newCars,
    updatedCars,
    stockOutCars,
    warnings,
    outputBlob,
    outputFilename: `${cfg.outputFilenamePrefix}_${asOfDateStr}.xlsx`,
  };
}
