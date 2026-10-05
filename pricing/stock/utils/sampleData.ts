import { getExcelJS, COLORS } from './excelHelpers';

/**
 * Generates sample BD Excel files (Customized Sheet + New Stock List)
 */
export async function generateSampleBDFiles(): Promise<{ customizedBlob: Blob; sourceBlob: Blob }> {
  const ExcelJS = await getExcelJS();

  // 1. Customized Sheet
  const wbCustom = new ExcelJS.Workbook();
  const wsCustom = wbCustom.addWorksheet('BD STOCK');

  // Title Row
  wsCustom.mergeCells('A1:X1');
  const titleCell = wsCustom.getCell('A1');
  titleCell.value = 'GARIR DOKAN BD STOCK MASTER TRACKER';
  titleCell.font = { name: 'Oswald', size: 16, bold: true, color: { argb: COLORS.WHITE_TEXT } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsCustom.getRow(1).height = 36;

  // Header Row (Row 2)
  const headers = [
    'SL NO', 'CAR NAME', 'GRADE', 'YEAR', 'Color', 'Point', 'Milage', 'DESCRIPTION',
    'PRICE', 'CHASSIS', 'LOCATION', 'STATUS', 'SUPPLIRE', 'LONG DESCRIPTION',
    'COSTING PRICE', 'PRICE (DOLLAR)', 'PRICE (BDT)', 'DUTY', 'DRIVER + CNF',
    'ADDITIONAL COST', 'PICTURE(DRIVE LINK)', 'UPLOADED LINK', 'IMAGE', 'SOURCE SHEET'
  ];

  const headerRow = wsCustom.getRow(2);
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Oswald', size: 11, bold: true, color: { argb: COLORS.WHITE_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF1A505F' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  // Base row styling helper
  const applyRowStyle = (row: any, chassisConfirmed = true) => {
    row.height = 24;
    row.eachCell((cell: any, colNum: number) => {
      cell.font = { name: 'Oswald', size: 10, color: { argb: COLORS.CHARCOAL_TEXT } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        right: { style: 'thin', color: { argb: 'FFE5E5E5' } },
      };
      // Col 10 = CHASSIS
      if (colNum === 10) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: chassisConfirmed ? COLORS.GREEN_CHASSIS : COLORS.BLUE_CHASSIS },
        };
        cell.font = { name: 'Oswald', size: 10, bold: true, color: { argb: COLORS.CHARCOAL_TEXT } };
      }
    });
  };

  const applySeparator = (row: any) => {
    row.height = 14;
    for (let c = 1; c <= 24; c++) {
      const cell = row.getCell(c);
      cell.value = '';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
    }
  };

  // Group 1: PREMIO (IN STOCK)
  const r3 = wsCustom.getRow(3);
  r3.values = [
    1, 'PREMIO', 'F EX', 2019, 'PEARL', '4.5', '32000 KM', 'PUSH, BEIGE INTERIOR',
    42.5, 'NZT260-3104521', 'DHAKA', 'IN STOCK', 'LOCAL', 'FRESH UNIT',
    38.5, '', '', '', '', '', '', '', { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-premio-1' }, 'STOCK LIST (01-Aug-2026)'
  ];
  applyRowStyle(r3, true); // Green confirmed

  const r4 = wsCustom.getRow(4);
  r4.values = [
    2, 'PREMIO', 'F', 2018, 'SILVER', '4.0', '48000 KM', 'OCTANE ONLY',
    39.0, 'NZT260-3098124', 'CHITTAGONG', 'IN STOCK', 'LOCAL', '',
    35.0, '', '', '', '', '', '', '', { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-premio-2' }, 'STOCK LIST (01-Aug-2026)'
  ];
  applyRowStyle(r4, false); // Blue pending

  // Separator 1
  applySeparator(wsCustom.getRow(5));

  // Group 2: AXIO (IN STOCK)
  const r6 = wsCustom.getRow(6);
  r6.values = [
    3, 'AXIO', 'HYBRID G', 2020, 'BLACK', '4.5 (B/B)', '41000 KM', 'SAFETY SENSE',
    32.0, 'NKE165-7124901', 'DHAKA', 'IN STOCK', 'LOCAL', 'HYBRID BATTERY GOOD',
    29.2, '', '', '', '', '', '', '', { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-axio' }, 'STOCK LIST (01-Aug-2026)'
  ];
  applyRowStyle(r6, true);

  // Separator 2
  applySeparator(wsCustom.getRow(7));

  // Gap rows (2 blank rows)
  wsCustom.getRow(8).values = [];
  wsCustom.getRow(9).values = [];

  // Red Label Row for BD STOCK OUT
  const r10 = wsCustom.getRow(10);
  r10.height = 30;
  wsCustom.mergeCells('A10:I10');
  const labelCell = wsCustom.getCell('A10');
  labelCell.value = "BD STOCK OUT LISTING CAR'S";
  labelCell.font = { name: 'Oswald', size: 12, bold: true, color: { argb: COLORS.WHITE_TEXT } };
  labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_LABEL } };
  labelCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group in STOCK OUT: NOAH
  const r11 = wsCustom.getRow(11);
  r11.values = [
    4, 'NOAH', 'SI W/B', 2017, 'WHITE', '4.0', '65000 KM', 'DUAL DOOR',
    36.5, 'ZRR80-0239102', 'SOLD', 'STOCK OUT', 'LOCAL', 'DELIVERED',
    33.0, '', '', '', '', '', '', '', '', 'STOCK LIST (15-Jul-2026)'
  ];
  applyRowStyle(r11, true);
  // Red car name for stock out
  const carNameCell11 = r11.getCell(2);
  carNameCell11.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_HIGHLIGHT } };
  carNameCell11.font = { name: 'Oswald', size: 10, bold: true, color: { argb: COLORS.WHITE_TEXT } };

  // Separator 3
  applySeparator(wsCustom.getRow(12));

  // 2. BD Source Stock List (BD_STOCK_LIST.xlsx)
  const wbSource = new ExcelJS.Workbook();
  const wsSource = wbSource.addWorksheet('SHEET1');

  wsSource.getRow(1).values = ['SL NO', 'NAME', 'DESCRIPTION', 'CHASSIS', 'YEAR', 'IMAGE', 'LOCATION', 'PRICE'];
  wsSource.getRow(1).font = { bold: true };

  // Row 1: Existing PREMIO #1 - will be UPDATED (price changed to 38.0, location to UTTARA)
  wsSource.getRow(2).values = [
    101, 'PREMIO', 'PEARL, F EX, 32000 KM, 4.5', 'NZT260-3104521', 2019,
    { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-premio-1-updated' }, 'UTTARA', 38.0
  ];

  // Note: NZT260-3098124 (PREMIO #2) is NOT in the source -> will be MOVED TO STOCK OUT!

  // Row 2: Existing AXIO - will be REFRESHED (price remains 29.2, location DHAKA)
  wsSource.getRow(3).values = [
    102, 'AXIO', 'BLACK, HYBRID G, 41000 KM, 4.5 (B/B)', 'NKE165-7124901', 2020,
    { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-axio' }, 'DHAKA', 29.2
  ];

  // Row 3: Brand new car - HARRIER (brand new group!)
  wsSource.getRow(4).values = [
    103, 'HARRIER', 'PEARL, TWO TONE, PROGRESS METAL, PANORAMIC ROOF, JBL, 28000 KM, 5.0 (A/A)', 'ZSU60-1289401', 2020,
    { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-harrier' }, 'PORT', 65.5
  ];

  // Row 4: Another new car in existing group - PREMIO
  wsSource.getRow(5).values = [
    104, 'PREMIO', 'WINE RED, G SUPERIOR, 18000 KM, 4.5', 'ZRT261-0089123', 2021,
    { text: 'PHOTO', hyperlink: 'https://drive.google.com/sample-premio-3' }, 'PORT', 46.0
  ];

  const customBuf = await wbCustom.xlsx.writeBuffer();
  const sourceBuf = await wbSource.xlsx.writeBuffer();

  return {
    customizedBlob: new Blob([customBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    sourceBlob: new Blob([sourceBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  };
}

/**
 * Generates sample Japan Excel files (Customized Sheet + Supplier RAITA Stock List)
 */
export async function generateSampleJapanFiles(): Promise<{ customizedBlob: Blob; sourceBlob: Blob }> {
  const ExcelJS = await getExcelJS();

  // 1. Japan Customized Sheet (23 cols A-W)
  const wbCustom = new ExcelJS.Workbook();
  const wsCustom = wbCustom.addWorksheet('JAPAN STOCK');

  // Title Row
  wsCustom.mergeCells('A1:W1');
  const titleCell = wsCustom.getCell('A1');
  titleCell.value = 'GARIR DOKAN JAPAN STOCK MASTER TRACKER';
  titleCell.font = { name: 'Oswald', size: 16, bold: true, color: { argb: COLORS.WHITE_TEXT } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsCustom.getRow(1).height = 36;

  // Header Row (Row 2)
  const headers = [
    'SL NO', 'CAR NAME', 'GRADE', 'YEAR', 'Color', 'Point', 'Milage', 'DESCRIPTION',
    'PRICE', 'CHASSIS', 'LOCATION', 'STATUS', 'SUPPLIRE', 'LONG DESCRIPTION',
    'COSTING PRICE', 'PRICE (DOLLAR)', 'PRICE (BDT)', 'DUTY', 'DRIVER + CNF',
    'ADDITIONAL COST', 'PICTURE(DRIVE LINK)', 'UPLOADED LINK', 'SOURCE SHEET'
  ];

  const headerRow = wsCustom.getRow(2);
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Oswald', size: 11, bold: true, color: { argb: COLORS.WHITE_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF1A505F' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  const applyRowStyle = (row: any) => {
    row.height = 24;
    row.eachCell((cell: any, colNum: number) => {
      cell.font = { name: 'Oswald', size: 10, color: { argb: COLORS.CHARCOAL_TEXT } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
        right: { style: 'thin', color: { argb: 'FFE5E5E5' } },
      };
      if (colNum === 10) {
        // Japan chassis is pending (blue)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BLUE_CHASSIS } };
      }
    });
  };

  const applySeparator = (row: any) => {
    row.height = 14;
    for (let c = 1; c <= 23; c++) {
      const cell = row.getCell(c);
      cell.value = '';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TEAL_SEPARATOR } };
    }
  };

  // Group 1: CHR (SL 101, SL 102)
  const r3 = wsCustom.getRow(3);
  r3.values = [
    101, 'CHR', 'G LED', 2021, 'WHITE', '4.5', '22000 KM', 'MODELISTA KIT',
    { formula: 'SUM(O3+T3)' }, '', 'JP', 'IN STOCK', 'RAITA', '',
    { formula: 'SUM(Q3:S3)' }, 12500, { formula: 'P3*127' }, 850000, 50000,
    75000, '', '', 'RAITA INTERNATIONAL LIST (01-Aug-2026)'
  ];
  applyRowStyle(r3);

  const r4 = wsCustom.getRow(4);
  r4.values = [
    102, 'CHR', 'S LED', 2020, 'BLACK', '4.0', '35000 KM', '',
    { formula: 'SUM(O4+T4)' }, '', 'JP', 'IN STOCK', 'RAITA', '',
    { formula: 'SUM(Q4:S4)' }, 11000, { formula: 'P4*127' }, 800000, 50000,
    70000, '', '', 'RAITA INTERNATIONAL LIST (01-Aug-2026)'
  ];
  applyRowStyle(r4);

  applySeparator(wsCustom.getRow(5));

  // Group 2: VEZEL (SL 103) - Note: SL 103 won't be in source -> will be MOVED TO STOCK OUT
  const r6 = wsCustom.getRow(6);
  r6.values = [
    103, 'VEZEL', 'Z', 2022, 'GREY', '5.0', '15000 KM', 'HONDA SENSING',
    { formula: 'SUM(O6+T6)' }, '', 'JP', 'IN STOCK', 'RAITA', '',
    { formula: 'SUM(Q6:S6)' }, 14000, { formula: 'P6*127' }, 920000, 50000,
    80000, '', '', 'RAITA INTERNATIONAL LIST (01-Aug-2026)'
  ];
  applyRowStyle(r6);

  applySeparator(wsCustom.getRow(7));

  // Gap rows
  wsCustom.getRow(8).values = [];
  wsCustom.getRow(9).values = [];

  // Red Label Row
  const r10 = wsCustom.getRow(10);
  r10.height = 30;
  wsCustom.mergeCells('A10:I10');
  const labelCell = wsCustom.getCell('A10');
  labelCell.value = "JAPAN STOCK OUT LISTING CAR'S";
  labelCell.font = { name: 'Oswald', size: 12, bold: true, color: { argb: COLORS.WHITE_TEXT } };
  labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_LABEL } };
  labelCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Group in Stock Out: YARIS CROSS
  const r11 = wsCustom.getRow(11);
  r11.values = [
    99, 'YARIS CROSS', 'Z', 2021, 'RED', '4.5', '19000 KM', 'FULL OPTION',
    { formula: 'SUM(O11+T11)' }, '', 'SOLD', 'STOCK OUT', 'RAITA', '',
    { formula: 'SUM(Q11:S11)' }, 12000, { formula: 'P11*127' }, 810000, 50000,
    70000, '', '', 'RAITA INTERNATIONAL LIST (15-Jul-2026)'
  ];
  applyRowStyle(r11);
  const carCell11 = r11.getCell(2);
  carCell11.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.RED_HIGHLIGHT } };
  carCell11.font = { name: 'Oswald', size: 10, bold: true, color: { argb: COLORS.WHITE_TEXT } };

  applySeparator(wsCustom.getRow(12));

  // 2. Japan Supplier Source List (MY STOCK LIST)
  const wbSource = new ExcelJS.Workbook();
  const wsSource = wbSource.addWorksheet('MY STOCK LIST');

  wsSource.getRow(1).values = [
    'RAITA SL NO', 'SL NO', 'CAR NAME', 'YEAR', 'DESCRIPTION',
    'PRICE', 'PRICE (USD)', 'PRICE (BDT)', 'DRIVER + CNF', 'DUTY', 'TOTAL', 'Additional Cost'
  ];
  wsSource.getRow(1).font = { bold: true };

  // Row 1: CHR SL 101 - matched refresh with new DUTY (860000) and new Additional Cost (80000)
  wsSource.getRow(2).values = [
    'R-101', 101, 'CHR', 2021, 'WHITE, G LED, 22000 KM, 4.5',
    2527500, 12500, 1587500, 50000, 860000, 2497500, 80000
  ];

  // Row 2: CHR SL 102 - matched refresh with identical values
  wsSource.getRow(3).values = [
    'R-102', 102, 'CHR', 2020, 'BLACK, S LED, 35000 KM, 4.0',
    2267000, 11000, 1397000, 50000, 800000, 2247000, 70000
  ];

  // Row 3: New car - COROLLA CROSS (brand new group)
  wsSource.getRow(4).values = [
    'R-104', 104, 'COROLLA CROSS', 2022, 'PEARL, Z LEATHER, 18000 KM, 5.0 (A/A)',
    3050000, 15500, 1968500, 50000, 950000, 2968500, 85000
  ];

  const customBuf = await wbCustom.xlsx.writeBuffer();
  const sourceBuf = await wbSource.xlsx.writeBuffer();

  return {
    customizedBlob: new Blob([customBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    sourceBlob: new Blob([sourceBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  };
}
