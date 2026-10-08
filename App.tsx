
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PricingDesk from './pricing/PricingDesk';
import { SyncStatus, SaveWarning, SyncFloatingBadge } from './components/SyncStatus.tsx';
import { HomePriceCalculator } from './components/HomePriceCalculator.tsx';
import { UndoToast, offerUndo } from './components/UndoToast.tsx';
import { ResumeDraftBanner, readAutosave, writeAutosave, clearAutosave, type AutosaveEntry } from './components/ResumeDraftBanner.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  Edit, 
  Eye, 
  Settings,
  X,
  LayoutDashboard,
  ChevronRight,
  ArrowRight,
  Car,
  MapPin,
  Sun,
  Moon,
  Database,
  CircleDollarSign,
  Activity,
  Cpu,
  Globe,
  Zap,
  Layers,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Menu,
  FileText,
  Image as ImageIcon,
  LogOut,
  Edit3,
  Minus, Calculator, FilePen } from 'lucide-react';
import { BusinessDocument, DocumentType, FooterSettings, HeaderSettings, HeroSettings } from './types.ts';
import { DOC_TYPES_CONFIG } from './constants.tsx';
import { addOrUpdateDocument, loadDocuments, deleteDocument, loadFooterSettings, loadAllHeaderSettings, loadHeroSettings,
  getCachedDocuments,
} from './utils/storage.ts';
import { isHostingerConfigured, LOGIN_REQUIRED_EVENT } from './utils/hostinger.ts';
import { checkSession, logout } from './utils/auth.ts';
import { flushPending } from './utils/sync.ts';
import DocumentForm from './components/DocumentForm.tsx';
import DocumentPreview from './components/DocumentPreview.tsx';
import ProInvoiceGenerator from './components/ProInvoiceGenerator.tsx';
import AssetLibrary from './components/AssetLibrary.tsx';
import GlobalSettings from './components/GlobalSettings.tsx';
import { LoginPage } from './components/LoginPage.tsx';

const RUNNING_TEXTS = [
  "Welcome to Garir Dokan Pro - Your Ultimate Automotive Solution",
  "Generate Professional Invoices, Quotations & Delivery Challans Instantly",
  "Managing your Automotive Business has never been this easy and stylish",
  "Premium Export Quality PDF Documents with One Click Download"
];

const STATS_BG = "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=2500";

const App: React.FC = () => {
  // The server decides who is logged in (see utils/auth.ts); null while that check is running.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkSession().then(state => setIsAuthenticated(state !== 'none'));
    const onLoginRequired = () => setIsAuthenticated(false);
    window.addEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('gd_theme') !== 'light'; // Default to dark if not set
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('gd_theme', 'dark');
    } else {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('gd_theme', 'light');
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    void logout();
  };

  const [currentBanner, setCurrentBanner] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && loadingProgress < 100) {
      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 70) return prev;
          const increment = (70 - prev) * 0.1;
          return prev + Math.max(increment, 1);
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isLoading, loadingProgress]);

  const startLoading = () => {
    setLoadingProgress(0);
    setIsLoading(true);
  };

  const finishLoading = () => {
    setLoadingProgress(100);
    setTimeout(() => setIsLoading(false), 500);
  };

  const [editingDoc, setEditingDoc] = useState<Partial<BusinessDocument> | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<BusinessDocument | null>(null);
  const [draftDoc, setDraftDoc] = useState<Partial<BusinessDocument> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'landing' | 'list' | 'assets' | 'pricing'>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [showProGenerator, setShowProGenerator] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [savedAsDraft, setSavedAsDraft] = useState(false);       // which message the save toast shows
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);   // Records filter
  // auto-save: work left in an editor that was never saved, offered back on the next visit
  const [resumeEntry, setResumeEntry] = useState<AutosaveEntry | null>(null);
  const editorBaseline = useRef<string | null>(null);           // the form as it opened, to tell real edits apart
  const [globalFooter, setGlobalFooter] = useState<FooterSettings | undefined>(undefined);
  const [globalHeaders, setGlobalHeaders] = useState<Record<DocumentType, HeaderSettings> | undefined>(undefined);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    selectedImages: [
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=2000",
      "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&q=80&w=2000"
    ],
    transitionEffect: 'fade',
    interval: 5000,
    backgroundPosition: '50% 50%',
    imagePositions: {}
  });

  const location = useLocation();
  const navigate = useNavigate();

  const lastPathname = useRef(location.pathname);
  // the first run must apply whatever address the browser opened, otherwise a direct link like
  // /records or /pricing-desk is ignored whenever the data happens to load instantly
  const firstRun = useRef(true);
  const lastTargetPath = useRef('/');
  const wasLoading = useRef(isLoading);

  let currentTargetPath = '/';
  if (editingDoc) {
    if (editingDoc.id && editingDoc.docNumber) currentTargetPath = `/edit/${editingDoc.docNumber}`;
    else if (editingDoc.id) currentTargetPath = `/edit/${editingDoc.id}`;
    else currentTargetPath = `/create/${(editingDoc.type || '').toLowerCase().replace('_', '-')}`;
  } else if (showProGenerator) {
    currentTargetPath = `/create/pro-invoice`;
  } else if (previewingDoc) {
    currentTargetPath = `/preview/${previewingDoc.docNumber || previewingDoc.id}`;
  } else if (showGlobalSettings) {
    currentTargetPath = `/settings`;
  } else if (viewMode === 'list') {
    currentTargetPath = `/records`;
  } else if (viewMode === 'assets') {
    currentTargetPath = `/assets`;
  } else if (viewMode === 'pricing') {
    currentTargetPath = `/pricing-desk`;
  }

  useEffect(() => {
    // "/assets/" is the same page as "/assets": browsers that once followed the server's old
    // slash-adding redirect keep using it, so drop a trailing slash without reloading the page
    if (location.pathname.length > 1 && location.pathname.endsWith('/')) {
      navigate(location.pathname.replace(/\/+$/, '') + location.search, { replace: true });
      return;
    }
    const path = location.pathname;
    const pathChanged = path !== lastPathname.current;
    const stateChanged = currentTargetPath !== lastTargetPath.current;
    const finishedLoading = wasLoading.current && !isLoading;

    if (pathChanged || finishedLoading || firstRun.current) {
      if (path === '/') {
        setEditingDoc(null);
        setShowProGenerator(false);
        setPreviewingDoc(null);
        setShowGlobalSettings(false);
        setViewMode('landing');
      } else if (path === '/records') {
        setViewMode('list');
        setEditingDoc(null);
        setShowProGenerator(false);
        setPreviewingDoc(null);
        setShowGlobalSettings(false);
      } else if (path === '/assets') {
        setViewMode('assets');
        setEditingDoc(null);
        setShowProGenerator(false);
        setPreviewingDoc(null);
        setShowGlobalSettings(false);
      } else if (path === '/pricing-desk') {
        setViewMode('pricing');
        setEditingDoc(null);
        setShowProGenerator(false);
        setPreviewingDoc(null);
        setShowGlobalSettings(false);
      } else if (path === '/settings') {
        setShowGlobalSettings(true);
      } else if (path.startsWith('/create/')) {
        const typeStr = path.replace('/create/', '');
        if (typeStr === 'pro-invoice') {
          setShowProGenerator(true);
          setEditingDoc(null);
          setPreviewingDoc(null);
        } else {
          const docType = typeStr.replace('-', '_').toUpperCase() as DocumentType;
          setEditingDoc({ type: docType });
          setShowProGenerator(false);
          setPreviewingDoc(null);
        }
      } else if (path.startsWith('/edit/')) {
        if (!isLoading) {
          const docIdentifier = path.replace('/edit/', '');
          const doc = documents.find(d => d.docNumber === docIdentifier || d.id === docIdentifier);
          if (doc) {
            setEditingDoc(doc);
            setShowProGenerator(false);
            setPreviewingDoc(null);
          }
        }
      } else if (path.startsWith('/preview/')) {
        if (!isLoading) {
          const docIdentifier = path.replace('/preview/', '');
          const doc = documents.find(d => d.docNumber === docIdentifier || d.id === docIdentifier);
          if (doc) {
            setPreviewingDoc(doc);
            setEditingDoc(null);
            setShowProGenerator(false);
          }
        }
      }
      lastPathname.current = path;
      firstRun.current = false;
    }

    // the address follows the view straight away; waiting for the initial load used to leave the
    // address behind for a few seconds on a slow connection
    if (stateChanged && !pathChanged) {
      if (path !== currentTargetPath) {
        navigate(currentTargetPath);
        lastPathname.current = currentTargetPath;
      }
    }

    lastTargetPath.current = currentTargetPath;
    wasLoading.current = isLoading;
  }, [location.pathname, currentTargetPath, isLoading, documents, navigate]);

  const previewRef = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem('gd_editor_width');
    return saved ? parseFloat(saved) : 55; // 55% left, 45% right
  });
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  
  const [previewZoom, setPreviewZoom] = useState(() => {
    const saved = localStorage.getItem('gd_preview_zoom');
    return saved ? parseFloat(saved) : 0.65;
  });
  const [mobilePreviewMode, setMobilePreviewMode] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY;
        const zoomStep = 0.03;
        setPreviewZoom(prev => {
          const next = delta < 0 ? prev + zoomStep : prev - zoomStep;
          const adjusted = Math.min(Math.max(next, 0.25), 2.5);
          localStorage.setItem('gd_preview_zoom', adjusted.toFixed(3));
          return adjusted;
        });
      }
    };

    let initialPinchDistance = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance > 0) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = currentDistance - initialPinchDistance;
        setPreviewZoom(prev => {
          const zoomStep = 0.005;
          const next = prev + (delta * zoomStep);
          const adjusted = Math.min(Math.max(next, 0.25), 2.5);
          localStorage.setItem('gd_preview_zoom', adjusted.toFixed(3));
          return adjusted;
        });
        initialPinchDistance = currentDistance;
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistance = 0;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [previewContainerRef.current, editingDoc?.id]);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const checkSize = () => setIsLargeScreen(window.innerWidth >= 1024);
    checkSize();
    window.addEventListener('resize', checkSize);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const percentage = (e.clientX / window.innerWidth) * 100;
      if (percentage >= 30 && percentage <= 75) {
        setEditorWidth(percentage);
        localStorage.setItem('gd_editor_width', percentage.toString());
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('resize', checkSize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const fetchFooter = async () => {
    const settings = await loadFooterSettings();
    setGlobalFooter(settings);
  };

  const fetchHeader = async () => {
    const settings = await loadAllHeaderSettings();
    setGlobalHeaders(settings);
  };

  const fetchHero = async () => {
    const settings = await loadHeroSettings();
    setHeroSettings(settings);
  };

  useEffect(() => {
    if (isAuthenticated !== true) return;   // data is loaded once the login is confirmed
    const initData = async () => {
      startLoading();

      // Show what is already on this device at once. A slow or unreachable cloud used to hold the
      // whole interface behind the loader; now it only refreshes what is already on screen.
      const cached = getCachedDocuments();
      if (cached.length) {
        setDocuments(cached);
        finishLoading();
      }

      try {
        // send anything saved while offline or logged out first, so the fresh list includes it
        await flushPending().catch(() => {});
        // independent of each other, so they run together instead of one after another
        const [docs] = await Promise.all([
          loadDocuments(),
          fetchFooter(),
          fetchHeader(),
          fetchHero(),
        ]);
        setDocuments(docs || []);
      } catch (err) {
        console.warn("Initialization failed (likely database down):", err);
      } finally {
        finishLoading();
      }
    };
    
    initData();
  }, [isAuthenticated]);

  useEffect(() => {
    const bannerInterval = setInterval(() => {
      if (heroSettings.selectedImages.length > 0) {
        setCurrentBanner(prev => (prev + 1) % heroSettings.selectedImages.length);
      }
    }, heroSettings.interval);

    return () => clearInterval(bannerInterval);
  }, [heroSettings.selectedImages.length, heroSettings.interval]);

  useEffect(() => {
    const textInterval = setInterval(() => {
      setCurrentTextIndex(prev => (prev + 1) % RUNNING_TEXTS.length);
    }, 3000);

    return () => clearInterval(textInterval);
  }, []);

  /** Open the Pricing Desk with its Price Calculator selected. */
  const openPriceDesk = () => {
    try { window.localStorage.setItem('gd.tool', 'PRICE'); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('gd:open-tool', { detail: 'PRICE' }));
    setViewMode('pricing');
    setActiveType(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  /** Slide down to the calculator on this page. */
  const scrollToPriceCalculator = () => {
    setViewMode('landing');
    window.setTimeout(() => {
      document.getElementById('home-price-calculator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSave = async (doc: BusinessDocument) => {
    const isDuplicate = documents.some(d => 
      d.docNumber === doc.docNumber && d.id !== doc.id && doc.docNumber.trim() !== ''
    );
    
    if (isDuplicate) {
      alert(`Warning: A document with Document / ID "${doc.docNumber}" already exists. You cannot use this name. Please choose a different ID.`);
      return;
    }

    startLoading();
    const updated = await addOrUpdateDocument(doc);
    setDocuments(updated);
    setEditingDoc(null);
    setDraftDoc(null);
    setShowProGenerator(false);
    clearAutosave();                         // saved — nothing left to recover
    editorBaseline.current = null;
    setSavedAsDraft(doc.status === 'draft');
    setShowSaveToast(true);
    finishLoading();
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  /* ---------------- auto-save while an editor is open ---------------- */
  const editorOpen = !!editingDoc || showProGenerator;

  // Remember how the form looked when it opened; only real edits are worth keeping. An editor
  // fills a few fields by itself as it opens (document number, date), so whatever it settles to
  // in its first second is the starting point, not something the operator typed.
  const editorOpenedAt = useRef(0);
  useEffect(() => {
    if (!editorOpen) { editorBaseline.current = null; editorOpenedAt.current = 0; return; }
    if (!editorOpenedAt.current) editorOpenedAt.current = Date.now();
    const settling = Date.now() - editorOpenedAt.current < 1000;
    if (draftDoc && (editorBaseline.current === null || settling)) editorBaseline.current = JSON.stringify(draftDoc);
  }, [editorOpen, draftDoc]);

  useEffect(() => {
    if (!editorOpen || !draftDoc || editorBaseline.current === null) return;
    if (JSON.stringify(draftDoc) === editorBaseline.current) return;
    const t = window.setTimeout(() => writeAutosave(draftDoc), 800);
    return () => window.clearTimeout(t);
  }, [editorOpen, draftDoc]);

  // on arrival: work that was never saved, from a closed tab or a crash
  useEffect(() => {
    const entry = readAutosave();
    if (entry) setResumeEntry(entry);
  }, []);

  // When the login runs out (or Log Out is pressed) while an editor is open, the login page hides
  // the editor. Close it and offer the auto-saved copy after the next login; otherwise the editor
  // would come back showing the form as it was before the edits.
  useEffect(() => {
    if (isAuthenticated !== false || !editorOpen) return;
    const edited = draftDoc && editorBaseline.current !== null && JSON.stringify(draftDoc) !== editorBaseline.current;
    if (edited) writeAutosave(draftDoc as Partial<BusinessDocument>);
    const entry = readAutosave();
    if (entry) setResumeEntry(entry);
    setEditingDoc(null);
    setShowProGenerator(false);
    setDraftDoc(null);
    editorBaseline.current = null;
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Reopen work that was never saved. It counts as edited from the start, so Discard still offers Undo. */
  const reopenUnsaved = (doc: Partial<BusinessDocument>) => {
    editorBaseline.current = '';              // nothing saved to compare against
    editorOpenedAt.current = Date.now() - 2000;
    setEditingDoc(doc as BusinessDocument);   // both editors open from editingDoc
  };

  const resumeAutosave = () => {
    if (!resumeEntry) return;
    setResumeEntry(null);
    reopenUnsaved(resumeEntry.doc);
  };

  /** Discard with a way back: the edited form can be reopened for ten seconds. */
  const discardEditor = (close: () => void) => {
    const edited = draftDoc && editorBaseline.current !== null && JSON.stringify(draftDoc) !== editorBaseline.current;
    const copy = edited ? (draftDoc as Partial<BusinessDocument>) : null;
    close();
    setDraftDoc(null);
    editorBaseline.current = null;
    clearAutosave();
    if (copy) {
      offerUndo('Unsaved changes discarded', () => { reopenUnsaved(copy); });
    }
  };

  const handleDelete = async (id: string) => {
    const removed = documents.find(d => d.id === id);
    if (confirm('Are you sure you want to delete this document?')) {
      startLoading();
      const updated = await deleteDocument(id);
      setDocuments(updated);
      finishLoading();
      // a short window to put it back exactly as it was — same id, number and dates
      if (removed) {
        offerUndo(`${removed.docNumber || 'Document'} deleted`, async () => {
          const restored = await addOrUpdateDocument(removed);
          setDocuments(restored);
        });
      }
    }
  };



  // Everything about a document that is worth searching, as one lowercase string.
  // Dates are written out in several shapes (and in Bangla) so a month name or 09-2026 both hit.
  const BN_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const EN_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

  const searchableText = (doc: BusinessDocument): string => {
    const parts: (string | number | undefined)[] = [
      doc.docNumber, doc.clientName, doc.clientPhone, doc.clientAddress,
      doc.vehicleTitle, doc.chassisNumber, doc.engineNumber, doc.brand, doc.model,
      doc.yearModel, doc.color, doc.garageNumber, doc.vehiclePrice, doc.date,
      doc.status === 'draft' ? 'draft' : undefined,
    ];
    const d = doc.date ? new Date(doc.date) : null;
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear());
      parts.push(
        `${day}-${month}-${year}`, `${day}/${month}/${year}`, `${month}-${year}`, `${month}/${year}`,
        EN_MONTHS[d.getMonth()], EN_MONTHS[d.getMonth()].slice(0, 3), BN_MONTHS[d.getMonth()], year,
      );
    }
    return parts.filter(Boolean).join(' ').toLowerCase();
  };

  // "inv 1" finds INV-000001: each word must appear, and separators are ignored on a second pass
  const flatten = (t: string) => t.replace(/[^a-z0-9\u0980-\u09FF]+/gi, '');

  const matchesQuery = (doc: BusinessDocument, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = searchableText(doc);
    const flatHay = flatten(hay);
    return q.split(/\s+/).filter(Boolean).every(word => hay.includes(word) || flatHay.includes(flatten(word)));
  };

  const filteredDocs = documents.filter(doc => {
    const matchesType = activeType ? doc.type === activeType : true;
    const matchesDraft = showDraftsOnly ? doc.status === 'draft' : true;
    return matchesType && matchesDraft && matchesQuery(doc, searchQuery);
  }).sort((a, b) => b.createdAt - a.createdAt);

  // the headline figures count finished documents; drafts are shown on their own
  const finalDocs = documents.filter(d => d.status !== 'draft');
  const draftCount = documents.length - finalDocs.length;
  const totalRecords = finalDocs.length;
  const totalAssetValue = finalDocs.reduce((sum, doc) => sum + (doc.vehiclePrice || 0), 0);
  
  const getCountByType = (type: DocumentType) => documents.filter(doc => doc.type === type).length;

  useEffect(() => {
    if (editingDoc) {
      setMobilePreviewMode(false);
    }
  }, [editingDoc?.id, editingDoc?.type]);

  if (isAuthenticated === null) {
    return null;   // a moment while the server confirms the login
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans selection:bg-red-700 selection:text-white">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 w-full max-w-[340px] px-4">
            <div className="relative w-full h-12">
              {/* Road line */}
              <div className="absolute left-4 right-4 bottom-0 h-[2px] bg-white/10 overflow-hidden rounded-full">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-red-700/50 to-transparent animate-[pulse_2s_ease-in-out_infinite]" />
              </div>

              {/* Destination */}
              <div className="absolute right-0 bottom-[2px] text-red-700 z-10 flex flex-col items-center">
                <MapPin className="w-8 h-8 animate-bounce drop-shadow-[0_0_10px_rgba(185,28,28,0.5)]" />
              </div>
              
              {/* Driving Car */}
              <div 
                className="absolute z-20 text-white transition-all ease-out bottom-[2px]"
                style={{ 
                  left: `${loadingProgress}%`,
                  transform: 'translateX(-50%)',
                  transitionDuration: loadingProgress === 100 ? '500ms' : '150ms'
                }}
              >
                <Car className="w-8 h-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
              </div>
            </div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-white whitespace-nowrap text-center">Car is on the way...</span>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-2xl shadow-green-900/40 animate-in slide-in-from-top-10">
          <CheckCircle2 className="w-6 h-6" />
          <span className="uppercase tracking-widest text-xs">{savedAsDraft ? 'Saved as Draft' : 'Document Secured Successfully'}</span>
        </div>
      )}

      {(editingDoc || showProGenerator || previewingDoc || showGlobalSettings) && <SyncFloatingBadge />}
      <UndoToast />
      {resumeEntry && !editorOpen && (
        <ResumeDraftBanner
          entry={resumeEntry}
          onResume={resumeAutosave}
          onDismiss={() => { clearAutosave(); setResumeEntry(null); }}
        />
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-10 py-3 md:py-6 flex justify-between items-center backdrop-blur-md bg-black/20 border-b border-white/5 print:hidden no-print">
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => {setViewMode('landing'); setActiveType(null); setIsSidebarOpen(false);}}>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-700 rounded-lg md:rounded-xl flex items-center justify-center font-black text-base md:text-xl shadow-lg shadow-red-700/30 text-white text-white-always">GD</div>
          <span className="text-base md:text-xl font-black tracking-tighter">Garir Dokan <span className="text-red-700 uppercase">Pro</span></span>
          <div onClick={e => e.stopPropagation()}><SyncStatus /></div>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          <button onClick={() => {setViewMode('landing'); setActiveType(null);}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'landing' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Home</button>
          <button onClick={() => {setViewMode('assets');}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'assets' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Asset Library</button>
          <button onClick={() => {setViewMode('list'); setActiveType(null);}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Records</button>
          <div className="h-4 w-px bg-white/10"></div>
          <button onClick={() => {setViewMode('pricing'); setActiveType(null);}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'pricing' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Pricing Desk</button>
          <div className="h-4 w-px bg-white/10"></div>
          <button 
            onClick={() => setShowGlobalSettings(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Global Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('landing')} className="bg-red-700 text-white text-white-always px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-red-700/20 hover:bg-red-800 transition-all active:scale-95">Dashboard</button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile Sidebar Navigation */}
      <div className={`
        fixed inset-y-0 right-0 z-[60] w-72 bg-[#0a0a0b] border-l border-white/5 transform transition-transform duration-300 ease-in-out lg:hidden print:hidden no-print
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-8 pt-24 space-y-6">
          <button 
            onClick={() => {setViewMode('landing'); setActiveType(null); setIsSidebarOpen(false);}} 
            className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors ${viewMode === 'landing' ? 'text-red-600' : 'text-gray-400'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Home
          </button>
          <button 
            onClick={() => {setViewMode('assets'); setIsSidebarOpen(false);}} 
            className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors ${viewMode === 'assets' ? 'text-red-600' : 'text-gray-400'}`}
          >
            <Database className="w-5 h-5" /> Asset Library
          </button>
          <button 
            onClick={() => {setViewMode('list'); setActiveType(null); setIsSidebarOpen(false);}} 
            className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'text-red-600' : 'text-gray-400'}`}
          >
            <FileText className="w-5 h-5" /> Records
          </button>
          <button 
            onClick={() => {setViewMode('pricing'); setActiveType(null); setIsSidebarOpen(false);}} 
            className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors ${viewMode === 'pricing' ? 'text-red-600' : 'text-gray-400'}`}
          >
            <Calculator className="w-5 h-5" /> Pricing Desk
          </button>
          <div className="h-px bg-white/5 w-full"></div>
          <button 
            onClick={() => {setShowGlobalSettings(true); setIsSidebarOpen(false);}} 
            className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" /> Global Settings
          </button>
          <button 
            onClick={() => {setIsDarkMode(!isDarkMode); setIsSidebarOpen(false);}} 
            className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            {isDarkMode ? <><Sun className="w-5 h-5" /> Light Mode</> : <><Moon className="w-5 h-5" /> Dark Mode</>}
          </button>
          <button 
            onClick={() => {handleLogout(); setIsSidebarOpen(false);}} 
            className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" /> Log Out
          </button>
          <button 
            onClick={() => {setViewMode('landing'); setIsSidebarOpen(false);}} 
            className="w-full bg-red-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-700/20"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Global Settings Modal */}
      {showGlobalSettings && (
        <GlobalSettings 
          onClose={() => setShowGlobalSettings(false)}
          onFooterUpdate={fetchFooter}
          onHeaderUpdate={fetchHeader}
          onHeroUpdate={fetchHero}
        />
      )}

      {viewMode === 'landing' && (
        <div className="flex flex-col overflow-x-hidden">
          {/* Hero Banner Section */}
          <section className="relative h-[90vh]">
            <div className="absolute inset-0 overflow-hidden">
              {heroSettings.selectedImages.map((banner, idx) => {
                const isActive = idx === currentBanner;
                let transitionClass = "";
                
                if (heroSettings.transitionEffect === 'fade') {
                  transitionClass = `transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`;
                } else if (heroSettings.transitionEffect === 'slide') {
                  transitionClass = `transition-all duration-1000 ease-in-out ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`;
                } else if (heroSettings.transitionEffect === 'zoom') {
                  transitionClass = `transition-all duration-1000 ease-in-out ${isActive ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`;
                }

                return (
                  <div 
                    key={idx}
                    className={`absolute inset-0 ${transitionClass}`}
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 100%), url(${banner})`,
                      backgroundSize: 'cover',
                      backgroundPosition: heroSettings.imagePositions && heroSettings.imagePositions[banner] 
                        ? `${heroSettings.imagePositions[banner].x}% ${heroSettings.imagePositions[banner].y}%`
                        : heroSettings.backgroundPosition || '50% 50%'
                    }}
                  />
                );
              })}
              <div 
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{
                  bottom: '-2px',
                  height: '120px',
                  background: isDarkMode 
                    ? 'linear-gradient(to top, #0a0a0b 0%, #0a0a0b 15%, rgba(10,10,11,0.8) 40%, rgba(10,10,11,0) 100%)' 
                    : 'transparent'
                }}
              ></div>
            </div>

            <div className="absolute left-0 right-0 lg:left-[3%] lg:right-auto top-[98%] lg:top-[60%] -translate-y-1/2 z-30 px-4 sm:px-0 flex justify-center lg:justify-start">
              <div className={`force-dark backdrop-blur-xl border border-white/10 p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3.5rem] w-full sm:w-[580px] shadow-2xl relative overflow-hidden group scale-[0.85] sm:scale-100 origin-center lg:origin-left transition-transform duration-500 ${!isDarkMode && !isLargeScreen ? 'bg-gray-900/90' : 'bg-white/5'}`}>
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-red-700/20 rounded-full blur-3xl group-hover:bg-red-700/40 transition-all"></div>
                
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-6 tracking-tighter uppercase">
                  Automotive <br/><span className="text-red-700 uppercase">Business</span> Manager
                </h1>
                
                <div className="min-h-[3.5rem] sm:min-h-[4.5rem] overflow-hidden relative border-l-4 border-red-700 pl-4 bg-white/5 rounded-r-lg flex items-center">
                  <div className="transition-all duration-500 transform translate-y-0 flex flex-col w-full">
                    <p className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-red-100/80 uppercase tracking-[0.2em] py-2 leading-relaxed">
                      {RUNNING_TEXTS[currentTextIndex]}
                    </p>
                  </div>
                </div>

                <div className="mt-6 sm:mt-10 lg:mt-12 flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setViewMode('list')} className="w-full sm:w-auto bg-red-700 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-red-700/40 hover:bg-red-800 transition-all group/btn uppercase tracking-widest text-[10px] sm:text-xs">
                    View Inventory <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                  </button>
                  <button onClick={scrollToPriceCalculator} className="w-full sm:w-auto bg-white/10 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-black border border-white/10 hover:bg-white/20 transition-all uppercase tracking-widest text-[10px] sm:text-xs">
                    Pricing Desk
                  </button>
                </div>
              </div>
            </div>

          </section>

          {/* Core Services Section */}
          <section className="px-[50px] md:px-20 pt-64 md:pt-80 lg:pt-32 pb-16 bg-[#0a0a0b] relative">
            <div className="mb-12 md:mb-24 flex flex-col items-center text-center">
              <p className="text-red-600 font-black uppercase tracking-[0.5em] text-[9px] md:text-[10px] mb-4">Enterprise Edition</p>
              <h2 className="text-3xl md:text-6xl font-black mb-6 uppercase tracking-tighter">Premium <span className="text-red-700">Workspace</span></h2>
              <div className="h-1.5 md:h-2 w-24 md:w-32 bg-red-700 rounded-full shadow-lg shadow-red-700/40"></div>
            </div>

            {/* Document Creation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-[50px] md:gap-10 max-w-[1800px] mx-auto mb-16">
              {Object.entries(DOC_TYPES_CONFIG).map(([type, config]) => (
                <div 
                  key={type}
                  className="group relative bg-white rounded-[2.5rem] border border-gray-200/50 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_50px_100px_-20px_rgba(185,28,28,0.2)] hover:-translate-y-3 transition-all duration-700 overflow-hidden flex flex-col min-h-[280px] sm:min-h-[360px]"
                >
                  <div 
                    onClick={() => {
                      setViewMode('list');
                      setActiveType(type as DocumentType);
                    }}
                    className="p-6 sm:p-8 pb-4 sm:pb-6 flex-1 transition-all duration-700 group-hover:bg-[#8b0000] cursor-pointer flex flex-col"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center mb-8 sm:mb-10 transition-all duration-700 bg-red-50 text-red-700 border border-red-100 shadow-sm group-hover:bg-white group-hover:text-red-800 group-hover:rotate-6 group-hover:scale-110">
                      {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-6 h-6 sm:w-7 sm:h-7' })}
                    </div>
                    <h3 className="text-[1.1rem] sm:text-2xl font-black text-red-900 mb-3 sm:mb-4 uppercase tracking-tighter transition-all duration-700 group-hover:text-white group-hover:translate-x-1 whitespace-nowrap sm:whitespace-normal">{config.label}</h3>
                    <p className="text-xs sm:text-[13px] text-gray-500 font-bold leading-relaxed mb-6 group-hover:text-red-100 group-hover-text-red-100-always transition-colors duration-700">
                      {type === DocumentType.INVOICE && "Professional vehicle sales records and automatic tracking."}
                      {type === DocumentType.QUOTATION && "Standard official quotes for individual or bank use."}
                      {type === DocumentType.BILL && "Record supplier transactions and operational costs."}
                      {type === DocumentType.CHALLAN && "Manage precise vehicle handover and item checks."}
                      {type === DocumentType.PRO_INVOICE && "High-impact visual documents for premium clients."}
                    </p>
                    <div className="mt-auto opacity-80 group-hover:opacity-100 transition-all duration-700 text-red-700 group-hover:text-white/80 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      View History <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div 
                    onClick={() => {
                      if (type === DocumentType.PRO_INVOICE) {
                        setShowProGenerator(true);
                      } else {
                        setEditingDoc({ type: type as DocumentType });
                      }
                    }}
                    className="mt-auto border-t border-gray-50 p-8 flex justify-between items-center bg-[#9d1414] border-transparent transition-all duration-700 cursor-pointer hover:!bg-[#b91c1c] group/bottom"
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white text-white-always group-hover:translate-x-2 transition-all duration-700">NEW DOCUMENT</span>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#9d1414] shadow-sm transition-all duration-700 transform group-hover:rotate-[360deg] group-hover:scale-110">
                      <Plus className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* HIGH-TECH BRIDGE STRIP */}
            <div className="max-w-[1800px] mx-auto px-4 md:px-10 mb-8 relative">
               <div className="h-px w-full bg-gradient-to-r from-transparent via-red-900/50 to-transparent mb-12"></div>
               <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-10 px-6 md:px-10 py-8 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-900/10 via-transparent to-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                  
                  <div className="flex items-center gap-4 md:gap-6 relative z-10 w-full lg:w-auto">
                    <div className="w-12 h-12 rounded-xl bg-red-700/10 border border-red-700/20 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-red-700 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">System Throughput</p>
                      <p className="text-xs sm:text-sm font-bold text-white uppercase tracking-tighter">Real-time Performance Metrics</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-center lg:justify-start gap-4 sm:gap-6 md:gap-12 relative z-10 w-full lg:w-auto">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isHostingerConfigured ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        {isHostingerConfigured ? 'Hostinger Connected' : 'Hostinger Not Connected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isHostingerConfigured ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-zinc-600'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        {isHostingerConfigured ? 'Cloud Sync Active' : 'Local Storage Mode'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4">
                      <Globe className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 leading-tight">
                        {isHostingerConfigured ? 'Hostinger Database' : 'Preview: Browser Storage Only'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-start lg:justify-end w-full lg:w-auto relative z-10 pt-6 sm:pt-0 border-t border-white/5 sm:border-t-0 mt-2 sm:mt-0">
                    <div className="text-left lg:text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Processor Load</p>
                      <p className="text-xs font-bold text-red-500">0.02ms latency</p>
                    </div>
                    <div className="hidden sm:block h-10 w-px bg-white/10 mx-4"></div>
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-red-700 transition-colors shrink-0">
                      <Cpu className="w-5 h-5" />
                    </div>
                  </div>
               </div>
            </div>

            {/* Price a car without leaving the home page — the Pricing Desk's calculator */}
            <div id="home-price-calculator" className="max-w-[1800px] mx-auto mt-16 md:mt-24 mb-24 md:mb-32 scroll-mt-28">
              <HomePriceCalculator onOpenDesk={openPriceDesk} />
            </div>

            {/* Business Intelligence Section with Background Image & Glassmorphism */}
            <div className="relative -mx-6 md:-mx-20 py-24 overflow-hidden">
              {/* Parallax-style Background Image */}
              <div 
                className="absolute inset-0 z-0 opacity-50 bg-fixed pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(to bottom, #0a0a0b 0%, rgba(10,10,11,0.4) 50%, #0a0a0b 100%), url(${STATS_BG})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
              
              <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,transparent_50%,#fff_50%)] bg-[length:100%_4px] animate-[scanline_10s_linear_infinite]"></div>

              <div className="max-w-[1800px] mx-auto px-6 md:px-20 relative z-10">
                <div className="flex flex-col gap-8">
                  
                  {/* CENTERED HEADER */}
                  <div className="flex flex-col items-center text-center mb-6 relative group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[100px] bg-red-700/5 blur-[100px] pointer-events-none group-hover:bg-red-700/10 transition-all duration-1000"></div>
                    
                  <div className="bg-white/[0.03] border border-white/10 px-6 md:px-16 py-4 md:py-6 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden transition-all duration-700 group-hover:bg-white/[0.05] group-hover:border-red-700/20 group-hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none"></div>
                    
                    <h3 className="text-2xl md:text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                      Business <span className="text-red-600">Intelligence</span>
                    </h3>
                    <p className="text-gray-400 text-[9px] md:text-[12px] font-black uppercase tracking-[0.3em] md:tracking-[0.6em] mt-3 md:mt-4 opacity-70 group-hover:opacity-100 group-hover:text-red-100 transition-all duration-700">
                      Advanced Real-time Analytics Dashboard
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-3 sm:gap-4 bg-black/40 px-4 sm:px-6 md:px-8 py-3 rounded-full border border-white/5 backdrop-blur-3xl shadow-lg group/status hover:border-red-700/30 transition-all max-w-full">
                     <Activity className="w-4 h-4 md:w-5 md:h-5 text-red-700 animate-pulse shrink-0" />
                     <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black text-red-600 uppercase tracking-wider md:tracking-widest group-hover/status:text-white transition-colors whitespace-nowrap overflow-hidden text-ellipsis">System Engine Status: 100% Optimal</span>
                  </div>
                </div>

                {/* Main Hero Stats - Non-Italic Numbers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                  <div className="bg-black/60 border border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-[50px] relative overflow-hidden group hover:bg-black/80 hover:border-red-700/40 transition-all duration-700 shadow-[0_50px_100px_-20_rgba(0,0,0,0.5)]">
                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-20 transition-all duration-700 scale-150 rotate-12">
                      <Database className="w-48 md:w-64 h-48 md:h-64 text-red-700" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="h-2 w-2 rounded-full bg-red-700 animate-ping shrink-0"></div>
                         <p className="text-red-700 text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest sm:tracking-[0.4em] md:tracking-[0.5em]">Inventory Audit</p>
                      </div>
                      <h4 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-700">
                        {totalRecords.toString().padStart(2, '0')}<span className="text-xl sm:text-2xl md:text-3xl text-gray-400 ml-3 md:ml-5 font-bold tracking-normal opacity-80">Total Files</span>
                        {draftCount > 0 && (
                          <span className="ml-3 align-middle inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] md:text-xs font-black uppercase tracking-widest text-amber-500">
                            + {draftCount} draft{draftCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </h4>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-gradient-to-r from-red-900 to-red-600 animate-pulse" style={{width: '75%'}}></div>
                      </div>
                      <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-relaxed">Verified documents in active repository</p>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-[50px] relative overflow-hidden group hover:bg-black/80 hover:border-red-700/40 transition-all duration-700 shadow-[0_50px_100px_-20_rgba(0,0,0,0.8)]">
                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-20 transition-all duration-700 scale-150 -rotate-12">
                      <CircleDollarSign className="w-48 md:w-64 h-48 md:h-64 text-red-700" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="h-2 w-2 rounded-full bg-red-700 animate-ping shrink-0"></div>
                         <p className="text-red-700 text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest sm:tracking-[0.4em] md:tracking-[0.5em]">Liquidity Value</p>
                      </div>
                      <div className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-700 flex items-baseline gap-2 md:gap-4 overflow-hidden">
                        <span className="text-2xl sm:text-3xl md:text-5xl text-red-700">৳</span>{totalAssetValue.toLocaleString()}
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-gradient-to-r from-red-900 to-red-600 animate-pulse" style={{width: '90%'}}></div>
                      </div>
                      <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-relaxed">Gross financial tracking of registered assets</p>
                    </div>
                  </div>
                </div>

                  {/* Categorical Breakdown Grid - Non-Italic Numbers */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mt-4">
                    {Object.entries(DOC_TYPES_CONFIG).map(([type, config]) => {
                      const count = getCountByType(type as DocumentType);
                      return (
                        <div key={type} className="bg-black/50 border border-white/10 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] backdrop-blur-3xl hover:bg-red-950/40 hover:border-red-700/60 transition-all duration-700 group relative overflow-hidden shadow-2xl">
                          <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-20 transition-all duration-700">
                            {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-20 h-20' })}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                             <div className="p-2 sm:p-2.5 bg-red-700/10 rounded-xl text-red-700 group-hover:bg-red-700 group-hover:text-white transition-all duration-500 shrink-0">
                               {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-3 h-3 sm:w-4 sm:h-4' })}
                             </div>
                             <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-gray-500 group-hover:text-white transition-colors break-words leading-tight">{config.label}</span>
                          </div>
                          <div className="text-3xl sm:text-4xl font-black tracking-tighter group-hover:scale-110 transition-transform origin-left text-white">
                            {count.toString().padStart(2, '0')}
                          </div>
                          <p className="text-[8px] font-black text-gray-400 uppercase mt-3 tracking-[0.3em] group-hover:text-red-500 transition-colors">Records Audit</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="px-6 md:px-20 py-16 md:py-24 border-t border-white/5 bg-[#0a0a0b] flex flex-col items-center">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-red-700 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-red-700/20 text-white text-white-always">GD</div>
              <span className="text-2xl font-black tracking-tighter text-center md:text-left">Garir Dokan <span className="text-red-700 uppercase">Pro</span></span>
            </div>
            <p className="text-gray-400 text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-center max-w-2xl leading-loose">
              Advanced Document Infrastructure for Automotive Trading • Importers • Dealers
            </p>
            <div className="mt-16 text-gray-400 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-center">© 2026 GARIR DOKAN PRO • ALL RIGHTS RESERVED</div>
          </footer>
        </div>
      )}

      {viewMode === 'assets' && (
        <div className="pt-24 md:pt-32 px-4 md:px-10 min-h-screen pb-20">
          <AssetLibrary />
        </div>
      )}

      {viewMode === 'pricing' && (
        <div className="animate-in fade-in duration-500">
          <ErrorBoundary area="Pricing Desk" onReset={() => setViewMode('landing')}>
            <PricingDesk />
          </ErrorBoundary>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="pt-24 md:pt-32 px-4 md:px-10 min-h-screen flex flex-col pb-20">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-10">
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-2">
                 <button onClick={() => {setViewMode('landing'); setActiveType(null);}} className="text-gray-400 hover:text-red-500 transition-colors uppercase text-[10px] font-black tracking-widest">Dashboard</button>
                 <ChevronRight className="w-3 h-3 text-gray-700" />
                 <span className="text-red-700 uppercase text-[10px] font-black tracking-widest">Record Archive</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
               <div className="relative w-full md:w-96 group">
                 <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-red-700 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Search ID, client, vehicle, chassis or date..." 
                   className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-red-700/50 focus:bg-white/10 outline-none transition-all placeholder:text-gray-500"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
               <button 
                 onClick={() => {
                   if (activeType === DocumentType.PRO_INVOICE) {
                     setShowProGenerator(true);
                   } else {
                     setEditingDoc({ type: activeType || DocumentType.INVOICE });
                   }
                 }}
                 className="w-full sm:w-auto bg-red-700 text-white px-10 py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-red-800 transition-all active:scale-95 shadow-2xl shadow-red-700/20 uppercase tracking-widest text-xs"
               >
                 <Plus className="w-6 h-6" /> Create New
               </button>
            </div>
          </header>

          {/* Records Navigation Tabs */}
          <div className="mb-10 flex flex-wrap items-center gap-2 md:gap-4 bg-white/5 p-2 md:p-3 rounded-2xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl animate-in slide-in-from-top-4 duration-500">
             <button 
               onClick={() => { setActiveType(null); setShowDraftsOnly(false); }}
               className={`px-4 md:px-8 py-2 md:py-3.5 rounded-full font-black text-[9px] md:text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 ${activeType === null ? 'bg-red-700 text-white shadow-lg shadow-red-700/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
             >
               <LayoutDashboard className="w-4 h-4" />
               <span className="hidden sm:inline">All Records</span>
               <span className="sm:hidden">All</span>
               <span className={`px-2 py-0.5 rounded-md text-[9px] ${activeType === null ? 'bg-white/20' : 'bg-white/10'}`}>{documents.length}</span>
             </button>
             
             <div className="hidden md:block h-6 w-px bg-white/10 mx-2"></div>

             {Object.entries(DOC_TYPES_CONFIG).map(([type, config]) => {
               const count = getCountByType(type as DocumentType);
               const isActive = activeType === type;
               return (
                 <button 
                   key={type}
                   onClick={() => setActiveType(type as DocumentType)}
                   className={`px-4 md:px-6 py-2 md:py-3.5 rounded-full font-black text-[9px] md:text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 ${isActive ? 'bg-red-700 text-white shadow-lg shadow-red-700/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                 >
                   {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                   <span className="hidden lg:inline">{config.label}</span>
                   <span className={`px-2 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/20' : 'bg-white/10'}`}>{count}</span>
                 </button>
               );
             })}

             {(draftCount > 0 || showDraftsOnly) && (
               <button
                 onClick={() => setShowDraftsOnly(v => !v)}
                 className={`px-4 md:px-6 py-2 md:py-3.5 rounded-full font-black text-[9px] md:text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 border ${
                   showDraftsOnly ? 'bg-amber-500/15 border-amber-500/50 text-amber-500' : 'border-amber-500/20 text-gray-400 hover:text-white hover:bg-white/5'}`}
               >
                 <FilePen className="w-4 h-4 text-amber-500" />
                 <span>Drafts</span>
                 <span className="px-2 py-0.5 rounded-md text-[9px] bg-white/10">{draftCount}</span>
               </button>
             )}
          </div>

          <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl md:rounded-[3.5rem] overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-700">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px] lg:min-w-0">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                    <th className="px-6 md:px-12 py-6 md:py-8">Category</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Document / ID</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Recipient</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Chassis No</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Valuation</th>
                    <th className="px-6 md:px-12 py-6 md:py-8 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/5 transition-all group/row">
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl transition-all group-hover/row:scale-110 ${DOC_TYPES_CONFIG[doc.type].bgColor} ${DOC_TYPES_CONFIG[doc.type].color}`}>
                            {DOC_TYPES_CONFIG[doc.type].icon}
                          </div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:block">{DOC_TYPES_CONFIG[doc.type].label}</p>
                        </div>
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        <p className="text-sm md:text-base font-black text-white group-hover/row:text-red-700 transition-colors">
                          <span className="whitespace-nowrap">{doc.docNumber}</span>
                          {doc.status === 'draft' && (
                            <span className="ml-2 inline-block align-middle rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-500">Draft</span>
                          )}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Ref No: {doc.id.slice(0,6)}</p>
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        <p className="text-xs md:text-sm font-bold text-gray-200 uppercase tracking-tight">{doc.clientName}</p>
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        {doc.chassisNumber
                          ? <p className="text-xs md:text-sm font-bold text-gray-200 uppercase tracking-tight font-mono">{doc.chassisNumber}</p>
                          : <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">—</p>}
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        <p className="text-sm md:text-base font-black text-white">৳{doc.vehiclePrice.toLocaleString()}</p>
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7 text-right flex justify-end gap-2 md:gap-3">
                        <button onClick={() => setPreviewingDoc(doc)} className="p-3 md:p-4 text-red-600 bg-red-700/10 rounded-xl md:rounded-2xl hover:bg-red-700 hover:text-white transition-all shadow-sm"><Eye className="w-4 h-4 md:w-5 md:h-5" /></button>
                        <button onClick={() => setEditingDoc(doc)} className="p-3 md:p-4 text-blue-500 bg-blue-500/10 rounded-xl md:rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"><Edit className="w-4 h-4 md:w-5 md:h-5" /></button>
                        <button onClick={() => handleDelete(doc.id)} className="p-3 md:p-4 text-gray-500 bg-white/5 rounded-xl md:rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredDocs.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="px-8 py-32 text-center text-gray-700 font-black text-lg uppercase tracking-[0.5em] opacity-30 italic">No records found in database</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editingDoc && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-0">
          <div className="bg-[#0a0a0b] w-full h-full border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-500">
          <SaveWarning />
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            <div 
              style={isLargeScreen && editingDoc.type !== DocumentType.PRO_INVOICE ? { width: `${editorWidth}%`, flex: 'none' } : { flex: 1 }} 
              className={`overflow-hidden ${!isLargeScreen && mobilePreviewMode && editingDoc.type !== DocumentType.PRO_INVOICE ? 'hidden' : 'flex flex-col'}`}
            >
              {editingDoc.type === DocumentType.PRO_INVOICE ? (
                <ProInvoiceGenerator 
                  initialData={editingDoc}
                  onSave={handleSave} 
                  onCancel={() => discardEditor(() => setEditingDoc(null))}
                  onChange={setDraftDoc}
                  footerSettings={globalFooter}
                  headerSettings={globalHeaders?.[editingDoc.type as DocumentType]}
                />
              ) : (
                <DocumentForm 
                  initialData={editingDoc} 
                  onSave={handleSave} 
                  onCancel={() => discardEditor(() => { setEditingDoc(null); setMobilePreviewMode(false); })}
                  onChange={setDraftDoc}
                  headerSettings={globalHeaders?.[editingDoc.type as DocumentType]}
                  showPreviewToggle={true}
                  onTogglePreview={() => setMobilePreviewMode(!mobilePreviewMode)}
                />
              )}
            </div>

            {isLargeScreen && editingDoc.type !== DocumentType.PRO_INVOICE && (
              <div 
                className="w-1.5 hover:w-2 bg-white/5 hover:bg-red-700/50 cursor-col-resize transition-all duration-150 shrink-0 select-none relative self-stretch"
                onMouseDown={handleMouseDown}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white/10 hover:bg-white/30 rounded-full my-auto h-24 top-1/2 -translate-y-1/2"></div>
              </div>
            )}

            {editingDoc.type !== DocumentType.PRO_INVOICE && (
              <div 
                ref={previewContainerRef}
                style={isLargeScreen ? { width: `${100 - editorWidth}%`, flex: 'none' } : {}}
                className={`${isLargeScreen ? 'flex' : (mobilePreviewMode ? 'flex flex-1 w-full' : 'hidden')} bg-black/50 p-4 lg:p-12 overflow-y-auto flex-col items-center scrollbar-hide border-l border-white/10 relative`}
              >
                {!isLargeScreen && mobilePreviewMode && (
                  <div className="w-full flex justify-end mb-4">
                    <button 
                      onClick={() => setMobilePreviewMode(false)}
                      className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all shadow-lg flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" /> Back to Edit
                    </button>
                  </div>
                )}
                <div className="mb-6 md:mb-8 w-full flex flex-wrap justify-between items-center gap-4 text-white/60">
                  <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-[200px]">
                     <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-red-700 animate-pulse shrink-0"></div>
                     <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] line-clamp-2 leading-tight">Live Rendering Engine</span>
                     <span className="px-2 py-0.5 text-[8px] md:text-[9px] font-bold bg-white/10 rounded text-white font-mono shrink-0">
                       Zoom: {Math.round(previewZoom * 100)}%
                     </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="hidden md:inline text-gray-500 text-[10px] shrink-0">Ctrl + Scroll to Zoom</span>
                    <div className="flex items-center gap-1 bg-red-700/10 p-1 rounded-lg border border-red-700/20">
                      <button 
                        onClick={() => setPreviewZoom(p => { const v = Math.max(0.25, p - 0.1); localStorage.setItem('gd_preview_zoom', v.toFixed(3)); return v; })} 
                        className="w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-700 hover:text-white rounded transition-all"
                        title="Zoom Out"
                      >
                        <Minus size={12} />
                      </button>
                      <button 
                        onClick={() => { setPreviewZoom(0.65); localStorage.setItem('gd_preview_zoom', '0.65'); }} 
                        className="px-2 h-6 text-red-500 hover:bg-red-700 hover:text-white rounded transition-all font-mono text-[10px] font-bold"
                        title="Reset Zoom"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => setPreviewZoom(p => { const v = Math.min(2.5, p + 0.1); localStorage.setItem('gd_preview_zoom', v.toFixed(3)); return v; })} 
                        className="w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-700 hover:text-white rounded transition-all"
                        title="Zoom In"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="transition-transform duration-300 ease-out origin-top">
                  {draftDoc && (
                    <DocumentPreview 
                      document={draftDoc as BusinessDocument} 
                      containerRef={previewRef} 
                      scale={previewZoom} 
                      footerSettings={globalFooter} 
                      headerSettings={globalHeaders?.[draftDoc.type as DocumentType]} 
                    />
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {showProGenerator && (
        <ProInvoiceGenerator 
          onSave={handleSave} 
          onCancel={() => discardEditor(() => setShowProGenerator(false))}
          onChange={setDraftDoc}
          footerSettings={globalFooter}
          headerSettings={globalHeaders?.[DocumentType.PRO_INVOICE]}
        />
      )}

      {previewingDoc && (
        <div className="fixed inset-0 z-[60] bg-black/98 backdrop-blur-3xl flex flex-col items-center animate-in fade-in duration-500 overflow-hidden print-modal-container">
          <div className="w-full bg-black/60 p-4 md:p-8 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-2xl px-6 md:px-16 border-b border-white/5 backdrop-blur-md shrink-0 print:hidden no-print">
            <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
               <button onClick={() => setPreviewingDoc(null)} className="p-3 md:p-4 hover:bg-white/10 rounded-full md:rounded-[2rem] transition-all group shrink-0"><X className="w-6 h-6 md:w-8 md:h-8 text-gray-500 group-hover:text-white" /></button>
               <div className="truncate flex-1">
                 <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tighter mb-1 leading-none truncate">{previewingDoc.docNumber}</h2>
                 <p className="text-[9px] md:text-[11px] font-black text-red-700 uppercase tracking-[0.2em] truncate">{previewingDoc.clientName}</p>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 w-full lg:w-auto">
              <button 
                onClick={() => window.print()}
                className="w-full sm:w-auto bg-red-700 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black flex items-center justify-center gap-3 md:gap-4 hover:bg-red-800 transition-all active:scale-95 shadow-2xl shadow-red-700/40 uppercase tracking-widest text-[10px] md:text-xs border border-red-600/50 print:hidden no-print"
              >
                <Download className="w-5 h-5 md:w-6 md:h-6" /> Print / Save PDF
              </button>
            </div>
          </div>

          <div className="flex-1 w-full overflow-auto p-4 md:p-12 flex justify-center bg-[radial-gradient(circle_at_center,rgba(185,28,28,0.05),transparent_70%)] scrollbar-hide print-scroll-container">
            <div className="origin-top transition-transform duration-500 ease-out scale-[0.4] sm:scale-[0.6] md:scale-[0.75] lg:scale-[0.85] xl:scale-100 print-scale-reset">
              <DocumentPreview 
                document={previewingDoc} 
                containerRef={previewRef} 
                footerSettings={globalFooter} 
                headerSettings={globalHeaders?.[previewingDoc.type as DocumentType]} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
