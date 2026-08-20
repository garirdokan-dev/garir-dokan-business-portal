
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Car, CreditCard, User, Upload, Type, Landmark, FileText, Truck, Receipt, FileCheck, Layers, Gauge, Image as ImageIcon, Database, Edit3, Calendar, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { BusinessDocument, DocumentType, PaymentEntry, Asset, AssetType, HeaderSettings } from '../types';
import { DOC_TYPES_CONFIG } from '../constants';
import AssetLibrary from './AssetLibrary';
import { getTypePreferences, saveTypePreferences } from '../utils/storage';

interface DocumentFormProps {
  initialData: Partial<BusinessDocument>;
  onSave: (doc: BusinessDocument) => void;
  onCancel: () => void;
  onChange?: (doc: Partial<BusinessDocument>) => void;
  headerSettings?: HeaderSettings;
}

const ONES_WORDS = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const TENS_WORDS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

const convertChunkWords = (n: number): string => {
  if (n < 20) {
    return ONES_WORDS[n];
  }
  const tenDigit = Math.floor(n / 10);
  const oneDigit = n % 10;
  return (TENS_WORDS[tenDigit] + (oneDigit > 0 ? " " + ONES_WORDS[oneDigit] : "")).trim();
};

const convertNumberToWords = (num: number): string => {
  if (num === 0) return "";
  
  num = Math.floor(num);
  if (num <= 0) return "";
  
  let words = "";
  
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  
  const hundred = Math.floor(num / 100);
  num %= 100;
  
  if (crore > 0) {
    words += convertChunkWords(crore) + " Crore ";
  }
  
  if (lakh > 0) {
    words += convertChunkWords(lakh) + " Lakh ";
  }
  
  if (thousand > 0) {
    words += convertChunkWords(thousand) + " Thousand ";
  }
  
  if (hundred > 0) {
    words += convertChunkWords(hundred) + " Hundred ";
  }
  
  if (num > 0) {
    words += convertChunkWords(num) + " ";
  }
  
  return (words.trim() + " Taka Only").replace(/\s+/g, ' ');
};

const DocumentForm: React.FC<DocumentFormProps> = ({ initialData, onSave, onCancel, onChange, headerSettings }) => {
  const [showAssetPicker, setShowAssetPicker] = useState<{ open: boolean; target: 'logoUrl' | 'productImageUrl'; type: AssetType } | null>(null);
  const [formData, setFormData] = useState<Partial<BusinessDocument>>(() => ({
    id: Math.random().toString(36).substr(2, 9),
    type: DocumentType.INVOICE,
    docNumber: '',
    date: new Date().toISOString().split('T')[0],
    clientName: '',
    clientAddress: '',
    clientPhone: '',
    vehicleTitle: '',
    vehicleTitleSize: 18,
    vehicleTitleAlign: 'left',
    brand: '',
    model: '',
    yearModel: '',
    color: '',
    chassisNumber: '',
    engineNumber: '',
    auctionPoint: '',
    cc: '',
    fuel: '',
    transmission: '',
    vehiclePrice: 0,
    priceInWords: '',
    payments: [],
    quantity: 1,
    advancedPaidAmount: 0,
    bankPaymentAmount: 0,
    bankName: '',
    createdAt: Date.now(),
    hiddenFields: [],
    ...initialData
  }));

  useEffect(() => {
    const applyPrefs = async () => {
      const type = formData.type || DocumentType.INVOICE;
      
      setFormData(prev => ({
        ...prev,
        docNumber: prev.docNumber || `${DOC_TYPES_CONFIG[type].prefix}-${Date.now().toString().slice(-6)}`,
        vehicleTitleSize: prev.vehicleTitleSize || (type === DocumentType.BILL ? 20 : 18),
      }));
    };
    
    if (!initialData.id) {
      applyPrefs();
    }
  }, []);

  useEffect(() => {
    if (onChange) {
      onChange(formData);
    }
  }, [formData, onChange]);

  const toggleField = (field: string) => {
    const hidden = formData.hiddenFields || [];
    if (hidden.includes(field)) {
      setFormData({ ...formData, hiddenFields: hidden.filter(f => f !== field) });
    } else {
      setFormData({ ...formData, hiddenFields: [...hidden, field] });
    }
  };

  const isFieldVisible = (field: string) => !(formData.hiddenFields || []).includes(field);

  const handleAssetSelect = (asset: Asset) => {
    if (showAssetPicker) {
      setFormData({ ...formData, [showAssetPicker.target]: asset.dataUrl });
      setShowAssetPicker(null);
    }
  };

  const addPayment = () => {
    const newPayment: PaymentEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      note: 'CASH'
    };
    setFormData({ ...formData, payments: [...(formData.payments || []), newPayment] });
  };

  const removePayment = (id: string) => {
    setFormData({ ...formData, payments: (formData.payments || []).filter(p => p.id !== id) });
  };

  const updatePayment = (id: string, field: keyof PaymentEntry, value: any) => {
    const newPayments = (formData.payments || []).map(p => 
      p.id === id ? { ...p, [field]: value } : p
    );
    setFormData({ ...formData, payments: newPayments });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName && formData.type !== DocumentType.BILL && formData.type !== DocumentType.QUOTATION) {
      alert("Please enter the buyer's name.");
      return;
    }
    
    onSave(formData as BusinessDocument);
  };

  const inputClass = "w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium outline-none focus:border-red-700/50 focus:bg-white/[0.08] text-white placeholder:text-white/20 transition-all focus:ring-4 focus:ring-red-700/10";
  const labelClass = "block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 ml-1";

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div 
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-red-700 shadow-[0_0_15px_rgba(185,28,28,0.3)]' : 'bg-white/10'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xl transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );

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

  const currentTypeConfig = DOC_TYPES_CONFIG[formData.type || DocumentType.INVOICE];

  return (
    <div className="bg-[#0a0a0b] h-full flex flex-col overflow-hidden font-sans border-r border-white/5">
      {showAssetPicker && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-20 animate-in zoom-in duration-300">
          <div className="w-full max-w-6xl h-full shadow-2xl relative">
            <AssetLibrary 
              selectionMode 
              onSelect={handleAssetSelect} 
              onClose={() => setShowAssetPicker(null)} 
              filterType={showAssetPicker.type}
            />
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-red-950/20 to-black px-4 md:px-10 py-4 md:py-8 flex justify-between items-center text-white shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="w-10 h-10 md:w-14 md:h-14 bg-red-700 rounded-xl md:rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(185,28,28,0.4)] ring-4 ring-red-700/10 transition-all group-hover:rotate-12 shrink-0">
            {React.cloneElement(currentTypeConfig.icon as React.ReactElement, { className: 'w-5 h-5 md:w-6 md:h-6' })}
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-2xl font-black uppercase tracking-tighter leading-none mb-1 md:mb-1.5 truncate">
              {initialData.id ? 'Modify' : 'Drafting'} <span className="text-red-700">{currentTypeConfig.label}</span>
            </h2>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-[7px] md:text-[9px] font-black text-gray-500 uppercase tracking-[0.1em] md:tracking-[0.3em] truncate">ID: {formData.id?.slice(0,8)}</span>
              <div className="w-1 h-1 rounded-full bg-red-700 animate-pulse shrink-0"></div>
              <span className="text-[7px] md:text-[9px] font-black text-red-700 uppercase tracking-[0.1em] md:tracking-[0.3em] truncate">Live Cloud Buffer</span>
            </div>
          </div>
        </div>
        <button onClick={onCancel} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-red-700 hover:text-white hover:border-transparent transition-all active:scale-90 group shrink-0 ml-2">
          <X className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-white" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 md:space-y-10 overflow-y-auto flex-1 scrollbar-hide bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.03),transparent_40%)]">
        {/* Dynamic Form Sections Based on Type */}
        {formData.type === DocumentType.CHALLAN && (
          <>
            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
              <SectionHeader icon={User} title="Recipient Logistics" subtitle="Delivery Destination Details" />
              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className={labelClass}>Recipient Full Name</label>
                  <input type="text" placeholder="Authorized Recipient" value={formData.clientName || ''} onChange={(e) => setFormData({...formData, clientName: e.target.value})} className={inputClass} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className={labelClass}>Contact Mobile</label>
                    <input type="text" placeholder="+880..." value={formData.clientPhone || ''} onChange={(e) => setFormData({...formData, clientPhone: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Dispatch Date</label>
                    <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Drop-off Location</label>
                  <textarea placeholder="Physical Address" rows={2} value={formData.clientAddress || ''} onChange={(e) => setFormData({...formData, clientAddress: e.target.value})} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-4 md:space-y-6">
              <SectionHeader icon={Car} title="Asset Specifications" subtitle="Vehicle Technical Data" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Text Size</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="40" 
                    value={formData.vehicleTitleSize ?? 18} 
                    onChange={(e) => setFormData({...formData, vehicleTitleSize: parseInt(e.target.value)})} 
                    className="flex-1 accent-red-700 h-1.5 bg-white/5 rounded-lg cursor-pointer appearance-none" 
                  />
                  <span className="text-[10px] font-black text-red-700 bg-red-700/10 px-2 py-0.5 rounded-md">{formData.vehicleTitleSize ?? 18}px</span>
                </div>

                <div className="flex items-center gap-2 bg-black/40 p-4 rounded-3xl border border-white/5">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-2">Alignment</span>
                  <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                    {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicleTitleAlign: align })}
                        className={`p-2 rounded-lg transition-all ${formData.vehicleTitleAlign === align ? 'bg-red-700 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                      >
                        {align === 'left' && <AlignLeft size={16} />}
                        {align === 'center' && <AlignCenter size={16} />}
                        {align === 'right' && <AlignRight size={16} />}
                        {align === 'justify' && <AlignJustify size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Vehicle Description (Paragraph)</label>
                <textarea 
                  placeholder="e.g. TOYOTA HIACE GL BUS..." 
                  value={formData.vehicleTitle || ''} 
                  onChange={(e) => setFormData({...formData, vehicleTitle: e.target.value})} 
                  className={`${inputClass} min-h-[120px] resize-y`}
                  style={{ textAlign: formData.vehicleTitleAlign }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['yearModel', 'color', 'chassisNumber', 'engineNumber', 'auctionPoint', 'quantity'].map(field => (
                  <div key={field}>
                    <label className={labelClass}>
                      {field === 'auctionPoint' ? 'AUCTION POINT' : field === 'quantity' ? 'QTY' : field.toUpperCase()}
                    </label>
                    <input 
                      type={field === 'quantity' ? 'number' : 'text'} 
                      placeholder={field === 'auctionPoint' ? 'e.g. 4.5' : `Enter ${field}`} 
                      value={(formData as any)[field] || ''} 
                      onChange={(e) => {
                        const val = field === 'quantity' ? parseInt(e.target.value) || 0 : e.target.value;
                        setFormData({...formData, [field]: val});
                      }} 
                      className={inputClass} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {(formData.type === DocumentType.INVOICE || formData.type === DocumentType.QUOTATION || formData.type === DocumentType.BILL) && (
          <>
            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
              <SectionHeader icon={User} title="Stakeholder Profile" subtitle="Client Identity Records" />
              <div className="space-y-4 md:space-y-6">
                {formData.type === DocumentType.INVOICE && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-4 md:pb-6 border-b border-white/5 mb-4 md:mb-6">
                    <div>
                      <label className={labelClass}>DATE</label>
                      <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Invoice no.</label>
                      <input type="text" placeholder="INV-XXXXXX" value={formData.docNumber || ''} onChange={(e) => setFormData({...formData, docNumber: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                )}

                {formData.type === DocumentType.QUOTATION ? (
                  <div className="space-y-4 md:space-y-6">
                    <div className="pb-4 border-b border-white/5">
                      <label className={labelClass}>Quotation Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className={`${inputClass} !pl-12`} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label className={labelClass}>Officer Designation</label>
                        <input type="text" placeholder="e.g. The Manager" value={formData.clientDesignation || ''} onChange={(e) => setFormData({...formData, clientDesignation: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Associated Organization</label>
                        <input type="text" placeholder="e.g. City Bank PLC" value={formData.clientOffice || ''} onChange={(e) => setFormData({...formData, clientOffice: e.target.value})} className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Registered Address</label>
                      <textarea placeholder="Legal Physical Address" rows={2} value={formData.clientAddress || ''} onChange={(e) => setFormData({...formData, clientAddress: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Account / Bank Reference (A/C)</label>
                      <input type="text" placeholder="e.g. A/C NAME OR REF" value={formData.acName || ''} onChange={(e) => setFormData({...formData, acName: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                ) : formData.type === DocumentType.BILL ? (
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <label className={labelClass}>A/C Name or Recipient</label>
                      <input type="text" placeholder="e.g. RAWSHAN JAHAN" value={formData.acName || ''} onChange={(e) => setFormData({...formData, acName: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Officer Designation</label>
                      <input type="text" placeholder="e.g. Head Office" value={formData.clientDesignation || ''} onChange={(e) => setFormData({...formData, clientDesignation: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className={labelClass}>Buyer's Identity</label>
                      <input type="text" placeholder="Full Name" value={formData.clientName || ''} onChange={(e) => setFormData({...formData, clientName: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Communication</label>
                      <input type="text" placeholder="Mobile / Phone" value={formData.clientPhone || ''} onChange={(e) => setFormData({...formData, clientPhone: e.target.value})} className={inputClass} />
                    </div>
                  </div>
                )}
                
                {formData.type !== DocumentType.QUOTATION && (
                  <div>
                    <label className={labelClass}>Registered Address</label>
                    <textarea placeholder="Legal Physical Address" rows={2} value={formData.clientAddress || ''} onChange={(e) => setFormData({...formData, clientAddress: e.target.value})} className={inputClass} />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-4 md:space-y-6">
              <SectionHeader icon={Car} title="Asset Valuation" subtitle="Vehicle Portfolio Details" />
              
              {formData.type === DocumentType.QUOTATION && (
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Header Typography</span>
                    <input 
                      type="range" 
                      min="10" 
                      max="40" 
                      value={formData.vehicleTitleSize ?? 18} 
                      onChange={(e) => setFormData({...formData, vehicleTitleSize: parseInt(e.target.value)})} 
                      className="flex-1 accent-red-700 h-1.5 bg-white/5 rounded-lg cursor-pointer appearance-none" 
                    />
                    <span className="text-[10px] font-black text-red-700 bg-red-700/10 px-2 py-0.5 rounded-md">{formData.vehicleTitleSize ?? 18}px</span>
                  </div>
                </div>
              )}

              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className={labelClass}>{formData.type === DocumentType.QUOTATION ? 'Vehicle Name' : 'Vehicle Description'}</label>
                  <input 
                    type="text" 
                    placeholder={formData.type === DocumentType.QUOTATION ? "Enter vehicle name..." : "Full vehicle title"} 
                    value={formData.vehicleTitle || ''} 
                    onChange={(e) => setFormData({...formData, vehicleTitle: e.target.value})} 
                    className={inputClass} 
                  />
                </div>

                {formData.type !== DocumentType.QUOTATION && (
                  <div className="flex items-center gap-4 md:gap-6 px-4 md:px-6 py-3 md:py-4 bg-black/40 rounded-3xl border border-white/5">
                     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Header Typography</span>
                     <input type="range" min="10" max="40" value={formData.vehicleTitleSize ?? 18} onChange={(e) => setFormData({...formData, vehicleTitleSize: parseInt(e.target.value)})} className="flex-1 accent-red-700 h-1.5 bg-white/5 rounded-lg cursor-pointer appearance-none" />
                     <span className="text-[10px] font-black text-red-700 bg-red-700/10 px-2 py-0.5 rounded-md">{formData.vehicleTitleSize ?? 18}px</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {(formData.type === DocumentType.BILL || formData.type === DocumentType.QUOTATION) ? (
                    <>
                      {(formData.type === DocumentType.QUOTATION 
                        ? ['brand', 'model', 'yearModel', 'color', 'chassisNumber', 'engineNumber', 'cc', 'fuel', 'transmission', 'quantity']
                        : ['yearModel', 'cc', 'engineNumber', 'chassisNumber', 'color']
                      ).map(field => (
                        <div key={field} className="flex items-center gap-4 bg-black/20 p-2 rounded-2xl border border-white/5">
                          <div className="flex-1">
                            <label className={labelClass}>
                              {field === 'cc' ? 'Cubic Capacity (CC)' : field === 'quantity' ? 'QTY' : field.toUpperCase()}
                            </label>
                            <input 
                              type={field === 'quantity' ? 'number' : 'text'} 
                              placeholder={field === 'quantity' ? '01' : `Enter ${field}`} 
                              value={(formData as any)[field] || ''} 
                              onChange={(e) => {
                                const val = field === 'quantity' ? parseInt(e.target.value) || 0 : e.target.value;
                                setFormData({...formData, [field]: val});
                              }} 
                              className={inputClass} 
                            />
                          </div>
                          <div className="pt-6 px-2"><ToggleSwitch checked={isFieldVisible(field)} onChange={() => toggleField(field)} /></div>
                        </div>
                      ))}

                      {formData.type === DocumentType.BILL && (
                        <div className="bg-red-700/5 p-2 rounded-2xl border border-red-700/20">
                          <div>
                            <label className={labelClass}>Net Valuation (TK)</label>
                            <input 
                              type="number" 
                              placeholder="Total Price" 
                              value={formData.vehiclePrice || ''} 
                              onChange={(e) => {
                                const net = parseFloat(e.target.value) || 0;
                                setFormData({
                                  ...formData, 
                                  vehiclePrice: net,
                                  priceInWords: convertNumberToWords(net)
                                });
                              }} 
                              className={`${inputClass} font-black text-red-700 !bg-red-700/10 border-red-700/30`} 
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {['model', 'color', 'cc', 'chassisNumber', 'engineNumber'].map(field => (
                        <div key={field} className="flex items-center gap-4 bg-black/20 p-2 rounded-2xl border border-white/5">
                          <div className="flex-1">
                            <label className={labelClass}>{field.toUpperCase()}</label>
                            <input type="text" placeholder={`Enter ${field}`} value={(formData as any)[field] || ''} onChange={(e) => setFormData({...formData, [field]: e.target.value})} className={inputClass} />
                          </div>
                          <div className="pt-6 px-2"><ToggleSwitch checked={isFieldVisible(field)} onChange={() => toggleField(field)} /></div>
                        </div>
                      ))}
                      {formData.type === DocumentType.INVOICE && (
                        <div className="flex items-center gap-4 bg-red-700/5 p-2 rounded-2xl border border-red-700/20">
                          <div className="flex-1">
                            <label className={labelClass}>NET VEHICLE PRICE (TK)</label>
                            <input 
                              type="number" 
                              placeholder="Enter Car Price" 
                              value={formData.vehiclePrice || ''} 
                              onChange={(e) => {
                                const price = parseFloat(e.target.value) || 0;
                                setFormData({
                                  ...formData,
                                  vehiclePrice: price,
                                  priceInWords: convertNumberToWords(price)
                                });
                              }} 
                              className={`${inputClass} font-black text-red-700 !bg-red-700/10 border-red-700/30`} 
                            />
                          </div>
                          <div className="pt-6 px-2"><ToggleSwitch checked={isFieldVisible('vehiclePrice')} onChange={() => toggleField('vehiclePrice')} /></div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
              <SectionHeader icon={CreditCard} title="Fiscal Transaction" subtitle="Payment & Settlement Records" />
              <div className="space-y-4 md:space-y-6">
                {formData.type === DocumentType.INVOICE ? (
                  <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Transaction History</h4>
                      <button type="button" onClick={addPayment} className="px-4 md:px-5 py-2 md:py-2.5 bg-red-700 text-white rounded-xl font-black text-[10px] uppercase hover:bg-red-800 transition-all shadow-xl shadow-red-700/20 active:scale-95 flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" /> Append Record
                      </button>
                    </div>
                    <div className="space-y-4">
                      {(formData.payments || []).map((pay) => (
                        <div key={pay.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 md:p-5 bg-black/30 rounded-2xl md:rounded-3xl border border-white/5 animate-in slide-in-from-right-4">
                          <div className="w-full sm:w-[160px]">
                            <label className={labelClass}>Execution Date</label>
                            <input type="date" value={pay.date || ''} onChange={(e) => updatePayment(pay.id, 'date', e.target.value)} className={`${inputClass} !py-3`} />
                          </div>
                          <div className="w-full sm:w-[140px]">
                            <label className={labelClass}>Amount (TK)</label>
                            <input type="number" placeholder="0" value={pay.amount || ''} onChange={(e) => updatePayment(pay.id, 'amount', parseFloat(e.target.value) || 0)} className={`${inputClass} !py-3 font-black text-red-700`} />
                          </div>
                          <div className="w-full sm:flex-1">
                            <label className={labelClass}>Payment Instrument / Note</label>
                            <input type="text" placeholder="CASH / BKASH / CHECK" value={pay.note || ''} onChange={(e) => updatePayment(pay.id, 'note', e.target.value)} className={`${inputClass} !py-3 uppercase`} />
                          </div>
                          <button type="button" onClick={() => removePayment(pay.id)} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 text-gray-500 rounded-xl md:rounded-2xl hover:text-white hover:bg-red-700 transition-all sm:mt-6 border border-white/5 active:scale-90 flex items-center justify-center self-end sm:self-center">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                 ) : formData.type === DocumentType.BILL ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                     <div className="space-y-4 md:space-y-6">
                       <div className="bg-black/20 p-4 md:p-5 rounded-2xl border border-white/5">
                         <label className={labelClass}>Advance Paid By Customer (TK)</label>
                         <input 
                           type="number" 
                           value={formData.advancedPaidAmount ?? 0} 
                           onChange={(e) => {
                             const adv = parseFloat(e.target.value) || 0;
                             const net = formData.vehiclePrice || 0;
                             setFormData({
                               ...formData, 
                               advancedPaidAmount: adv,
                               bankPaymentAmount: Math.max(0, net - adv)
                             });
                           }} 
                           className={`${inputClass} ${(formData.advancedPaidAmount || 0) > (formData.vehiclePrice || 0) ? 'border-red-500 focus:border-red-500' : ''}`} 
                         />
                       </div>
                       <div className="bg-black/20 p-4 md:p-5 rounded-2xl border border-white/5">
                         <label className={labelClass}>Unit</label>
                         <input type="number" placeholder="01" value={formData.quantity || ''} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} className={inputClass} />
                       </div>
                     </div>
                     <div className="space-y-4 md:space-y-6">
                       <div className="bg-black/20 p-4 md:p-5 rounded-2xl border border-white/5">
                         <label className={labelClass}>Paid by Bank (Amount)</label>
                         <input 
                           type="number" 
                           value={formData.bankPaymentAmount ?? 0} 
                           onChange={(e) => {
                             const bankVal = parseFloat(e.target.value) || 0;
                             const net = formData.vehiclePrice || 0;
                             setFormData({
                               ...formData, 
                               bankPaymentAmount: bankVal,
                               advancedPaidAmount: Math.max(0, net - bankVal)
                             });
                           }} 
                           className={inputClass} 
                         />
                       </div>
                       <div className="bg-black/20 p-4 md:p-5 rounded-2xl border border-white/5">
                         <label className={labelClass}>Bank Name</label>
                         <input type="text" placeholder="e.g. City Bank PLC" value={formData.bankName || ''} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className={inputClass} />
                       </div>
                     </div>
                  </div>
                ) : (
                  <div className="bg-red-700/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-red-700/20">
                    <label className={labelClass}>Net Proposed Valuation (TK)</label>
                    <input 
                      type="number" 
                      placeholder="Offer Price" 
                      value={formData.vehiclePrice || ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          vehiclePrice: val,
                          priceInWords: convertNumberToWords(val)
                        });
                      }} 
                      className={`${inputClass} font-black text-red-700 !bg-red-700/10 border-red-700/30`} 
                    />
                  </div>
                )}
                
                {(formData.type === DocumentType.BILL || formData.type === DocumentType.QUOTATION) && (
                  <div className="pt-2 md:pt-4">
                    <label className={labelClass}>Valuation in Verbal Format</label>
                    <input type="text" placeholder="e.g. Thirty Eight Lac Taka Only" value={formData.priceInWords || ''} onChange={(e) => setFormData({...formData, priceInWords: e.target.value})} className={inputClass} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {formData.type !== DocumentType.INVOICE && formData.type !== DocumentType.BILL && formData.type !== DocumentType.CHALLAN && (
          <div className="bg-white/[0.03] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
            <SectionHeader icon={Plus} title="Miscellaneous Notes" subtitle="Optional Disclaimers & Terms" />
            <textarea placeholder="Append additional instructions, accessories list, or legal disclaimers..." rows={4} value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} className={inputClass} />
          </div>
        )}
      </form>

      <div className="p-6 md:p-10 border-t border-white/5 bg-[#0a0a0b] shrink-0 flex flex-col sm:flex-row gap-4 md:gap-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <button 
          type="button" 
          onClick={handleSubmit} 
          className="flex-1 bg-red-700 text-white font-black py-4 md:py-5 rounded-2xl md:rounded-[2rem] hover:bg-red-800 transition-all flex items-center justify-center gap-3 md:gap-4 active:scale-[0.98] shadow-2xl shadow-red-700/40 uppercase tracking-widest text-[10px] md:text-xs border border-red-600/50"
        >
          <Save className="w-5 h-5 md:w-6 md:h-6" /> Commit Record to Storage
        </button>
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-6 md:px-10 bg-white/5 text-gray-400 font-black py-4 md:py-5 rounded-2xl md:rounded-[2rem] border border-white/10 hover:bg-white/10 hover:text-white active:scale-95 transition-all uppercase tracking-widest text-[10px] md:text-xs"
        >
          Discard
        </button>
      </div>
    </div>
  );
};

export default DocumentForm;
