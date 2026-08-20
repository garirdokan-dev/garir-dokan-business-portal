
import React, { useState, useEffect, useRef } from 'react';
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
  LogOut
} from 'lucide-react';
import { BusinessDocument, DocumentType, FooterSettings, HeaderSettings, HeroSettings } from './types.ts';
import { DOC_TYPES_CONFIG } from './constants.tsx';
import { addOrUpdateDocument, loadDocuments, deleteDocument, loadFooterSettings, loadAllHeaderSettings, loadHeroSettings } from './utils/storage.ts';
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('gd_auth') === 'true';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('gd_auth');
    setIsAuthenticated(false);
  };

  const [currentBanner, setCurrentBanner] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState<Partial<BusinessDocument> | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<BusinessDocument | null>(null);
  const [draftDoc, setDraftDoc] = useState<Partial<BusinessDocument> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'landing' | 'list' | 'assets'>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [showProGenerator, setShowProGenerator] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
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

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
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
    const initData = async () => {
      setIsLoading(true);
      try {
        const docs = await loadDocuments();
        setDocuments(docs || []);
        await fetchFooter();
        await fetchHeader();
        await fetchHero();
      } catch (err) {
        console.error("Initialization failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    initData();
  }, []);

  useEffect(() => {
    const bannerInterval = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % heroSettings.selectedImages.length);
    }, heroSettings.interval);

    return () => clearInterval(bannerInterval);
  }, [heroSettings.selectedImages.length, heroSettings.interval]);

  useEffect(() => {
    const textInterval = setInterval(() => {
      setCurrentTextIndex(prev => (prev + 1) % RUNNING_TEXTS.length);
    }, 3000);

    return () => clearInterval(textInterval);
  }, []);

  const handleSave = async (doc: BusinessDocument) => {
    setIsLoading(true);
    const updated = await addOrUpdateDocument(doc);
    setDocuments(updated);
    setEditingDoc(null);
    setDraftDoc(null);
    setShowProGenerator(false);
    setShowSaveToast(true);
    setIsLoading(false);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      setIsLoading(true);
      const updated = await deleteDocument(id);
      setDocuments(updated);
      setIsLoading(false);
    }
  };



  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.docNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeType ? doc.type === activeType : true;
    return matchesSearch && matchesType;
  }).sort((a, b) => b.createdAt - a.createdAt);

  const totalRecords = documents.length;
  const totalAssetValue = documents.reduce((sum, doc) => sum + (doc.vehiclePrice || 0), 0);
  
  const getCountByType = (type: DocumentType) => documents.filter(doc => doc.type === type).length;

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans selection:bg-red-700 selection:text-white">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-red-700 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Syncing with Cloud</span>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-2xl shadow-green-900/40 animate-in slide-in-from-top-10">
          <CheckCircle2 className="w-6 h-6" />
          <span className="uppercase tracking-widest text-xs">Document Secured Successfully</span>
        </div>
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-10 py-3 md:py-6 flex justify-between items-center backdrop-blur-md bg-black/20 border-b border-white/5 print:hidden no-print">
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => {setViewMode('landing'); setActiveType(null); setIsSidebarOpen(false);}}>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-700 rounded-lg md:rounded-xl flex items-center justify-center font-black text-base md:text-xl shadow-lg shadow-red-700/30">GD</div>
          <span className="text-base md:text-xl font-black tracking-tighter">Garir Dokan <span className="text-red-700 uppercase">Pro</span></span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          <button onClick={() => {setViewMode('landing'); setActiveType(null);}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'landing' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Home</button>
          <button onClick={() => {setViewMode('assets');}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'assets' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Asset Library</button>
          <button onClick={() => {setViewMode('list'); setActiveType(null);}} className={`text-sm font-bold uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'text-red-600' : 'text-gray-400 hover:text-white'}`}>Records</button>
          <div className="h-4 w-px bg-white/10"></div>
          <button 
            onClick={() => setShowGlobalSettings(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Global Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('landing')} className="bg-red-700 px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-red-700/20 hover:bg-red-800 transition-all active:scale-95">Dashboard</button>
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
          <div className="h-px bg-white/5 w-full"></div>
          <button 
            onClick={() => {setShowGlobalSettings(true); setIsSidebarOpen(false);}} 
            className="flex items-center gap-4 text-sm font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" /> Global Settings
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
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0b] to-transparent"></div>
            </div>

            <div className="absolute left-0 right-0 md:left-[3%] top-[98%] lg:top-[60%] -translate-y-1/2 z-10 px-4 md:px-0">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] w-full md:w-[580px] shadow-2xl relative overflow-hidden group scale-[0.85] lg:scale-100 origin-center md:origin-left transition-transform duration-500">
                <div className="absolute -top-20 -left-20 w-40 h-40 bg-red-700/20 rounded-full blur-3xl group-hover:bg-red-700/40 transition-all"></div>
                
                <h1 className="text-3xl md:text-6xl font-black leading-[1.1] mb-6 tracking-tighter uppercase">
                  Automotive <br/><span className="text-red-700 uppercase">Business</span> Manager
                </h1>
                
                <div className="min-h-[3rem] md:min-h-[3.5rem] overflow-hidden relative border-l-4 border-red-700 pl-4 bg-white/5 rounded-r-lg flex items-center">
                  <div className="transition-all duration-500 transform translate-y-0 flex flex-col w-full">
                    <p className="text-[9px] md:text-[11px] font-bold text-red-100/80 uppercase tracking-[0.2em] py-2 leading-relaxed">
                      {RUNNING_TEXTS[currentTextIndex]}
                    </p>
                  </div>
                </div>

                <div className="mt-6 md:mt-12 flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setViewMode('list')} className="w-full sm:w-auto bg-red-700 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-red-700/40 hover:bg-red-800 transition-all group/btn uppercase tracking-widest text-[10px] md:text-xs">
                    View Inventory <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                  </button>
                  <button className="w-full sm:w-auto bg-white/10 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black border border-white/10 hover:bg-white/20 transition-all uppercase tracking-widest text-[10px] md:text-xs">
                    User Guide
                  </button>
                </div>
              </div>
            </div>

          </section>

          {/* Core Services Section */}
          <section className="px-4 md:px-20 pt-64 md:pt-80 lg:pt-32 pb-16 bg-[#0a0a0b] relative">
            <div className="mb-12 md:mb-24 flex flex-col items-center text-center">
              <p className="text-red-600 font-black uppercase tracking-[0.5em] text-[9px] md:text-[10px] mb-4">Enterprise Edition</p>
              <h2 className="text-3xl md:text-6xl font-black mb-6 uppercase tracking-tighter">Premium <span className="text-red-700">Workspace</span></h2>
              <div className="h-1.5 md:h-2 w-24 md:w-32 bg-red-700 rounded-full shadow-lg shadow-red-700/40"></div>
            </div>

            {/* Document Creation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 md:gap-10 max-w-[1800px] mx-auto mb-16">
              {Object.entries(DOC_TYPES_CONFIG).map(([type, config]) => (
                <div 
                  key={type}
                  className="group relative bg-white rounded-[2.5rem] border border-gray-200/50 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_50px_100px_-20px_rgba(185,28,28,0.2)] hover:-translate-y-3 transition-all duration-700 overflow-hidden flex flex-col min-h-[360px]"
                >
                  <div 
                    onClick={() => {
                      setViewMode('list');
                      setActiveType(type as DocumentType);
                    }}
                    className="p-8 pb-6 flex-1 transition-all duration-700 group-hover:bg-[#8b0000] cursor-pointer flex flex-col"
                  >
                    <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-10 transition-all duration-700 bg-red-50 text-red-700 border border-red-100 shadow-sm group-hover:bg-white group-hover:text-red-800 group-hover:rotate-6 group-hover:scale-110">
                      {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-7 h-7' })}
                    </div>
                    <h3 className="text-2xl font-black text-red-900 mb-4 uppercase tracking-tighter transition-all duration-700 group-hover:text-white group-hover:translate-x-1">{config.label}</h3>
                    <p className="text-[13px] text-gray-500 font-bold leading-relaxed mb-6 group-hover:text-red-100 transition-colors duration-700">
                      {type === DocumentType.INVOICE && "Professional vehicle sales records and automatic tracking."}
                      {type === DocumentType.QUOTATION && "Standard official quotes for individual or bank use."}
                      {type === DocumentType.BILL && "Record supplier transactions and operational costs."}
                      {type === DocumentType.CHALLAN && "Manage precise vehicle handover and item checks."}
                      {type === DocumentType.PRO_INVOICE && "High-impact visual documents for premium clients."}
                    </p>
                    <div className="mt-auto opacity-40 group-hover:opacity-100 transition-all duration-700 text-red-700 group-hover:text-white/80 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
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
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white group-hover:translate-x-2 transition-all duration-700">NEW DOCUMENT</span>
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
               <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-10 px-6 md:px-10 py-8 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-900/10 via-transparent to-red-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                  
                  <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
                    <div className="w-12 h-12 rounded-xl bg-red-700/10 border border-red-700/20 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-red-700 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">System Throughput</p>
                      <p className="text-sm font-bold text-white uppercase tracking-tighter">Real-time Performance Metrics</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 md:gap-12 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Database Ready</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Cloud Sync Active</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Globe className="w-4 h-4 text-gray-600" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Global Region: AP-South</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto justify-center lg:justify-end">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Processor Load</p>
                      <p className="text-xs font-bold text-red-700">0.02ms latency</p>
                    </div>
                    <div className="h-10 w-px bg-white/10 mx-2"></div>
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-red-700 transition-colors">
                      <Cpu className="w-5 h-5" />
                    </div>
                  </div>
               </div>
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
                      Business <span className="text-red-700">Intelligence</span>
                    </h3>
                    <p className="text-gray-400 text-[9px] md:text-[12px] font-black uppercase tracking-[0.3em] md:tracking-[0.6em] mt-3 md:mt-4 opacity-70 group-hover:opacity-100 group-hover:text-red-100 transition-all duration-700">
                      Advanced Real-time Analytics Dashboard
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-4 bg-black/40 px-6 md:px-8 py-3 rounded-full border border-white/5 backdrop-blur-3xl shadow-lg group/status hover:border-red-700/30 transition-all">
                     <Activity className="w-4 h-4 md:w-5 md:h-5 text-red-700 animate-pulse" />
                     <span className="text-[9px] md:text-[10px] font-black text-red-600 uppercase tracking-widest group-hover/status:text-white transition-colors">System Engine Status: 100% Optimal</span>
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
                         <div className="h-2 w-2 rounded-full bg-red-700 animate-ping"></div>
                         <p className="text-red-700 text-[10px] md:text-[11px] font-black uppercase tracking-[0.5em]">Inventory Audit</p>
                      </div>
                      <h4 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-700">
                        {totalRecords.toString().padStart(2, '0')}<span className="text-2xl md:text-3xl text-gray-500 ml-3 md:ml-5 font-bold tracking-normal opacity-50">Total Files</span>
                      </h4>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-gradient-to-r from-red-900 to-red-600 animate-pulse" style={{width: '75%'}}></div>
                      </div>
                      <p className="text-gray-600 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-relaxed">Verified documents in active repository</p>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-[50px] relative overflow-hidden group hover:bg-black/80 hover:border-red-700/40 transition-all duration-700 shadow-[0_50px_100px_-20_rgba(0,0,0,0.8)]">
                    <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-20 transition-all duration-700 scale-150 -rotate-12">
                      <CircleDollarSign className="w-48 md:w-64 h-48 md:h-64 text-red-700" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="h-2 w-2 rounded-full bg-red-700 animate-ping"></div>
                         <p className="text-red-700 text-[10px] md:text-[11px] font-black uppercase tracking-[0.5em]">Liquidity Value</p>
                      </div>
                      <div className="text-5xl md:text-8xl font-black tracking-tighter mb-6 group-hover:translate-x-2 transition-transform duration-700 flex items-baseline gap-2 md:gap-4">
                        <span className="text-3xl md:text-5xl text-red-700">৳</span>{totalAssetValue.toLocaleString()}
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-gradient-to-r from-red-900 to-red-600 animate-pulse" style={{width: '90%'}}></div>
                      </div>
                      <p className="text-gray-600 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-relaxed">Gross financial tracking of registered assets</p>
                    </div>
                  </div>
                </div>

                  {/* Categorical Breakdown Grid - Non-Italic Numbers */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-4">
                    {Object.entries(DOC_TYPES_CONFIG).map(([type, config]) => {
                      const count = getCountByType(type as DocumentType);
                      return (
                        <div key={type} className="bg-black/50 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-3xl hover:bg-red-950/40 hover:border-red-700/60 transition-all duration-700 group relative overflow-hidden shadow-2xl">
                          <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-20 transition-all duration-700">
                            {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-20 h-20' })}
                          </div>
                          <div className="flex items-center gap-4 mb-4">
                             <div className="p-2.5 bg-red-700/10 rounded-xl text-red-700 group-hover:bg-red-700 group-hover:text-white transition-all duration-500">
                               {React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                             </div>
                             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 group-hover:text-white transition-colors">{config.label}</span>
                          </div>
                          <div className="text-4xl font-black tracking-tighter group-hover:scale-110 transition-transform origin-left text-white">
                            {count.toString().padStart(2, '0')}
                          </div>
                          <p className="text-[8px] font-black text-gray-700 uppercase mt-3 tracking-[0.3em] group-hover:text-red-700 transition-colors">Records Audit</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="px-6 md:px-20 py-16 md:py-24 border-t border-white/5 bg-[#080809] flex flex-col items-center">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-red-700 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-red-700/20">GD</div>
              <span className="text-2xl font-black tracking-tighter text-center md:text-left">Garir Dokan <span className="text-red-700 uppercase">Pro</span></span>
            </div>
            <p className="text-gray-600 text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-center max-w-2xl leading-loose">
              Advanced Document Infrastructure for Automotive Trading • Importers • Dealers
            </p>
            <div className="mt-16 text-gray-800 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-center">© 2026 GARIR DOKAN PRO • ALL RIGHTS RESERVED</div>
          </footer>
        </div>
      )}

      {viewMode === 'assets' && (
        <div className="pt-24 md:pt-32 px-4 md:px-10 min-h-screen pb-20">
          <AssetLibrary />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="pt-24 md:pt-32 px-4 md:px-10 min-h-screen flex flex-col pb-20">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 md:mb-10">
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-2">
                 <button onClick={() => {setViewMode('landing'); setActiveType(null);}} className="text-gray-600 hover:text-red-600 transition-colors uppercase text-[10px] font-black tracking-widest">Dashboard</button>
                 <ChevronRight className="w-3 h-3 text-gray-700" />
                 <span className="text-red-700 uppercase text-[10px] font-black tracking-widest">Record Archive</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
               <div className="relative w-full md:w-96 group">
                 <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-red-700 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Search ID, Client or Vehicle..." 
                   className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-red-700/50 focus:bg-white/10 outline-none transition-all placeholder:text-gray-600"
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
               onClick={() => setActiveType(null)}
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
          </div>

          <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl md:rounded-[3.5rem] overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-700">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px] lg:min-w-0">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">
                    <th className="px-6 md:px-12 py-6 md:py-8">Category</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Document / ID</th>
                    <th className="px-6 md:px-12 py-6 md:py-8">Recipient</th>
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
                        <p className="text-sm md:text-base font-black text-white group-hover/row:text-red-700 transition-colors">{doc.docNumber}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">Ref No: {doc.id.slice(0,6)}</p>
                      </td>
                      <td className="px-6 md:px-12 py-5 md:py-7">
                        <p className="text-xs md:text-sm font-bold text-gray-200 uppercase tracking-tight">{doc.clientName}</p>
                        <p className="text-[10px] text-gray-600 font-bold mt-1 max-w-[200px] truncate uppercase">{doc.vehicleTitle}</p>
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
                      <td colSpan={5} className="px-8 py-32 text-center text-gray-700 font-black text-lg uppercase tracking-[0.5em] opacity-30 italic">No records found in database</td>
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
          <div className="bg-[#0a0a0b] w-full h-full border-white/10 shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in zoom-in duration-500">
            <div 
              style={isLargeScreen && editingDoc.type !== DocumentType.PRO_INVOICE ? { width: `${editorWidth}%`, flex: 'none' } : { flex: 1 }} 
              className="overflow-hidden"
            >
              {editingDoc.type === DocumentType.PRO_INVOICE ? (
                <ProInvoiceGenerator 
                  initialData={editingDoc}
                  onSave={handleSave} 
                  onCancel={() => setEditingDoc(null)} 
                  footerSettings={globalFooter}
                  headerSettings={globalHeaders?.[editingDoc.type as DocumentType]}
                />
              ) : (
                <DocumentForm 
                  initialData={editingDoc} 
                  onSave={handleSave} 
                  onCancel={() => setEditingDoc(null)}
                  onChange={setDraftDoc}
                  headerSettings={globalHeaders?.[editingDoc.type as DocumentType]}
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
                className="hidden lg:flex bg-black/50 p-12 overflow-y-auto flex-col items-center scrollbar-hide border-l border-white/10"
              >
                <div className="mb-8 w-full flex justify-between items-center text-white/40">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Live Rendering Engine</span>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-white/10 rounded text-white font-mono">
                      Zoom: {Math.round(previewZoom * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-gray-500 text-[10px]">Ctrl + Scroll to Zoom</span>
                    <button 
                      onClick={() => setPreviewZoom(0.65)} 
                      className="px-2 py-0.5 bg-red-700/20 hover:bg-red-700 text-red-500 hover:text-white rounded border border-red-700/30 transition-all font-mono text-[10px]"
                      title="Reset Zoom"
                    >
                      Reset
                    </button>
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
      )}

      {showProGenerator && (
        <ProInvoiceGenerator 
          onSave={handleSave} 
          onCancel={() => setShowProGenerator(false)} 
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
