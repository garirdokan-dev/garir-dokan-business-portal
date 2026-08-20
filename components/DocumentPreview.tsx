import React from 'react';
import { 
  MapPin, Map, Navigation, Home, 
  Mail, Send, Inbox, MessageSquare, 
  Phone, Smartphone, PhoneCall, Headset, 
  Globe, Link, ExternalLink, Monitor 
} from 'lucide-react';
import { BusinessDocument, DocumentType, FooterSettings, HeaderSettings } from '../types';

interface DocumentPreviewProps {
  document: BusinessDocument;
  containerRef?: React.RefObject<HTMLDivElement>;
  scale?: number;
  footerSettings?: FooterSettings;
  headerSettings?: HeaderSettings;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document, containerRef, scale = 1, footerSettings, headerSettings }) => {
  const { 
    type, docNumber, date, clientName, clientAddress, clientPhone,
    clientDesignation, clientOffice, acName, logoUrl: docLogoUrl, logoSize: docLogoSize = 220, logoPosition: docLogoPosition = 0,
    vehicleTitle, vehicleTitleSize = 16, vehicleTitleAlign = 'left', brand, model, yearModel, color, chassisNumber, engineNumber, auctionPoint, cc, fuel, transmission,
    vehiclePrice, priceInWords, payments, quantity, notes, hiddenFields = [],
    advancedPaidAmount = 0, bankPaymentAmount = 0, bankName = "",
    productImageUrl, items = [], pageSettings
  } = document;

  const h = headerSettings || {
    text: 'Importer & All kinds of Brand new & Reconditioned Vehicles Supplier',
    fontSize: 14,
    fontFamily: 'serif',
    alignment: 'left',
    isItalic: true
  };

  const logoUrl = h.logoUrl || docLogoUrl;
  const logoSize = h.logoSize || docLogoSize;
  const logoPosition = h.logoPosition || docLogoPosition;

  const orientation = pageSettings?.orientation || 'portrait';
  const pageSize = pageSettings?.pageSize || 'a4';

  const getPageDimensions = () => {
    const sizes = {
      a4: { width: 210, height: 297 },
      letter: { width: 215.9, height: 279.4 },
      legal: { width: 215.9, height: 355.6 }
    };
    const base = sizes[pageSize as keyof typeof sizes] || sizes.a4;
    return orientation === 'portrait' 
      ? { width: `${base.width}mm`, height: `${base.height}mm` }
      : { width: `${base.height}mm`, height: `${base.width}mm` };
  };

  const dimensions = getPageDimensions();

  const isHidden = (id: string) => hiddenFields.includes(id);

  const isQuotation = type === DocumentType.QUOTATION;
  const isBill = type === DocumentType.BILL;
  const isChallan = type === DocumentType.CHALLAN;
  const isProInvoice = type === DocumentType.PRO_INVOICE;

  const formattedPrice = vehiclePrice > 0 ? new Intl.NumberFormat('en-IN').format(vehiclePrice) : "0";

  const commonA4Style: React.CSSProperties = {
    fontFamily: '"Times New Roman", Times, serif',
    width: dimensions.width,
    minHeight: dimensions.height,
    padding: '0',
    transform: scale !== 1 ? `scale(${scale})` : 'none',
    transformOrigin: 'top center',
    marginBottom: scale !== 1 ? `-${parseFloat(dimensions.height) * (1 - scale)}mm` : '10px',
    color: '#000000',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    isolation: 'isolate'
  };

  const f = footerSettings || {
    address: 'A.Hamid Road, Pabna',
    email: 'garirdokan2021@gmail.com',
    phone1: '+880 1713 110 570',
    phone2: '+880 1785 2555 86',
    website: 'garirdokan.com'
  };

  const WatermarkOverlay = () => {
    const config = f.watermarks?.[type];
    if (!config || !config.imageUrl) return null;

    return (
      <div 
        style={{
          position: 'absolute',
          top: `calc(50% + ${config.offsetY ?? 0}%)`,
          left: `calc(50% + ${config.offsetX ?? 0}%)`,
          transform: 'translate(-50%, -50%)',
          width: `${config.size ?? 50}%`,
          opacity: (config.opacity ?? 15) / 100,
          zIndex: -1,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <img 
          src={config.imageUrl} 
          alt="Watermark" 
          style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
        />
      </div>
    );
  };

  const renderWebsite = (url: string) => {
    const domain = url.replace(/\s+/g, '');
    return (
      <div className="web-url text-[15px] mt-[5px] tracking-[4px] font-sans text-black lowercase text-center font-bold">
        {domain.split('').map((char, i) => (
          <React.Fragment key={i}>
            <span className={char === 'g' || char === 'd' ? 'text-red-600' : 'text-black'}>{char}</span>
            {i < domain.length - 1 ? ' ' : ''}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const iconMap: Record<string, any> = {
    MapPin, Map, Navigation, Home,
    Mail, Send, Inbox, MessageSquare,
    Phone, Smartphone, PhoneCall, Headset,
    Globe, Link, ExternalLink, Monitor
  };

  const renderFooterIcon = (iconName: string | undefined, DefaultIcon: any) => {
    const Icon = (iconName && iconMap[iconName]) || DefaultIcon;
    return <Icon className="w-3 h-3 text-red-600" />;
  };

  const HeaderBar = ({ marginBottom }: { marginBottom?: string }) => {
    return (
      <div 
        className="w-full bg-[#dedede] py-1 px-4 border-y border-gray-300" 
        style={{ 
          width: '100%', 
          boxSizing: 'border-box', 
          display: 'flex', 
          alignItems: 'center',
          marginBottom: marginBottom !== undefined ? marginBottom : '1.5rem'
        }}
      >
        <div 
          style={{ 
            textAlign: h.alignment || 'left',
            fontSize: `${h.fontSize || 14}px`,
            fontFamily: h.fontFamily === 'serif' ? 'serif' : h.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
            fontStyle: h.isItalic ? 'italic' : 'normal',
            color: '#374151',
            fontWeight: '600',
            lineHeight: '1.2',
            width: '100%',
            letterSpacing: '0',
            wordSpacing: '0',
            whiteSpace: 'normal',
            wordBreak: 'break-word'
          }}
        >
          {h.text}
        </div>
      </div>
    );
  };

  const Footer = () => (
    <div 
      className="footer-container absolute left-0 right-0 text-center z-10 text-black"
      style={{ 
        bottom: `${f.bottomOffset ?? 10}mm`, 
        paddingLeft: `${f.horizontalPadding ?? 15}mm`, 
        paddingRight: `${f.horizontalPadding ?? 15}mm`,
        paddingTop: `${f.topPadding ?? 0}mm`,
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center'
      }}
    >
      <div className="h-px bg-red-600/30 w-full" style={{ marginBottom: `${f.lineSpacing ?? 3}mm`, width: '100%' }}></div>
      <div className="text-[11px] text-black font-bold" style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', margin: '0 10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>{renderFooterIcon(f.addressIcon, MapPin)}</span>
            <span>{f.address}</span>
          </span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', margin: '0 10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>{renderFooterIcon(f.emailIcon, Mail)}</span>
            <span>{f.email}</span>
          </span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', margin: '0 10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>{renderFooterIcon(f.phone1Icon, Phone)}</span>
            <span>{f.phone1}</span>
          </span>
        </div>
        {f.phone2 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', margin: '0 10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>{renderFooterIcon(f.phone2Icon, Phone)}</span>
              <span>{f.phone2}</span>
            </span>
          </div>
        )}
      </div>
      {renderWebsite(f.website)}
    </div>
  );

  // Render Product Invoice (Multi-row variant)
  if (isProInvoice) {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalPaid = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = subtotal - totalPaid;
    const showImageColumn = !isHidden('itemImageColumn');

    const proInvoiceStyle: React.CSSProperties = {
      ...commonA4Style,
      fontFamily: '"Segoe UI", Arial, sans-serif',
      width: dimensions.width,
    };

    return (
      <div className="bg-gray-100 p-4 overflow-auto flex justify-center w-full print-doc-preview-wrapper">
        <div ref={containerRef} className="a4-page shadow-2xl relative bg-white !text-black" style={proInvoiceStyle}>
          <WatermarkOverlay />
          <div className="pt-[5mm] mb-[5px] w-full" style={{ width: '100%', display: 'block', overflow: 'hidden' }}>
            <div className="logo-container" style={{ width: `${logoSize}px`, marginLeft: `${logoPosition}px`, float: 'left' }}>
              {logoUrl && <img src={logoUrl} alt="Logo" className="w-full block" />}
            </div>
            <div style={{ clear: 'both' }}></div>
          </div>
          <HeaderBar />
          
          <div className="main-content px-[15mm] text-black pb-[30mm]" style={{ width: '100%', display: 'block', minHeight: '220mm', boxSizing: 'border-box', fontFamily: 'Poppins, sans-serif' }}>
            <div className="mb-6 border-b-[1.5px] border-black text-black pb-1" style={{ width: '100%', display: 'block', overflow: 'hidden' }}>
              <div style={{ float: 'left' }}>
                <h1 className="m-0 text-[32px] font-normal text-black uppercase whitespace-nowrap" style={{ lineHeight: '1', letterSpacing: '0', fontFamily: 'Poppins, sans-serif' }}>INVOICE</h1>
              </div>
              <div style={{ float: 'right', marginTop: '15px' }}>
                <div className="text-[11px] font-normal text-black uppercase whitespace-nowrap" style={{ letterSpacing: '1px', fontFamily: 'Poppins, sans-serif' }}>CUSTOMER COPY</div>
              </div>
              <div style={{ clear: 'both' }}></div>
            </div>

            <div className="mb-8" style={{ width: '100%', display: 'block' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#000000' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '65%', verticalAlign: 'top', paddingRight: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '110px', fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Buyer's Name</td>
                            <td style={{ width: '15px', padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ fontWeight: 'bold', textTransform: 'uppercase', padding: '3px 0', verticalAlign: 'top' }}>{clientName || '---'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Phone</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{clientPhone || '---'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Address</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ textTransform: 'capitalize', padding: '3px 0', verticalAlign: 'top', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>{clientAddress || '---'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td style={{ width: '35%', verticalAlign: 'top', textAlign: 'right' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                        <tbody>
                          <tr>
                            <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold' }}>
                              <span style={{ marginRight: '8px' }}>DATE:</span>
                              <span>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold' }}>
                              <span style={{ marginRight: '8px' }}>Invoice no.:</span>
                              <span>{docNumber}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="w-full border-collapse text-black" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr className="bg-white border-y-[1.5px] border-black">
                  <th className="p-2.5 text-center font-bold uppercase text-[12px] text-black" style={{ width: '10%', letterSpacing: '0' }}>SL NO</th>
                  <th className="p-2.5 text-left font-bold uppercase text-[12px] text-black" style={{ width: showImageColumn ? '32%' : '48%', paddingLeft: '15px', letterSpacing: '0' }}>DESCRIPTION</th>
                  {showImageColumn && <th className="p-2.5 text-center font-bold uppercase text-[12px] text-black" style={{ width: '16%', letterSpacing: '0' }}>IMAGE</th>}
                  <th className="p-2.5 text-center font-bold uppercase text-[12px] text-black" style={{ width: '10%', letterSpacing: '0' }}>QTY</th>
                  <th className="p-2.5 text-right font-bold uppercase text-[12px] text-black" style={{ width: '17%', paddingRight: '15px', letterSpacing: '0' }}>UNIT PRICE</th>
                  <th className="p-2.5 text-right font-bold uppercase text-[12px] text-black" style={{ width: '17%', paddingRight: '15px', letterSpacing: '0' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, index) => (
                  <tr key={item.id} className="text-black border-b border-gray-100 last:border-black last:border-b-[1.5px]">
                    <td className="p-3 text-center align-middle font-bold text-[13px] text-black whitespace-nowrap">{(index + 1).toString().padStart(2, '0')}</td>
                    <td className="p-3 align-middle font-bold pl-4 text-[14px] text-black uppercase overflow-hidden">
                      {item.description}
                    </td>
                    {showImageColumn && (
                      <td className="p-3 text-center align-middle">
                        {item.imageUrl && (
                          <div className={`mx-auto rounded-lg overflow-hidden border border-gray-100 shadow-sm ${
                            item.imageSize === 'small' ? 'w-10 h-10' : 
                            item.imageSize === 'medium' ? 'w-14 h-14' : 
                            'w-20 h-20'
                          }`}>
                            <img src={item.imageUrl} alt="Product" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </td>
                    )}
                    <td className="p-3 text-center align-middle font-bold text-[14px] text-black">{item.quantity}</td>
                    <td className="p-3 text-right align-middle font-bold pr-4 text-[14px] text-black">{item.unitPrice.toLocaleString()}/-</td>
                    <td className="p-3 text-right align-middle font-black pr-4 text-[15px] text-black">{(item.quantity * item.unitPrice).toLocaleString()}/-</td>
                  </tr>
                )) : (
                  <tr className="h-[100px] text-black border-b-[1.5px] border-black">
                    <td colSpan={showImageColumn ? 6 : 5} className="text-center text-black font-bold italic align-middle">No items added to invoice</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ width: '100%', marginTop: '30px', clear: 'both' }}>
              <table style={{ width: '320px', float: 'right', borderCollapse: 'collapse', color: 'black', fontSize: '15px', fontWeight: 'bold' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px 15px', textTransform: 'uppercase', width: '160px' }}>Subtotal:</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', width: '160px' }}>{subtotal.toLocaleString()}/-</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px 15px', textTransform: 'uppercase' }}>Total Paid:</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid #9ca3af' }}>{totalPaid.toLocaleString()}/-</td>
                  </tr>
                  <tr style={{ fontSize: '17px' }}>
                    <td style={{ textAlign: 'right', padding: '8px 15px 4px 15px', textTransform: 'uppercase' }}>Balance:</td>
                    <td style={{ textAlign: 'right', padding: '8px 0 4px 0', color: '#b91c1c' }}>৳ {balance.toLocaleString()}/-</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ clear: 'both' }}></div>
            </div>
          </div>

          <Footer />
        </div>
      </div>
    );
  }

  // Render Delivery Challan
  if (isChallan) {
    const challanStyle: React.CSSProperties = {
      ...commonA4Style,
      fontFamily: "'Courier Prime', monospace",
      color: '#000000',
      width: dimensions.width,
    };

    return (
      <div className="bg-gray-100 p-4 overflow-auto flex justify-center w-full print-doc-preview-wrapper">
        <div ref={containerRef} className="a4-page shadow-2xl relative overflow-hidden bg-white !text-black" style={challanStyle}>
          <WatermarkOverlay />
          <div className="pt-[5mm] mb-[5px] w-full relative text-black" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div className="logo-container" style={{ width: `${logoSize}px`, marginLeft: `${logoPosition}px`, flexShrink: 0 }}>
              {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: '100%', display: 'block' }} />}
            </div>
            <div style={{ textAlign: 'right', paddingRight: '15mm', flexShrink: 0 }}>
              <div style={{ color: '#d1d3d4', fontSize: '42px', fontFamily: 'sans-serif', fontWeight: '300', lineHeight: '1', letterSpacing: '2px', marginBottom: '2px' }}>DELIVERY</div>
              <div style={{ color: '#d1d3d4', fontSize: '42px', fontFamily: 'sans-serif', fontWeight: '300', lineHeight: '1', letterSpacing: '2px' }}>CHALLAN</div>
            </div>
          </div>

          <HeaderBar />

          <div className="main-content px-[15mm] text-black pb-[30mm]" style={{ width: '100%', display: 'block', minHeight: '220mm', boxSizing: 'border-box' }}>
            <div className="mb-8" style={{ width: '100%', display: 'block' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', color: 'black' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top' }}>
                      <div style={{ color: '#4b5563', marginBottom: '2px' }}>Invoice No:</div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#000000', marginBottom: '15px' }}>#{docNumber}</div>
                      <div style={{ color: '#4b5563', marginBottom: '2px' }}>Date Issued:</div>
                      <div style={{ fontWeight: 'bold', color: '#000000' }}>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px' }}>
                      <div style={{ color: '#4b5563', marginBottom: '4px' }}>Issued to:</div>
                      <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#000000', fontSize: '16px', marginBottom: '6px' }}>{clientName}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '70px', color: '#4b5563', padding: '2px 0', verticalAlign: 'top' }}>Cell</td>
                            <td style={{ width: '15px', color: '#4b5563', padding: '2px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ color: '#000000', fontWeight: 'bold', padding: '2px 0', verticalAlign: 'top' }}>{clientPhone}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#4b5563', padding: '2px 0', verticalAlign: 'top' }}>Address</td>
                            <td style={{ color: '#4b5563', padding: '2px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ color: '#000000', textTransform: 'capitalize', fontWeight: 'bold', padding: '2px 0', verticalAlign: 'top', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>{clientAddress}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="w-full border-collapse mb-8 border border-[#bcbec0] text-black" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr className="bg-[#f1f2f2] text-black">
                  <th style={{ border: '1px solid #bcbec0', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', width: '80px', textTransform: 'uppercase' }}>NO</th>
                  <th style={{ border: '1px solid #bcbec0', padding: '10px 20px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>DESCRIPTION</th>
                  <th style={{ border: '1px solid #bcbec0', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', width: '120px', textTransform: 'uppercase' }}>QTY</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ minHeight: '350px' }}>
                  <td style={{ border: '1px solid #bcbec0', padding: '15px', textAlign: 'center', verticalAlign: 'top' }}>1</td>
                  <td style={{ border: '1px solid #bcbec0', padding: '20px', verticalAlign: 'top' }}>
                    <div 
                      style={{ 
                        textTransform: 'uppercase', 
                        fontWeight: 'bold', 
                        marginBottom: '20px', 
                        lineHeight: '1.2', 
                        fontSize: `${vehicleTitleSize}px`, 
                        textAlign: vehicleTitleAlign || 'left' as any,
                        letterSpacing: '0px'
                      }}
                    >
                      {vehicleTitle}
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', marginTop: '15px' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '160px', fontWeight: 'bold', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>| COLOR</td>
                          <td style={{ width: '20px', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>:</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>{color}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>| MODEL</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>:</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>{yearModel}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>| Engine No</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>:</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>{engineNumber}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>| AUCTION POINT</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>:</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>{auctionPoint || '---'}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 'bold', padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>| Chassis No</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>:</td>
                          <td style={{ padding: '6px 0', borderBottom: '1px dashed #e5e7eb' }}>{chassisNumber}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ border: '1px solid #bcbec0', padding: '15px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '18px' }}>
                    {quantity < 10 ? `0${quantity}` : quantity}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-10 text-black">
              <h3 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '15px' }}>Customer Acknowledgment of Vehicle Condition:</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6', textAlign: 'justify', marginBottom: '30px', letterSpacing: '0px', wordSpacing: '0.5px' }}>
                I, {clientName}, hereby acknowledge that I have received the vehicle with all the required paper documentation and I confirm that the vehicle has been delivered in complete and good condition. I have inspected the vehicle and found it to be satisfactory in all aspects, including its physical and mechanical condition. I have no complaints regarding the state of the vehicle at the time of delivery.
              </p>
            </div>

            <div style={{ width: '100%', marginTop: '60px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', textAlign: 'left', verticalAlign: 'top' }}>
                      <div style={{ width: '220px', textAlign: 'center', borderTop: '1px solid #000000', paddingTop: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'black' }}>Received By</span>
                      </div>
                    </td>
                    <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'top' }}>
                      <div style={{ width: '220px', display: 'inline-block', textAlign: 'center', borderTop: '1px solid #000000', paddingTop: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'black' }}>Proprietor</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Footer />
        </div>
      </div>
    );
  }

  // Render Bill
  if (isBill) {
    return (
      <div className="bg-gray-100 p-4 overflow-auto flex justify-center w-full print-doc-preview-wrapper">
        <div ref={containerRef} className="a4-page shadow-2xl relative bg-white !text-black" style={{...commonA4Style, width: dimensions.width}}>
          <WatermarkOverlay />
          <div className="flex pt-[5mm] mb-[5px] w-full text-black" style={{ width: '100%' }}>
            <div className="logo-container" style={{ width: `${logoSize}px`, marginLeft: `${logoPosition}px`, flexShrink: 0 }}>
              {logoUrl && <img src={logoUrl} alt="Logo" className="w-full block" />}
            </div>
          </div>
          <HeaderBar />
          <div className="main-content px-[20mm] text-black pb-[30mm]" style={{ width: '100%', display: 'block', minHeight: '220mm', boxSizing: 'border-box' }}>
            <div className="text-center font-bold uppercase mb-[15px] text-[22px] text-black" style={{ marginTop: '-10px' }}>BILL</div>
            <div className="mb-[25px] leading-[1.2] text-[17px] text-black" style={{ width: '100%', display: 'block' }}>
              To,<br />
              <div className="text-black" style={{ width: '100%', display: 'block' }}>
                <div className="text-black" style={{ display: 'block' }}>{acName ? `A/C: ${acName}` : clientName}</div>
                {clientDesignation && <div className="text-black" style={{ display: 'block' }}>{clientDesignation},</div>}
                {clientOffice && <div className="text-black" style={{ display: 'block' }}>{clientOffice}</div>}
                <div className="whitespace-pre-wrap text-black capitalize" style={{ display: 'block' }}>{clientAddress}</div>
              </div>
            </div>
            <div className="font-bold mb-[30px] text-black" style={{ fontSize: `${vehicleTitleSize}px`, display: 'block' }}>Sub: Bill for {vehicleTitle}</div>
            
            <div className="relative text-black" style={{ width: '100%', display: 'block' }}>
              <table className="w-full border-collapse mb-[25px] border border-black relative z-[1] text-black" style={{ width: '100%' }}>
                <thead>
                  <tr className="bg-white h-[45px] text-black">
                    <th className="border border-black p-2 text-center font-bold w-[55%] text-[17px] text-black bg-white uppercase">DESCRIPTION OF VEHICLE</th>
                    <th className="border border-black p-2 text-center font-bold w-[15%] text-[17px] text-black bg-white uppercase">Unit</th>
                    <th className="border border-black p-2 text-center font-bold w-[30%] text-[16px] text-black bg-white uppercase whitespace-nowrap">TOTAL AMOUNT (TK)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-black">
                    <td className="border-x border-black px-6 pt-6 pb-6 align-top text-black">
                      <div className="specs-block text-[18px] text-black" style={{ width: '100%', display: 'block' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '140px', fontWeight: 'bold', padding: '2.5px 0', verticalAlign: 'top' }}>Vehicle</td>
                              <td style={{ width: '25px', padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                              <td style={{ fontWeight: 'bold', padding: '2.5px 0', verticalAlign: 'top' }}>{formattedPrice}/-</td>
                            </tr>
                            {!isHidden('yearModel') && (
                              <tr>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>Year</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>{yearModel}</td>
                              </tr>
                            )}
                            {!isHidden('cc') && (
                              <tr>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>CC.</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>{cc}</td>
                              </tr>
                            )}
                            {!isHidden('engineNumber') && (
                              <tr>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>Engine No.</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>{engineNumber}</td>
                              </tr>
                            )}
                            {!isHidden('chassisNumber') && (
                              <tr>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>Chassis No</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>{chassisNumber}</td>
                              </tr>
                            )}
                            {!isHidden('color') && (
                              <tr>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>Color</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>:</td>
                                <td style={{ padding: '2.5px 0', verticalAlign: 'top' }}>{color}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </td>
                    <td className="border-x border-black px-3 pt-6 text-center align-middle font-bold text-[22px] text-black">
                      {quantity < 10 ? `0${quantity}` : quantity}
                    </td>
                    <td className="border-x border-black px-6 pt-6 text-right align-middle text-[20px] text-black font-bold"></td>
                  </tr>
                  <tr className="text-black h-[40px] border-t border-black">
                    <td colSpan={2} className="border-r border-black px-6 text-left text-[16px] text-black align-middle">
                      Advance Paid By Customer
                    </td>
                    <td className="px-6 text-right text-[17px] text-black align-middle font-bold">
                      {advancedPaidAmount > 0 ? `${new Intl.NumberFormat('en-IN').format(advancedPaidAmount)}/-` : '-'}
                    </td>
                  </tr>
                  <tr className="text-black h-[40px] border-t border-black">
                    <td colSpan={2} className="border-r border-black px-6 text-left text-[16px] text-black align-middle">
                      Paid by {bankName || 'Bank Name'}
                    </td>
                    <td className="px-6 text-right text-[17px] text-black align-middle font-bold">
                      {bankPaymentAmount > 0 ? `${new Intl.NumberFormat('en-IN').format(bankPaymentAmount)}/-` : '-'}
                    </td>
                  </tr>
                  <tr className="font-bold border-t border-black text-black h-[55px]">
                    <td colSpan={2} className="border border-black px-6 text-left text-[18px] uppercase text-black align-middle">NET PRICE IN TAKA</td>
                    <td className="border border-black px-6 text-right text-[20px] text-black align-middle">{formattedPrice}/-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-[19px] mt-[25px] text-black" style={{ display: 'block' }}>
              <span className="font-bold text-black">Price in words : {priceInWords}</span>
            </div>
            <div className="text-[19px] font-bold text-black mt-[25px]" style={{ display: 'block' }}>
              Yours Faithfully,
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // Render Quotation 
  if (isQuotation) {
    const challanStyle: React.CSSProperties = {
      ...commonA4Style,
      fontFamily: '"Segoe UI", Arial, sans-serif',
      width: dimensions.width,
    };

    return (
      <div className="bg-gray-100 p-4 overflow-auto flex justify-center w-full print-doc-preview-wrapper">
        <div ref={containerRef} className="a4-page shadow-2xl relative overflow-hidden bg-white !text-black" style={challanStyle}>
          <WatermarkOverlay />
          <div className="pt-[5mm] mb-[5px] w-full relative text-black" style={{ width: '100%', display: 'block', overflow: 'visible' }}>
            <div style={{ float: 'left', width: `${logoSize}px`, marginLeft: `${logoPosition}px` }}>
              {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: '100%', display: 'block' }} />}
            </div>
            <div style={{ clear: 'both' }}></div>
          </div>

          <HeaderBar marginBottom="0px" />

          <div className="main-content px-[20mm] text-black pb-[30mm]" style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Poppins, sans-serif' }}>
            <div 
              style={{ 
                fontWeight: 'bold', 
                textTransform: 'uppercase', 
                marginTop: '20px', 
                marginBottom: '20px', 
                fontSize: `${vehicleTitleSize}px`, 
                textAlign: 'center',
                lineHeight: '1.2'
              }}
            >
              QUOTATION FOR <span className="uppercase text-black">{vehicleTitle}</span>
            </div>
            
            <div className="mb-[15px]" style={{ width: '100%', display: 'block' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', color: 'black' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '65%', verticalAlign: 'top' }}>
                      To,<br />
                      {clientDesignation && <span className="text-black">{clientDesignation}<br /></span>}
                      {clientOffice && <span className="text-black">{clientOffice}<br /></span>}
                      {clientAddress && <div className="whitespace-pre-wrap text-black capitalize">{clientAddress}</div>}
                      {acName && <div className="mt-1 text-black font-bold">A/C: {acName}</div>}
                    </td>
                    <td style={{ width: '35%', verticalAlign: 'top', textAlign: 'right' }}>
                      {!isHidden('date') && <div>Date: {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</div>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '7.5px' }} className="text-[15px] text-black">
              Dear Sir,<br />
              <span style={{ display: 'block', marginTop: '2.5px', fontSize: '14px', textAlign: 'justify', textAlignLast: 'justify' }}>We have the pleasure to offer you the under mentioned vehicle with the following terms & conditions.</span>
            </div>
            <div className="relative text-black">
               <table className="main-table w-full border-collapse mb-[15px] border border-black relative z-[1] text-black">
                <thead>
                  <tr className="text-black bg-transparent">
                    <th className="border border-black p-2 text-center font-bold w-[65%] text-[15px] text-black uppercase">DESCRIPTION OF VEHICLE</th>
                    <th className="border border-black p-2 text-center font-bold w-[10%] text-[15px] text-black uppercase">QTY</th>
                    <th className="border border-black p-2 text-center font-bold w-[25%] text-[15px] text-black whitespace-nowrap uppercase">TOTAL AMOUNT (TK)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-black">
                    <td className="border border-black p-2 align-top text-black">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '19px', color: 'black' }}>
                        <tbody>
                          {!isHidden('brand') && (
                            <tr>
                              <td style={{ width: '120px', fontWeight: 'bold', padding: '1.5px 0' }}>Brand Name</td>
                              <td style={{ width: '20px', padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{brand}</td>
                            </tr>
                          )}
                          {!isHidden('model') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Model</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{model}</td>
                            </tr>
                          )}
                          {!isHidden('yearModel') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Year Model</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{yearModel}</td>
                            </tr>
                          )}
                          {!isHidden('color') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Color</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{color}</td>
                            </tr>
                          )}
                          {!isHidden('chassisNumber') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Chassis No</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{chassisNumber}</td>
                            </tr>
                          )}
                          {!isHidden('engineNumber') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Engine No</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{engineNumber}</td>
                            </tr>
                          )}
                          {!isHidden('cc') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>C.C</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{cc}</td>
                            </tr>
                          )}
                          {!isHidden('fuel') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Fuel</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{fuel}</td>
                            </tr>
                          )}
                          {!isHidden('transmission') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '1.5px 0' }}>Transmission</td>
                              <td style={{ padding: '1.5px 0' }}>:</td>
                              <td style={{ padding: '1.5px 0' }}>{transmission}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                    <td className="border border-black p-2 text-center align-middle text-black">{!isHidden('quantity') && (quantity < 10 ? `0${quantity}` : quantity)}</td>
                    <td className="border border-black p-2 text-right text-[18px] font-bold align-middle text-black">{formattedPrice}/-</td>
                  </tr>
                  <tr className="net-price-row font-bold text-black">
                    <td colSpan={2} className="border border-black p-2 text-left uppercase text-[15px] text-black">NET PRICE IN TAKA</td>
                    <td className="border border-black p-2 text-right text-[16px] text-black">{formattedPrice}/-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="price-words-row mb-[15px] text-[15px] text-black"><span className="font-bold text-black">Price in words :</span> {priceInWords}</div>
            {notes && (<div className="accessories-box mt-[10px] mb-[15px] leading-[1.4] text-justify text-[14px] text-black"><span className="font-bold text-black">Fitting Accessories:</span> {notes}</div>)}
            <div className="mt-[10px] text-[15px] leading-[1.4] text-black"><p className="text-black">Price excluding REGISTRATION cost.<br /><span className="font-bold uppercase text-black">Yours Faithfully,</span></p></div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // Invoice Render (Default Standard / CAR SALE INVOICE)
  const totalPaidAmount = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const balanceAmount = (vehiclePrice || 0) - totalPaidAmount;

  return (
    <div className="bg-gray-100 p-4 overflow-auto flex justify-center w-full print-doc-preview-wrapper">
      <div 
        ref={containerRef} 
        className="a4-page shadow-2xl relative bg-white !text-black" 
        style={{ 
          fontFamily: '"Segoe UI", Arial, sans-serif',
          width: dimensions.width,
          minHeight: dimensions.height,
          padding: '0', 
          transform: scale !== 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'top center',
          marginBottom: scale !== 1 ? `-${parseFloat(dimensions.height) * (1 - scale)}mm` : '10px',
          color: '#000000',
          position: 'relative',
          backgroundColor: 'white',
          boxSizing: 'border-box',
          isolation: 'isolate'
        }}
      >
        <WatermarkOverlay />
        <div className="text-black" style={{ width: '100%' }}>
          <div className="pt-[5mm] mb-[5px] w-full text-black" style={{ width: '100%', display: 'block', overflow: 'hidden' }}>
            <div className="logo-container" style={{ width: `${logoSize}px`, marginLeft: `${logoPosition}px`, float: 'left' }}>
              {logoUrl && <img src={logoUrl} alt="Logo" className="w-full block" />}
            </div>
            <div style={{ clear: 'both' }}></div>
          </div>
          <HeaderBar />
          <div className="px-[15mm] pt-[5mm] text-black pb-[30mm]" style={{ width: '100%', display: 'block', minHeight: '220mm', boxSizing: 'border-box' }}>
            <div className="mb-4 relative text-black border-b border-black" style={{ width: '100%', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 className="m-0 text-[32px] font-normal text-black whitespace-nowrap" style={{ lineHeight: '1', fontFamily: 'Poppins, sans-serif' }}>INVOICE</h1>
              <div className="text-[11px] font-normal text-black uppercase whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>CUSTOMER COPY</div>
            </div>

            <div className="mb-8" style={{ width: '100%', display: 'block' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#000000' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '62%', verticalAlign: 'top', paddingRight: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                        <tbody>
                          {!isHidden('clientName') && (
                            <tr>
                              <td style={{ width: '110px', fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Buyer's Name</td>
                              <td style={{ width: '15px', padding: '3px 0', verticalAlign: 'top' }}>:</td>
                              <td style={{ fontWeight: 'bold', textTransform: 'uppercase', padding: '3px 0', verticalAlign: 'top' }}>{clientName}</td>
                            </tr>
                          )}
                          {!isHidden('clientPhone') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Phone</td>
                              <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                              <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{clientPhone}</td>
                            </tr>
                          )}
                          {!isHidden('clientAddress') && (
                            <tr>
                              <td style={{ fontWeight: 'bold', padding: '3px 0', verticalAlign: 'top' }}>Address</td>
                              <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                              <td style={{ textTransform: 'capitalize', padding: '3px 0', verticalAlign: 'top', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>{clientAddress}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                    <td style={{ width: '38%', verticalAlign: 'top', textAlign: 'right' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                        <tbody>
                          <tr>
                            <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold' }}>
                              <span style={{ marginRight: '8px' }}>DATE:</span>
                              <span>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold' }}>
                              <span style={{ marginRight: '8px' }}>Invoice no.:</span>
                              <span>{docNumber}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="w-full border-collapse text-black" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr className="text-black">
                  <th className="border-y-[1.5px] border-black py-2.5 pl-[20px] pr-1.5 text-left text-[14px] font-bold text-black bg-white border-x-0 uppercase" style={{ width: '45%' }}><div style={{ display: 'flex', alignItems: 'center' }}>DESCRIPTION</div></th>
                  <th className="border-y-[1.5px] border-black py-2.5 px-1.5 text-left text-[14px] font-bold text-black bg-white border-x-0 uppercase" style={{ width: '35%' }}><div style={{ display: 'flex', alignItems: 'center' }}>PAYMENT DATE</div></th>
                  <th className="border-y-[1.5px] border-black py-2.5 px-1.5 text-right text-[14px] font-bold text-black bg-white border-x-0 uppercase" style={{ width: '20%' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>AMOUNT</div></th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-black">
                  <td className="w-[45%] align-top pt-4 pr-3 pb-8 text-black" style={{ verticalAlign: 'top', borderBottom: '1.5px solid #000000', paddingBottom: '30px' }}>
                    {!isHidden('vehicleTitle') && <span className="font-bold uppercase mb-4 block leading-tight text-black" style={{ fontSize: `${vehicleTitleSize}px`, display: 'block' }}>{vehicleTitle}</span>}
                    {productImageUrl && (
                      <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 max-w-[200px] shadow-sm" style={{ display: 'block' }}>
                        <img src={productImageUrl} alt="Product" className="w-full h-auto block" />
                      </div>
                    )}
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: 'black', marginTop: '10px' }}>
                      <tbody>
                        {!isHidden('model') && (
                          <tr>
                            <td style={{ width: '90px', padding: '3px 0', verticalAlign: 'top' }}>Model</td>
                            <td style={{ width: '15px', padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{model}</td>
                          </tr>
                        )}
                        {!isHidden('color') && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>Color</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{color}</td>
                          </tr>
                        )}
                        {!isHidden('cc') && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>CC</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{cc}</td>
                          </tr>
                        )}
                        {!isHidden('chassisNumber') && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>Chassis no</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{chassisNumber}</td>
                          </tr>
                        )}
                        {!isHidden('engineNumber') && (
                          <tr>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>Engine no</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>:</td>
                            <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{engineNumber}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {!isHidden('vehiclePrice') && (
                      <div className="text-black" style={{ marginTop: '20px', display: 'block' }}>
                        <strong className="text-[15px] text-black" style={{ display: 'block' }}>Car price : {vehiclePrice.toLocaleString()}/-</strong>
                        <span className="text-[13px] font-normal text-black" style={{ display: 'block', marginTop: '4px' }}>(Excluding registration fee)</span>
                      </div>
                    )}
                  </td>
                  <td colSpan={2} className="p-0 align-top border-l border-gray-200 text-black pb-8" style={{ verticalAlign: 'top', width: '55%', borderBottom: '1.5px solid #000000', paddingBottom: '30px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {payments?.map((p, index) => (
                          <tr key={p.id} style={{ borderBottom: index === payments.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                            <td className="py-3 px-3 text-[13px] text-black" style={{ width: '63.6%', textAlign: 'left', verticalAlign: 'top' }}>
                              {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
                            </td>
                            <td className="py-3 px-3 text-right text-black font-bold text-[13px]" style={{ width: '36.4%', textAlign: 'right', verticalAlign: 'top' }}>
                              <div className="text-black font-bold">{p.amount.toLocaleString()}/-</div>
                              <div className="text-[11px] text-[#555] italic font-normal uppercase mt-0.5">{p.note}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ width: '100%', marginTop: '0px', paddingTop: '15px' }}>
              <table style={{ width: '320px', float: 'right', borderCollapse: 'collapse', color: 'black', fontSize: '15px', fontWeight: 'bold' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px 15px', width: '160px' }}>Total Paid:</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid #ddd', width: '160px' }}>{totalPaidAmount.toLocaleString()}/-</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px 15px' }}>Balance:</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', borderBottom: '1px solid #ddd' }}>{balanceAmount.toLocaleString()}/-</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ clear: 'both' }}></div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
