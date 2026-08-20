
import React from 'react';
import { 
  FileText, 
  FileCheck, 
  Receipt, 
  Truck, 
  LayoutDashboard
} from 'lucide-react';
import { DocumentType } from './types';

export const DOC_TYPES_CONFIG = {
  [DocumentType.INVOICE]: {
    label: 'CAR SALE INVOICE',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    prefix: 'INV'
  },
  [DocumentType.QUOTATION]: {
    label: 'QUOTATION',
    icon: <FileCheck className="w-5 h-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    prefix: 'QTN'
  },
  [DocumentType.BILL]: {
    label: 'Purchase Bill',
    icon: <Receipt className="w-5 h-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    prefix: 'BIL'
  },
  [DocumentType.CHALLAN]: {
    label: 'Delivery Challan',
    icon: <Truck className="w-5 h-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    prefix: 'CHL'
  },
  [DocumentType.PRO_INVOICE]: {
    label: 'PRODUCT Invoice',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    prefix: 'PRO'
  }
};

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  ...Object.values(DocumentType).map(type => ({
    id: type,
    label: DOC_TYPES_CONFIG[type].label,
    icon: DOC_TYPES_CONFIG[type].icon
  }))
];
