/**
 * Which Excel design each stock tool writes: BD Stock, Japan Stock and BD + Japan Combine each
 * have their own choice.
 *
 * The choice is saved in this browser first, then in the portal database as the preference
 * `stock_design`, so every computer uses the same one. The newest choice wins: each change is
 * stamped with a time, and the shared copy is read when a stock tool opens and when the window
 * comes back into focus. A save that fails is retried by the app's sync queue. In the AI Studio
 * preview (no database) the choice stays in this browser.
 */
import { hostinger, isHostingerConfigured, hasContent } from '../../../utils/hostinger.ts';
import { withTimeout } from '../../../utils/storage.ts';
import { queueFailure, markSynced, getPendingItems } from '../../../utils/sync.ts';
import type { SheetDesign } from './sheetDesign';

export type DesignTool = 'BD' | 'JAPAN' | 'COMBINE';

export interface DesignChoices {
  BD: SheetDesign;
  JAPAN: SheetDesign;
  COMBINE: SheetDesign;
  /** when the choice last changed on any computer (0 = never) */
  updatedAt: number;
}

/** Browser copy. The same key is used by the sync queue to resend a failed save. */
export const DESIGN_LOCAL_KEY = 'gd_stock_design';
/** Row id in the portal's preferences table. */
export const DESIGN_PREF_ID = 'stock_design';

const isDesign = (d: unknown): d is SheetDesign => d === 'classic' || d === 'brand';

const normalise = (raw: any): DesignChoices => ({
  BD: isDesign(raw?.BD) ? raw.BD : 'classic',
  JAPAN: isDesign(raw?.JAPAN) ? raw.JAPAN : 'classic',
  COMBINE: isDesign(raw?.COMBINE) ? raw.COMBINE : 'classic',
  updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : 0,
});

export const readDesignChoices = (): DesignChoices => {
  try {
    const raw = window.localStorage.getItem(DESIGN_LOCAL_KEY);
    return normalise(raw ? JSON.parse(raw) : null);
  } catch {
    return normalise(null);
  }
};

const writeLocal = (c: DesignChoices) => {
  try { window.localStorage.setItem(DESIGN_LOCAL_KEY, JSON.stringify(c)); } catch { /* storage full or blocked */ }
};

const listeners = new Set<(c: DesignChoices) => void>();
export const onDesignChoicesChanged = (fn: (c: DesignChoices) => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const emit = (c: DesignChoices) => listeners.forEach(fn => fn(c));

const pushChoices = async (c: DesignChoices) => {
  if (!isHostingerConfigured) return;
  try {
    await withTimeout(hostinger.savePreference(DESIGN_PREF_ID, c), 'saving the Excel design');
    markSynced('settings', DESIGN_PREF_ID);
  } catch (e) {
    queueFailure('settings', 'upsert', DESIGN_PREF_ID, e);
  }
};

/** Choose the design one tool writes from now on. */
export const setSheetDesign = (tool: DesignTool, design: SheetDesign) => {
  const next: DesignChoices = { ...readDesignChoices(), [tool]: design, updatedAt: Date.now() };
  writeLocal(next);
  emit(next);
  void pushChoices(next);
};

let lastPull = 0;
/** How long ago the shared copy was last read. */
export const msSinceDesignPull = () => Date.now() - lastPull;

/** Take the shared choice when another computer changed it more recently. */
export const pullDesignChoices = async () => {
  if (!isHostingerConfigured) return;
  lastPull = Date.now();
  // a change that has not reached the server yet is the newest one; the sync queue sends it
  if (getPendingItems().some(i => i.recordId === DESIGN_PREF_ID)) return;
  const local = readDesignChoices();
  try {
    const data = await withTimeout(hostinger.getPreference<DesignChoices>(DESIGN_PREF_ID), 'loading the Excel design');
    if (!hasContent(data)) {
      if (local.updatedAt) void pushChoices(local);     // chosen here before it could be shared
      return;
    }
    const shared = normalise(data);
    if (shared.updatedAt > local.updatedAt) {
      writeLocal(shared);
      emit(shared);
    } else if (local.updatedAt > shared.updatedAt) {
      void pushChoices(local);
    }
  } catch {
    /* offline or logged out — this browser's choice keeps working */
  }
};
