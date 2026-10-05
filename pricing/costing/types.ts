export interface RaitaRow {
  raitaSlNo: string | number;
  carName: string;
  year: number;
  description: string;
  priceUsd: number;
  originalIndex: number;
}

export interface DutyRecord {
  vehicle: string;
  model: string; // chassis code, e.g. 6AA-NKE165
  cc: string | number;
  year: number;
  yBookValue?: string | number;
  invoiceValue?: string | number;
  dutyValues: { [key: string]: number }; // column name -> duty value
  isHybrid: boolean;
  sourceSheet: string;
}

export interface BracketRule {
  min: number;
  max: number;
  cost: number;
}

export interface CalculatedRow {
  raitaSlNo: string | number;
  slNo: string; // formula: =5&A4
  carName: string;
  year: number;
  description: string;
  priceUsd: number;
  priceBdt: number; // G5 * rate
  driverCnf: number; // 50000
  duty: number; // matched duty
  dutyModelMatched?: string; // model that was matched in the duty sheet
  totalCosting: number; // priceBdt + driverCnf + duty
  additionalCost: number; // based on bracket
  finalPrice: number; // totalCosting + additionalCost
  isManualMatched?: boolean;
}
