import type { CellData, ReconciliationSummary } from '../types';
import { readNotesFromXlsx, noteFor, type NoteMap } from '../utils/noteReader';
import {
  COLORS,
  getExcelJS,
  colNumberToLetter,
  extractCellValue,
  cloneCellStyle,
  applyCellStyle,
  findWorksheet,
  normalizeKey,
  formatDateForTag,
  toNumber,
  stripEquals,
  applySheetLayout,
  carRowHeight,
} from '../utils/excelHelpers';
import { applySheetDesign, type LaidRow, type SheetDesign } from '../utils/sheetDesign';
import {
  BD_ORDER, JAPAN_ORDER, columnMove, inputPositions, layoutHeaderAndTitle, moveFormula, outputPositions,
  type ColumnPositions,
} from '../utils/columnLayout';

/* ---------------- column map: the output's order (BD layout, the new column order) ---------------- */
const OUT = outputPositions(BD_ORDER) as Required<ColumnPositions>;
const COL = {
  SL: OUT.SL_NO, NAME: OUT.CAR_NAME, GRADE: OUT.GRADE, YEAR: OUT.YEAR, COLOR: OUT.COLOR, POINT: OUT.POINT,
  MILE: OUT.MILAGE, DESC: OUT.DESCRIPTION, CHASSIS: OUT.CHASSIS,
  DOLLAR: OUT.PRICE_DOLLAR, BDT: OUT.PRICE_BDT, DUTY: OUT.DUTY, CNF: OUT.DRIVER_CNF, ADDL: OUT.ADDITIONAL_COST,
  COSTING: OUT.COSTING_PRICE, PRICE: OUT.PRICE, LONGDESC: OUT.LONG_DESCRIPTION,
  LOC: OUT.LOCATION, STATUS: OUT.STATUS, SUPPLIER: OUT.SUPPLIER,
  PICTURE: OUT.PICTURE_DRIVE, UPLOADED: OUT.UPLOADED_LINK, IMAGE: OUT.IMAGE, SOURCE: OUT.SOURCE_SHEET,
};
const TOTAL = BD_ORDER.length;
const DOLLAR_COLS = [COL.DOLLAR, COL.BDT, COL.DUTY, COL.CNF, COL.ADDL];
const TEAL = COLORS.TEAL_SEPARATOR;          // FF31859B
const REDROW = COLORS.RED_HIGHLIGHT;         // FFFF0000
// text columns sit on the left, everything else in the centre
const LEFT_COLS = new Set([COL.DESC, COL.LONGDESC, COL.PICTURE, COL.IMAGE, COL.SOURCE]);
const CENTER_COLS = new Set(Object.values(COL).filter((c) => !LEFT_COLS.has(c)));

/* ---------------- normalizers (match Python route.py) ---------------- */
const nu = (v: any): string | null => {
  const x = normalizeKey(v);
  return x ? x.toUpperCase() : null;
};
const squash = (v: any): string | null => {
  const x = nu(v);
  return x ? x.replace(/[\s,]+/g, '') : null;
};
const milenum = (v: any): string | null => {
  const x = nu(v);
  if (!x) return null;
  const m = x.match(/(\d[\d,]*)/);
  return m ? m[1].replace(/,/g, '') : null;
};
const baseCode = (code: string | null): string | null => {
  if (!code) return null;
  const m = code.match(/([A-Z]+\d+)/);
  return m ? m[1] : code;
};
const CODE_RE = /^[A-Z]{2,5}\d{2,3}[A-Z]*$/;
const TRIMS = new Set(['HB', '4WD', 'DX', 'GL', 'SUGL', 'W', 'G']);
const jpWord = (name: string): string => {
  const toks = (name || '').split(/\s+/).filter((t) => t && !CODE_RE.test(t) && !TRIMS.has(t));
  return toks.join(' ');
};

/* ---------------- row model ---------------- */
interface CRow {
  origin: 'BD' | 'JP';
  rowNum: number;
  sec: 'IN' | 'OUT';
  name: string;
  year: string | null;
  color: string | null;
  point: string | null;
  mile: string | null;
  chassis: string | null;
  serial: string | null;
  height?: number;
  cells: Map<number, CellData>;
}

function fillHex(cell: any): string | null {
  const f = cell.fill;
  if (f && f.pattern === 'solid') return (f.fgColor && f.fgColor.argb) || null;
  return null;
}

/* Read a customized sheet (BD or Japan, either column order) into row models with per-cell styles.
 * Cells are kept under the output's columns; the columns are found by their header text. */
function readSheet(ws: any, ncols: number, origin: 'BD' | 'JP', notes?: NoteMap | null) {
  // header row (has CHASSIS or CAR NAME + SL NO)
  let headerRowIdx = 4;
  for (let r = 1; r <= 12; r++) {
    const row = ws.getRow(r);
    let hasName = false, hasKey = false;
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      const v = String(cell.value || '').trim().toUpperCase();
      if (v.includes('CAR NAME')) hasName = true;
      if (v.includes('CHASSIS') || v === 'SL NO') hasKey = true;
    });
    if (hasName && hasKey) { headerRowIdx = r; break; }
  }
  const headerMap: Record<string, number> = {};
  ws.getRow(headerRowIdx).eachCell({ includeEmpty: false }, (cell: any, colNum: number) => {
    const v = String(cell.value || '').trim().toUpperCase();
    if (v && !headerMap[v]) headerMap[v] = colNum;
  });
  const order = origin === 'JP' ? JAPAN_ORDER : BD_ORDER;
  const input = inputPositions(headerMap, origin === 'JP' ? 'JAPAN' : 'BD');
  const move = columnMove(input, OUT, order);
  const at = (row: any, c: number | undefined) => (c ? row.getCell(c).value : null);
  // label row (STOCK OUT ...)
  let labelRowIdx = -1;
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const t = String(ws.getRow(r).getCell(1).value || '').toUpperCase();
    if (t.includes('STOCK OUT') || t.includes('LISTING CAR')) { labelRowIdx = r; break; }
  }
  const isSep = (r: number) => {
    for (let c = 1; c <= 6; c++) {
      const v = fillHex(ws.getRow(r).getCell(c));
      // teal in the classic design, black in the Brand design
      if (v && /31859B|111111/.test(v.toUpperCase())) return true;
    }
    return false;
  };
  let last = headerRowIdx;
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let any = false;
    for (let c = 1; c <= ncols; c++) { const v = row.getCell(c).value; if (v !== null && v !== undefined && String(v).trim() !== '') { any = true; break; } }
    if (any) last = r;
  }
  const rows: CRow[] = [];
  for (let r = headerRowIdx + 1; r <= last; r++) {
    if (r === labelRowIdx || isSep(r)) continue;
    const row = ws.getRow(r);
    const a = at(row, input.SL_NO), b = at(row, input.CAR_NAME);
    if ((a === null || a === '') && (b === null || b === '')) continue;
    const cells = new Map<number, CellData>();
    for (let c = 1; c <= ncols; c++) {
      const to = move.get(c);
      if (!to) continue;
      const cell = row.getCell(c);
      const ext = extractCellValue(cell);
      cells.set(to, {
        colIndex: to, colLetter: colNumberToLetter(to),
        value: ext.value,
        formula: ext.formula ? moveFormula(stripEquals(ext.formula), move) : undefined,
        hyperlink: ext.hyperlink, hyperlinkText: ext.hyperlinkText,
        style: cloneCellStyle(cell),
        note: (() => {
          const real = noteFor(notes || null, ws.name, `${colNumberToLetter(c)}${r}`);
          if (real) return real;
          if (!cell.note) return undefined;
          if (typeof cell.note === 'string') return cell.note;
          if (cell.note.texts) { const t = cell.note.texts.map((x: any) => x.text).join(''); return t || undefined; }
          return undefined;
        })(),
      });
    }
    rows.push({
      origin, rowNum: r, sec: labelRowIdx > 0 && r > labelRowIdx ? 'OUT' : 'IN',
      name: nu(b) || '', year: normalizeKey(at(row, input.YEAR)) || null,
      color: squash(at(row, input.COLOR)), point: squash(at(row, input.POINT)),
      mile: milenum(at(row, input.MILAGE)), chassis: nu(at(row, input.CHASSIS)),
      serial: normalizeKey(a) || null, height: row.height, cells,
    });
  }
  return { rows, headerRowIdx, labelRowIdx, last, input };
}

/* ---------------- canonical BD model key + Japan routing (port of route.py) ---------------- */
function bdCanon(name: string): string {
  if (!name) return '';
  let n = name.toUpperCase().replace('NON-HYBRID', 'NON HYBRID').trim();
  if (n.includes('HARRIER')) return n.includes('NON') ? 'HARRIER NON HYBRID' : 'HARRIER HYBRID';
  if (n.includes('HIACE')) return n.includes('AMBUL') ? 'HIACE AMBULANCE' : (n.includes('VAN') ? 'HIACE VAN' : n);
  if (n.includes('PRADO')) return 'LAND CRUISER PRADO';
  if (n === 'CR-V' || n === 'HONDA CR-V') return 'HONDA CR-V';
  return n;
}
const JMAP: Record<string, string | null> = {
  'CROSS': 'COROLLA CROSS HYBRID', 'COROLLA CROSS': 'COROLLA CROSS HYBRID',
  'YARIS CROSS': 'YARIS CROSS HYBRID', 'CROWN': 'CROWN HYBRID',
  'CR-V': 'HONDA CR-V', 'C-HR': 'C-HR HYBRID', 'PRIUS': 'PRIUS', 'SIENTA': 'SIENTA HYBRID',
  'AXIO': 'AXIO HYBRID', 'FIELDER': 'FIELDER HYBRID', 'ESQUIRE': 'ESQUIRE HYBRID',
  'LEXUS ES': 'LEXUS ES300H', 'ALPHARD': 'ALPHARD',
  'PRADO': 'LAND CRUISER PRADO', 'LAND CRUISER': null,
  'COROLLA': null, 'DYNA TRUCK': null, 'RAV4': null, 'RAV4 HB': null,
};

function buildRouter(bd: CRow[], jp: CRow[]) {
  const bdByCh = new Map<string, CRow>();
  for (const x of bd) if (x.chassis) bdByCh.set(x.chassis, x);
  const bdMY = new Map<string, CRow[]>();
  for (const x of bd) if (x.mile && x.year) {
    const k = x.mile + '|' + x.year;
    if (!bdMY.has(k)) bdMY.set(k, []);
    bdMY.get(k)!.push(x);
  }
  const bdPrefix2names = new Map<string, Set<string>>();
  for (const x of bd) if (x.chassis) {
    const p = baseCode(x.chassis.split('-')[0]);
    if (p) { if (!bdPrefix2names.has(p)) bdPrefix2names.set(p, new Set()); bdPrefix2names.get(p)!.add(x.name); }
  }
  const allbdCanon = new Set(bd.map((z) => bdCanon(z.name)));

  const match = (x: CRow): CRow | null => {
    if (x.chassis && bdByCh.has(x.chassis)) return bdByCh.get(x.chassis)!;
    if (x.chassis) return null;
    if (x.mile && x.year) {
      const cands = (bdMY.get(x.mile + '|' + x.year) || []).filter((c) => c.color === x.color && c.point === x.point);
      if (cands.length === 1) return cands[0];
    }
    return null;
  };
  const route = (x: CRow): string => {
    const m = match(x);
    if (m) return bdCanon(m.name);
    const jw = jpWord(x.name);
    let code: string | null = null;
    if (x.chassis) code = baseCode(x.chassis.split('-')[0]);
    else {
      const toks = (x.name || '').split(/\s+/);
      for (let i = toks.length - 1; i >= 0; i--) if (CODE_RE.test(toks[i])) { code = baseCode(toks[i]); break; }
    }
    // special model rules first
    if (jw.includes('HIACE')) return x.name.includes('AMBUL') ? 'HIACE AMBULANCE' : 'HIACE VAN';
    if (jw.includes('HARRIER')) return (code && code.startsWith('MXUA')) ? 'HARRIER NON HYBRID' : 'HARRIER HYBRID';
    if (jw === 'NOAH' || jw === 'VOXY') return (code && code.startsWith('ZRR')) ? jw : jw + ' HYBRID';
    if (jw.includes('CR-V')) return (code && code.startsWith('RT')) ? 'HONDA CR-V HYBRID' : 'HONDA CR-V NON HYBRID';
    if (jw.includes('CROSS') && !jw.includes('YARIS')) return 'COROLLA CROSS HYBRID';
    if (jw in JMAP) { const v = JMAP[jw]; return v ? v : 'NEW:' + jw; }
    if (code && bdPrefix2names.has(code)) {
      const hits = [...bdPrefix2names.get(code)!].filter((n) => jw && n.includes(jw));
      if (hits.length >= 1) return bdCanon(hits.sort((a, b) => a.length - b.length)[0]);
    }
    if (allbdCanon.has(bdCanon(jw))) return bdCanon(jw);
    return 'NEW:' + jw;
  };
  return { match, route };
}

/* ---------------- formula chain compute (so values show) ---------------- */
function num(cells: Map<number, CellData>, c: number): number {
  const cd = cells.get(c);
  if (!cd || cd.formula) return 0;
  return toNumber(cd.value);
}
function chainResults(cells: Map<number, CellData>): Record<number, number> {
  const res: Record<number, number> = {};
  const P = num(cells, COL.DOLLAR);
  let Q = num(cells, COL.BDT);
  if (cells.get(COL.BDT)?.formula) { Q = P * 127; res[COL.BDT] = Q; }
  if (cells.get(COL.COSTING)?.formula) { res[COL.COSTING] = Q + num(cells, COL.DUTY) + num(cells, COL.CNF); }
  if (cells.get(COL.PRICE)?.formula) { res[COL.PRICE] = (res[COL.COSTING] ?? num(cells, COL.COSTING)) + num(cells, COL.ADDL); }
  return res;
}

/* ================================================================= */
export async function combineStocks(
  bdFile: File | ArrayBuffer,
  japanFile: File | ArrayBuffer,
  asOfDateIn: Date | string,
  onProgress?: (msg: string) => void,
  design: SheetDesign = 'classic',
): Promise<ReconciliationSummary> {
  const ExcelJS = await getExcelJS();
  const warnings: string[] = [];
  const combineDateStr = (() => {
    try { return formatDateForTag(asOfDateIn || new Date()); } catch { return formatDateForTag(new Date()); }
  })();

  onProgress?.('Loading BD & Japan workbooks…');
  const bdBuf: ArrayBuffer = bdFile instanceof File ? await bdFile.arrayBuffer() : (bdFile as ArrayBuffer);
  const jpBuf: ArrayBuffer = japanFile instanceof File ? await japanFile.arrayBuffer() : (japanFile as ArrayBuffer);
  const bdWb = new ExcelJS.Workbook();
  await bdWb.xlsx.load(bdBuf);
  const jpWb = new ExcelJS.Workbook();
  await jpWb.xlsx.load(jpBuf);
  // ExcelJS drops note TEXT on load — read real notes from the xlsx parts
  let bdNotes: NoteMap | null = null, jpNotes: NoteMap | null = null;
  try { bdNotes = await readNotesFromXlsx(bdBuf); } catch { bdNotes = null; }
  try { jpNotes = await readNotesFromXlsx(jpBuf); } catch { jpNotes = null; }

  const bdWs = findWorksheet(bdWb, {
    preferredNames: ['BD STOCK', 'BD_STOCK', 'BD-STOCK', 'BD STOCK MASTER', 'BD MASTER', 'BD', 'MASTER', 'Sheet1'],
    kind: 'customized',
    mode: 'BD',
  });
  const jpWs = findWorksheet(jpWb, {
    preferredNames: ['JAPAN STOCK', 'JAPAN_STOCK', 'JAPAN-STOCK', 'JAPAN', 'JAPAN MASTER', 'MASTER', 'Sheet1'],
    kind: 'customized',
    mode: 'JAPAN',
  });
  if (!bdWs || !jpWs) {
    const bdAvailable = (bdWb.worksheets || []).map((w: any) => `"${w.name}"`).join(', ');
    const jpAvailable = (jpWb.worksheets || []).map((w: any) => `"${w.name}"`).join(', ');
    throw new Error(
      `Could not find BD STOCK / JAPAN STOCK sheets. Check both uploads. ` +
      `BD sheets: [${bdAvailable}]. Japan sheets: [${jpAvailable}].`
    );
  }

  onProgress?.('Reading rows & styles…');
  const bdInfo = readSheet(bdWs, 24, 'BD', bdNotes);
  const jpInfo = readSheet(jpWs, 23, 'JP', jpNotes);
  const BD = bdInfo.rows, JP = jpInfo.rows;
  if (BD.length === 0) throw new Error('No car rows found in the BD sheet — is the correct BD file uploaded?');
  if (JP.length === 0) throw new Error('No car rows found in the Japan sheet — is the correct Japan file uploaded?');

  // ---- sanity guards: catch swapped / duplicate uploads before producing a wrong sheet ----
  const bdSheetName = String(bdWs.name || '').toUpperCase();
  const jpSheetName = String(jpWs.name || '').toUpperCase();
  if (bdSheetName.includes('JAPAN') && !bdSheetName.includes('BD')) {
    throw new Error('The BD slot contains a JAPAN STOCK workbook. Please swap the two uploads: BD sheet on the left, Japan sheet on the right.');
  }
  if (jpSheetName.includes('BD') && !jpSheetName.includes('JAPAN')) {
    throw new Error('The Japan slot contains a BD STOCK workbook. Please swap the two uploads: BD sheet on the left, Japan sheet on the right.');
  }
  // identical uploads (same workbook in both slots)
  const bdKeys = BD.map((x) => (x.chassis || '') + '|' + x.name).join(',');
  const jpKeys = JP.map((x) => (x.chassis || '') + '|' + x.name).join(',');
  if (BD.length === JP.length && bdKeys === jpKeys) {
    throw new Error('Both slots contain the same workbook. Upload your updated BD sheet in one slot and your updated Japan sheet in the other.');
  }
  // a combined sheet fed back in (its Japan rows already carry LOCATION = JP)
  const bdJpLocs = BD.filter((x) => String((x.cells.get(COL.LOC)?.value ?? '')).trim().toUpperCase() === 'JP').length;
  if (bdJpLocs > BD.length * 0.3) {
    warnings.push('The BD slot looks like an already-combined sheet (many rows have LOCATION = JP). Combining again may duplicate Japan cars — upload the plain BD workbook instead.');
  }

  onProgress?.('Matching BD ↔ Japan (chassis + mileage/year/color/point)…');
  const { match, route } = buildRouter(BD, JP);

  /* ---- merge decisions ---- */
  const bdMatches = new Map<number, { x: CRow; how: string }[]>();
  for (const x of JP) {
    const m = match(x);
    if (m) {
      const how = x.chassis && x.chassis === m.chassis ? 'chassis' : 'fuzzy';
      if (!bdMatches.has(m.rowNum)) bdMatches.set(m.rowNum, []);
      bdMatches.get(m.rowNum)!.push({ x, how });
    }
  }
  const MERGE_DOLLAR = new Map<number, CRow>();   // bd rowNum -> jp row (same-section)
  const TRANSFER_MERGE = new Map<number, CRow>(); // bd rowNum -> jp row (transferred, pull dollars)
  const TRANSFER_RED = new Set<number>();         // jp rowNum rendered red in OUT
  const DROPPED = new Set<number>();
  const DUPLICATES: { bdRow: number; jp: CRow; how: string }[] = [];
  const BD_NOTE = new Map<number, string[]>();
  const bdByRow = new Map<number, CRow>(); BD.forEach((z) => bdByRow.set(z.rowNum, z));
  const addNote = (r: number, s: string) => { if (!BD_NOTE.has(r)) BD_NOTE.set(r, []); BD_NOTE.get(r)!.push(s); };

  for (const [br, lst] of bdMatches) {
    lst.sort((a, b) => (a.how === 'chassis' ? 0 : 1) - (b.how === 'chassis' ? 0 : 1));
    const primary = lst[0].x;
    const bdrow = bdByRow.get(br)!;
    if (primary.sec === bdrow.sec) {
      MERGE_DOLLAR.set(br, primary);
    } else if (bdrow.sec === 'IN' && primary.sec === 'OUT') {
      TRANSFER_RED.add(primary.rowNum);
      TRANSFER_MERGE.set(br, primary);
      addNote(br, `Transferred from Japan (was Japan STOCK-OUT). Chassis ${bdrow.chassis || primary.chassis}.`);
    }
    for (let i = 1; i < lst.length; i++) {
      DROPPED.add(lst[i].x.rowNum);
      addNote(br, `Also appeared in Japan ${lst[i].x.sec} list (${lst[i].how} match) — verify duplicate.`);
      DUPLICATES.push({ bdRow: br, jp: lst[i].x, how: lst[i].how });
    }
  }
  const consumedJp = new Set<number>();
  for (const jr of MERGE_DOLLAR.values()) consumedJp.add(jr.rowNum);
  for (const jr of DROPPED) consumedJp.add(jr);

  const returnedCount = 0;
  void returnedCount;

  /* ---- canonical model per row ---- */
  const bdCanonOf = new Map<number, string>(); BD.forEach((x) => bdCanonOf.set(x.rowNum, bdCanon(x.name)));
  const jpRouteOf = new Map<number, string>(); JP.forEach((x) => jpRouteOf.set(x.rowNum, route(x)));

  const bdCostEmpty = (x: CRow): boolean => {
    const cd = x.cells.get(COL.COSTING);
    if (!cd) return true;
    if (cd.formula) return false;
    const v = cd.value;
    return v === null || v === undefined || v === '' || toNumber(v) === 0;
  };

  /* ---- assemble mixed model groups per section ---- */
  interface Spec { kind: 'BD' | 'JP' | 'SUBSEP'; row?: CRow; mergeJp?: CRow; mergeCosting?: boolean; red?: boolean; notes?: string[]; bdSerial?: string | null; jpSerial?: string | null; }
  const bdRec = (x: CRow): Spec => {
    const mj = MERGE_DOLLAR.get(x.rowNum) || TRANSFER_MERGE.get(x.rowNum) || undefined;
    return { kind: 'BD', row: x, mergeJp: mj, mergeCosting: !!mj && bdCostEmpty(x), notes: BD_NOTE.get(x.rowNum) || [], bdSerial: x.serial, jpSerial: mj ? mj.serial : null };
  };
  const jpRec = (x: CRow): Spec => ({ kind: 'JP', row: x, red: TRANSFER_RED.has(x.rowNum), notes: [], bdSerial: null, jpSerial: x.serial });

  function assemble(sec: 'IN' | 'OUT'): Spec[][] {
    const order: string[] = []; const seen = new Set<string>();
    for (const x of BD) if (x.sec === sec) { const c = bdCanonOf.get(x.rowNum)!; if (!seen.has(c)) { seen.add(c); order.push(c); } }
    const bdBy = new Map<string, CRow[]>();
    for (const x of BD) if (x.sec === sec) { const c = bdCanonOf.get(x.rowNum)!; if (!bdBy.has(c)) bdBy.set(c, []); bdBy.get(c)!.push(x); }
    const jpBy = new Map<string, CRow[]>(); const newOrder: string[] = [];
    for (const x of JP) {
      if (x.sec !== sec) continue;
      if (consumedJp.has(x.rowNum)) continue;
      const rt = jpRouteOf.get(x.rowNum)!;
      if (!order.includes(rt) && !jpBy.has(rt)) newOrder.push(rt);
      if (!jpBy.has(rt)) jpBy.set(rt, []); jpBy.get(rt)!.push(x);
    }
    const groups: Spec[][] = [];
    for (const c of order) {
      const bdPart = (bdBy.get(c) || []).map(bdRec);
      const jpPart = (jpBy.get(c) || []).map(jpRec);
      let g: Spec[];
      if (bdPart.length && jpPart.length) g = [...bdPart, { kind: 'SUBSEP' } as Spec, ...jpPart];
      else g = [...bdPart, ...jpPart];
      if (g.length) groups.push(g);
    }
    for (const rt of newOrder) {
      const g = (jpBy.get(rt) || []).map(jpRec);
      if (g.length) groups.push(g);
    }
    return groups;
  }
  const inGroups = assemble('IN');
  const outGroups = assemble('OUT');

  onProgress?.('Building combined sheet…');

  /* ---- output = copy of BD workbook (keep title/header/widths) ---- */
  const outWb = new ExcelJS.Workbook();
  await outWb.xlsx.load(bdBuf);
  const ws =
    findWorksheet(outWb, {
      preferredNames: ['BD STOCK', 'BD_STOCK', 'BD-STOCK', 'BD STOCK MASTER', 'BD MASTER', 'BD', 'MASTER', 'Sheet1'],
      kind: 'customized',
      mode: 'BD',
    }) || outWb.worksheets[0];
  const headerRowIdx = bdInfo.headerRowIdx;
  // header in the new column order; title rows merged A … PRICE
  layoutHeaderAndTitle(ws, headerRowIdx, bdInfo.input, OUT, BD_ORDER);

  // capture label styling from BD label row
  const bdLabelCell = bdInfo.labelRowIdx > 0 ? bdWs.getRow(bdInfo.labelRowIdx).getCell(1) : null;
  const labelFont = bdLabelCell?.font ? JSON.parse(JSON.stringify(bdLabelCell.font)) : { name: 'Oswald', size: 14, color: { argb: COLORS.WHITE_TEXT } };
  const labelFill = bdLabelCell?.fill ? JSON.parse(JSON.stringify(bdLabelCell.fill)) : { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_LABEL } };
  const labelAlign = bdLabelCell?.alignment ? JSON.parse(JSON.stringify(bdLabelCell.alignment)) : { vertical: 'middle', horizontal: 'center' };
  const labelHeight = bdInfo.labelRowIdx > 0 ? (bdWs.getRow(bdInfo.labelRowIdx).height || 29.25) : 29.25;
  const sepHeight = 14.25;

  // unmerge below header + clear rows
  const oldMax = ws.rowCount;
  const merges: string[] = (ws.model?.merges || []).slice();
  for (const m of merges) {
    const mm = m.match(/^[A-Z]+(\d+):/);
    if (mm && parseInt(mm[1], 10) > headerRowIdx) { try { ws.unMergeCells(m); } catch { /* */ } }
  }
  for (let r = headerRowIdx + 1; r <= oldMax + 2; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= TOTAL; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      // remove the note completely: assigning undefined leaves an empty note box behind
      if (cell._comment) cell._comment = undefined;
      cell.style = { font: { name: 'Oswald', size: 11 }, fill: { type: 'pattern', pattern: 'none' }, border: {}, alignment: {}, numFmt: 'General' };
    }
    row.height = undefined as any;
  }

  const setFormula = (cell: any, f: string, tr: number, result?: number) => {
    let ff = f;
    if (ff.includes('{r}')) ff = ff.replace(/\{r\}/g, String(tr));
    else ff = ff.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (_m, a) => a + String(tr));
    cell.value = result !== undefined ? { formula: ff, result } : { formula: ff };
  };

  const writeCellData = (tr: number, tc: number, cd: CellData | undefined, chain: Record<number, number>) => {
    const cell = ws.getRow(tr).getCell(tc);
    if (!cd) { cell.value = null; cell.style = { fill: { type: 'pattern', pattern: 'none' }, border: {}, font: { name: 'Oswald', size: 11 }, alignment: {}, numFmt: 'General' }; return; }
    if (cd.formula) setFormula(cell, cd.formula, tr, chain[tc]);
    else if (cd.hyperlink) cell.value = { text: cd.hyperlinkText || String(cd.value ?? 'PHOTO'), hyperlink: cd.hyperlink };
    else cell.value = cd.value === undefined ? null : cd.value;
    applyCellStyle(cell, cd.style);
    if (cd.note) cell.note = cd.note;
  };

  let tr = headerRowIdx + 1;
  let serial = 0;
  // what each written row is, for the Excel design step at the end
  const laid: LaidRow[] = [];

  const writeCarRow = (spec: Spec) => {
    const x = spec.row!;
    // build the effective cell map for this combined row
    const cells = new Map<number, CellData>();
    // rows are already in the output's columns (a Japan row has no IMAGE, so that cell stays blank)
    for (let c = 1; c <= TOTAL; c++) cells.set(c, x.cells.get(c) ? JSON.parse(JSON.stringify(x.cells.get(c))) : undefined as any);
    // merge Japan dollars (+ costing when BD empty)
    if (spec.mergeJp) {
      for (const c of DOLLAR_COLS) cells.set(c, spec.mergeJp.cells.get(c) ? JSON.parse(JSON.stringify(spec.mergeJp.cells.get(c))) : undefined as any);
      if (spec.mergeCosting) cells.set(COL.COSTING, spec.mergeJp.cells.get(COL.COSTING) ? JSON.parse(JSON.stringify(spec.mergeJp.cells.get(COL.COSTING))) : undefined as any);
    }
    // location: BD keeps its own; JP -> "JP"
    if (x.origin === 'JP') { const lc = cells.get(COL.LOC) || { colIndex: COL.LOC, colLetter: 'K', value: null, style: {} } as CellData; lc.value = 'JP'; lc.formula = undefined; cells.set(COL.LOC, lc); }
    // supplier -> RAITA
    { const sc = cells.get(COL.SUPPLIER) || { colIndex: COL.SUPPLIER, colLetter: 'M', value: null, style: {} } as CellData; sc.value = 'RAITA'; sc.formula = undefined; cells.set(COL.SUPPLIER, sc); }

    const chain = chainResults(cells);
    laid.push({ row: tr, kind: 'car', origin: x.origin });
    const rowObj = ws.getRow(tr);
    const descCell = cells.get(COL.DESC);
    rowObj.height = carRowHeight(
      descCell?.value,
      (descCell?.style as any)?.font?.name || 'Oswald',
      (descCell?.style as any)?.font?.size || 11,
    );
    for (let c = 1; c <= TOTAL; c++) writeCellData(tr, c, cells.get(c), chain);

    // running SL serial + note (BD/Japan original serials)
    serial += 1;
    const slCell = ws.getRow(tr).getCell(1);
    slCell.value = serial;
    const lines: string[] = [];
    if (spec.bdSerial) lines.push(`[BD Stock Serial - ${spec.bdSerial}]`);
    if (spec.jpSerial) lines.push(`[Japan Stock Serial - ${spec.jpSerial}]`);
    if (lines.length) slCell.note = lines.join('\n');

    // chassis-cell notes (transferred / duplicate)
    if (spec.notes && spec.notes.length) {
      const ch = ws.getRow(tr).getCell(COL.CHASSIS);
      const prev = ch.note ? String(ch.note) + '\n' : '';
      ch.note = prev + spec.notes.join('\n');
    }
    // whole-row red for transferred Japan-out rows
    if (spec.red) {
      for (let c = 1; c <= TOTAL; c++) ws.getRow(tr).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REDROW } };
    }
    // alignment
    for (let c = 1; c <= TOTAL; c++) {
      ws.getRow(tr).getCell(c).alignment = CENTER_COLS.has(c)
        ? { horizontal: 'center', vertical: 'center', wrapText: true }
        : { horizontal: 'left', vertical: 'center', wrapText: true };
    }
    tr += 1;
  };

  const writeSep = () => {
    laid.push({ row: tr, kind: 'separator' });
    const row = ws.getRow(tr); row.height = sepHeight;
    for (let c = 1; c <= TOTAL; c++) {
      const cell = row.getCell(c); cell.value = null;
      cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }, border: {}, font: { name: 'Oswald', size: 11 }, alignment: {}, numFmt: 'General' };
    }
    tr += 1;
  };
  const writeSubSep = () => {
    laid.push({ row: tr, kind: 'divider' });
    const row = ws.getRow(tr); row.height = 3.75;
    const line = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    for (let c = 1; c <= TOTAL; c++) {
      const cell = row.getCell(c); cell.value = null;
      cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }, border: { bottom: line }, font: { name: 'Oswald', size: 9 }, alignment: {}, numFmt: 'General' };
    }
    tr += 1;
  };

  let newCount = 0, mergedCount = MERGE_DOLLAR.size, transferCount = TRANSFER_RED.size;

  // IN section
  for (const g of inGroups) {
    for (const spec of g) {
      if (spec.kind === 'SUBSEP') writeSubSep();
      else { writeCarRow(spec); if (spec.kind === 'JP' && !spec.red) newCount++; }
    }
    writeSep();
  }
  // gap rows (2)
  for (let i = 0; i < 2; i++) { laid.push({ row: tr, kind: 'gap' }); const row = ws.getRow(tr); for (let c = 1; c <= TOTAL; c++) { const cell = row.getCell(c); cell.value = null; cell.style = { fill: { type: 'pattern', pattern: 'none' }, border: {}, font: { name: 'Oswald', size: 11 }, alignment: {}, numFmt: 'General' }; } tr += 1; }
  // label row
  const labelRow = ws.getRow(tr); labelRow.height = labelHeight;
  const lc = labelRow.getCell(1);
  lc.value = "BD & JAPAN COMBINED STOCK OUT LISTING CAR'S";
  lc.style = { font: labelFont, fill: labelFill, alignment: labelAlign, border: {}, numFmt: 'General' };
  for (let c = 2; c <= COL.PRICE; c++) labelRow.getCell(c).style = { fill: JSON.parse(JSON.stringify(labelFill)), font: { name: 'Oswald', size: 11 }, border: {}, alignment: {}, numFmt: 'General' };
  // merged A … PRICE like the BD and Japan sheets; unmerged, the centred title was cut off on the left
  try { ws.mergeCells(`A${tr}:${colNumberToLetter(COL.PRICE)}${tr}`); } catch { /* ignore */ }
  laid.push({ row: tr, kind: 'stockOutTitle' });
  tr += 1;
  // OUT section
  for (const g of outGroups) {
    for (const spec of g) {
      if (spec.kind === 'SUBSEP') writeSubSep();
      else { writeCarRow(spec); if (spec.kind === 'JP' && !spec.red) newCount++; }
    }
    writeSep();
  }
  // header row alignment: all center+center
  for (let c = 1; c <= TOTAL; c++) ws.getRow(headerRowIdx).getCell(c).alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

  onProgress?.('Generating downloadable .xlsx…');
  /* ---- final layout: column widths, header row heights, centre alignment ---- */
  applySheetLayout(ws, COL as unknown as Record<string, number | undefined>, TOTAL, tr);
  /* ---- the chosen Excel design (Classic leaves a classic sheet exactly as written) ---- */
  applySheetDesign(design, {
    ws, headerRow: headerRowIdx, totalCols: TOTAL, rows: laid,
    cols: {
      name: COL.NAME, description: COL.DESC, longDescription: COL.LONGDESC, price: COL.PRICE,
      chassis: COL.CHASSIS, location: COL.LOC, status: COL.STATUS, supplier: COL.SUPPLIER,
    },
  });

  const buf = await outWb.xlsx.writeBuffer();
  const outputBlob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const totalCars = inGroups.reduce((a, g) => a + g.filter((s) => s.kind !== 'SUBSEP').length, 0)
    + outGroups.reduce((a, g) => a + g.filter((s) => s.kind !== 'SUBSEP').length, 0);

  // ---- build detailed preview lists (for the results dashboard) ----
  const rawc = (x: CRow, c: number): any => { const cd = x.cells.get(c); return cd ? (cd.value ?? '') : ''; };
  const newCars: any[] = [];   // Japan-only cars added
  for (const x of JP) {
    if (consumedJp.has(x.rowNum)) continue;
    if (TRANSFER_RED.has(x.rowNum)) continue;
    newCars.push({
      key: x.chassis || ('SL ' + (x.serial || '?')),
      carName: rawc(x, COL.NAME) || x.name,
      year: rawc(x, COL.YEAR), price: rawc(x, COL.COSTING),
      grade: rawc(x, COL.GRADE), color: rawc(x, COL.COLOR),
      point: rawc(x, COL.POINT), milage: rawc(x, COL.MILE),
      location: 'JP', status: 'IN STOCK', sourceSheetTag: String(rawc(x, COL.SOURCE) || ''),
    });
  }
  const updatedCars: any[] = [];  // merged BD+Japan (same-section)
  for (const [br, jp] of MERGE_DOLLAR) {
    const b = bdByRow.get(br)!;
    updatedCars.push({
      key: b.chassis || ('SL ' + (b.serial || '?')),
      carName: rawc(b, COL.NAME) || b.name,
      changes: [{ field: 'Merged Japan pricing (Dollar / BDT / Duty / CNF / Additional' + (bdCostEmpty(b) ? ' + Costing' : '') + ')', colName: `${colNumberToLetter(COL.DOLLAR)}–${colNumberToLetter(COL.ADDL)}`, oldValue: 'BD row', newValue: 'Japan SL ' + (jp.serial || '?') }],
    });
  }
  const duplicateCars: any[] = [];  // duplicate Japan listings (dropped, noted on BD chassis)
  for (const d of DUPLICATES) {
    const b = bdByRow.get(d.bdRow)!;
    duplicateCars.push({
      key: b.chassis || ('SL ' + (b.serial || '?')),
      carName: rawc(b, COL.NAME) || b.name,
      changes: [{
        field: `Duplicate Japan listing (${d.how} match) — kept once, verify`,
        colName: `${colNumberToLetter(COL.CHASSIS)} note`,
        oldValue: `Japan ${d.jp.sec} SL ${d.jp.serial || '?'} — ${d.jp.name}`,
        newValue: 'dropped from combined sheet',
      }],
    });
  }
  const stockOutCars: any[] = [];  // transferred (Japan stock-out but BD in-stock)
  for (const [br, jp] of TRANSFER_MERGE) {
    const b = bdByRow.get(br)!;
    stockOutCars.push({
      key: b.chassis || ('SL ' + (b.serial || '?')),
      carName: rawc(b, COL.NAME) || b.name,
      groupName: bdCanon(b.name),
      previousSection: 'Japan STOCK-OUT → now in BD (Japan SL ' + (jp.serial || '?') + ')',
    });
  }

  if (stockOutCars.length) {
    const names = stockOutCars.map((d) => d.key).join(', ');
    warnings.push(`${stockOutCars.length} transferred car(s): ${names} — Japan stock-out but in-stock in BD (full red rows in STOCK OUT; see the "Transferred" tab).`);
  }
  if (duplicateCars.length) {
    const names = duplicateCars.map((d) => d.key).join(', ');
    warnings.push(`${duplicateCars.length} duplicate Japan listing(s): ${names} — see the "Duplicates" tab (also noted on the BD chassis cell).`);
  }

  return {
    mode: 'COMBINE' as any,
    asOfDate: combineDateStr,
    newCount,
    updatedCount: mergedCount,
    stockOutCount: transferCount,
    totalRowsCount: totalCars,
    newCars,
    updatedCars,
    duplicateCars,
    stockOutCars,
    warnings,
    outputBlob,
    outputFilename: `BD_Japan_Combined_Stock_${combineDateStr}.xlsx`,
  };
}
