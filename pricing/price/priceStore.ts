/**
 * One source of truth for the price calculator.
 *
 * The same calculator appears twice — as a card on the home page and as a tool inside the
 * Pricing Desk. They are the same thing: the duty sheets, the rate and charges, and whatever car
 * is being priced right now are held here, so a change in one place shows up in the other.
 *
 * Duty sheets, rate and charges persist in localStorage exactly as before. The current selection
 * (month, year, car, chosen duty, dollar price, profit) lives for the session only, which is how
 * the desk has always behaved.
 */

export interface Entry {
  name: string;
  code: string;
  hybrid: boolean;
  years: { [year: string]: number };
}

export interface MonthData {
  label: string;      // e.g. "SEPTEMBER'26"
  source: string;     // file name
  pdfId: string;      // key of the stored PDF, for the preview
  entries: Entry[];
}

export interface PriceStore {
  months: MonthData[];
  selectedMonth: string;
  rate: number;
  cnf: number;
  drive: number;
  /** when this copy last changed — decides which copy wins between devices */
  updatedAt?: number;
}

/** What is being priced at this moment — shared, but not written to disk. */
export interface PriceSelection {
  year: string;
  carName: string;
  entryKey: string;
  usd: string;
  profit: string;
}

const STORE_KEY = 'gd.price.v1';

export const DEFAULT_STORE: PriceStore = { months: [], selectedMonth: '', rate: 128, cnf: 30000, drive: 15000 };
export const EMPTY_SELECTION: PriceSelection = { year: '', carName: '', entryKey: '', usd: '', profit: '' };

const loadStore = (): PriceStore => {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    const p = JSON.parse(raw);
    return {
      months: Array.isArray(p.months) ? p.months : [],
      selectedMonth: typeof p.selectedMonth === 'string' ? p.selectedMonth : '',
      rate: Number.isFinite(p.rate) ? p.rate : DEFAULT_STORE.rate,
      cnf: Number.isFinite(p.cnf) ? p.cnf : DEFAULT_STORE.cnf,
      drive: Number.isFinite(p.drive) ? p.drive : DEFAULT_STORE.drive,
      updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : 0,
    };
  } catch {
    return { ...DEFAULT_STORE };
  }
};

let store: PriceStore = typeof window === 'undefined' ? { ...DEFAULT_STORE } : loadStore();
let selection: PriceSelection = { ...EMPTY_SELECTION };
let listeners: Array<() => void> = [];

const notify = () => listeners.forEach(fn => { try { fn(); } catch { /* keep the others working */ } });

export const getStore = (): PriceStore => store;
export const getSelection = (): PriceSelection => selection;

export const setStore = (next: PriceStore | ((prev: PriceStore) => PriceStore)) => {
  const value = typeof next === 'function' ? (next as (p: PriceStore) => PriceStore)(store) : next;
  store = { ...value, updatedAt: Date.now() };
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* full or blocked */ }
  notify();
  onLocalChange?.(store);
};

/* ---------------- cloud copy (optional, plugged in by the site) ---------------- */

let onLocalChange: ((s: PriceStore) => void) | null = null;
/** The site registers a callback that sends every local change to the cloud. */
export const onStoreChanged = (fn: ((s: PriceStore) => void) | null) => { onLocalChange = fn; };

/**
 * Take a copy that arrived from the cloud. It is written locally and shown at once, but it is
 * not sent back up — and it keeps its own timestamp, so devices agree on which copy is newest.
 */
export const adoptStore = (incoming: PriceStore) => {
  store = {
    months: Array.isArray(incoming.months) ? incoming.months : [],
    selectedMonth: typeof incoming.selectedMonth === 'string' ? incoming.selectedMonth : '',
    rate: Number.isFinite(incoming.rate) ? incoming.rate : DEFAULT_STORE.rate,
    cnf: Number.isFinite(incoming.cnf) ? incoming.cnf : DEFAULT_STORE.cnf,
    drive: Number.isFinite(incoming.drive) ? incoming.drive : DEFAULT_STORE.drive,
    updatedAt: Number.isFinite(incoming.updatedAt) ? incoming.updatedAt : 0,
  };
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* full or blocked */ }
  notify();
};

export const setSelection = (next: PriceSelection | ((prev: PriceSelection) => PriceSelection)) => {
  selection = typeof next === 'function' ? (next as (p: PriceSelection) => PriceSelection)(selection) : next;
  notify();
};

export const subscribe = (fn: () => void): (() => void) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
};

/* ---------------- helpers shared by both calculators ---------------- */

export const monthKey = (label: string) => label.trim().toUpperCase();

const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

/** Sort key for labels like "SEPTEMBER'26" so the newest month comes first. */
export function monthRank(label: string): number {
  const up = monthKey(label);
  const mi = MONTHS.findIndex(m => up.startsWith(m));
  const ym = up.match(/(\d{2,4})\s*$/);
  const yr = ym ? (ym[1].length === 2 ? 2000 + Number(ym[1]) : Number(ym[1])) : 0;
  return yr * 12 + (mi < 0 ? 0 : mi);
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export const findMonth = (s: PriceStore): MonthData | null =>
  s.months.find(m => monthKey(m.label) === monthKey(s.selectedMonth)) || null;

export const yearsOf = (m: MonthData | null): string[] => {
  const set = new Set<string>();
  m?.entries.forEach(e => Object.keys(e.years).forEach(y => set.add(y)));
  return [...set].sort((a, b) => Number(b) - Number(a));
};

/** Car names for a month and year, each carrying its chassis codes so a code can find the car. */
export const carsOf = (m: MonthData | null, year: string): { name: string; search: string }[] => {
  if (!m || !year) return [];
  const codes = new Map<string, Set<string>>();
  m.entries.forEach(e => {
    if (!e.years[year]) return;
    if (!codes.has(e.name)) codes.set(e.name, new Set());
    codes.get(e.name)!.add(e.code);
  });
  return [...codes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, set]) => ({ name, search: [...set].join(' ') }));
};

export interface DutyOption { key: string; code: string; hybrid: boolean; duty: number }

export const dutiesOf = (m: MonthData | null, year: string, carName: string): DutyOption[] => {
  if (!m || !year || !carName) return [];
  return m.entries
    .filter(e => e.name === carName && e.years[year])
    .map(e => ({ key: `${e.code}|${e.hybrid}`, code: e.code, hybrid: e.hybrid, duty: e.years[year] }))
    .sort((a, b) => a.duty - b.duty);
};

/** The sum both calculators show. */
export const totals = (s: PriceStore, sel: PriceSelection, duty: number) => {
  const usdVal = Number(sel.usd) || 0;
  const converted = Math.round(usdVal * (s.rate || 0));
  const profit = Number(sel.profit) || 0;
  const costing = converted + duty + (s.cnf || 0) + (s.drive || 0);
  return { usdVal, converted, duty, profit, costing, sale: costing + profit };
};
