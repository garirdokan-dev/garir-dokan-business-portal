// ============================================================================
// UNIFIED DUTY SHEET PARSER
// ----------------------------------------------------------------------------
// Parses ANY of the known Bangladeshi C&F duty-sheet layouts from PDF text:
//
//   A) "Columnar / Yellow-Book" style (e.g. SAHARA FREIGHT):
//      SL | VEHICLE | MFG.YEAR | DEP. | Y.BOOK | INV. | [FREIGHT] | TTI |
//      <CUR MONTH> | <PREV MONTH> | DIFFERENCE
//      - 5-row box per chassis (2021 .. 2025/2026)
//      - chassis code printed on the 2nd (2022) row
//      - current-month duty is the FIRST of the two duty columns
//
//   B) "Stacked / two-column" style (e.g. HABIBA ENTERPRISE):
//      SL | VEHICLE MODEL | CC | Y.BOOK | YEAR | INVOICE |
//      APP.DUTY OF <PREV> | APP.DUTY OF <CUR>
//      - vehicle name line, then "3BA-NZT260 1500 1277034 2021 ... FEB MAR"
//      - current-month duty is the LAST of the two duty columns
//      - hybrid & non-hybrid may arrive as separate PDFs or one file
//
// The parser does NOT hard-code which column is "current". It reads the month
// names from the table headers and picks the chronologically LATER month as
// the current one. Layout (diff-column vs two-column) is detected from the
// presence of a DIFFERENCE column, and every diff-layout row is verified with
// the identity  |dutyA - dutyB| == |difference|  (fallback heuristics if not).
//
// Hybrid detection priority (per block):
//   1. H.S. code  8703.40.xx / 8703.60.xx / 8703.80.xx  -> hybrid / PHV / EV
//      any other 8702/8703/8704 code                    -> non-hybrid
//   2. explicit "(HYBRID)" / "(NON-HYBRID)" tag on the CC line
//   3. the section header the block sits under (e.g. "HYBRID (CAR & JEEP)")
//   4. default: non-hybrid
// ============================================================================

export interface TextItem {
  x: number;
  y: number;
  w: number;
  s: string;
}

export interface DutyRowVals {
  /** previous-month duty (legacy slot name kept for the matching engine) */
  jan: number;
  /** CURRENT-month duty (legacy slot name kept for the matching engine) */
  feb: number;
}

export interface UnifiedDutyBlock {
  vehicleName: string;
  modelCode: string;   // e.g. "6AA-NKE165"
  chassisCode: string; // e.g. "NKE165"
  isHybrid: boolean;
  rows: { [year: string]: DutyRowVals };
  source: string;      // file name the block came from
  hsCode?: string;
  cc?: string;
}

export interface DutyParseMeta {
  source: string;
  layout: 'columnar-diff' | 'two-column' | 'generic';
  currentMonthLabel: string;
  previousMonthLabel: string;
  pageCount: number;
  blockCount: number;
  hybridCount: number;
  nonHybridCount: number;
  droppedNoCode: number;   // data boxes that had duty rows but no chassis code
  rowWarnings: number;     // rows whose diff-identity check failed (fallback used)
  yearRowCount: number;    // total (block, year) duty cells recovered
  warnings: string[];
}

export interface DutyParseResult {
  blocks: UnifiedDutyBlock[];
  meta: DutyParseMeta;
}

// ---------------------------------------------------------------------------
// Text-line reconstruction from pdf.js items
// ---------------------------------------------------------------------------

/** Cluster items into visual lines using a FIXED y-tolerance. */
function itemsToLinesFixed(items: TextItem[], tol = 3.0): string[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: { y: number; items: TextItem[] }[] = [];
  let cur: { y: number; items: TextItem[] } | null = null;
  for (const it of sorted) {
    if (cur && Math.abs(it.y - cur.y) <= tol) {
      cur.items.push(it);
    } else {
      cur = { y: it.y, items: [it] };
      lines.push(cur);
    }
  }
  return joinLines(lines.map(L => L.items));
}

/** Cluster items into lines using a RUNNING gap (handles jittered baselines). */
function itemsToLinesRunning(items: TextItem[], step = 6): string[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: { lastY: number; items: TextItem[] }[] = [];
  let cur: { lastY: number; items: TextItem[] } | null = null;
  for (const it of sorted) {
    if (cur && (cur.lastY - it.y) <= step) {
      cur.items.push(it);
      cur.lastY = it.y;
    } else {
      cur = { lastY: it.y, items: [it] };
      lines.push(cur);
    }
  }
  return joinLines(lines.map(L => L.items));
}

function joinLines(lineItems: TextItem[][]): string[] {
  return lineItems
    .map(arr => {
      arr.sort((a, b) => a.x - b.x);
      let s = '';
      let prevEnd: number | null = null;
      for (const it of arr) {
        if (prevEnd !== null && (it.x - prevEnd) > 1.5) s += ' ';
        s += it.s;
        prevEnd = it.x + it.w;
      }
      return s.trim();
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Month / header detection
// ---------------------------------------------------------------------------

const MONTH_TOKEN_RE =
  /\b(JANUARY|FEBRUARY|MARCH|APRIL|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JULY|JUNE|MAY|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b\s*[-']?\s*(\d{2,4})?/g;

const MONTH_INDEX: { [k: string]: number } = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

interface MonthTok { label: string; m: number; y: number | null; }

function extractMonthTokens(line: string): MonthTok[] {
  const out: MonthTok[] = [];
  const up = line.toUpperCase();
  let m: RegExpExecArray | null;
  MONTH_TOKEN_RE.lastIndex = 0;
  while ((m = MONTH_TOKEN_RE.exec(up)) !== null) {
    const key = m[1].slice(0, 3);
    let y: number | null = null;
    if (m[2]) {
      const n = parseInt(m[2], 10);
      // "26" -> 2026 ; "2026" stays ; ignore stray numbers that are not years
      if (m[2].length === 2) y = 2000 + n;
      else if (n >= 2015 && n <= 2099) y = n;
    }
    out.push({ label: m[0].trim().replace(/\s+/g, ''), m: MONTH_INDEX[key], y });
  }
  return out;
}

/** true when a is chronologically LATER than b */
function monthLater(a: MonthTok, b: MonthTok): boolean {
  if (a.y != null && b.y != null && a.y !== b.y) return a.y > b.y;
  // DEC vs JAN across a year boundary (no explicit years)
  if ((a.y == null || b.y == null)) {
    if (a.m === 11 && b.m === 0) return false; // DEC < JAN(next year)
    if (a.m === 0 && b.m === 11) return true;  // JAN(next) > DEC
  }
  return a.m > b.m;
}

interface HeaderInfo {
  hasDiff: boolean;
  currentIsFirst: boolean;
  curLabel: string;
  prevLabel: string;
  sawHeader: boolean;
}

function detectHeader(lines: string[]): HeaderInfo {
  const pairCount = new Map<string, { toks: [MonthTok, MonthTok]; n: number }>();
  let hasDiff = false;
  let sawHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const up = raw.toUpperCase();
    const headerish =
      /DIFFERENCE|TTI|APP\.?\s*DUTY|MFG\.?\s*YEAR|Y\.?\s*BOOK/.test(up);
    if (!headerish) continue;
    sawHeader = true;
    if (/DIFFERENCE/.test(up)) hasDiff = true;

    // Month names may sit on the header line itself (SAHARA:
    //   "... TTI APRIL MARCH DIFFERENCE")
    // or wrap onto the NEXT line (HABIBA prints
    //   "SL VEHICLE ... APP. DUTY   APP. DUTY"
    //   "        VALUE   OF FEB-2026  OF MAR-2026").
    // So scan this line, and if it yields no pair, scan the continuation line.
    let toks = extractMonthTokens(up);
    if (toks.length < 2 && i + 1 < lines.length) {
      const nxt = lines[i + 1].toUpperCase();
      // only treat it as a continuation when it carries no year-row data
      if (!/\b202\d\b/.test(nxt) || /OF\s+[A-Z]{3}/.test(nxt)) {
        const nextToks = extractMonthTokens(nxt);
        if (nextToks.length >= 2) toks = nextToks;
      }
    }
    if (toks.length >= 2) {
      // take the LAST two month tokens on the header line — those are the
      // two duty columns (any earlier month word would be part of a title)
      const a = toks[toks.length - 2];
      const b = toks[toks.length - 1];
      const key = `${a.label}|${b.label}`;
      const e = pairCount.get(key);
      if (e) e.n += 1;
      else pairCount.set(key, { toks: [a, b], n: 1 });
    }
  }

  let currentIsFirst = false; // generic default: current duty = LAST column
  let curLabel = 'CURRENT';
  let prevLabel = 'PREVIOUS';

  if (pairCount.size) {
    let best: { toks: [MonthTok, MonthTok]; n: number } | null = null;
    for (const v of pairCount.values()) {
      if (!best || v.n > best.n) best = v;
    }
    if (best) {
      const [a, b] = best.toks;
      currentIsFirst = monthLater(a, b);
      curLabel = currentIsFirst ? a.label : b.label;
      prevLabel = currentIsFirst ? b.label : a.label;
    }
  }

  return { hasDiff, currentIsFirst, curLabel, prevLabel, sawHeader };
}

// ---------------------------------------------------------------------------
// Row-level number extraction
// ---------------------------------------------------------------------------

// duty figures ALWAYS carry decimals in these sheets; integers (Y.Book,
// freight, CC, SL, plain invoice) do not match this pattern.
const MONEY_RE = /\d[\d,]*\.\d{1,2}/g;
const YEAR_RE = /\b(202\d)\b/;
const ALL_YEARS_RE = /\b202\d\b/g;

function moneyNums(line: string): number[] {
  const m = line.match(MONEY_RE) || [];
  return m.map(s => parseFloat(s.replace(/,/g, '')));
}

/**
 * Extract the (current, previous) duty pair from one data row.
 * Returns null when the line does not carry a plausible duty pair.
 */
function extractDutyPair(
  line: string,
  hdr: HeaderInfo,
  onWarn: () => void,
): { cur: number; prev: number } | null {
  const nums = moneyNums(line);
  if (!nums.length) return null;

  if (hdr.hasDiff && nums.length >= 3) {
    const a = nums[nums.length - 3];
    const b = nums[nums.length - 2];
    const d = nums[nums.length - 1];
    // identity check:  |a - b| == |d|  (rounding tolerance)
    if (Math.abs(Math.abs(a - b) - Math.abs(d)) <= 2 && a > 1000 && b > 1000) {
      return hdr.currentIsFirst ? { cur: a, prev: b } : { cur: b, prev: a };
    }
    onWarn();
    // fall through to the generic heuristic below
  }

  // generic: the LAST TWO "large" decimal numbers are the duty pair.
  let cands = nums.filter(n => n >= 10000);
  if (hdr.hasDiff && cands.length >= 3) {
    // the trailing number may be the DIFFERENCE column — drop it when it is
    // an order of magnitude smaller than the duty next to it.
    const last = cands[cands.length - 1];
    const beforeLast = cands[cands.length - 2];
    if (last < beforeLast * 0.2) cands = cands.slice(0, -1);
  }
  if (!cands.length) return null;
  if (cands.length === 1) return { cur: cands[0], prev: cands[0] };

  const a = cands[cands.length - 2];
  const b = cands[cands.length - 1];
  return hdr.currentIsFirst ? { cur: a, prev: b } : { cur: b, prev: a };
}

// ---------------------------------------------------------------------------
// Line classification helpers
// ---------------------------------------------------------------------------

const SKIP_RE =
  /^[\$¥=]|USD\s*=|JP\.?\s*YEN|YELLOW BOOK|^BUDGET|MONTH OF|BISMILLAH|HABIBA|ENTERPRISE|C\s*&\s*F|AGENT|MUJIB|BARIK|PLAZA|MOBILE|PHONE|E-?MAIL|CUSTOMS HOUSE|SAHARA FREIGHT|CLEARING|FORWARDING|^PAGE\b|PAGE\s*-|WWW\.|SHIPMENT/i;

const HEADER_LINE_RE =
  /(SL\s*NO\.?|^SL\b).*(VEHICLE|MODEL)|MFG\.?\s*YEAR|Y\.?\s*BOOK\s*VALUE|APP\.?\s*DUTY|INVOICE\s*VALUE/i;

const SECTION_RE =
  /^(CAR\s*\/?\s*JEEP|CAR\s*\(|CAR$|JEEP|MICROBUS|HIACE\s*&|HIACE\s+VAN|AMBULANCE|HYBRID|PICK\s?-?\s?UP|REFER\s*VAN|FREEZER\s*VAN|COVER\s*VAN|EXTENTION|EXTENSION|MORE\s+THAN)/i;

// chassis / model code, e.g. DBA-NZE164, 6AA/DAA-ZVW40W, QDF/LDF-KDY221,
// 2KG-XZU720M, 5BA-DKLFW, EBD-DA16T
const MODEL_RE =
  /\b([0-9A-Z]{3}(?:\/[0-9A-Z]{3,4})?-[A-Z][A-Z0-9]{1,9})\b/;

const MODEL_BLOCKLIST = new Set([
  'HYBRID', 'TRAIL', 'MAIL', 'CODE', 'YEAR', 'BOOK', 'VALUE', 'DUTY',
  'CROSS', 'OVER', 'VAN', 'CAB', 'LIST',
]);

function findModelCode(line: string): string | null {
  const up = line.toUpperCase();
  const m = up.match(MODEL_RE);
  if (!m) return null;
  const code = m[1];
  const mdl = code.split('-').pop() || '';
  if (MODEL_BLOCKLIST.has(mdl)) return null;
  // real chassis models contain a digit, or are >= 4 letters (e.g. DKLFW)
  if (!/\d/.test(mdl) && mdl.length < 4) return null;
  return code;
}

const HS_RE = /\b(87\d{2})\s*\.\s*(\d{2})(?:\s*\.\s*(\d{2}))?\b/;

// ---------------------------------------------------------------------------
// Main line-driven state machine
// ---------------------------------------------------------------------------

interface WorkBlock extends UnifiedDutyBlock {
  tagHybrid?: boolean | null;
  hsHybrid?: boolean | null;
  sectionHybrid?: boolean | null;
}

export function parseDutyTextLines(
  rawLines: string[],
  source: string,
  pageCount: number,
): DutyParseResult {
  const hdr = detectHeader(rawLines);

  const blocks: UnifiedDutyBlock[] = [];
  const warnings: string[] = [];
  let droppedNoCode = 0;
  let rowWarnings = 0;

  let cur: WorkBlock | null = null;
  let pendingName = '';
  let sectionHybrid: boolean | null = false;

  const newBlock = (name: string): WorkBlock => ({
    vehicleName: name.trim(),
    modelCode: '',
    chassisCode: '',
    isHybrid: false,
    rows: {},
    source,
    tagHybrid: null,
    hsHybrid: null,
    sectionHybrid,
  });

  const finalize = (b: WorkBlock | null) => {
    if (!b) return;
    const hasRows = Object.keys(b.rows).length > 0;
    if (!hasRows) return; // header noise — nothing worth keeping
    if (!b.modelCode) {
      droppedNoCode++;
      return;
    }
    const hybrid =
      b.tagHybrid != null ? b.tagHybrid :
      b.hsHybrid != null ? b.hsHybrid :
      b.sectionHybrid != null ? b.sectionHybrid : false;
    blocks.push({
      vehicleName: b.vehicleName,
      modelCode: b.modelCode,
      chassisCode: b.chassisCode,
      isHybrid: hybrid,
      rows: b.rows,
      source,
      hsCode: b.hsCode,
      cc: b.cc,
    });
  };

  for (const raw of rawLines) {
    // normalise dashes / whitespace ("3BF -TRY230" -> "3BF-TRY230")
    let line = raw
      .replace(/\s*[\-\u2010\u2011\u2013\u2014]\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;

    const hasYear = YEAR_RE.test(line);

    if (!hasYear && SKIP_RE.test(line)) continue;

    // table header row => hard block boundary (present between every box on
    // the columnar sheets, and on every page of the stacked sheets)
    if (HEADER_LINE_RE.test(line) && !hasYear) {
      finalize(cur);
      cur = null;
      pendingName = '';
      continue;
    }

    // section banner (CAR/JEEP, HYBRID, PICKUP, ...)
    if (!hasYear && line.length <= 45 && SECTION_RE.test(line) && !MODEL_RE.test(line.toUpperCase())) {
      finalize(cur);
      cur = null;
      pendingName = '';
      const up = line.toUpperCase();
      if (/HYBRID/.test(up)) {
        sectionHybrid = /NON/.test(up) ? null : true; // "(NON HYBRID & HYBRID)" => mixed
      } else {
        sectionHybrid = false;
      }
      continue;
    }

    // H.S. code — may share the line with a data row on columnar sheets
    const hs = line.match(HS_RE);
    if (hs) {
      const hsFull = `${hs[1]}.${hs[2]}${hs[3] ? '.' + hs[3] : ''}`;
      const hyb = hs[1] === '8703' && /^(40|60|80)$/.test(hs[2]);
      if (cur) {
        if (!cur.hsCode) cur.hsCode = hsFull;
        if (cur.hsHybrid == null) cur.hsHybrid = hyb;
      }
      if (!hasYear) continue; // pure "H. S. CODE: xxxx" line
    }

    // CC-#### and explicit (HYBRID)/(NON-HYBRID) tags — may share a data row
    const ccm = line.match(/\bCC-?\s*(\d{3,4})\b/i);
    if (ccm && cur && !cur.cc) cur.cc = ccm[1];
    if (/\(NON-?\s?HYBRID\)/i.test(line)) {
      if (cur) cur.tagHybrid = false;
    } else if (/\(HYBRID\)/i.test(line)) {
      if (cur) cur.tagHybrid = true;
    }

    // chassis / model code
    const code = findModelCode(line);
    if (code) {
      if (!cur || cur.modelCode) {
        // stacked layout: a code line opens the next box
        finalize(cur);
        cur = newBlock(pendingName);
      }
      cur.modelCode = code;
      cur.chassisCode = code.split('-').slice(1).join('').replace(/\//g, '');
      pendingName = '';
      // fall through — the same line often carries the first year row
    }

    // data row(s)
    if (hasYear) {
      const pair = extractDutyPair(line, hdr, () => { rowWarnings++; });
      if (pair) {
        if (!cur) {
          // columnar layout: box opens on its first (2021) data row; the
          // vehicle name is the text before the year token
          const ym = line.match(YEAR_RE)!;
          const before = line.split(ym[1])[0];
          const name = ((pendingName ? pendingName + ' ' : '') + before)
            .replace(/[\d.%,$]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          cur = newBlock(name);
          pendingName = '';
        } else if (!cur.vehicleName) {
          const ym = line.match(YEAR_RE)!;
          const before = line.split(ym[1])[0]
            .replace(/[\d.%,$]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          cur.vehicleName = (pendingName || before || '').trim();
          if (cur.vehicleName) pendingName = '';
        }
        const years = line.match(ALL_YEARS_RE) || [];
        for (const y of years) {
          cur.rows[y] = { jan: pair.prev, feb: pair.cur };
        }
        continue;
      }
      // a line with a year but no duty pair: probably a title — ignore
      continue;
    }

    if (code) continue; // bare code line already handled

    // standalone SL numbers ("1", "133/A", "12.")
    if (/^\d{1,3}\.?(\/[A-Z0-9]+)?$/i.test(line)) continue;

    // plausible vehicle-name fragment
    if (/[A-Za-z]/.test(line) && line.length >= 2 && line.length <= 60) {
      if (!/^\d+(\.\d+)?$/.test(line) && !/^[24]WD\b|^AWD\b|PLUGGING/i.test(line)) {
        pendingName = line.replace(/^\d+[\s.]+/, '').trim();
      }
    }
  }
  finalize(cur);

  const hybridCount = blocks.filter(b => b.isHybrid).length;
  const yearRowCount = blocks.reduce((s, b) => s + Object.keys(b.rows).length, 0);

  const meta: DutyParseMeta = {
    source,
    layout: hdr.hasDiff ? 'columnar-diff' : (hdr.sawHeader ? 'two-column' : 'generic'),
    currentMonthLabel: hdr.curLabel,
    previousMonthLabel: hdr.prevLabel,
    pageCount,
    blockCount: blocks.length,
    hybridCount,
    nonHybridCount: blocks.length - hybridCount,
    droppedNoCode,
    rowWarnings,
    yearRowCount,
    warnings,
  };

  if (droppedNoCode > 0) {
    warnings.push(
      `${droppedNoCode} data box(es) had duty values but no readable chassis code — skipped.`,
    );
  }
  if (rowWarnings > 0) {
    warnings.push(
      `${rowWarnings} row(s) failed the duty/difference cross-check — fallback extraction used.`,
    );
  }

  return { blocks, meta };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Parse one duty PDF given its per-page pdf.js text items.
 *
 * Columnar sheets jitter baselines inside a 5-row box, so no single
 * y-tolerance recovers every row. We parse under several tolerances, pick the
 * strategy that recovers the most (block, year) cells as the base, then UNION
 * in any year-rows the other strategies found for the same chassis+source.
 * This heals the "missing 2021 row" problem without ever overwriting a value
 * the base strategy already has.
 */
export function parseDutyPages(
  pages: TextItem[][],
  source: string,
): DutyParseResult {
  const strategies: string[][] = [
    pages.flatMap(p => itemsToLinesFixed(p, 4)),
    pages.flatMap(p => itemsToLinesFixed(p, 3)),
    pages.flatMap(p => itemsToLinesFixed(p, 5)),
    pages.flatMap(p => itemsToLinesRunning(p, 6)),
  ];

  const parsed = strategies.map(lines =>
    parseDutyTextLines(lines, source, pages.length),
  );

  // choose the base: most year-rows, then fewest warnings, then fewest drops
  const score = (r: DutyParseResult) =>
    r.meta.yearRowCount * 1000 - r.meta.rowWarnings * 10 - r.meta.droppedNoCode;
  parsed.sort((a, b) => score(b) - score(a));
  const base = parsed[0];

  // index base blocks by modelCode for row-union
  const baseByCode = new Map<string, UnifiedDutyBlock[]>();
  for (const b of base.blocks) {
    const arr = baseByCode.get(b.modelCode);
    if (arr) arr.push(b); else baseByCode.set(b.modelCode, [b]);
  }

  let healed = 0;
  for (let i = 1; i < parsed.length; i++) {
    for (const alt of parsed[i].blocks) {
      const cands = baseByCode.get(alt.modelCode);
      if (!cands) continue;
      // match by vehicle name when the code is duplicated in the sheet
      const target =
        cands.length === 1
          ? cands[0]
          : cands.find(c => c.vehicleName === alt.vehicleName) || cands[0];

      // Provenance guard: only union rows from an alt block that is provably
      // the SAME physical box as the target — i.e. they agree on at least one
      // overlapping year value AND disagree on none. Without this, a block
      // that a different tolerance merged with its neighbour could inject a
      // stray year-row from an adjacent (different) vehicle.
      let shared = 0, conflict = 0;
      for (const [yr, val] of Object.entries(alt.rows)) {
        const tv = target.rows[yr];
        if (!tv) continue;
        if (Math.abs(tv.feb - val.feb) <= 2) shared++;
        else conflict++;
      }
      const overlap = shared + conflict;
      // require positive agreement and zero conflict; if there is no overlap
      // at all we cannot prove identity, so skip (safer to leave a gap that
      // the matcher fills via nearest-year than to inject a wrong figure).
      if (conflict > 0 || shared === 0) continue;

      for (const [yr, val] of Object.entries(alt.rows)) {
        if (!target.rows[yr]) {
          target.rows[yr] = val;
          healed++;
        }
      }
      void overlap;
    }
  }

  if (healed > 0) {
    base.meta.yearRowCount += healed;
    base.meta.warnings.push(
      `${healed} year-row(s) recovered by cross-strategy union.`,
    );
  }

  return base;
}

/** Browser helper: read a File through the CDN pdf.js build. */
export async function parseDutyPdfFile(
  file: File,
  pdfjsLib: any,
): Promise<DutyParseResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items.map((it: any) => ({
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        s: it.str,
      })),
    );
  }
  try { doc.destroy?.(); } catch { /* noop */ }
  return parseDutyPages(pages, file.name);
}

/**
 * Merge the results of 1–2 parsed PDFs into a single block pool.
 *
 * Only reports duplicates the MATCHER CANNOT RESOLVE ON ITS OWN. A chassis
 * code shared by differently-named vehicles (ZRR80G = NOAH / VOXY / ESQUIRE,
 * NZT260 = ALLION / PREMIO, AYH30W = ALPHARD / VELLFIRE) is harmless: the
 * exporter sheet carries the vehicle name, and name-match now outranks
 * highest-duty in the tie-break, so the right block is chosen automatically.
 *
 * The genuinely ambiguous case is one code carrying the SAME vehicle name
 * several times — e.g. TRH200 across four "TOYOTA HIACE" van variants, which
 * differ only by an emission prefix the exporter sheet never prints. There the
 * matcher falls through to "highest duty", and the operator should know.
 */
export function mergeDutyResults(
  results: DutyParseResult[],
): { blocks: UnifiedDutyBlock[]; duplicates: string[] } {
  const blocks = results.flatMap(r => r.blocks);
  const byCode = new Map<string, UnifiedDutyBlock[]>();
  for (const b of blocks) {
    const k = b.modelCode.toUpperCase();
    const arr = byCode.get(k);
    if (arr) arr.push(b);
    else byCode.set(k, [b]);
  }

  // Reduce a vehicle name to the words that actually distinguish it, using the
  // same rules the matcher's name-score uses (brand words carry no signal).
  const IGNORE = new Set([
    'TOYOTA', 'HONDA', 'NISSAN', 'MAZDA', 'SUBARU', 'MITSUBISHI', 'SUZUKI',
    'HYBRID', 'NEW', 'CAR', 'VEHICLE', 'MODEL',
  ]);
  const nameKey = (n: string) =>
    n.toUpperCase()
      .split(/[\s\/\-_.]+/)
      .filter(w => w && !IGNORE.has(w) && w.length >= 2)
      .sort()
      .join(' ');

  const duplicates: string[] = [];
  for (const [code, arr] of byCode) {
    if (arr.length < 2) continue;
    // group the same-code blocks by their distinguishing name
    const byName = new Map<string, UnifiedDutyBlock[]>();
    for (const b of arr) {
      const k = nameKey(b.vehicleName);
      const g = byName.get(k);
      if (g) g.push(b);
      else byName.set(k, [b]);
    }
    // a name that appears more than once under this code is unresolvable
    for (const [, g] of byName) {
      if (g.length > 1) {
        const label = g[0].vehicleName || '(no name)';
        const srcs = [...new Set(g.map(b => b.source))];
        duplicates.push(`${code} — ${label} ×${g.length} (${srcs.join(' + ')})`);
      }
    }
  }
  return { blocks, duplicates };
}
