/**
 * Keeps the Pricing Desk's duty sheets in the Hostinger database, so every computer sees the same ones.
 *
 * What is stored, in the existing `preferences` table (no new table needed):
 *   - id `price_desk`        the parsed duty sheets, the chosen month, rate, C&F and drive
 *   - id `price_pdf:<id>`    each original PDF, for the preview. The server keeps the PDF itself as
 *                            a file in /var/www/portal/uploads and the row holds its /uploads/... link.
 *
 * The newest copy wins: every local change stamps the store with a time, and on start-up — and
 * whenever the window comes back into focus — the cloud copy is fetched and taken if it is newer.
 * The car being priced at the moment stays on each device; only the sheets and charges are shared.
 */
import { hostinger, isHostingerConfigured, hasContent } from './hostinger.ts';
import { withTimeout } from './storage.ts';
import { queueFailure, markSynced } from './sync.ts';
import { getStore, setStore, adoptStore, onStoreChanged, monthKey, monthRank, type PriceStore } from '../pricing/price/priceStore';
import { setRemotePdfs, loadPdf } from '../pricing/price/pdfStore';

const STORE_ID = 'price_desk';
const PDF_PREFIX = 'price_pdf:';

/* Every PDF id this browser has seen. The API cannot list rows by prefix, so Reset uses this
 * (plus the shared copy) to know which cloud PDFs to clear. */
const knownPdfIds = new Set<string>();
const rememberPdfIds = (s: PriceStore | null | undefined) => {
  s?.months?.forEach(m => { if (m.pdfId) knownPdfIds.add(m.pdfId); });
};

/* ---------------- the duty-sheet data ---------------- */

const pushStore = async (s: PriceStore) => {
  if (!isHostingerConfigured) return;
  try {
    await withTimeout(hostinger.savePreference(STORE_ID, s), 'saving duty sheets');
    markSynced('settings', STORE_ID);
  } catch (e) {
    queueFailure('settings', 'upsert', STORE_ID, e);
  }
};

let pushTimer: number | undefined;
const schedulePush = (s: PriceStore) => {
  rememberPdfIds(s);
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => { void pushStore(s); }, 1200);   // one write per burst of edits
};

let lastPull = 0;
const pullStore = async () => {
  if (!isHostingerConfigured) return;
  lastPull = Date.now();
  try {
    const data = await withTimeout(hostinger.getPreference<PriceStore>(STORE_ID), 'loading duty sheets');
    const cloud = hasContent(data) ? (data as PriceStore) : null;
    const local = getStore();
    rememberPdfIds(cloud);
    rememberPdfIds(local);
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

/** How a PDF row looks: `file` is the /uploads link; `b64` only in older copies that kept the file inline. */
interface StoredPdf { type?: string; file?: string; b64?: string }

const remotePdfs = {
  put: async (id: string, blob: Blob) => {
    if (!isHostingerConfigured) return;
    knownPdfIds.add(id);
    const type = blob.type || 'application/pdf';
    // Sent as a data URL: the server saves it as a real PDF file and keeps only its link.
    await withTimeout(
      hostinger.savePreference(PDF_PREFIX + id, { type, file: `data:${type};base64,${await toBase64(blob)}` }),
      'saving a duty sheet file');
  },
  get: async (id: string): Promise<Blob | null> => {
    if (!isHostingerConfigured) return null;
    const d = await withTimeout(hostinger.getPreference<StoredPdf>(PDF_PREFIX + id), 'loading a duty sheet file');
    if (d?.file) {
      const response = await withTimeout(fetch(d.file, { credentials: 'same-origin' }), 'loading a duty sheet file');
      if (!response.ok) throw new Error(`Loading the duty sheet file failed (${response.status})`);
      const bytes = await response.blob();
      return new Blob([bytes], { type: d.type || bytes.type || 'application/pdf' });
    }
    return d?.b64 ? fromBase64(d.b64, d.type) : null;
  },
  remove: async (id: string) => {
    if (!isHostingerConfigured) return;
    knownPdfIds.delete(id);
    await withTimeout(hostinger.clearPreference(PDF_PREFIX + id), 'removing a duty sheet file');
  },
  clear: async () => {
    if (!isHostingerConfigured) return;
    try {
      // The shared copy may still list sheets this browser never saw.
      const shared = await withTimeout(hostinger.getPreference<PriceStore>(STORE_ID), 'loading duty sheets');
      if (hasContent(shared)) rememberPdfIds(shared as PriceStore);
    } catch {
      /* clear what this browser knows about */
    }
    const ids = [...knownPdfIds];
    knownPdfIds.clear();
    for (const id of ids) {
      await withTimeout(hostinger.clearPreference(PDF_PREFIX + id), 'removing duty sheet files');
    }
  },
};

/** PDFs that were loaded before the cloud copy existed: send any the cloud does not have yet. */
const backfillPdfs = async () => {
  if (!isHostingerConfigured) return;
  const ids = [...new Set(getStore().months.map(m => m.pdfId).filter(Boolean))];
  if (!ids.length) return;
  try {
    for (const id of ids) {
      knownPdfIds.add(id);
      const existing = await withTimeout(hostinger.getPreference<StoredPdf>(PDF_PREFIX + id), 'checking duty sheet files');
      if (existing?.file || existing?.b64) continue;
      const blob = await loadPdf(id);
      if (blob) await remotePdfs.put(id, blob);
    }
  } catch {
    /* try again next start-up */
  }
};

/** Called once at start-up. */
export const startPriceCloudSync = () => {
  if (!isHostingerConfigured) return;
  rememberPdfIds(getStore());
  setRemotePdfs(remotePdfs);
  onStoreChanged(schedulePush);
  void pullStore().then(backfillPdfs);
  // coming back to the tab is the natural moment another device may have changed something
  window.addEventListener('focus', () => { if (Date.now() - lastPull > 20000) void pullStore(); });
};
