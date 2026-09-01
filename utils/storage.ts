import { BusinessDocument, Asset, DocumentType, FooterSettings, HeaderSettings, HeroSettings } from '../types.ts';

export interface LogoSettings {
  logoUrl?: string;
  logoSize?: number;
  logoPosition?: number;
}

export interface UserPreferences {
  typeSettings: Partial<Record<DocumentType, LogoSettings>>;
}

const STORAGE_KEYS = {
  DOCUMENTS: 'gd_documents',
  ASSETS: 'gd_assets',
  PREFERENCES: 'gd_user_preferences',
  GLOBAL_FOOTER: 'gd_global_footer',
  GLOBAL_HEADERS: 'gd_global_headers_v2',
  HERO_BANNER: 'gd_hero_banner'
};

// Documents Local Storage Utils
export const loadDocuments = async (): Promise<BusinessDocument[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load documents from local storage:', e);
    return [];
  }
};

export const addOrUpdateDocument = async (doc: BusinessDocument): Promise<BusinessDocument[]> => {
  try {
    const current = await loadDocuments();
    const index = current.findIndex(d => d.id === doc.id);
    let updated: BusinessDocument[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = doc;
    } else {
      updated = [doc, ...current];
    }
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save document to storage:', error);
    alert('Failed to save document to local storage.');
    return await loadDocuments();
  }
};

export const deleteDocument = async (id: string): Promise<BusinessDocument[]> => {
  try {
    const current = await loadDocuments();
    const updated = current.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete document from storage:', e);
    return await loadDocuments();
  }
};

// Asset Library Local Storage Utils
export const loadAssets = async (): Promise<Asset[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSETS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load assets from local storage:', e);
    return [];
  }
};

export const saveAsset = async (asset: Asset): Promise<Asset[]> => {
  try {
    const current = await loadAssets();
    const index = current.findIndex(a => a.id === asset.id);
    let updated: Asset[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = asset;
    } else {
      updated = [asset, ...current];
    }
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save asset to storage:', error);
    return await loadAssets();
  }
};

export const deleteAsset = async (id: string): Promise<Asset[]> => {
  try {
    const current = await loadAssets();
    const updated = current.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete asset from storage:', e);
    return await loadAssets();
  }
};

// User Preferences Local Storage Utils
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
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updatedPrefs));
  } catch (e) {
    console.error('Failed to save preferences to storage:', e);
  }
};

export const loadPreferences = async (): Promise<UserPreferences> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (!raw) return { typeSettings: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { typeSettings: {} };
  } catch (e) {
    return { typeSettings: {} };
  }
};

export const getTypePreferences = async (type: DocumentType): Promise<LogoSettings | undefined> => {
  const prefs = await loadPreferences();
  return prefs.typeSettings?.[type];
};

// Global Footer Settings Utils
export const loadFooterSettings = async (): Promise<FooterSettings> => {
  const defaultFooter: FooterSettings = {
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

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_FOOTER);
    if (!raw) return defaultFooter;
    const parsed = JSON.parse(raw);
    return { ...defaultFooter, ...parsed };
  } catch (e) {
    return defaultFooter;
  }
};

export const saveFooterSettings = async (settings: FooterSettings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_FOOTER, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save footer settings to storage:', e);
  }
};

// Global Header Settings Utils
export const loadAllHeaderSettings = async (): Promise<Record<DocumentType, HeaderSettings>> => {
  const defaultHeader: HeaderSettings = {
    text: 'Importer & All kinds of Brand new & Reconditioned Vehicles Supplier',
    fontSize: 14,
    fontFamily: 'serif',
    alignment: 'left',
    isItalic: true,
    logoUrl: '',
    logoSize: 220,
    logoPosition: 0
  };

  const initial: Record<DocumentType, HeaderSettings> = {
    [DocumentType.INVOICE]: { ...defaultHeader },
    [DocumentType.QUOTATION]: { ...defaultHeader },
    [DocumentType.BILL]: { ...defaultHeader },
    [DocumentType.CHALLAN]: { ...defaultHeader },
    [DocumentType.PRO_INVOICE]: { ...defaultHeader }
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_HEADERS);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return initial;
    return { ...initial, ...parsed };
  } catch (e) {
    console.warn('Failed to load all header settings from storage:', e);
    return initial;
  }
};

export const saveAllHeaderSettings = async (settings: Record<DocumentType, HeaderSettings>) => {
  try {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_HEADERS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save all header settings to storage:', e);
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
  const defaultHero: HeroSettings = {
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

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HERO_BANNER);
    if (!raw) return defaultHero;
    const parsed = JSON.parse(raw);
    return { ...defaultHero, ...parsed };
  } catch (e) {
    return defaultHero;
  }
};

export const saveHeroSettings = async (settings: HeroSettings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.HERO_BANNER, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save hero settings to storage:', e);
  }
};
