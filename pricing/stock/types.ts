export type Mode = 'BD' | 'JAPAN' | 'COMBINE';

export interface ParseDescriptionResult {
  grade: string;
  color: string;
  milage: string;
  point: string;
  remainingDescription: string;
}

export interface CellStyle {
  font?: any;
  fill?: any;
  border?: any;
  alignment?: any;
  numFmt?: string;
}

export interface CellData {
  colIndex: number;
  colLetter: string;
  value: any;
  formula?: string;
  hyperlink?: string;
  hyperlinkText?: string;
  style: CellStyle;
  note?: string;
}

export interface SheetRow {
  key: string; // CHASSIS for BD, SL NO for Japan
  carName: string;
  status: string;
  section: 'IN_STOCK' | 'STOCK_OUT';
  originalRowNumber?: number;
  height?: number;
  cells: Map<number, CellData>;
  isNew?: boolean;
  isRelocatedToStockOut?: boolean;
}

export interface CarGroup {
  carName: string;
  section: 'IN_STOCK' | 'STOCK_OUT';
  rows: SheetRow[];
}

export interface NewCarRecord {
  key: string;
  carName: string;
  year: string | number;
  price: string | number;
  grade?: string;
  color?: string;
  point?: string;
  milage?: string;
  location?: string;
  status: string;
  sourceSheetTag?: string;
}

export interface FieldChange {
  field: string;
  colName?: string;
  oldValue: any;
  newValue: any;
}

export interface UpdatedCarRecord {
  key: string;
  carName: string;
  changes: FieldChange[];
  formulasRebuilt?: string[];
  noteAdded?: string;
}

export interface StockOutCarRecord {
  key: string;
  carName: string;
  groupName: string;
  previousSection: string;
}

export interface ReconciliationSummary {
  mode: Mode;
  asOfDate: string;
  newCount: number;
  updatedCount: number;
  stockOutCount: number;
  totalRowsCount: number;
  newCars: NewCarRecord[];
  updatedCars: UpdatedCarRecord[];
  stockOutCars: StockOutCarRecord[];
  duplicateCars?: UpdatedCarRecord[];
  warnings: string[];
  outputBlob: Blob;
  outputFilename: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  detail?: string;
}
