
import React, { useState, useRef, useEffect } from 'react';
import { Save, X, Upload, Download, Image as ImageIcon, Layers, User, Calendar, CreditCard, ShoppingBag, Plus, Trash2, Database, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { BusinessDocument, DocumentType, Asset, AssetType, InvoiceItem, FooterSettings, HeaderSettings } from '../types';
import DocumentPreview from './DocumentPreview';
import AssetLibrary from './AssetLibrary';
import { getTypePreferences, saveTypePreferences } from '../utils/storage';

interface ProInvoiceGeneratorProps {
  initialData?: Partial<BusinessDocument>;
  onSave: (doc: BusinessDocument) => void;
  onCancel: () => void;
  footerSettings?: FooterSettings;
  headerSettings?: HeaderSettings;
}

const ProInvoiceGenerator: React.FC<ProInvoiceGeneratorProps> = ({ initialData, onSave, onCancel, footerSettings, headerSettings }) => {
  const [assetPickerConfig, setAssetPickerConfig] = useState<{ open: boolean; target: 'logoUrl' | { type: 'itemImage'; index: number }; type: AssetType } | null>(null);
  
  // Initialize form data with initialData or defaults
  const [formData, setFormData] = useState<Partial<BusinessDocument>>(() => {
    const type = DocumentType.PRO_INVOICE;
    
    return {
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      type: type,
      docNumber: initialData?.docNumber || `PRO-${Math.floor(Math.random() * 100000)}`,
      date: initialData?.date || new Date().toISOString().split('T')[0],
      clientName: initialData?.clientName || '',
      clientPhone: initialData?.clientPhone || '',
      clientAddress: initialData?.clientAddress || '',
      vehiclePrice: initialData?.vehiclePrice || 0,
      payments: initialData?.payments || [{ id: '1', date: new Date().toISOString().split('T')[0], amount: 0, note: 'CASH' }],
      items: initialData?.items || [
        { id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unitPrice: 0, imageSize: 'medium' }
      ],
      notes: initialData?.notes || '',
      hiddenFields: initialData?.hiddenFields || [],
      createdAt: initialData?.createdAt || Date.now()
    };
  });

  useEffect(() => {
    // Only apply preferences for brand new documents
    if (!initialData?.id) {
      // No specific preferences for Pro Invoice currently besides logo which is now global
    }
  }, [initialData?.id]);

  const previewRef = useRef<HTMLDivElement>(null);
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem('gd_editor_width');
    return saved ? parseFloat(saved) : 55; // 55% left, 45% right
  });
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const isDragging = useRef(false);
  
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
  }, [previewContainerRef.current, initialData?.id]);

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

  const calculateSubtotal = () => {
    return (formData.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateBalance = () => {
    const subtotal = calculateSubtotal();
    const paid = (formData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    return subtotal - paid;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: { type: 'itemImage'; index: number }) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const newItems = [...(formData.items || [])];
        newItems[target.index] = { ...newItems[target.index], imageUrl: reader.result as string };
        setFormData({ ...formData, items: newItems });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAssetSelect = (asset: Asset) => {
    if (assetPickerConfig) {
      if (typeof assetPickerConfig.target !== 'string') {
        const newItems = [...(formData.items || [])];
        newItems[assetPickerConfig.target.index] = { ...newItems[assetPickerConfig.target.index], imageUrl: asset.dataUrl };
        setFormData({ ...formData, items: newItems });
      }
      setAssetPickerConfig(null);
    }
  };

  const addRow = () => {
    const newItem: InvoiceItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantity: 1,
      unitPrice: 0,
      imageSize: 'medium'
    };
    setFormData({ ...formData, items: [...(formData.items || []), newItem] });
  };

  const removeRow = (index: number) => {
    const newItems = (formData.items || []).filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const toggleImageColumn = () => {
    const hidden = formData.hiddenFields || [];
    if (hidden.includes('itemImageColumn')) {
      setFormData({ ...formData, hiddenFields: hidden.filter(f => f !== 'itemImageColumn') });
    } else {
      setFormData({ ...formData, hiddenFields: [...hidden, 'itemImageColumn'] });
    }
  };

  const handleSave = () => {
    const finalDoc = { ...formData, vehiclePrice: calculateSubtotal() } as BusinessDocument;
    onSave(finalDoc);
  };

  const inputClass = "w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-red-700/50 focus:bg-white/[0.08] text-white placeholder:text-white/20 transition-all focus:ring-4 focus:ring-red-700/10";
  const labelClass = "block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 ml-1";

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-red-700 shadow-inner group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/95 backdrop-blur-3xl font-sans p-0 overflow-hidden">
      {assetPickerConfig?.open && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-20 animate-in zoom-in duration-300">
          <div className="w-full max-w-6xl h-full shadow-2xl relative">
            <AssetLibrary 
              selectionMode 
              onSelect={handleAssetSelect} 
              onClose={() => setAssetPickerConfig(null)} 
              filterType={assetPickerConfig.type}
            />
          </div>
        </div>
      )}

      <div className="w-full h-full bg-[#0a0a0b] flex flex-col lg:flex-row overflow-hidden animate-in zoom-in duration-500">
        
        {/* LEFT: Premium Editor Panel */}
        <div 
          style={isLargeScreen ? { width: `${editorWidth}%`, flex: 'none' } : { flex: 1 }}
          className="bg-[#0a0a0b] border-r border-white/5 flex flex-col shrink-0 lg:min-w-[300px] overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-950/20 to-black px-6 md:px-10 py-6 md:py-8 flex justify-between items-center text-white shrink-0 border-b border-white/5">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-red-700 rounded-xl md:rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(185,28,28,0.4)] ring-4 ring-red-700/10 transition-all group-hover:rotate-12">
                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-black uppercase tracking-tighter leading-none mb-1 md:mb-1.5">
                  {initialData?.id ? 'MODIFY' : 'DRAFTING'} <span className="text-red-700">PRODUCT INVOICE</span>
                </h2>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-[8px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">Session ID: {formData.id?.slice(0,8).toUpperCase()}</span>
                  <div className="w-1 h-1 rounded-full bg-red-700 animate-pulse"></div>
                  <span className="text-[8px] md:text-[9px] font-black text-red-700 uppercase tracking-[0.2em] md:tracking-[0.3em]">Live Cloud Buffer</span>
                </div>
              </div>
            </div>
            <button onClick={onCancel} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-red-700 hover:text-white hover:border-transparent transition-all active:scale-90 group">
              <X className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 scrollbar-hide bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.03),transparent_40%)]">
            {/* Recipient Info */}
            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-6">
              <SectionHeader icon={User} title="Stakeholder Profile" subtitle="Client Identity Records" />
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Execution Date</label>
                    <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Number</label>
                    <input type="text" placeholder="PRO-XXXXX" value={formData.docNumber || ''} onChange={(e) => setFormData({...formData, docNumber: e.target.value})} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Buyer's Identity</label>
                  <input type="text" placeholder="Full Legal Name" value={formData.clientName || ''} onChange={(e) => setFormData({...formData, clientName: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contact Communication</label>
                  <input type="text" placeholder="Mobile / Phone Number" value={formData.clientPhone || ''} onChange={(e) => setFormData({...formData, clientPhone: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Registered Address</label>
                  <textarea placeholder="Legal Physical Address" value={formData.clientAddress || ''} onChange={(e) => setFormData({...formData, clientAddress: e.target.value})} className={`${inputClass} !py-3 min-h-[80px]`} rows={2} />
                </div>
              </div>
            </div>

            {/* Items Table Editor */}
            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <SectionHeader icon={ShoppingBag} title="Inventory Components" subtitle="Multi-Row Order Details" />
                <button onClick={toggleImageColumn} className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${formData.hiddenFields?.includes('itemImageColumn') ? 'bg-white/5 text-gray-500' : 'bg-red-700/10 text-red-700 border border-red-700/20'}`}>
                  {formData.hiddenFields?.includes('itemImageColumn') ? <EyeOff size={14} /> : <Eye size={14} />} 
                  Image Column
                </button>
              </div>

              <div className="space-y-6">
                {(formData.items || []).map((item, idx) => (
                  <div key={item.id} className="relative group p-6 md:p-8 bg-black/40 rounded-2xl md:rounded-[2rem] border border-white/5 hover:border-white/10 transition-all animate-in slide-in-from-right-4">
                    <button onClick={() => removeRow(idx)} className="absolute -top-3 -right-3 w-8 h-8 md:w-10 md:h-10 bg-red-700 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-800 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 z-10 border-2 md:border-4 border-black">
                      <Trash2 size={14} className="md:w-4 md:h-4" />
                    </button>
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                      <div className="w-10 shrink-0 flex items-center justify-center md:justify-start">
                        <span className="text-2xl md:text-3xl font-black text-white/10 group-hover:text-red-700/40 tracking-tighter transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                      </div>
                      <div className="flex-1 space-y-6">
                        <div>
                          <label className={labelClass}>Asset Description</label>
                          <input type="text" placeholder="e.g. Premium Tissu Box" value={item.description || ''} onChange={(e) => updateItem(idx, 'description', e.target.value)} className={inputClass} />
                        </div>
                        
                        {!formData.hiddenFields?.includes('itemImageColumn') && (
                          <div className="flex flex-col sm:flex-row gap-6 p-4 md:p-6 bg-white/5 rounded-2xl border border-white/5">
                            <div className="w-20 h-20 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-inner mx-auto sm:mx-0">
                              {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-white/5" />}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex gap-3">
                                <button onClick={() => setAssetPickerConfig({ open: true, target: { type: 'itemImage', index: idx }, type: AssetType.PRODUCT })} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-gray-400 hover:text-white">Library</button>
                                <label className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-gray-400 hover:text-white text-center cursor-pointer">
                                  Upload
                                  <input type="file" onChange={(e) => handleFileUpload(e, { type: 'itemImage', index: idx })} className="hidden" />
                                </label>
                              </div>
                              <div className="flex bg-black/40 rounded-xl p-1 gap-1">
                                {(['small', 'medium', 'large'] as const).map(size => (
                                  <button key={size} onClick={() => updateItem(idx, 'imageSize', size)} className={`flex-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${item.imageSize === size ? 'bg-red-700 text-white' : 'text-gray-600 hover:text-white'}`}>{size}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                          <div>
                            <label className={labelClass}>Units (Qty)</label>
                            <input type="number" min="1" value={item.quantity ?? 1} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className={`${inputClass} !py-3 md:!py-3.5 font-bold`} />
                          </div>
                          <div>
                            <label className={labelClass}>Unit Cost (TK)</label>
                            <input type="number" placeholder="Price" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className={`${inputClass} !py-3 md:!py-3.5 font-bold text-red-700 !bg-red-700/5`} />
                          </div>
                          <div>
                            <label className={labelClass}>Sub-total</label>
                            <div className="h-12 flex items-center justify-end font-black text-red-700 bg-red-700/10 rounded-2xl px-5 border border-red-700/20 shadow-inner text-base md:text-lg tracking-tighter">
                              {(item.quantity * item.unitPrice).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addRow} className="w-full py-5 md:py-6 border-2 border-dashed border-white/10 rounded-3xl md:rounded-[2.5rem] text-gray-600 hover:text-red-700 hover:border-red-700/30 hover:bg-red-700/5 transition-all flex items-center justify-center gap-3 md:gap-4 group font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-[11px]">
                <Plus className="group-hover:rotate-90 transition-transform w-4 h-4 md:w-5 md:h-5" /> Append Inventory Row
              </button>
            </div>

            {/* Final Totals & Settlement */}
            <div className="bg-red-700/5 p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-red-700/20 space-y-6 md:space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-red-700/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-red-700/20 transition-all duration-1000"></div>
              <SectionHeader icon={CreditCard} title="Fiscal Transaction" subtitle="Grand Totals & Balance" />
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-center text-white border-b border-red-700/10 pb-4">
                  <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-gray-500">Gross Invoice Aggregate</span>
                  <span className="text-xl md:text-3xl font-black tracking-tighter">৳ {calculateSubtotal().toLocaleString()}/-</span>
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] md:text-[11px] font-black text-red-700 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-2 ml-1">Capital Received</label>
                  <div className="relative">
                    <span className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-2xl md:text-3xl font-black text-red-300 pointer-events-none">৳</span>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={formData.payments?.[0].amount ?? ''} 
                      onChange={(e) => {
                        const newPayments = [...(formData.payments || [])];
                        newPayments[0] = { ...newPayments[0], amount: parseFloat(e.target.value) || 0 };
                        setFormData({...formData, payments: newPayments});
                      }} 
                      className="w-full bg-red-700 text-white pl-12 md:pl-16 pr-6 md:pr-8 py-4 md:py-6 rounded-2xl md:rounded-[2.5rem] text-2xl md:text-4xl font-black outline-none border border-red-600 shadow-2xl shadow-red-700/30 placeholder:text-red-300 focus:ring-8 focus:ring-red-700/20 transition-all" 
                    />
                  </div>
                </div>
                <div className="pt-6 border-t border-red-700/20 flex justify-between items-center">
                  <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-red-700/60">Outstanding Balance Due</span>
                  <span className={`text-2xl md:text-4xl font-black tracking-tighter ${calculateBalance() < 0 ? 'text-green-500' : 'text-red-700'}`}>
                    ৳ {calculateBalance().toLocaleString()}/-
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 border-t border-white/5 bg-[#0a0a0b] shrink-0 flex flex-col sm:flex-row gap-4 md:gap-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <button onClick={handleSave} className="flex-1 bg-red-700 text-white font-black py-4 md:py-5 rounded-2xl md:rounded-[2.5rem] hover:bg-red-800 flex items-center justify-center gap-3 md:gap-4 transition-all active:scale-95 shadow-2xl shadow-red-700/40 uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-xs border border-red-600/50">
              <Save size={20} className="md:w-6 md:h-6" /> Commit Record to Storage
            </button>
            <button onClick={onCancel} className="px-6 md:px-12 bg-white/5 text-gray-500 font-black py-4 md:py-5 rounded-2xl md:rounded-[2.5rem] border border-white/10 hover:bg-white/10 hover:text-white active:scale-95 transition-all uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-xs">
              Discard
            </button>
          </div>
        </div>

        {isLargeScreen && (
          <div 
            className="w-1.5 hover:w-2 bg-white/5 hover:bg-red-700/50 cursor-col-resize transition-all duration-150 shrink-0 select-none relative self-stretch"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white/10 hover:bg-white/30 rounded-full my-auto h-24 top-1/2 -translate-y-1/2"></div>
          </div>
        )}

        {/* RIGHT: Live Rendering Panel */}
        <div 
          ref={previewContainerRef}
          style={isLargeScreen ? { width: `${100 - editorWidth}%`, flex: 'none' } : {}}
          className="hidden lg:flex bg-black/50 p-12 overflow-y-auto flex flex-col items-center scrollbar-hide border-l border-white/10"
        >
          <div className="mb-8 w-full flex justify-between items-center text-white/30">
            <div className="flex items-center gap-4">
               <div className="w-2.5 h-2.5 rounded-full bg-red-700 animate-pulse"></div>
               <span className="text-[11px] font-black uppercase tracking-[0.4em]">Live Rendering Engine</span>
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
            <DocumentPreview document={formData as BusinessDocument} containerRef={previewRef} scale={previewZoom} footerSettings={footerSettings} headerSettings={headerSettings} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProInvoiceGenerator;
