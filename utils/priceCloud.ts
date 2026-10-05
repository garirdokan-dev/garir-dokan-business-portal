/**
 * Keeps the Pricing Desk's duty sheets in Supabase, so every computer sees the same ones.
 *
 * What is stored, in the existing `preferences` table (no new table or bucket needed):
 *   - id `price_desk`        the parsed duty sheets, the chosen month, rate, C&F and drive
 *   - id `price_pdf:<id>`    each original PDF, for the preview, base64-encoded
 *
 * The newest copy wins: every local change stamps the store with a time, and on start-up — and
 * whenever the window comes back into focus — the cloud copy is fetched and taken if it is newer.
 * The car being priced at the moment stays on each device; only the sheets and charges are shared.
 */
import { supabase } from './supabase.ts';
import { withTimeout } from './storage.ts';
import { queueFailure, markSynced } from './sync.ts';
import { getStore, setStore, adoptStore, onStoreChanged, monthKey, monthRank, type PriceStore } from '../pricing/price/priceStore';
import { setRemotePdfs, loadPdf } from '../pricing/price/pdfStore';

const STORE_ID = 'price_desk';
const PDF_PREFIX = 'price_pdf:';

/* ---------------- the duty-sheet data ---------------- */

const pushStore = async (s: PriceStore) => {
  if (!supabase) return;
  try {
    const { error } = await withTimeout(
      supabase.from('preferences').upsert({ id: STORE_ID, data: s }), 'saving duty sheets');
    if (error) throw error;
    markSynced('settings', STORE_ID);
  } catch (e) {
    queueFailure('settings', 'upsert', STORE_ID, e);
  }
};

let pushTimer: number | undefined;
const schedulePush = (s: PriceStore) => {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => { void pushStore(s); }, 1200);   // one write per burst of edits
};

let lastPull = 0;
const pullStore = async () => {
  if (!supabase) return;
  lastPull = Date.now();
  try {
    const { data, error } = await withTimeout(
      supabase.from('preferences').select('data').eq('id', STORE_ID).maybeSingle(), 'loading duty sheets');
    if (error) throw error;
    const cloud = (data?.data ?? null) as PriceStore | null;
    const local = getStore();
    if (!cloud) {
      // first time on the cloud: send what this computer already has (sheets loaded before this
      // update carry no timestamp, so they are stamped now)
      if (local.months.length) setStore({ ...local });
      return;
    }
    // Sheets loaded on this computer before the cloud copy existed have never been shared, so
    // nothing anywhere could have meant to remove them: add the ones the cloud lacks instead of
    // letting a newer cloud copy replace them.
    if (!local.updatedAt && local.months.length) {
      const known = new Set(cloud.months.map(m => monthKey(m.label)));
      const missing = local.months.filter(m => !known.has(monthKey(m.label)));
      adoptStore(cloud);
      if (missing.length) {
        const merged = [...getStore().months, ...missing].sort((a, b) => monthRank(b.label) - monthRank(a.label));
        setStore({ ...getStore(), months: merged });      // stamped and sent up
      }
      return;
    }
    const cloudAt = cloud.updatedAt || 0;
    const localAt = local.updatedAt || 0;
    if (cloudAt > localAt) adoptStore(cloud);          // another device changed it more recently
    else if (localAt > cloudAt) void pushStore(local); // this device is ahead
  } catch {
    /* offline or not set up yet — the local copy keeps working */
  }
};

/* ---------------- the original PDFs, for the preview ---------------- */

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64: string, type = 'application/pdf'): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

const remotePdfs = {
  put: async (id: string, blob: Blob) => {
    if (!supabase) return;
    const { error } = await withTimeout(
      supabase.from('preferences').upsert({ id: PDF_PREFIX + id, data: { type: blob.type || 'application/pdf', b64: await toBase64(blob) } }),
      'saving a duty sheet file');
    if (error) throw error;
  },
  get: async (id: string): Promise<Blob | null> => {
    if (!supabase) return null;
    const { data, error } = await withTimeout(
      supabase.from('preferences').select('data').eq('id', PDF_PREFIX + id).maybeSingle(), 'loading a duty sheet file');
    if (error) throw error;
    const d = data?.data as { type?: string; b64?: string } | undefined;
    return d?.b64 ? fromBase64(d.b64, d.type) : null;
  },
  remove: async (id: string) => {
    if (!supabase) return;
    await withTimeout(supabase.from('preferences').delete().eq('id', PDF_PREFIX + id), 'removing a duty sheet file');
  },
  clear: async () => {
    if (!supabase) return;
    await withTimeout(supabase.from('preferences').delete().like('id', PDF_PREFIX + '%'), 'removing duty sheet files');
  },
};

/** PDFs that were loaded before the cloud copy existed: send any the cloud does not have yet. */
const backfillPdfs = async () => {
  if (!supabase) return;
  const ids = [...new Set(getStore().months.map(m => m.pdfId).filter(Boolean))];
  if (!ids.length) return;
  try {
    const { data } = await withTimeout(
      supabase.from('preferences').select('id').in('id', ids.map(i => PDF_PREFIX + i)), 'checking duty sheet files');
    const have = new Set(((data || []) as { id: string }[]).map(r => r.id));
    for (const id of ids) {
      if (have.has(PDF_PREFIX + id)) continue;
      const blob = await loadPdf(id);
      if (blob) await remotePdfs.put(id, blob);
    }
  } catch {
    /* try again next start-up */
  }
};

/** Called once at start-up. */
export const startPriceCloudSync = () => {
  if (!supabase) return;
  setRemotePdfs(remotePdfs);
  onStoreChanged(schedulePush);
  void pullStore().then(backfillPdfs);
  // coming back to the tab is the natural moment another device may have changed something
  window.addEventListener('focus', () => { if (Date.now() - lastPull > 20000) void pullStore(); });
};
