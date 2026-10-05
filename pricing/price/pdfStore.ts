/**
 * The uploaded duty-sheet PDFs are kept in IndexedDB so the preview still works after a
 * reload. Parsed duty amounts live in localStorage; only the raw files are kept here,
 * because they are far too large for localStorage once several months are loaded.
 * Every call fails softly: without IndexedDB the tool still works, just without preview.
 */
const DB_NAME = 'gd-price';
const STORE = 'pdfs';

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Optional cloud copy. The site plugs in functions that keep each PDF
 * in Supabase too, so a preview opened on another computer still has
 * the file. Without them the store stays local, exactly as before.
 * ------------------------------------------------------------------ */
interface RemotePdfs {
  put: (id: string, blob: Blob) => Promise<void>;
  get: (id: string) => Promise<Blob | null>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}
let remote: RemotePdfs | null = null;
export const setRemotePdfs = (r: RemotePdfs | null) => { remote = r; };

const quietly = (p: Promise<unknown> | undefined) => { p?.catch(() => { /* the local copy is what matters */ }); };

export const savePdf = async (id: string, blob: Blob) => {
  const r = await run<void>('readwrite', s => s.put(blob, id));
  quietly(remote?.put(id, blob));
  return r;
};

/** Local first; if this browser has never seen the file, fetch it from the cloud and keep it. */
export const loadPdf = async (id: string): Promise<Blob | null> => {
  const local = await run<Blob>('readonly', s => s.get(id));
  if (local || !remote) return local;
  try {
    const fetched = await remote.get(id);
    if (fetched) await run<void>('readwrite', s => s.put(fetched, id));
    return fetched;
  } catch {
    return null;
  }
};

export const deletePdf = async (id: string) => {
  const r = await run<void>('readwrite', s => s.delete(id));
  quietly(remote?.remove(id));
  return r;
};

export const clearPdfs = async () => {
  const r = await run<void>('readwrite', s => s.clear());
  quietly(remote?.clear());
  return r;
};
