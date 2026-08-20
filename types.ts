
export enum DocumentType {
  INVOICE = 'INVOICE',
  QUOTATION = 'QUOTATION',
  BILL = 'BILL',
  CHALLAN = 'CHALLAN',
  PRO_INVOICE = 'PRO_INVOICE'
}

export enum AssetType {
  LOGO = 'LOGO',
  ICON = 'ICON',
  SIGNATURE = 'SIGNATURE',
  PRODUCT = 'PRODUCT',
  BANNER = 'BANNER'
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  dataUrl: string;
  createdAt: number;
}

export interface PaymentEntry {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  imageUrl?: string;
  imageSize: 'small' | 'medium' | 'large';
  quantity: number;
  unitPrice: number;
}

export interface WatermarkConfig {
  imageUrl?: string;
  size?: number; // width in percentage (e.g. 10 to 100)
  opacity?: number; // opacity in percentage (e.g. 0 to 100)
  offsetX?: number; // horizontal offset in percentage (e.g. -100 to 100)
  offsetY?: number; // vertical offset in percentage (e.g. -100 to 100)
}

export interface FooterSettings {
  address: string;
  addressIcon?: string;
  email: string;
  emailIcon?: string;
  phone1: string;
  phone1Icon?: string;
  phone2: string;
  phone2Icon?: string;
  website: string;
  websiteIcon?: string;
  bottomOffset?: number;
  topPadding?: number;
  horizontalPadding?: number;
  lineSpacing?: number;
  watermarks?: Record<string, WatermarkConfig>;
}

export interface HeaderSettings {
  text: string;
  fontSize: number;
  fontFamily: string;
  alignment: 'left' | 'center' | 'right';
  isItalic: boolean;
  logoUrl?: string;
  logoSize?: number;
  logoPosition?: number;
}

export interface HeroSettings {
  selectedImages: string[];
  transitionEffect: 'fade' | 'slide' | 'zoom';
  interval: number;
  backgroundPosition: string;
  imagePositions?: Record<string, { x: number; y: number }>;
  removedImages?: string[];
}

export interface PageSettings {
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter' | 'legal';
}

export interface BusinessDocument {
  id: string;
  type: DocumentType;
  docNumber: string;
  date: string;
  logoUrl?: string;
  logoSize?: number;
  logoPosition?: number;
  clientName: string;
  clientDesignation?: string;
  clientOffice?: string;
  clientAddress: string;
  clientPhone?: string;
  acName?: string;
  vehicleTitle?: string;
  vehicleTitleSize?: number;
  // Added vehicleTitleAlign to fix type errors in components
  vehicleTitleAlign?: 'left' | 'center' | 'right' | 'justify';
  brand?: string;
  model?: string;
  yearModel?: string;
  color?: string;
  chassisNumber?: string;
  engineNumber?: string;
  auctionPoint?: string;
  cc?: string;
  fuel?: string;
  transmission?: string;
  vehiclePrice: number;
  priceInWords?: string;
  payments: PaymentEntry[];
  advancedPaidAmount?: number;
  bankPaymentAmount?: number;
  bankName?: string;
  quantity: number;
  taxRate: number;
  notes?: string;
  bankDetails?: string;
  validUntil?: string;
  createdAt: number;
  updatedAt?: number;
  hiddenFields?: string[];
  productImageUrl?: string;
  items?: InvoiceItem[];
  pageSettings?: PageSettings;
}
