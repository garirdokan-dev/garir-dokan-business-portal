import ExcelJS from 'exceljs';
import { CalculatedRow, BracketRule } from '../types';

// Helper to construct dynamic Excel formula for Additional Cost based on brackets
function buildAdditionalCostFormula(rowNum: number, brackets: BracketRule[]): string {
  // Sort brackets descending by min to construct standard nested IFs
  const sortedBrackets = [...brackets].sort((a, b) => b.min - a.min);
  
  let formula = '';
  // Default fallback for below lowest bracket
  const lowestBracket = sortedBrackets[sortedBrackets.length - 1];
  const lowestCost = lowestBracket ? lowestBracket.cost : 200000;
  
  // Construct nested IFs: IF(K5>=15000000, 1400000, IF(K5>=12000000, ...))
  // Column K is TOTAL (Costing Total)
  let prevFormula = String(lowestCost);
  
  for (let i = sortedBrackets.length - 1; i >= 0; i--) {
    const bracket = sortedBrackets[i];
    prevFormula = `IF(K${rowNum}>=${bracket.min}, ${bracket.cost}, ${prevFormula})`;
  }
  
  return `=${prevFormula}`;
}

export async function exportToExcel(
  rows: CalculatedRow[],
  exchangeRate: number,
  driverCnfValue: number,
  brackets: BracketRule[],
  offerMonth: string
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock offers');

  // Page setup for professional layout
  worksheet.views = [{ showGridLines: true }];

  // Column definitions for sizing
  worksheet.columns = [
    { key: 'raitaSlNo', width: 15 },
    { key: 'slNo', width: 12 },
    { key: 'carName', width: 20 },
    { key: 'year', width: 10 },
    { key: 'description', width: 60 },
    { key: 'price', width: 16 },
    { key: 'priceUsd', width: 14 },
    { key: 'priceBdt', width: 16 },
    { key: 'driverCnf', width: 14 },
    { key: 'duty', width: 16 },
    { key: 'total', width: 18 },
    { key: 'additionalCost', width: 16 }
  ];

  // --- Row 1: Bismillah ---
  worksheet.mergeCells('A1:L1');
  const bismillahRow = worksheet.getRow(1);
  bismillahRow.height = 25;
  const bismillahCell = worksheet.getCell('A1');
  bismillahCell.value = 'BISMILLAHIR RAHMANIR RAHIM';
  bismillahCell.alignment = { horizontal: 'center', vertical: 'middle' };
  bismillahCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFF' } };
  bismillahCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '333333' } // Dark Charcoal Slate
  };

  // --- Row 2: Header Offer List ---
  worksheet.mergeCells('A2:L2');
  const titleRow = worksheet.getRow(2);
  titleRow.height = 35;
  const titleCell = worksheet.getCell('A2');
  titleCell.value = `GARIR DOKAN ${offerMonth.toUpperCase()} OFFER LIST`;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'B22222' } // Deep Burgundy Red (matches Garir Dokan red theme)
  };

  // --- Row 3: Website & Contact Info ---
  worksheet.mergeCells('A3:L3');
  const infoRow = worksheet.getRow(3);
  infoRow.height = 25;
  const infoCell = worksheet.getCell('A3');
  infoCell.value = 'Call/WhatsApp : +880 1785-255586 | Visit our website : www.garirdokan.com';
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  infoCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  infoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '104E8B' } // Deep Blue Accent
  };

  // --- Row 4: Table Headers ---
  const headerRow = worksheet.getRow(4);
  headerRow.height = 28;
  const headerTitles = [
    'RAITA SL NO.',
    'SL NO.',
    'CAR NAME',
    'YEAR',
    'DESCRIPTION',
    'PRICE',
    'PRICE (USD)',
    'PRICE (BDT)',
    'DRIVER + CNF',
    'DUTY',
    'TOTAL',
    'Additional Cost'
  ];

  headerTitles.forEach((title, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = title;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0D5D66' } // Custom Deep Blue Teal
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'D3D3D3' } },
      bottom: { style: 'medium', color: { argb: '0D5D66' } },
      left: { style: 'thin', color: { argb: 'D3D3D3' } },
      right: { style: 'thin', color: { argb: 'D3D3D3' } }
    };
  });

  // --- Row 5 onwards: Data rows ---
  rows.forEach((row, i) => {
    const rowNum = i + 5; // Start at row 5
    const excelRow = worksheet.getRow(rowNum);
    excelRow.height = 22;

    // Col A: RAITA SL NO.
    const cellA = excelRow.getCell(1);
    cellA.value = isNaN(Number(row.raitaSlNo)) ? row.raitaSlNo : Number(row.raitaSlNo);
    cellA.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col B: SL NO. (Formula: =5&A5)
    const cellB = excelRow.getCell(2);
    cellB.value = { formula: `=5&A${rowNum}`, result: Number(`5${row.raitaSlNo}`) };
    cellB.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col C: CAR NAME
    const cellC = excelRow.getCell(3);
    cellC.value = row.carName;
    cellC.alignment = { horizontal: 'left', vertical: 'middle' };

    // Col D: YEAR
    const cellD = excelRow.getCell(4);
    cellD.value = Number(row.year);
    cellD.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col E: DESCRIPTION
    const cellE = excelRow.getCell(5);
    cellE.value = row.description;
    cellE.alignment = { horizontal: 'left', vertical: 'middle' };

    // Col F: PRICE (Formula: =K5+L5)
    const cellF = excelRow.getCell(6);
    cellF.value = { formula: `=K${rowNum}+L${rowNum}`, result: row.finalPrice };
    cellF.alignment = { horizontal: 'right', vertical: 'middle' };
    cellF.numFmt = '#,##0';

    // Col G: PRICE (USD)
    const cellG = excelRow.getCell(7);
    cellG.value = Number(row.priceUsd);
    cellG.alignment = { horizontal: 'right', vertical: 'middle' };
    cellG.numFmt = '#,##0';

    // Col H: PRICE (BDT) (Formula: =G5*ExchangeRate)
    const cellH = excelRow.getCell(8);
    cellH.value = { formula: `=G${rowNum}*${exchangeRate}`, result: row.priceBdt };
    cellH.alignment = { horizontal: 'right', vertical: 'middle' };
    cellH.numFmt = '#,##0';

    // Col I: DRIVER + CNF
    const cellI = excelRow.getCell(9);
    cellI.value = Number(driverCnfValue);
    cellI.alignment = { horizontal: 'right', vertical: 'middle' };
    cellI.numFmt = '#,##0';

    // Col J: DUTY
    const cellJ = excelRow.getCell(10);
    cellJ.value = Number(row.duty);
    cellJ.alignment = { horizontal: 'right', vertical: 'middle' };
    cellJ.numFmt = '#,##0.00';

    // Col K: TOTAL (Formula: =H5+I5+J5)
    const cellK = excelRow.getCell(11);
    cellK.value = { formula: `=H${rowNum}+I${rowNum}+J${rowNum}`, result: row.totalCosting };
    cellK.alignment = { horizontal: 'right', vertical: 'middle' };
    cellK.numFmt = '#,##0.00';

    // Col L: Additional Cost (Formula: nested IF based on brackets)
    const cellL = excelRow.getCell(12);
    cellL.value = { formula: buildAdditionalCostFormula(rowNum, brackets), result: row.additionalCost };
    cellL.alignment = { horizontal: 'right', vertical: 'middle' };
    cellL.numFmt = '#,##0';

    // Add borders & alternating row background
    const isEven = i % 2 === 1;
    for (let col = 1; col <= 12; col++) {
      const cell = excelRow.getCell(col);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E5E5E5' } },
        bottom: { style: 'thin', color: { argb: 'E5E5E5' } },
        left: { style: 'thin', color: { argb: 'E5E5E5' } },
        right: { style: 'thin', color: { argb: 'E5E5E5' } }
      };
      
      // Light gray striping for professional readability
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F9FBFB' }
        };
      }
    }
  });

  // Save/Download Workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `RAITA_STOCK_CALCULATED_${offerMonth.toUpperCase().replace(/\s+/g, '_')}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
