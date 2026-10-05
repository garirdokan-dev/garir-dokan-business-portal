import * as XLSX from 'xlsx';
import { RaitaRow, DutyRecord } from '../types';

// Helper to normalize strings for comparison
export function cleanString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

// Normalize month column names to prevent multi-sheet variation mismatches
// e.g. "FEB 26", "FEB-26", "FEB'26", "FEBRUARY 2026", "FEB. 26" -> "FEB-26"
export function normalizeMonthKey(month: string): string {
  if (!month) return '';
  const m = month.toUpperCase().trim();
  
  // Check for standard month abbreviations
  const monthAbbrs = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const matchedAbbr = monthAbbrs.find(abbr => m.includes(abbr));
  
  if (matchedAbbr) {
    // Extract year digits (if any, e.g. 25, 26, 2025, 2026)
    const yearMatch = m.match(/\d+/);
    if (yearMatch) {
      const yearPart = yearMatch[0];
      const yearDigits = yearPart.length === 4 ? yearPart.slice(2) : yearPart;
      return `${matchedAbbr}-${yearDigits}`;
    }
    return matchedAbbr;
  }
  
  // Clean generic duty names
  if (m.includes('DUTY') || m.includes('APP') || m.includes('TAX')) {
    return 'APP. DUTY';
  }
  
  return m;
}

// Extract chassis code from car name
// E.g., "CROSS ZVG11" -> "ZVG11"
// "NOAH ZWR80W HB" -> "ZWR80W"
// "VOXY ZWR90W HB" -> "ZWR90W"
// "ESQUIRE ZWR80G HB" -> "ZWR80G"
export function extractChassisCode(carName: string): string {
  if (!carName) return '';
  const cleaned = carName.toUpperCase()
    .replace(/\bHB\b/g, '')
    .replace(/\b4WD\b/g, '')
    .replace(/\b2WD\b/g, '')
    .replace(/\bHYBRID\b/g, '')
    .trim();
  
  // Split by spaces, hyphens, slashes, parentheses, commas, dots, brackets
  const words = cleaned.split(/[\s\-/(),.[\]]+/);
  // Find a word that looks like a chassis code
  // Typically contains letters and numbers, e.g., ZVG11, MXPJ10, TRH200, NHP170
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].replace(/[^A-Z0-9]/g, ''); // strip any punctuation
    if (!word) continue;
    const hasLetters = /[A-Z]/.test(word);
    const hasNumbers = /[0-9]/.test(word);
    if (hasLetters && hasNumbers && word.length >= 3 && word.length <= 10) {
      return word;
    }
  }
  
  // Fallback: return the last word cleaned
  if (words.length > 0) {
    const lastWord = words[words.length - 1].replace(/[^A-Z0-9]/g, '');
    if (lastWord && lastWord.length >= 3) return lastWord;
  }
  
  return carName;
}

// Get the core chassis code by removing emission prefixes and common package suffixes
// E.g., "6AA-NKE165" -> "NKE165"
// "NKE165G" -> "NKE165"
// "6AA-ZVG11" -> "ZVG11"
// "6AA-NHP170G" -> "NHP170"
export function getCoreChassisCode(str: string): string {
  if (!str) return '';
  
  // 1. Remove emission standard prefixes like 6AA-, 3BA-, 5BA-, 4BA-, DAA-, DLA-, 6LA-
  let cleaned = str.toUpperCase().trim()
    .replace(/^[3456](AA|BA|LA|CA|DA|GA|TA|UA|WA|XA|YA|ZA)[-]/g, '')
    .replace(/^(DAA|DLA|6LA|6LA\/DLA)[-]/g, '');

  // 2. Extract chassis code from remaining words, splitting by common punctuation
  const words = cleaned.split(/[\s\-/(),.[\]]+/);
  for (let i = words.length - 1; i >= 0; i--) {
    let word = words[i].replace(/[^A-Z0-9]/g, '');
    
    // Strip trailing G or W (wagon/fielder package) if it makes it a standard length (usually 5 or 6 chars)
    if (word.length >= 6 && /[A-Z]$/.test(word)) {
      if (word.endsWith('G') || word.endsWith('W')) {
        word = word.slice(0, -1);
      }
    }
    
    const hasLetters = /[A-Z]/.test(word);
    const hasNumbers = /[0-9]/.test(word);
    if (hasLetters && hasNumbers && word.length >= 3 && word.length <= 10) {
      return word;
    }
  }

  // Fallback to checking words with alphanumeric criteria
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^A-Z0-9]/g, '');
    if (/[A-Z]/.test(word) && /[0-9]/.test(word) && word.length >= 3) {
      return word;
    }
  }

  // Final fallback
  return extractChassisCode(str);
}

// Parse Raita Stock Sheet
export function parseRaitaStock(sheetData: any[][]): RaitaRow[] {
  if (!sheetData || sheetData.length < 2) return [];

  // Find header row (usually contains words like CAR NAME, DESCRIPTION, PRICE)
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
    const row = sheetData[r];
    if (!row) continue;
    const rowStr = row.map(cell => String(cell || '').toUpperCase());
    const hasCarName = rowStr.some(c => c.includes('CAR NAME') || c.includes('VEHICLE'));
    const hasPrice = rowStr.some(c => c.includes('PRICE') || c.includes('USD') || c.includes('VALUE'));
    
    if (hasCarName && hasPrice) {
      headerRowIndex = r;
      headers = row.map(cell => String(cell || '').trim());
      break;
    }
  }

  // Fallback to first row if header row not found
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = sheetData[0]?.map(cell => String(cell || '').trim()) || [];
  }

  // Find column indices
  let slIdx = -1;
  let nameIdx = -1;
  let yearIdx = -1;
  let descIdx = -1;
  let priceIdx = -1;

  headers.forEach((h, idx) => {
    const hu = h.toUpperCase();
    if (hu.includes('SL') || hu.includes('SERIAL') || hu.includes('NO')) {
      if (slIdx === -1) slIdx = idx;
    }
    if (hu.includes('CAR') || hu.includes('NAME') || hu.includes('MODEL') || hu.includes('VEHICLE')) {
      if (nameIdx === -1) nameIdx = idx;
    }
    if (hu.includes('YEAR') || hu.includes('YR') || hu.includes('CONST')) {
      if (yearIdx === -1) yearIdx = idx;
    }
    if (hu.includes('DESC') || hu.includes('DETAILS') || hu.includes('SPEC')) {
      if (descIdx === -1) descIdx = idx;
    }
    if (hu.includes('PRICE') || hu.includes('USD') || hu.includes('RATE') || hu.includes('COST')) {
      if (priceIdx === -1) priceIdx = idx;
    }
  });

  // Fallback defaults if mapping failed
  if (slIdx === -1) slIdx = 0;
  if (nameIdx === -1) nameIdx = Math.min(1, headers.length - 1);
  if (descIdx === -1) descIdx = Math.min(2, headers.length - 1);
  if (yearIdx === -1) yearIdx = Math.min(3, headers.length - 1);
  if (priceIdx === -1) priceIdx = Math.min(4, headers.length - 1);

  const rows: RaitaRow[] = [];
  let indexCounter = 0;

  for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
    const row = sheetData[r];
    if (!row || row.length === 0) continue;

    // Skip helper rows (like footer, totals, or "BISMILLAHIR RAHMANIR RAHIM" lines if they ended up at bottom)
    const carNameVal = String(row[nameIdx] || '').trim();
    if (!carNameVal || carNameVal.toUpperCase().includes('BISMILLAH') || carNameVal.toUpperCase().includes('TOTAL')) {
      continue;
    }

    const slVal = row[slIdx] !== undefined ? String(row[slIdx]).trim() : '';
    if (!slVal) continue; // Skip empty rows

    // Parse year robustly (e.g., extract first 2 or 4 digit match like "2021-22" -> 2021)
    const rawStockYear = String(row[yearIdx] || '').trim();
    const stockYearMatch = rawStockYear.match(/\d+/);
    let yearVal = 2021; // default fallback
    if (stockYearMatch) {
      const parsedYear = parseInt(stockYearMatch[0], 10);
      yearVal = parsedYear < 100 ? (parsedYear < 50 ? 2000 + parsedYear : 1900 + parsedYear) : parsedYear;
    }

    const rawPrice = String(row[priceIdx] || '0').replace(/[^0-9.]/g, '');
    const priceUsd = parseFloat(rawPrice) || 0;

    rows.push({
      raitaSlNo: slVal,
      carName: carNameVal,
      year: yearVal,
      description: String(row[descIdx] || '').trim(),
      priceUsd: priceUsd,
      originalIndex: indexCounter++
    });
  }

  return rows;
}

// Parse Duty Sheet
export function parseDutySheet(sheetData: any[][], isHybrid: boolean, sourceSheet: string): DutyRecord[] {
  if (!sheetData || sheetData.length < 2) return [];

  // Find header row by scoring each candidate row based on the presence of key columns
  let headerRowIndex = -1;
  let headers: string[] = [];
  let highestScore = 0;

  for (let r = 0; r < Math.min(sheetData.length, 25); r++) {
    const row = sheetData[r];
    if (!row) continue;
    const rowStr = row.map(cell => String(cell || '').toUpperCase().trim());
    
    let score = 0;
    if (rowStr.some(c => c === 'SL' || c.includes('SL NO') || c.includes('SL.NO') || c.includes('SL NO.'))) score += 2;
    if (rowStr.some(c => c === 'VEHICLE' || c.includes('VEHICLE NAME') || c.includes('CAR NAME') || c === 'CAR')) score += 3;
    if (rowStr.some(c => c === 'MODEL' || c.includes('CHASSIS') || c.includes('MODEL CODE') || c.includes('CODE') || c.includes('CHASIS'))) score += 3;
    if (rowStr.some(c => c === 'CC' || c === 'C.C.' || c === 'C.C' || c.includes('C.C'))) score += 2;
    if (rowStr.some(c => c === 'YEAR' || c === 'Y.R' || c === 'Y. R' || c === 'YR' || c === 'Y. R.' || c.includes('YEAR'))) score += 3;
    if (rowStr.some(c => c.includes('BOOK VALUE') || c.includes('Y. BOOK') || c.includes('Y.BOOK') || c.includes('BOOKVAL'))) score += 2;
    if (rowStr.some(c => c.includes('INVOICE') || c.includes('INV.'))) score += 2;
    if (rowStr.some(c => c.includes('DUTY') || c.includes('APP.') || c.includes('JAN') || c.includes('FEB') || c.includes('MARCH'))) score += 3;

    // We want the row with the most column matches and it must match at least a couple of keys (score >= 3)
    if (score > highestScore && score >= 3) {
      highestScore = score;
      headerRowIndex = r;
      headers = row.map(cell => String(cell || '').trim());
    }
  }

  // Fallback defaults if search failed
  if (headerRowIndex === -1) {
    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const row = sheetData[r];
      if (row && row.some(cell => String(cell || '').toUpperCase() === 'MODEL')) {
        headerRowIndex = r;
        headers = row.map(cell => String(cell || '').trim());
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headers = sheetData[0]?.map(cell => String(cell || '').trim()) || [];
  }

  // Find column indices
  let vehicleIdx = -1;
  let modelIdx = -1;
  let ccIdx = -1;
  let yearIdx = -1;
  let yBookIdx = -1;
  let invoiceIdx = -1;
  const dutyColMapping: { [colName: string]: number } = {};

  headers.forEach((h, idx) => {
    const hu = h.toUpperCase().trim();
    
    // Vehicle/Car Name Column
    const isVehicleCol = 
      hu === 'VEHICLE' || 
      hu.includes('CAR NAME') || 
      hu.includes('VEHICLE NAME') || 
      hu.includes('CAR') || 
      hu === 'NAME' || 
      hu.includes('MODEL NAME');
      
    // Model/Chassis Column
    const isModelCol = 
      hu === 'MODEL' || 
      hu.includes('CHASSIS') || 
      hu.includes('CHASIS') || 
      hu.includes('CODE') || 
      hu.includes('MODEL CODE');
      
    // CC Column
    const isCcCol = 
      hu === 'CC' || 
      hu === 'C.C' || 
      hu === 'C.C.' || 
      hu.includes('ENGINE') || 
      hu.startsWith('CC') || 
      hu.endsWith('CC');
      
    // Year Column
    const isYearCol = 
      (hu === 'YEAR' || 
       hu === 'YR' || 
       hu === 'Y.R' || 
       hu === 'Y.R.' || 
       hu === 'Y. R.' || 
       hu === 'Y. R' || 
       hu === 'Y-R' || 
       hu === 'Y/R' || 
       (hu.includes('YEAR') && !hu.includes('BOOK') && !hu.includes('VAL'))) &&
      !hu.includes('DUTY') &&
      !hu.includes('APP') &&
      !hu.includes('TAX');

    if (isVehicleCol) {
      if (vehicleIdx === -1) vehicleIdx = idx;
    } else if (isModelCol) {
      if (modelIdx === -1) modelIdx = idx;
    } else if (isCcCol) {
      if (ccIdx === -1) ccIdx = idx;
    } else if (isYearCol) {
      if (yearIdx === -1) yearIdx = idx;
    } else if (hu.includes('BOOK VALUE') || hu.includes('Y. BOOK') || hu.includes('Y.BOOK') || hu.includes('BOOKVAL')) {
      if (yBookIdx === -1) yBookIdx = idx;
    } else if (hu.includes('INVOICE') || hu.includes('INV.')) {
      if (invoiceIdx === -1) invoiceIdx = idx;
    }
    
    // Catch-all for monthly duties: match "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "DUTY", "APP.", "TAX"
    const isDutyCol = 
      hu.includes('DUTY') || 
      hu.includes('APP.') || 
      hu.includes('APP ') || 
      hu.includes('TAX') || 
      hu.includes('FEE') || 
      hu.includes('JAN') || 
      hu.includes('FEB') || 
      hu.includes('MAR') || 
      hu.includes('APR') || 
      hu.includes('MAY') || 
      hu.includes('JUN') || 
      hu.includes('JUL') || 
      hu.includes('AUG') || 
      hu.includes('SEP') || 
      hu.includes('OCT') || 
      hu.includes('NOV') || 
      hu.includes('DEC') || 
      hu.includes('FEBRUARY') || 
      hu.includes('FEBUARY');
      
    if (isDutyCol && !isYearCol && !hu.includes('BOOK VALUE') && !hu.includes('INVOICE') && !hu.includes('BOOKVAL')) {
      const normalizedKey = normalizeMonthKey(h);
      if (normalizedKey) {
        dutyColMapping[normalizedKey] = idx;
      }
    }
  });

  // If still empty, scan again with robust fallback keywords
  if (Object.keys(dutyColMapping).length === 0) {
    const fallbackKeywords = [
      'DUTY', 'APP', 'TAX', 'SD', 'VAT', 'AIT', 'RD', 'AT', 'ASSESS', 'FEE', 'AMOUNT', 'VALUE',
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
      'JANUARY', 'FEBRUARY', 'FEBUARY'
    ];
    headers.forEach((h, idx) => {
      const hu = h.toUpperCase().trim();
      const isCandidate = fallbackKeywords.some(keyword => hu.includes(keyword)) &&
                          idx !== vehicleIdx && 
                          idx !== modelIdx && 
                          idx !== yearIdx && 
                          idx !== ccIdx;
      if (isCandidate) {
        const normalizedKey = normalizeMonthKey(h) || hu || `COLUMN-${idx}`;
        dutyColMapping[normalizedKey] = idx;
      }
    });
  }

  // If still empty, fall back to the last column
  if (Object.keys(dutyColMapping).length === 0 && headers.length > 0) {
    const targetIdx = headers.length - 1;
    if (targetIdx > Math.max(vehicleIdx, modelIdx, yearIdx)) {
      dutyColMapping['APP. DUTY'] = targetIdx;
    } else {
      const knownIndices = [vehicleIdx, modelIdx, ccIdx, yearIdx, yBookIdx, invoiceIdx];
      for (let idx = headers.length - 1; idx >= 0; idx--) {
        if (!knownIndices.includes(idx)) {
          dutyColMapping['APP. DUTY'] = idx;
          break;
        }
      }
    }
  }

  // Fallback defaults if some key indexes are still missing
  if (vehicleIdx === -1) vehicleIdx = Math.min(1, headers.length - 1);
  if (modelIdx === -1) modelIdx = Math.min(2, headers.length - 1);
  if (ccIdx === -1) ccIdx = Math.min(3, headers.length - 1);
  if (yearIdx === -1) yearIdx = Math.min(5, headers.length - 1);
  if (yBookIdx === -1) yBookIdx = Math.min(4, headers.length - 1);
  if (invoiceIdx === -1) invoiceIdx = Math.min(6, headers.length - 1);

  const records: DutyRecord[] = [];

  // Carry-over state for merged hierarchical cells
  let lastVehicle = '';
  let lastModel = '';
  let lastCc = '';

  // Helper to guard against helper/auxiliary texts in hierarchical carryover
  const isDirtyValue = (val: string): boolean => {
    const u = val.toUpperCase();
    return (
      u.includes('H.S.') ||
      u.includes('H. S.') ||
      u.includes('CODE:') ||
      u.includes('BISMILLAH') ||
      u.includes('TOTAL') ||
      u.includes('SUB-TOTAL') ||
      u.includes('PAGE') ||
      u.includes('HABIBA') ||
      u.includes('SHIPMENT')
    );
  };

  for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
    const row = sheetData[r];
    if (!row || row.length === 0) continue;

    // Check if we have a valid Year in this row
    const rawYear = String(row[yearIdx] || '').trim();
    if (!rawYear) continue; // Skip if no year is provided, which means it is an empty row or footer

    // Extract first numeric group matching year (e.g. "2021-22" -> 2021)
    const yearMatch = rawYear.match(/\d+/);
    if (!yearMatch) continue;
    let yearVal = parseInt(yearMatch[0], 10);
    if (yearVal < 100) {
      yearVal = yearVal < 50 ? 2000 + yearVal : 1900 + yearVal;
    }
    if (yearVal < 2000 || yearVal > 2030) continue; // Not a valid year cell

    // Extract hierarchical state
    const currentVehicle = vehicleIdx !== -1 && row[vehicleIdx] !== undefined ? String(row[vehicleIdx]).trim() : '';
    const currentModel = modelIdx !== -1 && row[modelIdx] !== undefined ? String(row[modelIdx]).trim() : '';
    const currentCc = ccIdx !== -1 && row[ccIdx] !== undefined ? String(row[ccIdx]).trim() : '';

    if (currentVehicle && !isDirtyValue(currentVehicle)) lastVehicle = currentVehicle;
    if (currentModel && !isDirtyValue(currentModel)) lastModel = currentModel;
    if (currentCc && !isDirtyValue(currentCc)) lastCc = currentCc;

    // Read duties
    const dutyValues: { [key: string]: number } = {};
    Object.entries(dutyColMapping).forEach(([normalizedKey, colIdx]) => {
      const rawDuty = String(row[colIdx] || '0').replace(/[^0-9.]/g, '');
      dutyValues[normalizedKey] = parseFloat(rawDuty) || 0;
    });

    records.push({
      vehicle: lastVehicle,
      model: lastModel,
      cc: lastCc,
      year: yearVal,
      yBookValue: yBookIdx !== -1 ? String(row[yBookIdx] || '').trim() : '',
      invoiceValue: invoiceIdx !== -1 ? String(row[invoiceIdx] || '').trim() : '',
      dutyValues: dutyValues,
      isHybrid: isHybrid,
      sourceSheet: sourceSheet
    });
  }

  return records;
}
