
import { BusinessDocument, Asset, DocumentType, FooterSettings, HeaderSettings, HeroSettings } from '../types.ts';
import { hostinger, isHostingerConfigured, hasContent } from './hostinger.ts';
import { queueFailure, markSynced, registerReplay, getPendingItems, type PendingItem } from './sync.ts';

export interface LogoSettings {
  logoUrl?: string;
  logoSize?: number;
  logoPosition?: number;
}

export interface UserPreferences {
  typeSettings: Partial<Record<DocumentType, LogoSettings>>;
}

const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  address: 'A.Hamid Road, Pabna',
  email: 'garirdokan2021@gmail.com',
  phone1: '+880 1713 110 570',
  phone2: '+880 1785 2555 86',
  website: 'garirdokan.com',
  bottomOffset: 10,
  topPadding: 0,
  horizontalPadding: 15,
  lineSpacing: 3
};

const DEFAULT_HEADER: HeaderSettings = {
  text: 'Importer & All kinds of Brand new & Reconditioned Vehicles Supplier',
  fontSize: 14,
  fontFamily: 'serif',
  alignment: 'left',
  isItalic: true,
  logoUrl: '',
  logoSize: 220,
  logoPosition: 0
};

const DEFAULT_HEADERS_MAP: Record<DocumentType, HeaderSettings> = {
  [DocumentType.INVOICE]: { ...DEFAULT_HEADER },
  [DocumentType.QUOTATION]: { ...DEFAULT_HEADER },
  [DocumentType.BILL]: { ...DEFAULT_HEADER },
  [DocumentType.CHALLAN]: { ...DEFAULT_HEADER },
  [DocumentType.PRO_INVOICE]: { ...DEFAULT_HEADER }
};

const DEFAULT_HERO_SETTINGS: HeroSettings = {
  selectedImages: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=2000",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=2000",
    "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&q=80&w=2000"
  ],
  transitionEffect: 'fade',
  interval: 5000,
  backgroundPosition: '50% 50%',
  imagePositions: {},
  removedImages: []
};

// Safe localStorage helpers
const getLocalItem = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item) return JSON.parse(item);
    }
  } catch (e) {
    console.warn(`Failed reading ${key} from localStorage:`, e);
  }
  return defaultValue;
};

const setLocalItem = <T>(key: string, value: T): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`Failed saving ${key} to localStorage:`, e);
  }
};

// Documents: Hostinger database & local cache

/* A cloud call must never hang the interface. On a flaky or blocked connection the server's
 * request can stay unresolved indefinitely, which used to freeze saving and restoring; every
 * call is therefore time-bounded and falls into the normal "queued for retry" path instead. */
const CLOUD_TIMEOUT_MS = 12000;      // writes: worth waiting for
const CLOUD_READ_TIMEOUT_MS = 5000;  // reads: the local cache is right there, do not stall the UI
export const withTimeout = async <T>(work: PromiseLike<T>, label: string): Promise<T> => {
  const ms = /^loading/.test(label) ? CLOUD_READ_TIMEOUT_MS : CLOUD_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work as Promise<T>,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out — no answer from the cloud`)), CLOUD_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/* A list fetched from the server does not contain a save or delete that failed and is still
 * waiting in the retry queue. It must not replace this browser's copy of those records, or the
 * retry finds nothing to send and the change is lost. A waiting save keeps the local version;
 * a waiting delete keeps the record out. */
const keepWaitingChanges = <T extends { id: string }>(kind: 'document' | 'asset', remote: T[], local: T[]): T[] => {
  const waiting = getPendingItems().filter(i => i.kind === kind);
  if (!waiting.length) return remote;
  const localById = new Map(local.map(r => [r.id, r]));
  let merged = remote.slice();
  for (const item of waiting) {
    const at = merged.findIndex(r => r.id === item.recordId);
    if (item.op === 'delete') {
      if (at >= 0) merged.splice(at, 1);
      continue;
    }
    const mine = localById.get(item.recordId);
    if (!mine) continue;
    if (at >= 0) merged[at] = mine;
    else merged = [mine, ...merged];
  }
  return merged;
};

/** A change to this setting is waiting to be retried, so this browser's copy is the newest. */
const settingWaiting = (recordId: string): boolean =>
  getPendingItems().some(i => i.recordId === recordId && i.op === 'upsert');

/** The local copy, read without touching the network. */
export const getCachedDocuments = (): BusinessDocument[] => getLocalItem<BusinessDocument[]>('gd_documents', []);

export const loadDocuments = async (): Promise<BusinessDocument[]> => {
  if (isHostingerConfigured) {
    try {
      const rows = await withTimeout(hostinger.list<BusinessDocument>('documents'), 'loading documents');
      const remoteDocs = keepWaitingChanges('document', Array.isArray(rows) ? rows : [],
        getLocalItem<BusinessDocument[]>('gd_documents', []));
      setLocalItem('gd_documents', remoteDocs);
      return remoteDocs;
    } catch (e) {
      console.warn('Hostinger loadDocuments failed, using local cache:', e);
    }
  }
  return getLocalItem<BusinessDocument[]>('gd_documents', []);
};

export const addOrUpdateDocument = async (doc: BusinessDocument): Promise<BusinessDocument[]> => {
  // Update local cache immediately
  const current = getLocalItem<BusinessDocument[]>('gd_documents', []);
  const existingIndex = current.findIndex(d => d.id === doc.id);
  let updated: BusinessDocument[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = doc;
  } else {
    updated = [doc, ...current];
  }
  setLocalItem('gd_documents', updated);

  if (isHostingerConfigured) {
    try {
      await withTimeout(hostinger.save('documents', doc.id, doc), 'saving the document');
      markSynced('document', doc.id);
      return await loadDocuments();
    } catch (error) {
      console.error('Failed to save document to the Hostinger database:', error);
      queueFailure('document', 'upsert', doc.id, error);
    }
  }

  return updated;
};

export const deleteDocument = async (id: string): Promise<BusinessDocument[]> => {
  const current = getLocalItem<BusinessDocument[]>('gd_documents', []);
  const updated = current.filter(d => d.id !== id);
  setLocalItem('gd_documents', updated);

  if (isHostingerConfigured) {
    try {
      await withTimeout(hostinger.remove('documents', id), 'deleting the document');
      markSynced('document', id);
      return await loadDocuments();
    } catch (e) {
      console.error('Failed to delete document from the Hostinger database:', e);
      queueFailure('document', 'delete', id, e);
    }
  }

  return updated;
};

// Asset Library: Hostinger database & local cache
export const loadAssets = async (): Promise<Asset[]> => {
  if (isHostingerConfigured) {
    try {
      const rows = await withTimeout(hostinger.list<Asset>('assets'), 'loading assets');
      const remoteAssets = keepWaitingChanges('asset', Array.isArray(rows) ? rows : [],
        getLocalItem<Asset[]>('gd_assets', []));
      setLocalItem('gd_assets', remoteAssets);
      return remoteAssets;
    } catch (e) {
      console.warn('Hostinger loadAssets failed, using local cache:', e);
    }
  }
  return getLocalItem<Asset[]>('gd_assets', []);
};

export const saveAsset = async (asset: Asset): Promise<Asset[]> => {
  const current = getLocalItem<Asset[]>('gd_assets', []);
  const existingIndex = current.findIndex(a => a.id === asset.id);
  let updated: Asset[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = asset;
  } else {
    updated = [asset, ...current];
  }
  setLocalItem('gd_assets', updated);

  if (isHostingerConfigured) {
    try {
      await withTimeout(hostinger.save('assets', asset.id, asset), 'saving the asset');
      markSynced('asset', asset.id);
      return await loadAssets();
    } catch (error) {
      console.error('Failed to save asset to the Hostinger database:', error);
      queueFailure('asset', 'upsert', asset.id, error);
    }
  }

  return updated;
};

export const deleteAsset = async (id: string): Promise<Asset[]> => {
  const current = getLocalItem<Asset[]>('gd_assets', []);
  const updated = current.filter(a => a.id !== id);
  setLocalItem('gd_assets', updated);

  if (isHostingerConfigured) {
    try {
      await withTimeout(hostinger.remove('assets', id), 'deleting the asset');
      markSynced('asset', id);
      return await loadAssets();
    } catch (e) {
      console.error('Failed to delete asset from the Hostinger database:', e);
      queueFailure('asset', 'delete', id, e);
    }
  }

  return updated;
};

// User Preferences: Hostinger database & local cache
export const loadPreferences = async (): Promise<UserPreferences> => {
  if (isHostingerConfigured && !settingWaiting('user_prefs')) {
    try {
      const data = await withTimeout(hostinger.getPreference<any>('user_prefs'), 'loading preferences');
      if (hasContent(data)) {
        setLocalItem('gd_user_prefs', data);
        return data as UserPreferences;
      }
    } catch {
      // fallback to local
    }
  }
  return getLocalItem<UserPreferences>('gd_user_prefs', { typeSettings: {} });
};

export const saveTypePreferences = async (type: DocumentType, settings: LogoSettings) => {
  try {
    const currentPrefs = await loadPreferences();
    const updatedPrefs = {
      ...currentPrefs,
      typeSettings: {
        ...currentPrefs.typeSettings,
        [type]: settings
      }
    };
    setLocalItem('gd_user_prefs', updatedPrefs);

    if (isHostingerConfigured) {
      await withTimeout(hostinger.savePreference('user_prefs', updatedPrefs), 'saving preferences');
      markSynced('preferences', 'user_prefs');
    }
  } catch (e) {
    console.error('Failed to save preferences:', e);
    queueFailure('preferences', 'upsert', 'user_prefs', e);
  }
};

export const getTypePreferences = async (type: DocumentType): Promise<LogoSettings | undefined> => {
  const prefs = await loadPreferences();
  return prefs.typeSettings?.[type];
};

// Global Footer Settings Utils
export const loadFooterSettings = async (): Promise<FooterSettings> => {
  if (isHostingerConfigured && !settingWaiting('global_footer')) {
    try {
      const data = await withTimeout(hostinger.getPreference<any>('global_footer'), 'loading preferences');
      if (hasContent(data)) {
        setLocalItem('gd_global_footer', data);
        return data as FooterSettings;
      }
    } catch {
      // fallback to local
    }
  }
  return getLocalItem<FooterSettings>('gd_global_footer', DEFAULT_FOOTER_SETTINGS);
};

export const saveFooterSettings = async (settings: FooterSettings) => {
  try {
    setLocalItem('gd_global_footer', settings);
    if (isHostingerConfigured) {
      await withTimeout(hostinger.savePreference('global_footer', settings), 'saving preferences');
      markSynced('settings', 'global_footer');
    }
  } catch (e) {
    console.error('Failed to save footer settings:', e);
    queueFailure('settings', 'upsert', 'global_footer', e);
  }
};

// Global Header Settings Utils
export const loadAllHeaderSettings = async (): Promise<Record<DocumentType, HeaderSettings>> => {
  if (isHostingerConfigured && !settingWaiting('global_headers_v2')) {
    try {
      const data = await withTimeout(hostinger.getPreference<any>('global_headers_v2'), 'loading preferences');
      if (hasContent(data)) {
        const merged = { ...DEFAULT_HEADERS_MAP, ...(data as Record<DocumentType, HeaderSettings>) };
        setLocalItem('gd_global_headers_v2', merged);
        return merged;
      }
    } catch (e) {
      console.warn('Failed to load all header settings from the Hostinger database:', e);
    }
  }
  return getLocalItem<Record<DocumentType, HeaderSettings>>('gd_global_headers_v2', DEFAULT_HEADERS_MAP);
};

export const saveAllHeaderSettings = async (settings: Record<DocumentType, HeaderSettings>) => {
  try {
    setLocalItem('gd_global_headers_v2', settings);
    if (isHostingerConfigured) {
      await withTimeout(hostinger.savePreference('global_headers_v2', settings), 'saving preferences');
      markSynced('settings', 'global_headers_v2');
    }
  } catch (e) {
    console.error('Failed to save all header settings:', e);
    queueFailure('settings', 'upsert', 'global_headers_v2', e);
  }
};

export const loadHeaderSettings = async (): Promise<HeaderSettings> => {
  const all = await loadAllHeaderSettings();
  return all[DocumentType.INVOICE];
};

export const saveHeaderSettings = async (settings: HeaderSettings) => {
  const all = await loadAllHeaderSettings();
  all[DocumentType.INVOICE] = settings;
  await saveAllHeaderSettings(all);
};

// Hero Banner Settings Utils
export const loadHeroSettings = async (): Promise<HeroSettings> => {
  if (isHostingerConfigured && !settingWaiting('hero_banner')) {
    try {
      const data = await withTimeout(hostinger.getPreference<any>('hero_banner'), 'loading preferences');
      if (hasContent(data)) {
        setLocalItem('gd_hero_banner', data);
        return data as HeroSettings;
      }
    } catch {
      // fallback to local
    }
  }
  return getLocalItem<HeroSettings>('gd_hero_banner', DEFAULT_HERO_SETTINGS);
};

export const saveHeroSettings = async (settings: HeroSettings) => {
  try {
    setLocalItem('gd_hero_banner', settings);
    if (isHostingerConfigured) {
      await withTimeout(hostinger.savePreference('hero_banner', settings), 'saving preferences');
      markSynced('settings', 'hero_banner');
    }
  } catch (e) {
    console.error('Failed to save hero settings:', e);
    queueFailure('settings', 'upsert', 'hero_banner', e);
  }
};



/* ------------------------------------------------------------------ *
 * Replaying writes that could not reach the Hostinger database earlier.
 * Everything is read back from the local cache, which is always the
 * newest copy, so a retry can never resurrect stale data.
 * ------------------------------------------------------------------ */
const replayPending = async (item: PendingItem): Promise<void> => {
  if (!isHostingerConfigured) throw new Error('Hostinger database not configured');

  if (item.kind === 'document') {
    if (item.op === 'delete') {
      await withTimeout(hostinger.remove('documents', item.recordId), 'deleting documents');
      return;
    }
    const doc = getLocalItem<BusinessDocument[]>('gd_documents', []).find(d => d.id === item.recordId);
    if (!doc) return;                       // deleted since; nothing to push
    await withTimeout(hostinger.save('documents', doc.id, doc), 'saving documents');
    return;
  }

  if (item.kind === 'asset') {
    if (item.op === 'delete') {
      await withTimeout(hostinger.remove('assets', item.recordId), 'deleting assets');
      return;
    }
    const asset = getLocalItem<Asset[]>('gd_assets', []).find(a => a.id === item.recordId);
    if (!asset) return;
    await withTimeout(hostinger.save('assets', asset.id, asset), 'saving assets');
    return;
  }

  // preferences and global settings
  const localKeyByRecord: Record<string, string> = {
    user_prefs: 'gd_user_prefs',
    global_footer: 'gd_global_footer',
    global_headers_v2: 'gd_global_headers_v2',
    hero_banner: 'gd_hero_banner',
    price_desk: 'gd.price.v1',          // the Pricing Desk's duty sheets, rate and charges
  };
  const key = localKeyByRecord[item.recordId];
  if (!key) return;
  const data = getLocalItem<unknown>(key, null as unknown);
  if (data === null) return;
  await withTimeout(hostinger.savePreference(item.recordId, data), 'saving preferences');
};

registerReplay(replayPending, isHostingerConfigured);
