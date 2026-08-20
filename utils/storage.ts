
import { BusinessDocument, Asset, DocumentType, FooterSettings, HeaderSettings, HeroSettings } from '../types.ts';
import { supabase } from './supabase.ts';

export interface LogoSettings {
  logoUrl?: string;
  logoSize?: number;
  logoPosition?: number;
}

export interface UserPreferences {
  typeSettings: Partial<Record<DocumentType, LogoSettings>>;
}

// Documents Supabase Utils
export const loadDocuments = async (): Promise<BusinessDocument[]> => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('data')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? data.map(item => item.data as BusinessDocument) : [];
  } catch (e) {
    console.error('Failed to load documents:', e);
    return [];
  }
};

export const addOrUpdateDocument = async (doc: BusinessDocument): Promise<BusinessDocument[]> => {
  try {
    const { error } = await supabase
      .from('documents')
      .upsert({ 
        id: doc.id, 
        data: doc,
        created_at: new Date(doc.createdAt).toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return await loadDocuments();
  } catch (error) {
    console.error('Failed to save document:', error);
    alert('Failed to save to cloud database.');
    return [];
  }
};

export const deleteDocument = async (id: string): Promise<BusinessDocument[]> => {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return await loadDocuments();
  } catch (e) {
    console.error('Failed to delete document:', e);
    return [];
  }
};

// Asset Library Supabase Utils
export const loadAssets = async (): Promise<Asset[]> => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('data');

    if (error) throw error;
    return data ? data.map(item => item.data as Asset) : [];
  } catch (e) {
    console.error('Failed to load assets:', e);
    return [];
  }
};

export const saveAsset = async (asset: Asset): Promise<Asset[]> => {
  try {
    const { error } = await supabase
      .from('assets')
      .upsert({ id: asset.id, data: asset });

    if (error) throw error;
    return await loadAssets();
  } catch (error) {
    console.error('Failed to save asset:', error);
    return await loadAssets();
  }
};

export const deleteAsset = async (id: string): Promise<Asset[]> => {
  try {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return await loadAssets();
  } catch (e) {
    console.error('Failed to delete asset:', e);
    return [];
  }
};

// User Preferences Supabase Utils
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
    
    await supabase
      .from('preferences')
      .upsert({ id: 'user_prefs', data: updatedPrefs });
  } catch (e) {
    console.error('Failed to save preferences:', e);
  }
};

export const loadPreferences = async (): Promise<UserPreferences> => {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('data')
      .eq('id', 'user_prefs')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
    return data ? (data.data as UserPreferences) : { typeSettings: {} };
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
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('data')
      .eq('id', 'global_footer')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return data ? (data.data as FooterSettings) : {
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
  } catch (e) {
    return {
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
  }
};

export const saveFooterSettings = async (settings: FooterSettings) => {
  try {
    await supabase
      .from('preferences')
      .upsert({ id: 'global_footer', data: settings });
  } catch (e) {
    console.error('Failed to save footer settings:', e);
  }
};

// Global Header Settings Utils
export const loadAllHeaderSettings = async (): Promise<Record<DocumentType, HeaderSettings>> => {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('data')
      .eq('id', 'global_headers_v2')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
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

    if (!data || !data.data) return initial;

    // Merge with defaults in case new document types are added
    return { ...initial, ...(data.data as Record<DocumentType, HeaderSettings>) };
  } catch (e) {
    console.error('Failed to load all header settings:', e);
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
    return {
      [DocumentType.INVOICE]: { ...defaultHeader },
      [DocumentType.QUOTATION]: { ...defaultHeader },
      [DocumentType.BILL]: { ...defaultHeader },
      [DocumentType.CHALLAN]: { ...defaultHeader },
      [DocumentType.PRO_INVOICE]: { ...defaultHeader }
    };
  }
};

export const saveAllHeaderSettings = async (settings: Record<DocumentType, HeaderSettings>) => {
  try {
    await supabase
      .from('preferences')
      .upsert({ id: 'global_headers_v2', data: settings });
  } catch (e) {
    console.error('Failed to save all header settings:', e);
  }
};

export const loadHeaderSettings = async (): Promise<HeaderSettings> => {
  const all = await loadAllHeaderSettings();
  return all[DocumentType.INVOICE]; // Default to Invoice for legacy callers
};

export const saveHeaderSettings = async (settings: HeaderSettings) => {
  const all = await loadAllHeaderSettings();
  all[DocumentType.INVOICE] = settings;
  await saveAllHeaderSettings(all);
};

// Hero Banner Settings Utils
export const loadHeroSettings = async (): Promise<HeroSettings> => {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('data')
      .eq('id', 'hero_banner')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return data ? (data.data as HeroSettings) : {
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
  } catch (e) {
    return {
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
  }
};

export const saveHeroSettings = async (settings: HeroSettings) => {
  try {
    await supabase
      .from('preferences')
      .upsert({ id: 'hero_banner', data: settings });
  } catch (e) {
    console.error('Failed to save hero settings:', e);
  }
};
