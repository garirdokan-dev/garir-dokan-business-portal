import React, { useState, useEffect, useRef } from 'react';
import {
  parseDutyPdfFile,
  mergeDutyResults,
  type UnifiedDutyBlock,
  type DutyParseResult,
} from './utils/dutyParser';
import { isCsvFile, decodeCsvBytes, csvIntoWorkbook } from './utils/csvReader';

// Default Brackets matching the user's template
const DEFAULT_BRACKETS = [
  { from: 15000001, to: Infinity, add: 1400000 },
  { from: 12000001, to: 15000000, add: 1200000 },
  { from: 10000001, to: 12000000, add: 950000 },
  { from: 8000001, to: 10000000, add: 750000 },
  { from: 6000001, to: 8000000, add: 550000 },
  { from: 4500001, to: 6000000, add: 400000 },
  { from: 3500001, to: 4500000, add: 350000 },
  { from: 2500000, to: 3500000, add: 300000 },
];

interface Bracket {
  from: number;
  to: number;
  add: number;
}

interface CarRecord {
  sl: number;
  name: string;
  desc: string;
  year: number;
  usd: number;
}

interface DutyBlockRow {
  jan: number;
  feb: number;
}

// DutyBlock is the unified block shape produced by the parser module.
type DutyBlock = UnifiedDutyBlock;

// One duty-PDF upload slot.
interface DutySlot {
  id: string;
  file: File | null;
  fileName: string;
  result: DutyParseResult | null;
}

interface ComputedRow extends CarRecord {
  prefix: string;
  converted: number;
  driver: number;
  duty: number;
  costing: number;
  additional: number;
  final: number;
  status: 'exact' | 'nearest' | 'manual';
  /** set when the vehicle name and the chassis code point at different duty entries */
  verify?: string;
  note: string;
  matchModel: string;
  matchYear: string;
}

interface LogEntry {
  text: string;
  type: 'info' | 'ok' | 'warn' | 'err';
  time: string;
}

export default function App() {
  // CDNs Loaded State
  const [libsReady, setLibsReady] = useState(false);

  // ---- Single-mode parameters -------------------------------------------
  const [prefix, setPrefix] = useState('5');
  const [rate, setRate] = useState(127);
  const [driver, setDriver] = useState(50000);
  const [brackets, setBrackets] = useState<Bracket[]>(DEFAULT_BRACKETS);
  const [offerFileName, setOfferFileName] = useState('');
  const [cars, setCars] = useState<CarRecord[] | null>(null);
  const [dutyBlocks, setDutyBlocks] = useState<DutyBlock[] | null>(null);
  const [rows, setRows] = useState<ComputedRow[] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusTxt, setStatusTxt] = useState('Offer list যোগ করুন।');
  const [isErr, setIsErr] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // ---- Duty PDF slots (format-agnostic; any sheet in any slot) ----------
  const [slots, setSlots] = useState<DutySlot[]>([
    { id: 'duty-a', file: null, fileName: '', result: null },
    { id: 'duty-b', file: null, fileName: '', result: null },
  ]);
  // Duplicate-chassis notices from the last merge (informational).
  const [dupNotices, setDupNotices] = useState<string[]>([]);
  // Operator has acknowledged a Raita-vs-duty-sheet month mismatch and wants
  // to compute anyway. Re-armed on every new upload.
  const [monthOverride, setMonthOverride] = useState(false);

  // Month printed INSIDE the Raita sheet's title row (exporter's own wording).
  const [sheetMonth, setSheetMonth] = useState('');
  // When the filename month and the in-sheet month disagree, the operator
  // picks which one is authoritative. null = not yet answered.
  const [monthChoice, setMonthChoice] = useState<'sheet' | 'file' | null>(null);

  // Pull a month name out of any text (title line, filename, ...).
  const findMonthIn = (text: string): string => {
    if (!text) return '';
    // Underscores/dots/dashes are separators here ("APRIL_11_RAITA"), but JS
    // counts "_" as a word char, so \b would not fire after APRIL. Normalise
    // those to spaces first.
    const t = text.toUpperCase().replace(/[_.\-]+/g, ' ');
    const m = t.match(
      /\b(JANUARY|FEBRUARY|MARCH|APRIL|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JULY|JUNE|MAY|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/,
    );
    return m ? m[1] : '';
  };

  // Month taken from the Raita FILENAME (e.g. "APRIL_11_RAITA_...").
  const fileMonth = findMonthIn(offerFileName);

  // The two Raita sources disagree -> ask the operator which one to trust.
  const monthConflict = !!sheetMonth && !!fileMonth &&
    sheetMonth.slice(0, 3) !== fileMonth.slice(0, 3);

  // Authoritative Raita month.
  //   1. in-sheet title  (preferred — the exporter wrote it)
  //   2. filename
  //   3. neither -> '' , and the duty sheet's own month is taken as truth
  const getDisplayMonth = () => {
    if (monthConflict && monthChoice) {
      return monthChoice === 'sheet' ? sheetMonth : fileMonth;
    }
    if (sheetMonth) return sheetMonth;
    if (fileMonth) return fileMonth;
    // fall back to whatever the duty sheets say, so headers/filenames stay sane
    const s = slots.find(x => x.result)?.result?.meta.currentMonthLabel || '';
    const m = s.match(/[A-Z]+/i);
    return m ? m[0].toUpperCase() : 'UNKNOWN';
  };

  // Refs for file elements
  const fileOfferRef = useRef<HTMLInputElement>(null);
  const dutyRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // ---- Upload safety ------------------------------------------------------
  // Async handlers must read the LATEST slots after an await; the value captured when a
  // handler started is stale if another upload finished meanwhile (two quick PDF drops
  // used to overwrite each other). Every change goes through commitSlots().
  const slotsRef = useRef<DutySlot[]>(slots);
  const slotReqRef = useRef<number[]>(slots.map(() => 0)); // newest upload per slot wins
  const offerReqRef = useRef(0);                            // newest offer-list upload wins
  const busyRef = useRef(0);                                // uploads still running
  const carsRef = useRef<CarRecord[] | null>(cars);
  const libFailRef = useRef({ pdf: false, excel: false });
  useEffect(() => { carsRef.current = cars; }, [cars]);

  const commitSlots = (next: DutySlot[]) => {
    slotsRef.current = next;
    setSlots(next);
    recompilePool(next);
  };
  const beginBusy = () => { busyRef.current += 1; setIsBusy(true); };
  const endBusy = () => { busyRef.current = Math.max(0, busyRef.current - 1); setIsBusy(busyRef.current > 0); };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // pdf.js and ExcelJS load from the CDN after the page opens. A file dropped before
  // then used to fail with a cryptic error; now we wait for the library with a clear
  // message, and give a plain instruction if it never arrives.
  const libReady = (kind: 'pdf' | 'excel') => {
    const w = window as any;
    return kind === 'pdf'
      ? !!(w.pdfjsLib && w.pdfjsLib.GlobalWorkerOptions && w.pdfjsLib.GlobalWorkerOptions.workerSrc)
      : !!w.ExcelJS;
  };
  const waitForLib = async (kind: 'pdf' | 'excel'): Promise<boolean> => {
    if (libReady(kind)) return true;
    updateStatus(kind === 'pdf'
      ? 'PDF লাইব্রেরি লোড হচ্ছে — একটু অপেক্ষা করুন…'
      : 'Excel লাইব্রেরি লোড হচ্ছে — একটু অপেক্ষা করুন…');
    for (let i = 0; i < 80 && !libFailRef.current[kind]; i++) {
      await sleep(250);
      if (libReady(kind)) return true;
    }
    const msg = `${kind === 'pdf' ? 'PDF' : 'Excel'} লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ দেখে পেজটা refresh করুন, তারপর ফাইলটা আবার দিন।`;
    updateStatus(msg, true);
    addLog(msg, 'err');
    return false;
  };

  // Content fingerprint of a parsed duty sheet (the file name is left out), used to
  // stop the same sheet from being added to both slots and doubling every entry.
  const dutySignature = (r: DutyParseResult) =>
    JSON.stringify(r.blocks.map(b => [b.vehicleName, b.modelCode, b.chassisCode, b.isHybrid, b.rows]));

  // Dynamic style insertion
  useEffect(() => {
    // Load CDN files sequentially
    libFailRef.current = { pdf: false, excel: false };
    const pdfScript = document.createElement('script');
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    pdfScript.async = true;
    pdfScript.onerror = () => { libFailRef.current.pdf = true; };
    pdfScript.onload = () => {
      const globalPdfjs = (window as any).pdfjsLib;
      if (globalPdfjs) {
        globalPdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      checkLibs();
    };
    document.body.appendChild(pdfScript);

    const excelScript = document.createElement('script');
    excelScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    excelScript.async = true;
    excelScript.onerror = () => { libFailRef.current.excel = true; };
    excelScript.onload = () => {
      checkLibs();
    };
    document.body.appendChild(excelScript);

    function checkLibs() {
      if (typeof (window as any).ExcelJS !== 'undefined' && typeof (window as any).pdfjsLib !== 'undefined') {
        setLibsReady(true);
      }
    }

    return () => {
      document.body.removeChild(pdfScript);
      document.body.removeChild(excelScript);
    };
  }, []);

  // Sync rows dynamically whenever parameters or inputs change
  useEffect(() => {
    if (cars && dutyBlocks) {
      handleCompute();
    }
  }, [cars, dutyBlocks, prefix, rate, driver, brackets]);

  // Logging Helper
  const addLog = (text: string, type: 'info' | 'ok' | 'warn' | 'err' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { text, type, time }]);
  };

  const updateStatus = (msg: string, err = false) => {
    setStatusTxt(msg);
    setIsErr(err);
  };

  // Excel Cell Parsers
  const cellVal = (cell: any): string => {
    if (!cell) return '';
    const v = cell.value;
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map((r: any) => r.text).join('');
      if ('result' in v) return v.result == null ? '' : String(v.result);
      if (v.text) return String(v.text);
      return '';
    }
    return String(v);
  };

  const cellNum = (cell: any): number | null => {
    if (!cell) return null;
    const v = cell.value;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && typeof v.result === 'number') return v.result;
    const s = cellVal(cell).replace(/[^\d.]/g, '');
    return s === '' ? null : parseFloat(s);
  };

  // readRaita implementation
  const readRaita = async (file: File): Promise<CarRecord[]> => {
    const buf = await file.arrayBuffer();
    const ExcelJS = (window as any).ExcelJS;
    const wb = new ExcelJS.Workbook();
    if (isCsvFile(file.name, file.type)) {
      // Raita sometimes sends the offer list as CSV: load it into a worksheet so the
      // exact same header search and row parsing below applies.
      csvIntoWorkbook(wb, decodeCsvBytes(buf));
    } else {
      await wb.xlsx.load(buf);
    }

    let ws: any = null;
    let headerRow = -1;
    // Month printed inside the sheet itself, e.g. row 2:
    //   "APRIL 14 RAITA INTERNATIONAL OFFER LIST"
    // This is the exporter's own wording, so it outranks the filename.
    let titleMonth = '';

    for (const sheet of wb.worksheets) {
      const maxR = Math.min(25, sheet.rowCount || 0);
      for (let r = 1; r <= maxR; r++) {
        const row = sheet.getRow(r);
        let found = false;
        let rowText = '';
        row.eachCell({ includeEmpty: false }, (cell: any) => {
          const raw = cellVal(cell);
          const t = raw.toUpperCase().trim();
          rowText += ' ' + t;
          if (t.includes('CAR NAME') || t === 'CAR') found = true;
        });
        // only look at title-ish rows (above the column header), and only
        // trust a line that actually looks like a Raita offer-list title
        if (!found && !titleMonth && /RAITA|OFFER\s*LIST/.test(rowText)) {
          titleMonth = findMonthIn(rowText);
        }
        if (found) {
          ws = sheet;
          headerRow = r;
          break;
        }
      }
      if (ws) break;
    }

    setSheetMonth(titleMonth);

    if (!ws) throw new Error('"CAR NAME" column header পাওয়া যায়নি। Raita offer file টা দিন।');

    const C = { sl: -1, name: -1, desc: -1, year: -1, price: -1 };
    const hRow = ws.getRow(headerRow);
    const maxC = Math.max(ws.columnCount || 0, hRow.cellCount || 0);

    for (let c = 1; c <= maxC; c++) {
      const t = cellVal(hRow.getCell(c)).toUpperCase().trim();
      if (!t) continue;
      if (t.includes('CAR NAME') || t === 'CAR') {
        if (C.name < 0) C.name = c;
      }
      if (t.includes('DESCRIPTION')) C.desc = c;
      if (t === 'YEAR' || t.includes('YEAR')) C.year = c;
      if (/^SL|SERIAL|RAITA SL/.test(t)) {
        if (C.sl < 0) C.sl = c;
      }
      if (t.includes('USD') || (t.includes('PRICE') && !t.includes('BDT'))) C.price = c;
    }

    if (C.price < 0) {
      for (let c = maxC; c >= 1; c--) {
        const t = cellVal(hRow.getCell(c)).toUpperCase().trim();
        if (t.includes('PRICE')) {
          C.price = c;
          break;
        }
      }
    }

    addLog(`Raita columns map → SL:${C.sl} Name:${C.name} Desc:${C.desc} Year:${C.year} Price:${C.price}`, 'info');
    if (C.name < 0 || C.year < 0 || C.price < 0) {
      throw new Error('SL / Name / Year / Price column খুঁজে পাওয়া গেল না।');
    }

    const loadedCars: CarRecord[] = [];
    const last = ws.rowCount || 0;
    for (let r = headerRow + 1; r <= last; r++) {
      const row = ws.getRow(r);
      const name = cellVal(row.getCell(C.name)).trim();
      if (!name) continue;

      const sl = C.sl > 0 ? (cellNum(row.getCell(C.sl)) || null) : null;
      const yr = cellNum(row.getCell(C.year));
      let usd = cellNum(row.getCell(C.price));
      if (!usd) {
        const raw = cellVal(row.getCell(C.price)).replace(/[$,\s]/g, '');
        usd = parseFloat(raw) || null;
      }
      if (!yr || !usd) continue;

      const desc = C.desc > 0 ? cellVal(row.getCell(C.desc)).trim() : '';
      const slNum = (sl && !isNaN(sl)) ? Math.round(sl) : loadedCars.length + 1;
      loadedCars.push({ sl: slNum, name, desc, year: Math.round(yr), usd });
    }

    if (!loadedCars.length) throw new Error('Header এর পরে কোনো data পাওয়া যায়নি।');
    addLog(`Raita: ${loadedCars.length} cars loaded`, 'ok');
    return loadedCars;
  };

  // ============================================================
  // Duty PDF parsing — delegated to the unified format-agnostic parser
  // (src/utils/dutyParser.ts). Handles every known layout: SAHARA columnar
  // (diff column, current = first duty col), HABIBA two-column (current =
  // last duty col), hybrid/non-hybrid split OR combined, freight column,
  // 2025/2026 double-year rows, duplicate & unnamed boxes.
  // ============================================================
  const parseAnyDutyPDF = async (file: File): Promise<DutyParseResult> => {
    const pdfjsLib = (window as any).pdfjsLib;
    return parseDutyPdfFile(file, pdfjsLib);
  };


  // Vehicle Name Word Match Score
  const getVehicleNameMatchScore = (carName: string, vehicleName: string): number => {
    if (!carName || !vehicleName) return 0;
    
    const cName = carName.toUpperCase();
    const vName = vehicleName.toUpperCase();
    
    // Ignore common manufacturer names and generic terms
    const ignoreWords = new Set(['TOYOTA', 'HONDA', 'NISSAN', 'MAZDA', 'SUBARU', 'MITSUBISHI', 'SUZUKI', 'HYBRID', 'NEW', 'CAR', 'VEHICLE', 'MODEL']);
    
    const cWords = cName.split(/[\s\/\-_]+/).filter(w => w && !ignoreWords.has(w) && w.length >= 2);
    const vWords = vName.split(/[\s\/\-_]+/).filter(w => w && !ignoreWords.has(w) && w.length >= 2);
    
    let matchCount = 0;
    for (const vw of vWords) {
      if (cWords.some(cw => cw.includes(vw) || vw.includes(cw))) {
        matchCount += 10;
      }
    }
    
    return matchCount;
  };

  // Clean Chassis Code (strip trailing suffixes like W, G, V preceded by digits)
  const cleanChassisCode = (code: string): string => {
    return code.trim().toUpperCase().replace(/(\d+)[WGV]$/, '$1');
  };

  // Chassis Extraction
  const extractChassis = (name: string): string => {
    const DRIVEWORDS = new Set(['4WD', '2WD', 'AWD', 'FWD', 'RWD', 'HB']);
    const upperName = name.trim().toUpperCase();

    // Specific explicit overrides for user-specified models to be 100% reliable
    if (upperName.includes('PRADO') && upperName.includes('TRJ150')) return 'TRJ150';
    if (upperName.includes('AXIO') && upperName.includes('NRE161')) return 'NRE161';
    if (upperName.includes('CR-V') && upperName.includes('RW1')) return 'RW1';
    if (upperName.includes('HARRIER') && upperName.includes('MXUA80')) return 'MXUA80';
    if (upperName.includes('ESQUIRE') && upperName.includes('ZRR80G')) return 'ZRR80G';
    if (upperName.includes('HIACE') && upperName.includes('TRH200')) return 'TRH200';
    if (upperName.includes('ZV11')) return 'ZVG11';

    const tokens = name.trim().toUpperCase().split(/[\s\/\-]+/);
    const CHASSIS_RE = /^([A-Z]{1,6})(\d{1,3})([A-Z0-9]{0,4})$/;

    // First pass: scan tokens from the end
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (DRIVEWORDS.has(t)) continue;
      if (CHASSIS_RE.test(t) && t.length >= 3 && t.length <= 10) {
        if (/^\d{4}$/.test(t)) continue; // ignore year-only numbers like 2021
        return t;
      }
    }

    // Second pass: global regex search for contiguous pattern
    const m = name.toUpperCase().match(/([A-Z]{1,5}\d{1,3}[A-Z0-9]{0,4})/g);
    if (m) {
      for (let i = m.length - 1; i >= 0; i--) {
        const val = m[i];
        if (val.length >= 3 && !/^\d+$/.test(val)) {
          return val;
        }
      }
    }
    return '';
  };

  // Duty matching algorithm EXACTLY as user provided!
  const closestYear = (rows: { [year: string]: DutyBlockRow }, target: number): string => {
    const yrs = Object.keys(rows).map(Number).sort((a, b) => a - b);
    if (!yrs.length) return '';
    let best = yrs[0];
    let bestDiff = Math.abs(yrs[0] - target);
    for (const yr of yrs) {
      const d = Math.abs(yr - target);
      if (d < bestDiff) {
        bestDiff = d;
        best = yr;
      }
    }
    return String(best);
  };

  const matchDuty = (blocks: DutyBlock[], carName: string, year: number, selectedMonth: 'jan' | 'feb') => {
    const chassis = extractChassis(carName);
    if (!chassis) return null;

    const y = String(year);
    const scored: {
      cs: number;
      nameScore: number;
      hasExact: boolean;
      dutyVal: number;
      pickedYear: string;
      b: DutyBlock;
    }[] = [];

    for (const b of blocks) {
      if (!Object.keys(b.rows).length) continue;
      const bc = b.chassisCode.toUpperCase();
      const tc = chassis.toUpperCase();

      const cleanBc = cleanChassisCode(bc);
      const cleanTc = cleanChassisCode(tc);

      let cs = 0;
      if (bc === tc) {
        cs = 5;
      } else if (cleanBc === cleanTc) {
        cs = 4;
      } else if (bc.startsWith(tc)) {
        cs = 3;
      } else if (cleanBc.startsWith(cleanTc)) {
        cs = 3;
      } else if (tc.startsWith(bc) || cleanTc.startsWith(cleanBc)) {
        cs = 2;
      } else if (bc.includes(tc) || tc.includes(bc)) {
        cs = 1;
      }

      if (!cs) continue;

      const hasExact = !!b.rows[y];
      const pickY = hasExact ? y : closestYear(b.rows, year);
      const row = b.rows[pickY];
      const dVal = row ? (selectedMonth === 'jan' ? row.jan : row.feb) : 0;
      
      const nameScore = getVehicleNameMatchScore(carName, b.vehicleName);

      scored.push({
        cs,
        nameScore,
        hasExact,
        dutyVal: dVal,
        pickedYear: pickY,
        b
      });
    }

    if (!scored.length) return null;

    // Sorting according to new priorities: Chassis score first, then exact year match, then HIGHEST amount, then name similarity
    scored.sort((a, b) => {
      // 1. Vehicle name first. Exporter lists name the car correctly but often drop a letter
      //    from the code — "FIELDER NKE165" is a FIELDER (NKE165G), not the AXIO that owns the
      //    bare NKE165 — so a clearly better name beats a closer code. This also separates the
      //    genuinely shared codes (ZWR80G = NOAH / VOXY / ESQUIRE, AAHH40W = ALPHARD / VELLFIRE).
      if (b.nameScore !== a.nameScore) {
        return b.nameScore - a.nameScore;
      }
      // 2. Chassis match strength (higher is better)
      if (b.cs !== a.cs) {
        return b.cs - a.cs;
      }
      // 3. Exact year match priority
      if (b.hasExact !== a.hasExact) {
        return b.hasExact ? 1 : -1;
      }
      // 4. Highest amount (safety fallback when the name cannot separate them,
      //    e.g. TRH200 across four HIACE van variants — exporter sheets never
      //    carry the emission prefix, so over-quoting is the safe side).
      return b.dutyVal - a.dutyVal;
    });

    const best = scored[0].b;
    const exact = scored[0].hasExact;
    const pickY = scored[0].pickedYear;
    const dutyVal = scored[0].dutyVal;

    // Why this entry won, for the note in the workbook: compare it with the closest rival that
    // is a DIFFERENT vehicle, so the reason names the step that actually ruled the others out.
    const nameOf = (x: any) => (x.b.vehicleName || '').trim().toUpperCase();
    const next = scored.find(x => nameOf(x) !== nameOf(scored[0])) || scored[1];
    const reason: string = !next
      ? 'only entry for this code'
      : scored[0].nameScore > next.nameScore
        ? 'vehicle name'
        : scored[0].cs > next.cs
          ? 'chassis code'
          : scored[0].hasExact !== next.hasExact
            ? 'exact year'
            : 'highest amount';

    // Name and code pointing at different entries: the strongest code match is a car with a
    // weaker name match. We follow the name, and hand the operator the other entry to check.
    const byCode = [...scored].sort((a, b) =>
      (b.cs - a.cs) || (Number(b.hasExact) - Number(a.hasExact)) || (b.dutyVal - a.dutyVal));
    const codePick = byCode[0];
    const conflict =
      codePick.b !== best && codePick.cs > scored[0].cs && codePick.nameScore < scored[0].nameScore
        ? { name: codePick.b.vehicleName, code: codePick.b.modelCode, duty: Math.round(codePick.dutyVal) }
        : null;

    return {
      duty: Math.round(dutyVal),
      exact,
      pickedYear: pickY,
      block: best,
      reason,
      conflict,
    };
  };

  // Additional Cost Brackets calculation
  const getAdditionalCost = (K: number): number => {
    for (const b of brackets) {
      if (K >= b.from && K <= b.to) return b.add;
    }
    return 0;
  };

  // ---- Month cross-check -------------------------------------------------
  // The Raita offer filename carries the month the costing is for (e.g.
  // "APRIL_11_RAITA_..."). Every duty sheet reports the month of the duty
  // column the parser selected (e.g. "APRIL", "JUNE'26", "MAR"). If the two
  // disagree the operator has almost certainly uploaded the wrong duty sheet —
  // and since a budget change can move TTI by 20%+, that silently produces
  // very wrong prices. So we block Generate until it is acknowledged.
  const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const normMonth = (label: string): string => {
    if (!label) return '';
    const up = label.toUpperCase();
    for (const k of MONTH_KEYS) {
      if (up.startsWith(k)) return k;
    }
    return '';
  };

  // Slots whose duty month disagrees with the Raita month.
  const monthMismatches = (() => {
    // No month anywhere in the Raita file -> we defer to the duty sheet's own
    // month (rule 3), so there is nothing to cross-check.
    if (!sheetMonth && !fileMonth) return [];
    const raita = normMonth(getDisplayMonth());
    if (!raita) return [];
    return slots
      .filter(s => s.result)
      .map(s => ({
        file: s.fileName,
        sheet: s.result!.meta.currentMonthLabel,
        ok: normMonth(s.result!.meta.currentMonthLabel) === raita,
      }))
      .filter(x => !x.ok);
  })();

  // Generate is blocked while (a) the Raita filename/title conflict is
  // unanswered, or (b) a duty-sheet month mismatch is unacknowledged.
  const monthBlocked =
    (monthConflict && !monthChoice) ||
    (monthMismatches.length > 0 && !monthOverride);

  // Compute Landing Cost for each car
  const handleCompute = () => {
    if (!cars) return;
    if (monthBlocked) {
      updateStatus('মাস মিলছে না — নিচের সতর্কবার্তা দেখুন।', true);
      return;
    }
    const blocks = dutyBlocks || [];

    const computed = cars.map(car => {
      const match = matchDuty(blocks, car.name, car.year, 'feb');

      const duty = match ? match.duty : 0;
      const converted = Math.round(car.usd * rate);
      const costing = converted + driver + duty;
      const additional = getAdditionalCost(costing);
      const final = costing + additional;

      const status: 'exact' | 'nearest' | 'manual' = !match ? 'manual' : (match.exact ? 'exact' : 'nearest');
      const verify = match && match.conflict
        ? `Name says ${match.block.vehicleName} (${match.block.modelCode}); ` +
          `the code alone is ${match.conflict.name} (${match.conflict.code}, ` +
          `${match.conflict.duty.toLocaleString('en-IN')}) — verify`
        : '';

      let note = '';
      if (match) {
        note = `Model: ${match.block.modelCode} | ${match.block.vehicleName} | ` +
          `Year: ${match.pickedYear}${match.exact ? '' : ' (nearest)'} | picked by: ${match.reason}` +
          (verify ? ` | ⚠ ${verify}` : '');
      } else {
        note = 'NO DUTY MATCH — fill manually';
      }

      return {
        ...car,
        prefix,
        converted,
        driver,
        duty,
        costing,
        additional,
        final,
        verify,
        status,
        note,
        matchModel: match ? match.block.modelCode : '',
        matchYear: match ? match.pickedYear : '',
      };
    });

    setRows(computed);
  };

  // File dropzone trigger and handling
  const triggerOfferSelect = () => {
    if (fileOfferRef.current) fileOfferRef.current.value = '';
    fileOfferRef.current?.click();
  };
  const triggerDutySelect = (idx: number) => {
    const ref = dutyRefs[idx].current;
    if (ref) { ref.value = ''; ref.click(); }
  };

  // Re-merge every parsed slot into a single duty pool. Called after any slot
  // gains or loses a PDF. Missing slots simply contribute nothing — so one
  // sheet, two split sheets, or a combined sheet all work identically.
  const recompilePool = (nextSlots: DutySlot[]) => {
    const parsed = nextSlots.map(s => s.result).filter(Boolean) as DutyParseResult[];
    if (!parsed.length) {
      setDutyBlocks(null);
      setDupNotices([]);
      updateStatus(carsRef.current ? 'Duty sheet আপলোড করুন।' : 'Offer list যোগ করুন।');
      return;
    }
    const { blocks, duplicates } = mergeDutyResults(parsed);
    setDutyBlocks(blocks);
    setDupNotices(duplicates);

    for (const r of parsed) {
      const m = r.meta;
      addLog(
        `${m.source}: ${m.blockCount} blocks (${m.hybridCount} hybrid / ${m.nonHybridCount} petrol), ` +
        `layout=${m.layout}, current-month=${m.currentMonthLabel}`,
        'ok',
      );
      for (const w of m.warnings) addLog(`  ⚠ ${m.source}: ${w}`, 'warn');
    }
    const hyb = blocks.filter(b => b.isHybrid).length;
    updateStatus(
      `✓ ${blocks.length} duty entries (${hyb} hybrid / ${blocks.length - hyb} petrol) from ` +
      `${parsed.length} sheet${parsed.length > 1 ? 's' : ''}. ${carsRef.current ? 'Generate করুন।' : 'Offer list দিন।'}`,
    );
  };

  const handleOfferChange = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    // Any file name is fine; the contents are checked instead (readRaita needs the
    // "CAR NAME" header plus SL / Year / Price columns and at least one car row).
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      updateStatus('Raita offer list টা Excel (.xlsx) বা CSV (.csv) হিসেবে দিন।', true);
      return;
    }
    const ticket = ++offerReqRef.current;
    beginBusy();
    try {
      if (!(await waitForLib('excel'))) return;
      if (ticket !== offerReqRef.current) return;   // a newer offer list was dropped meanwhile
      setOfferFileName(file.name);
      setMonthOverride(false);
      setMonthChoice(null);
      setSheetMonth('');
      updateStatus('Offer list পড়া হচ্ছে…');
      try {
        const loaded = await readRaita(file);
        if (ticket !== offerReqRef.current) return;
        setCars(loaded);
        updateStatus(`✓ ${loaded.length} গাড়ি loaded। Duty sheet আপলোড করুন।`);
      } catch (e: any) {
        if (ticket !== offerReqRef.current) return;
        setCars(null);
        setOfferFileName('');
        setSheetMonth('');
        updateStatus(e.message, true);
        addLog(e.message, 'err');
      }
    } finally {
      endBusy();
    }
  };

  const handleDutyChange = async (idx: number, fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    if (!/\.pdf$/i.test(file.name)) {
      updateStatus('অনুগ্রহ করে PDF ফাইল দিন।', true);
      return;
    }
    const ticket = ++slotReqRef.current[idx];          // a newer upload to this slot supersedes this one
    beginBusy();
    try {
      if (!(await waitForLib('pdf'))) return;
      if (ticket !== slotReqRef.current[idx]) return;
      updateStatus(`Duty sheet পড়া হচ্ছে: ${file.name}…`);
      setMonthOverride(false);
      addLog(`Parsing duty PDF: ${file.name}`, 'info');
      const result = await parseAnyDutyPDF(file);
      if (ticket !== slotReqRef.current[idx]) {
        addLog(`${file.name}: replaced by a newer upload in the same slot — ignored.`, 'warn');
        return;
      }
      // Build on the LATEST slots (not the ones captured before the await), so a sheet
      // that finished parsing in the other slot meanwhile is kept.
      const latest = slotsRef.current;
      const sig = dutySignature(result);
      const clash = latest.findIndex((s, i) => i !== idx && !!s.result && (
        (!!s.file && s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified) ||
        dutySignature(s.result!) === sig
      ));
      if (clash >= 0) {
        updateStatus(
          `এই duty sheet টা আগেই Duty Sheet ${clash + 1}-এ দেওয়া আছে। একই শিট দুবার দিলে সব entry দ্বিগুণ হয়ে যাবে — এই স্লটে অন্য শিট দিন।`,
          true,
        );
        addLog(`${file.name}: same sheet as Duty Sheet ${clash + 1} — not added.`, 'warn');
        const input = dutyRefs[idx].current;
        if (input) input.value = '';
        return;
      }
      commitSlots(latest.map((s, i) =>
        i === idx ? { ...s, file, fileName: file.name, result } : s,
      ));
    } catch (e: any) {
      if (ticket === slotReqRef.current[idx]) {
        updateStatus('PDF parsing error: ' + e.message, true);
        addLog(e.message, 'err');
      }
    } finally {
      endBusy();
    }
  };

  const clearDutySlot = (idx: number) => {
    slotReqRef.current[idx]++;                         // a parse still running for this slot is dropped
    setMonthOverride(false);
    commitSlots(slotsRef.current.map((s, i) =>
      i === idx ? { ...s, file: null, fileName: '', result: null } : s,
    ));
  };

  // Drag-and-drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (id === 'offer') await handleOfferChange(files);
    else if (id.startsWith('duty-')) {
      const idx = parseInt(id.split('-')[1], 10);
      await handleDutyChange(idx, files);
    }
  };

  // Additional cost formula generator EXACTLY matching user's Excel structure
  const addFormula = (rowIdx: number, totalCol: string = 'K'): string => {
    const K = `${totalCol}${rowIdx}`;
    return (
      `=IF(${K}>15000000,${brackets[0].add},` +
      `IF(${K}>12000000,${brackets[1].add},` +
      `IF(${K}>10000000,${brackets[2].add},` +
      `IF(${K}>8000000,${brackets[3].add},` +
      `IF(${K}>6000000,${brackets[4].add},` +
      `IF(${K}>4500000,${brackets[5].add},` +
      `IF(${K}>3500000,${brackets[6].add},` +
      `IF(${K}>=2500000,${brackets[7].add},0))))))))`
    );
  };

  // Excel workbook generator using ExcelJS from the CDN
  const handleDownloadExcel = async () => {
    if (!rows) return;
    setIsBusy(true);
    updateStatus('Workbook প্রস্তুত করা হচ্ছে…');

    try {
      const ExcelJS = (window as any).ExcelJS;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Costing Desk';
      wb.created = new Date();

      const ws = wb.addWorksheet('MY STOCK LIST', {
        views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }]
      });

      const NAVY = 'FF1F3864', WHITE = 'FFFFFFFF', LTGREY = 'FFD6DCE4',
        GREEN_F = 'FF006100', GREEN_BG = 'FFE2EFDA',
        AMBER_F = 'FF7D5A00', AMBER_BG = 'FFFFF2CC',
        RED_F = 'FF9C1A0A', RED_BG = 'FFFCE4E1';

      // Column layout. With an SL prefix the sheet opens with RAITA SL NO. (prefix & SL); with no
      // prefix that column is left out and everything after it moves one column to the left.
      // Every position below is written for the prefixed layout and passed through C().
      const hasPrefix = prefix.trim() !== '';
      const shift = hasPrefix ? 0 : 1;
      const colLetter = (n: number) => String.fromCharCode(64 + n);
      const C = (n: number) => n - shift;
      const L = (n: number) => colLetter(C(n));
      const LAST = C(12);
      const RATE_COL = colLetter(LAST + 2);     // N in the prefixed layout
      const DRIVER_COL = colLetter(LAST + 4);   // P in the prefixed layout

      const thin = (argb: string) => ({ style: 'thin', color: { argb } });
      const border = (c = 'FFCCCCCC') => ({ top: thin(c), left: thin(c), bottom: thin(c), right: thin(c) });

      ws.mergeCells(`A1:${colLetter(LAST)}1`);
      const r1 = ws.getCell('A1');
      r1.value = 'BISMILLAHIR RAHMANIR RAHIM';
      r1.alignment = { horizontal: 'center', vertical: 'middle' };
      r1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      r1.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF333333' }
      };
      ws.getRow(1).height = 25;

      ws.mergeCells(`A2:${colLetter(LAST)}2`);
      const r2 = ws.getCell('A2');
      r2.value = `GARIR DOKAN ${getDisplayMonth()} 2026 OFFER LIST`;
      r2.alignment = { horizontal: 'center', vertical: 'middle' };
      r2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      r2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB22222' }
      };
      ws.getRow(2).height = 35;

      ws.mergeCells(`A3:${colLetter(LAST)}3`);
      const r3 = ws.getCell('A3');
      r3.value = 'Call/WhatsApp : +880 1785-255586 | Visit our website : www.garirdokan.com';
      r3.alignment = { horizontal: 'center', vertical: 'middle' };
      r3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      r3.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF104E8B' }
      };
      ws.getRow(3).height = 25;

      const setAssump = (addr: string, label: string, val: number) => {
        ws.getCell(addr + '3').value = label;
        ws.getCell(addr + '3').font = { name: 'Arial', size: 9, bold: true };
        const vc = ws.getCell(String.fromCharCode(addr.charCodeAt(0) + 1) + '3');
        vc.value = val;
        vc.numFmt = '#,##0.00';
        vc.font = { name: 'Arial', size: 9, color: { argb: 'FF0000FF' }, bold: true };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER_BG } };
      };
      setAssump(colLetter(LAST + 1), 'USD Rate →', rate);
      setAssump(colLetter(LAST + 3), 'Driver+CNF →', driver);

      const HEADERS = [
        'RAITA SL NO.',
        'SL NO.',
        'CAR NAME',
        'YEAR',
        'DESCRIPTION',
        'PRICE',
        'PRICE (USD)',
        'PRICE (BDT)',
        'DRIVER + CNF',
        'DUTY',
        'TOTAL',
        'Additional Cost'
      ];
      const hRow = ws.getRow(4);
      hRow.height = 28;
      const headers = hasPrefix ? HEADERS : HEADERS.slice(1);
      headers.forEach((h, i) => {
        const c = hRow.getCell(i + 1);
        c.value = h;
        c.font = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D5D66' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'medium', color: { argb: 'FF0D5D66' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
      });

      let exRow = 4;
      let prevName = '';

      for (const d of rows) {
        if (prevName && d.name !== prevName) {
          exRow++;
          const sepR = ws.getRow(exRow);
          sepR.height = 6;
          for (let c = 1; c <= LAST; c++) {
            sepR.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4EEDF' } };
          }
        }
        exRow++;
        const row = ws.getRow(exRow);
        row.height = 48;

        const cell = (col: number, val: any, numFmt: string | null, extra: any) => {
          const c = row.getCell(col);
          c.value = val;
          c.border = border();
          c.font = { name: 'Arial', size: 10, ...(extra?.font || {}) };
          if (numFmt) c.numFmt = numFmt;
          if (extra?.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: extra.fill } };
          if (extra?.align) c.alignment = extra.align;
          if (extra?.note) c.note = { texts: [{ text: extra.note }], margins: { insetmode: 'auto' } };
          return c;
        };

        const ER = exRow;

        if (hasPrefix) {
          cell(1, { formula: `="${prefix}"&B${ER}`, result: `${prefix}${d.sl}` }, '@', {
            align: { horizontal: 'center', vertical: 'middle' },
            font: { bold: true, size: 10, color: { argb: 'FF9C3722' } }
          });
        }

        cell(C(2), d.sl, '0', { align: { horizontal: 'center', vertical: 'middle' } });
        cell(C(3), d.name, '@', { align: { vertical: 'middle', wrapText: false }, font: { bold: true, size: 10 } });
        cell(C(4), d.year, '0', { align: { horizontal: 'center', vertical: 'middle' } });
        cell(C(5), d.desc, '@', { align: { vertical: 'middle', wrapText: true }, font: { size: 9, color: { argb: 'FF555555' } } });

        cell(C(6), { formula: `=${L(11)}${ER}+${L(12)}${ER}`, result: d.final }, '#,##0', {
          font: { bold: true, size: 11, color: { argb: GREEN_F } },
          fill: GREEN_BG,
          align: { horizontal: 'right', vertical: 'middle' }
        });

        cell(C(7), d.usd, '#,##0.00', { align: { horizontal: 'right', vertical: 'middle' } });
        cell(C(8), { formula: `=${L(7)}${ER}*$${RATE_COL}$3`, result: d.converted }, '#,##0', { align: { horizontal: 'right', vertical: 'middle' } });
        cell(C(9), { formula: `=$${DRIVER_COL}$3`, result: d.driver }, '#,##0', { align: { horizontal: 'right', vertical: 'middle' } });

        cell(C(10), d.duty, '#,##0', {
          align: { horizontal: 'right', vertical: 'middle' },
          note: d.note,
          fill: d.status === 'manual' ? RED_BG : (d.status === 'nearest' || d.verify ? AMBER_BG : undefined)
        });

        cell(C(11), { formula: `=${L(8)}${ER}+${L(9)}${ER}+${L(10)}${ER}`, result: d.costing }, '#,##0', { align: { horizontal: 'right', vertical: 'middle' } });
        cell(C(12), { formula: addFormula(ER, L(11)), result: d.additional }, '#,##0', { align: { horizontal: 'right', vertical: 'middle' } });

        prevName = d.name;
      }

      const widths: { [key: number]: number } = { 1: 9, 2: 9, 3: 22, 4: 7, 5: 50, 6: 14, 7: 10, 8: 14, 9: 12, 10: 14, 11: 14, 12: 14 };
      Object.entries(widths).forEach(([c, w]) => {
        if (!hasPrefix && +c === 1) return;          // no RAITA SL NO. column to size
        ws.getColumn(C(+c)).width = w;
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);

      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `MY STOCK LIST - COSTING (${getDisplayMonth()}-2026).xlsx`
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      updateStatus('✓ Excel ফাইলটি ডাউনলোড হয়েছে।');
    } catch (e: any) {
      updateStatus('Workbook Error: ' + e.message, true);
      addLog(e.message, 'err');
      console.error(e);
    }
    setIsBusy(false);
  };

  const handleBracketChange = (idx: number, val: number) => {
    // Replace just that bracket; never mutate the shared DEFAULT_BRACKETS objects.
    setBrackets(prev => prev.map((b, i) => (i === idx ? { ...b, add: val } : b)));
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

  const exCount = rows ? rows.filter(r => r.status === 'exact').length : 0;
  const nrCount = rows ? rows.filter(r => r.status === 'nearest').length : 0;
  const mnCount = rows ? rows.filter(r => r.status === 'manual').length : 0;

  // Range text for a bracket, built from its own limits so the label and the amount beside
  // it always belong together. A lower limit like 3,500,001 reads "> ৳3,500,000".
  const bracketLabel = (b: Bracket): string => {
    const n = (v: number) => v.toLocaleString('en-US');
    const exclusive = b.from % 1000 === 1;
    const low = exclusive ? b.from - 1 : b.from;
    const op = exclusive ? '>' : '≥';
    return b.to === Infinity ? `${op} ৳${n(low)}` : `${op} ৳${n(low)} – ${n(b.to)}`;
  };
  // Shown smallest range first; each row still edits its own bracket.
  const bracketRows = brackets
    .map((b, i) => ({ b, i }))
    .sort((x, y) => x.b.from - y.b.from);

  return (
    <>
      <style>{`
        :root{
          --petrol:#0C3A38;--petrol-d:#072321;--petrol-l:#11514C;
          --manila:#F0E7D4;--paper:#FBF7EF;--paper-2:#F4EEDF;
          --ink:#14211F;--ink-soft:#47564F;--ink-faint:#7A867F;
          --stamp:#C1452C;--stamp-d:#9C3722;
          --green:#1E6F4C;--green-bg:#DDEBDF;
          --amber:#A9760F;--amber-bg:#F2E6C8;
          --red:#B23A2A;--red-bg:#F2DDD7;
          --line:rgba(20,33,31,.16);--line-soft:rgba(20,33,31,.08);
          --shadow:0 1px 0 rgba(255,255,255,.5) inset,0 18px 40px -24px rgba(0,0,0,.55);
        }
        
        /* page background comes from the host page (.gd-app) */
        
        .num{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
        .wrap{max-width:1200px;margin:0 auto;padding:0 22px}

        /* MASTHEAD */
        .mast{position:relative;overflow:hidden;border-bottom:1px solid rgba(240,231,212,.16)}
        .mast::before{content:"";position:absolute;inset:0;opacity:.08;pointer-events:none;
          background-image:repeating-linear-gradient(90deg,rgba(240,231,212,.6) 0 1px,transparent 1px 26px),
            repeating-linear-gradient(0deg,rgba(240,231,212,.5) 0 1px,transparent 1px 26px);
          mask-image:radial-gradient(120% 100% at 50% 0%,#000 35%,transparent 78%)}
        .mast-in{position:relative;display:flex;align-items:center;gap:20px;padding:26px 0 30px}
        .seal{flex:0 0 auto;width:74px;height:74px;display:grid;place-items:center;
          border:2.5px solid var(--stamp);border-radius:50%;transform:rotate(-7deg);
          box-shadow:0 0 0 2px rgba(193,69,44,.25);background:rgba(193,69,44,.06);position:relative}
        .seal b{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:34px;color:#E9DFC9}
        .seal small{position:absolute;bottom:7px;font-size:6.5px;letter-spacing:.18em;color:var(--stamp);font-weight:600}
        .mast h1{font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--manila);
          font-size:clamp(24px,4.2vw,38px);letter-spacing:-.01em;line-height:1.02}
        .mast .lede{color:rgba(240,231,212,.74);margin:5px 0 0;font-size:14.5px;max-width:54ch}
        .mast .bn{color:rgba(240,231,212,.5);font-size:12.5px;margin-top:3px}
        .ticket{margin-left:auto;align-self:flex-start;border:1px solid rgba(240,231,212,.28);
          border-radius:4px;padding:9px 13px;color:rgba(240,231,212,.78);font-size:11px;
          letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
        @media(max-width:680px){.ticket{display:none}.mast-in{gap:12px}}

        /* SHEET PANEL */
        .sheet{background:var(--paper);border-radius:8px;box-shadow:var(--shadow);
          margin:26px 0;overflow:hidden;border:1px solid rgba(0,0,0,.06)}
        .sheet-head{display:flex;align-items:center;gap:12px;background:var(--manila);
          border-bottom:1.5px solid var(--line);padding:13px 22px}
        .sheet-head .tag{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;
          letter-spacing:.16em;color:var(--stamp);text-transform:uppercase}
        .sheet-head h2{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--ink)}
        .sheet-head .bn{margin-left:auto;color:var(--ink-faint);font-size:12.5px}
        @media(max-width:600px){.sheet-head .bn{display:none}}
        .sheet-body{padding:22px}

        /* INTAKE Dropzones */
        .intake-container{display:flex;flex-direction:column;gap:16px}
        .intake{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .intake-3{grid-template-columns:repeat(3,1fr)}
        @media(max-width:920px){.intake-3{grid-template-columns:1fr 1fr}}
        @media(max-width:720px){.intake,.intake-3{grid-template-columns:1fr}}
        .month-warn{margin-top:14px;padding:12px 14px;border:1.5px solid var(--stamp);
          background:#fff5f5;border-radius:6px;font-size:12.5px;color:var(--ink);line-height:1.65}
        .month-warn b{color:var(--stamp)}
        .month-warn .ovr{display:inline-flex;align-items:center;gap:7px;margin-top:8px;
          cursor:pointer;font-weight:600;color:var(--stamp)}
        .month-warn .ovr input{cursor:pointer}
        .month-warn .mchoice{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
        .month-warn .mbtn{padding:6px 12px;border:1.5px solid var(--line);background:#fff;
          border-radius:5px;cursor:pointer;font:inherit;font-size:12.5px;color:var(--ink)}
        .month-warn .mbtn:hover{border-color:var(--stamp)}
        .month-warn .mbtn.on{border-color:var(--stamp);background:var(--stamp);color:#fff;font-weight:600}
        .month-warn .mbtn.on .num{color:#fff}
        .dup-note{margin-top:14px;padding:11px 14px;border:1px solid var(--amber);
          background:var(--amber-bg);border-radius:6px;font-size:12.5px;color:var(--ink);line-height:1.6}
        .dup-note b{color:var(--amber)}
        @media(max-width:720px){.intake,.intake-3{grid-template-columns:1fr}}
        .drop{position:relative;border:1.5px dashed var(--line);border-radius:6px;background:var(--paper-2);
          padding:22px 18px 18px;cursor:pointer;transition:border-color .18s,background .18s,transform .16s;
          display:flex;flex-direction:column;min-height:150px}
        .drop:hover,.drop:focus-visible{border-color:var(--stamp);background:#F7F1E2;outline:none}
        .drop.drag{border-color:var(--green);background:#EEF4EA;transform:translateY(-2px)}
        .drop.has{border-style:solid;border-color:var(--green);background:#F1F6EE}
        .drop .step{position:absolute;top:-12px;left:16px;width:24px;height:24px;border-radius:50%;
          background:var(--petrol);color:var(--manila);display:grid;place-items:center;
          font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px}
        .drop h3{margin:2px 0 3px;font-size:15px;font-weight:600}
        .drop p{color:var(--ink-soft);font-size:13px}
        .drop .hint{font-size:11.5px;color:var(--ink-faint);margin-top:4px}
        .drop .files{margin-top:auto;padding-top:10px;font-family:'IBM Plex Mono',monospace;font-size:11.5px;
          color:var(--green);word-break:break-all;line-height:1.7}
        .drop .files .none{color:var(--ink-faint)}
        input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}

        /* PARAMS */
        .params{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end;
          margin-top:20px;padding-top:18px;border-top:1px solid var(--line-soft)}
        .field{display:flex;flex-direction:column;gap:5px}
        .field label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);font-weight:600}
        .field input[type=number],.field input[type=text]{font-family:'IBM Plex Mono',monospace;font-size:14px;
          width:120px;padding:8px 10px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink)}
        .field input:focus{outline:2px solid var(--stamp);outline-offset:-1px;border-color:transparent}
        .seg{display:inline-flex;border:1px solid var(--line);border-radius:5px;overflow:hidden;background:#fff}
        .seg button{font-family:'IBM Plex Mono',monospace;font-size:12.5px;padding:8px 13px;border:0;
          background:transparent;color:var(--ink-soft);cursor:pointer;letter-spacing:.04em;transition:background .14s}
        .seg button.on{background:var(--petrol);color:var(--manila);font-weight:600}
        /* Chrome-style mode tabs */
        .mode-tabs{display:flex;gap:6px;align-items:flex-end;border-bottom:2px solid var(--line);margin-bottom:16px}
        .mode-tab{font-family:'IBM Plex Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;
          padding:11px 18px 9px;border:1px solid var(--line);border-bottom:none;
          border-radius:9px 9px 0 0;background:#ece6d8;color:var(--ink-soft);
          margin-bottom:-2px;transition:background .14s,color .14s;display:flex;align-items:center;gap:8px;white-space:nowrap}
        .mode-tab:hover{background:#f3eee2}
        .mode-tab.on{background:var(--paper);color:var(--petrol);border-color:var(--line);
          border-bottom:2px solid var(--paper)}
        .mode-tab .tnum{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;
          font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;
          background:var(--line);color:var(--ink)}
        .mode-tab.on .tnum{background:var(--petrol);color:var(--manila)}
        @media(max-width:560px){.mode-tab{padding:9px 11px;font-size:12.5px}}
        details.adv{margin-left:auto;width:auto}
        @media(max-width:760px){details.adv{margin-left:0;width:100%}}
        details.adv summary{list-style:none;cursor:pointer;font-size:12.5px;color:var(--stamp);
          font-weight:600;letter-spacing:.04em;user-select:none;padding:8px 0}
        details.adv summary::-webkit-details-marker{display:none}
        details.adv summary::before{content:"▸ "}
        details.adv[open] summary::before{content:"▾ "}
        .brackets{margin-top:8px;border:1px solid var(--line-soft);border-radius:6px;overflow:hidden;width:340px}
        @media(max-width:760px){.brackets{width:100%}}
        .brackets table{width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',monospace;font-size:12px}
        .brackets th{background:var(--paper-2);text-align:left;padding:7px 12px;font-weight:600;
          color:var(--ink-soft);font-size:11px;letter-spacing:.06em}
        .brackets td{padding:5px 10px;border-top:1px solid var(--line-soft)}
        .brackets input{font-family:'IBM Plex Mono',monospace;font-size:12px;width:110px;
          padding:5px 7px;border:1px solid var(--line);border-radius:3px;background:#fff}
        .brackets .op{color:var(--ink-faint);font-size:11px}

        /* ACTIONS */
        .actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:22px}
        .btn{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;letter-spacing:.02em;
          padding:12px 24px;border-radius:5px;border:0;cursor:pointer;transition:transform .12s,box-shadow .12s,background .15s}
        .btn:disabled{opacity:.42;cursor:not-allowed;transform:none!important}
        .btn-primary{background:var(--stamp);color:#FBEFE9;
          box-shadow:0 0 0 1.5px var(--stamp-d) inset,0 10px 22px -12px rgba(193,69,44,.8)}
        .btn-primary:not(:disabled):hover{background:var(--stamp-d);transform:translateY(-1px)}
        .btn-ghost{background:#fff;color:var(--petrol);box-shadow:0 0 0 1.5px var(--line) inset}
        .btn-ghost:not(:disabled):hover{box-shadow:0 0 0 1.5px var(--petrol) inset;transform:translateY(-1px)}
        .status-txt{font-size:13px;color:var(--ink-soft);min-height:18px}
        .status-txt.err{color:var(--red);font-weight:600}
        .bar{height:4px;background:var(--line-soft);border-radius:3px;overflow:hidden;flex-basis:100%;display:none}
        .bar.show{display:block}
        .bar i{display:block;height:100%;width:30%;background:var(--stamp);border-radius:3px;
          animation:slide 1.1s ease-in-out infinite}
        @keyframes slide{0%{margin-left:-30%}100%{margin-left:110%}}

        /* LOG */
        .log-box{margin-top:16px;background:var(--petrol-d);border-radius:6px;padding:14px 16px;
          max-height:180px;overflow-y:auto;display:none;font-family:'IBM Plex Mono',monospace;font-size:11.5px;line-height:1.7}
        .log-box.show{display:block}
        .log-box .li{padding:1px 0}
        .log-box .li.ok{color:#6fcf97}.log-box .li.warn{color:#f2c94c}.log-box .li.err{color:#eb5757}.log-box .li.info{color:#9bbcd6}

        /* RESULTS */
        #results{display:none}
        .stats{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
        .stat{border:1px solid var(--line);border-radius:6px;padding:11px 15px;min-width:110px;background:var(--paper-2)}
        .stat .k{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;line-height:1}
        .stat .l{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-top:3px}
        .stat.g{background:var(--green-bg);border-color:#bcd3bf}.stat.g .k{color:var(--green)}
        .stat.a{background:var(--amber-bg);border-color:#e2cf9e}.stat.a .k{color:var(--amber)}
        .stat.r{background:var(--red-bg);border-color:#e4bdb2}.stat.r .k{color:var(--red)}
        .legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--ink-soft);margin:0 0 13px}
        .legend span{display:inline-flex;align-items:center;gap:6px}
        .dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0}
        .dot.g{background:var(--green)}.dot.a{background:var(--amber)}.dot.r{background:var(--red)}
        .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:7px}
        table.manifest{border-collapse:collapse;width:100%;min-width:960px;font-size:12.5px;background:#fff}
        table.manifest thead th{position:sticky;top:0;background:var(--petrol);color:var(--manila);
          font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:10.5px;letter-spacing:.05em;
          text-transform:uppercase;padding:10px 11px;text-align:right;white-space:nowrap;z-index:2}
        table.manifest thead th.l{text-align:left}
        table.manifest tbody td{padding:8px 11px;border-top:1px solid var(--line-soft);text-align:right;white-space:nowrap}
        table.manifest tbody td.l{text-align:left;white-space:normal;max-width:280px;font-size:11.5px}
        table.manifest tbody td.car-cell{white-space:nowrap;max-width:none}
        table.manifest tbody tr:nth-child(even){background:var(--paper)}
        table.manifest tbody tr.row-nearest{background:var(--amber-bg)!important}
        table.manifest tbody tr.row-manual{background:var(--red-bg)!important}
        table.manifest tbody tr:hover{background:#eef4ea!important}
        .sl-badge{font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--stamp)}
        .chassis-tag{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--ink-faint);
          display:block;margin-top:1px}
        .final-price{font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)}
        .chip{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.04em;
          padding:2px 7px;border-radius:10px;text-transform:uppercase;display:inline-block}
        .chip.g{background:var(--green-bg);color:var(--green)}
        .chip.a{background:var(--amber-bg);color:var(--amber)}
        .chip.r{background:var(--red-bg);color:var(--red)}
        .duty-cell{cursor:help;border-bottom:1px dashed var(--ink-faint)}
        .sep-row td{background:var(--paper-2)!important;height:8px;padding:0!important;border:none!important}

        footer{padding-bottom:40px}
        .notes{font-size:12px;color:rgba(240,231,212,.58);line-height:1.7;margin:6px 0 30px}
        .notes b{color:rgba(240,231,212,.82);font-weight:600}
      `}</style>

      <header className="mast" id="headerSection">
        <div className="wrap mast-in">
          <div className="seal"><b>৳</b><small>COSTING · BD</small></div>
          <div>
            <h1>Japan to BD Convert</h1>
            <p className="lede">Drop the Raita offer list (Excel) and customs duty sheets (PDF). Get a BDT landed-cost workbook with live formulas, ready to price.</p>
            <p className="bn">রাইটা অফার + ডিউটি শিট → বিডিটি কস্টিং শিট, ফর্মুলা সহ</p>
          </div>
          <div className="ticket">Customs costing<br />terminal</div>
        </div>
      </header>

      <main className="wrap">
        <section className="sheet" id="intakePanel">
          <div className="sheet-head">
            <span className="tag">Intake</span>
            <h2>Documents</h2>
            <span className="bn">অফার লিস্ট + ডিউটি শিট দিন</span>
          </div>
          <div className="sheet-body">
            <div className="intake-container">
              <p className="bn" style={{ margin: '0 0 4px', fontSize: '12.5px', color: 'var(--ink-faint)' }}>
                Raita offer (Excel) + যেকোনো ১–২টি ডিউটি শিট (PDF)। Hybrid+Non-Hybrid একসাথে হোক বা আলাদা — যেকোনো স্লটে দিন, নিজে থেকে বুঝে নেবে।
              </p>

              <div className="intake intake-3">
                {/* OFFER DROP */}
                <div
                  className={`drop ${offerFileName ? 'has' : ''}`}
                  onClick={triggerOfferSelect}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'offer')}
                  tabIndex={0}
                  role="button"
                  aria-label="Upload Raita offer list"
                >
                  <span className="step">1</span>
                  <h3>Raita Offer List</h3>
                  <p>Excel (.xlsx) বা CSV (.csv) — যেকোনো file name</p>
                  <span className="hint">Click করুন বা file টা এখানে drag করুন</span>
                  <div className="files">
                    {offerFileName ? (
                      <span>▸ {offerFileName}</span>
                    ) : (
                      <span className="none">কোনো file নেই</span>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileOfferRef}
                    onChange={(e) => handleOfferChange(e.target.files)}
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                  />
                </div>

                {/* TWO FORMAT-AGNOSTIC DUTY SLOTS */}
                {slots.map((slot, idx) => {
                  const r = slot.result;
                  const hyb = r ? r.blocks.filter(b => b.isHybrid).length : 0;
                  const pet = r ? r.blocks.length - hyb : 0;
                  return (
                    <div
                      key={slot.id}
                      className={`drop ${slot.fileName ? 'has' : ''}`}
                      onClick={() => triggerDutySelect(idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, slot.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Upload duty PDF ${idx + 1}`}
                    >
                      <span className="step">{idx + 2}</span>
                      <h3>Duty Sheet {idx + 1}{idx === 1 ? ' (optional)' : ''}</h3>
                      <p>যেকোনো ডিউটি শিট — Combined বা Hybrid/Non-Hybrid</p>
                      <span className="hint">PDF file সিলেক্ট করুন</span>
                      <div className="files">
                        {slot.fileName ? (
                          <>
                            <span>▸ {slot.fileName}</span>
                            {r && (
                              <span style={{ color: 'var(--ink-faint)', display: 'block' }}>
                                {r.blocks.length} entries · {hyb}H / {pet}P · {r.meta.layout} · {r.meta.currentMonthLabel}
                              </span>
                            )}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); clearDutySlot(idx); }}
                              style={{ color: 'var(--stamp)', cursor: 'pointer', display: 'inline-block', marginTop: 2 }}
                            >
                              ✕ সরান
                            </span>
                          </>
                        ) : (
                          <span className="none">কোনো file নেই</span>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={dutyRefs[idx]}
                        onChange={(e) => handleDutyChange(idx, e.target.files)}
                        accept="application/pdf,.pdf"
                        style={{ display: 'none' }}
                      />
                    </div>
                  );
                })}
              </div>

              {monthConflict && (
                <div className="month-warn">
                  <b>❓ Raita শিটে দুই মাস পাওযা গেছে</b> — কোনটা ধরব?
                  <div className="mchoice">
                    <button
                      type="button"
                      className={`mbtn ${monthChoice === 'sheet' ? 'on' : ''}`}
                      onClick={() => setMonthChoice('sheet')}
                    >
                      শিটের ভেতরে: <span className="num">{sheetMonth}</span>
                    </button>
                    <button
                      type="button"
                      className={`mbtn ${monthChoice === 'file' ? 'on' : ''}`}
                      onClick={() => setMonthChoice('file')}
                    >
                      ফাইলের নামে: <span className="num">{fileMonth}</span>
                    </button>
                  </div>
                  {monthChoice && (
                    <div style={{ marginTop: 6 }}>
                      ✓ <b>{getDisplayMonth()}</b> ধরা হলো।
                    </div>
                  )}
                </div>
              )}

              {monthMismatches.length > 0 && (
                <div className="month-warn">
                  <b>⛔ মাস মিলছে না</b> — Raita শিট: <span className="num">{getDisplayMonth()}</span>,
                  {' '}কিন্তু ডিউটি শিট:{' '}
                  <span className="num">
                    {monthMismatches.map(m => `${m.sheet} (${m.file})`).join(', ')}
                  </span>
                  <div style={{ marginTop: 6 }}>
                    ভুল মাসের ডিউটি শিট দিলে দাম অনেক ভুল আসবে (Budget বদলালে TTI ২০%+ পর্যন্ত বাড়ে)।
                    {' '}সঠিক শিট দিন, অথবা—
                  </div>
                  <label className="ovr">
                    <input
                      type="checkbox"
                      checked={monthOverride}
                      onChange={(e) => setMonthOverride(e.target.checked)}
                    />
                    <span>আমি জানি, তারপরেও হিসাব করো</span>
                  </label>
                </div>
              )}

              {dupNotices.length > 0 && (
                <div className="dup-note">
                  <b>⚠ নাম দিয়ে আলাদা করা যায়নি</b> — এই chassis code-গুলোর একাধিক এন্ট্রির গাড়ির নামও এক।
                  {' '}এখানে <b>সবচেয়ে বেশি duty amount</b> ধরা হবে (Raita শিটে emission prefix থাকে না, তাই নিশ্চিত করা সম্ভব নয়):
                  <span className="num"> {dupNotices.slice(0, 8).join('  ·  ')}{dupNotices.length > 8 ? ` …+${dupNotices.length - 8}` : ''}</span>
                </div>
              )}
            </div>

            {/* PARAMETERS */}
            <div className="params">
              <div className="field">
                <label htmlFor="pPrefix">SL Prefix</label>
                <input
                  type="text"
                  id="pPrefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  maxLength={4}
                  style={{ width: '70px' }}
                />
              </div>
              <div className="field">
                <label htmlFor="pRate">USD → ৳ Rate</label>
                <input
                  type="number"
                  id="pRate"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  min="1"
                  step="0.5"
                />
              </div>
              <div className="field">
                <label htmlFor="pDriver">Driver + C&F (৳)</label>
                <input
                  type="number"
                  id="pDriver"
                  value={driver}
                  onChange={(e) => setDriver(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="500"
                />
              </div>
              <details className="adv">
                <summary>Additional cost brackets</summary>
                <div className="brackets">
                  <table>
                    <thead>
                      <tr>
                        <th>Costing Total (৳)</th>
                        <th>Add. Cost (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bracketRows.map(({ b, i }) => (
                        <tr key={i}>
                          <td>
                            <span className="op">{bracketLabel(b)}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={b.add}
                              onChange={(e) => handleBracketChange(i, parseFloat(e.target.value) || 0)}
                              step="10000"
                              style={{ width: '110px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>

            {/* ACTIONS */}
            <div className="actions">
              <button
                className="btn btn-primary"
                id="btnGen"
                disabled={!cars || !cars.length || !dutyBlocks || !dutyBlocks.length || !libsReady || monthBlocked}
                onClick={handleCompute}
              >
                Generate Costing
              </button>
              <button
                className="btn btn-ghost"
                id="btnDl"
                disabled={!rows || !rows.length || !libsReady}
                onClick={handleDownloadExcel}
              >
                Download Workbook
              </button>
              <span className={`status-txt ${isErr ? 'err' : ''}`} id="statusTxt">
                {statusTxt}
              </span>
              <div className={`bar ${isBusy ? 'show' : ''}`} id="bar">
                <i></i>
              </div>
            </div>

            {/* LOGS */}
            <div className={`log-box ${logs.length > 0 ? 'show' : ''}`} id="logBox">
              {logs.map((l, i) => (
                <div key={i} className={`li ${l.type}`}>
                  [{l.time}] {l.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RESULTS PREVIEW */}
        {rows && rows.length > 0 && (
          <section className="sheet" id="results" style={{ display: 'block' }}>
            <div className="sheet-head">
              <span className="tag">Manifest</span>
              <h2>Costing Preview</h2>
              <span className="bn" id="resBn">
                {rows.length} গাড়ি · {getDisplayMonth()}-2026
              </span>
            </div>
            <div className="sheet-body">
              <div className="stats" id="statsBox">
                <div className="stat">
                  <div className="k num">{rows.length}</div>
                  <div className="l">Total Cars</div>
                </div>
                <div className="stat g">
                  <div className="k num">{exCount}</div>
                  <div className="l">Exact Year</div>
                </div>
                <div className="stat a">
                  <div className="k num">{nrCount}</div>
                  <div className="l">Nearest Year</div>
                </div>
                <div className="stat r">
                  <div className="k num">{mnCount}</div>
                  <div className="l">No Duty</div>
                </div>
              </div>

              <div className="legend">
                <span><i className="dot g"></i>Exact year match</span>
                <span><i className="dot a"></i>Nearest year used — check করুন</span>
                <span><i className="dot r"></i>Duty পাওয়া যায়নি — manually দিন</span>
              </div>

              <div className="tablewrap">
                <table className="manifest">
                  <thead>
                    <tr>
                      <th className="l">SL</th>
                      <th className="l">Car Name</th>
                      <th>Year</th>
                      <th>USD</th>
                      <th>Converted (৳)</th>
                      <th>Driver+C&F</th>
                      <th>Duty (৳)</th>
                      <th>Costing Total</th>
                      <th>Additional</th>
                      <th>Final Price (৳)</th>
                      <th className="l">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let prevName = '';
                      return rows.map((r, idx) => {
                        const showSep = prevName && r.name !== prevName;
                        prevName = r.name;
                        const rowClass = r.status === 'manual' ? 'row-manual' : ((r.status === 'nearest' || r.verify) ? 'row-nearest' : '');
                        return (
                          <React.Fragment key={idx}>
                            {showSep && (
                              <tr className="sep-row">
                                <td colSpan={11}></td>
                              </tr>
                            )}
                            <tr className={rowClass}>
                              <td className="l">
                                <span className="sl-badge">{r.prefix}{r.sl}</span>
                              </td>
                              <td className="l car-cell">
                                {r.name}
                                {r.matchModel && (
                                  <span className="chassis-tag">
                                    {r.matchModel}
                                    {r.matchYear && r.matchYear !== String(r.year) ? ` · y${r.matchYear}` : ''}
                                  </span>
                                )}
                              </td>
                              <td className="num">{r.year}</td>
                              <td className="num">{fmt(r.usd)}</td>
                              <td className="num">{fmt(r.converted)}</td>
                              <td className="num">{fmt(r.driver)}</td>
                              <td className="num">
                                <span className="duty-cell" title={r.note}>
                                  {fmt(r.duty)}
                                </span>
                              </td>
                              <td className="num">{fmt(r.costing)}</td>
                              <td className="num">{fmt(r.additional)}</td>
                              <td className="final-price num">{fmt(r.final)}</td>
                              <td className="l">
                                {r.status === 'exact' && <span className="chip g">✓ exact</span>}
                                {r.status === 'nearest' && <span className="chip a">≈ nearest</span>}
                                {r.status === 'manual' && <span className="chip r">✗ manual</span>}
                                {r.verify && <span className="chip a" title={r.verify}>⚠ name vs code</span>}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <footer>
          <p className="notes">
            <b>কিভাবে কাজ করে:</b> প্রতিটি টাকার ঘরে live Excel formula আছে। USD × rate = BDT converted। Converted + Driver/C&F + Duty = Costing Total। Additional cost bracket candy। Final Price = Costing Total + Additional। Duty cell এ mouse রাখলে source model ও year দেখাবে।<br />
            <b>Chassis matching:</b> Car name থেকে chassis code বের করে (যেমন "CROSS ZVG11" → ZVG11), তারপর duty sheet এ "6AA-ZVG11" এর মধ্যে খোঁজে। একাধিক match হলে সবচেয়ে বেশি duty amount নেওয়া হয়।<br />
            <span className="num" style={{ opacity: 0.65 }}>Files আপনার browser এ পড়া হয়। কোনো server এ upload হয় না।</span>
          </p>
        </footer>
      </main>
    </>
  );
}
