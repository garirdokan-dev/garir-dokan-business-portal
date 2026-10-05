/**
 * Sync state for the whole app.
 *
 * Everything already saves to localStorage first and only then to Supabase, so the app keeps
 * working without a connection. What was missing is telling the operator when the cloud copy
 * did NOT happen, and trying again later. This module holds that state:
 *
 *   - are we online?
 *   - how many writes are still waiting to reach Supabase?
 *   - when did the last successful sync happen, and what was the last error?
 *
 * Failed writes are queued in localStorage and replayed when the connection returns, so a save
 * made on a dead connection is never silently lost.
 */

export type PendingKind = 'document' | 'asset' | 'preferences' | 'settings';
export type PendingOp = 'upsert' | 'delete';

export interface PendingItem {
  id: string;            // unique per record, so repeated edits collapse into one entry
  kind: PendingKind;
  op: PendingOp;
  recordId: string;
  queuedAt: number;
}

export interface SyncStatus {
  online: boolean;
  /** Supabase is configured at all */
  cloud: boolean;
  pending: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** a write failed and is waiting to be retried */
  localOnly: boolean;
}

const QUEUE_KEY = 'gd_pending_sync';
const LAST_SYNC_KEY = 'gd_last_sync';

const readQueue = (): PendingItem[] => {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: PendingItem[]) => {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* storage full — the queue is a convenience, never block the save */
  }
};

let lastError: string | null = null;
let listeners: Array<(s: SyncStatus) => void> = [];
let flushing = false;
/** set by storage.ts so this module does not need to know about Supabase itself */
let replay: ((item: PendingItem) => Promise<void>) | null = null;
let cloudConfigured = false;

export const registerReplay = (fn: (item: PendingItem) => Promise<void>, cloud: boolean) => {
  replay = fn;
  cloudConfigured = cloud;
  emit();
};

export const getSyncStatus = (): SyncStatus => {
  const pending = readQueue().length;
  let lastSyncedAt: number | null = null;
  try {
    const v = window.localStorage.getItem(LAST_SYNC_KEY);
    lastSyncedAt = v ? Number(v) : null;
  } catch {
    lastSyncedAt = null;
  }
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    cloud: cloudConfigured,
    pending,
    lastSyncedAt,
    lastError,
    localOnly: pending > 0,
  };
};

const emit = () => {
  const s = getSyncStatus();
  listeners.forEach(fn => { try { fn(s); } catch { /* a bad listener must not break syncing */ } });
};

export const subscribeSync = (fn: (s: SyncStatus) => void): (() => void) => {
  listeners.push(fn);
  fn(getSyncStatus());
  return () => { listeners = listeners.filter(l => l !== fn); };
};

/** Called by storage.ts when a cloud write fails. */
export const queueFailure = (kind: PendingKind, op: PendingOp, recordId: string, error: unknown) => {
  lastError = error instanceof Error ? error.message : String(error ?? 'unknown error');
  const items = readQueue().filter(i => !(i.kind === kind && i.recordId === recordId));
  items.push({ id: `${kind}:${recordId}`, kind, op, recordId, queuedAt: Date.now() });
  writeQueue(items);
  emit();
};

/** Called by storage.ts after any successful cloud write. */
export const markSynced = (kind?: PendingKind, recordId?: string) => {
  lastError = null;
  try { window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
  if (kind && recordId) {
    const items = readQueue().filter(i => !(i.kind === kind && i.recordId === recordId));
    writeQueue(items);
  }
  emit();
};

/** Try to push everything that is still waiting. Safe to call at any time. */
export const flushPending = async (): Promise<void> => {
  if (flushing || !replay) return;
  const items = readQueue();
  if (!items.length) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  flushing = true;
  try {
    for (const item of items) {
      try {
        await replay(item);
        const left = readQueue().filter(i => i.id !== item.id);
        writeQueue(left);
        lastError = null;
        try { window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
        emit();
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        emit();
        break;                       // still no luck — keep the rest for the next attempt
      }
    }
  } finally {
    flushing = false;
    emit();
  }
};

/** Start watching the connection. Called once from the app root. */
export const startSyncWatcher = (): (() => void) => {
  const onOnline = () => { emit(); void flushPending(); };
  const onOffline = () => emit();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const timer = window.setInterval(() => { void flushPending(); }, 60000);
  void flushPending();
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    window.clearInterval(timer);
  };
};
