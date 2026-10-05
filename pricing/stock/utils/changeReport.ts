import type { ReconciliationSummary } from '../types';
import { getExcelJS } from './excelHelpers';

/**
 * Build a compact, human-readable "Change Report" workbook for one reconciliation run.
 * It records exactly what the engine did — new cars, field updates (old → new),
 * relocations, and any warnings — so the business keeps an audit trail per month.
 */
export async function generateChangeReportBlob(summary: ReconciliationSummary): Promise<Blob> {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Garir Dokan Stock Customizer';
  wb.created = new Date();

  const TEAL = 'FF31859B';
  const HEADER_FONT = { name: 'Oswald', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const TITLE_FONT = { name: 'Oswald', size: 16, bold: true, color: { argb: 'FF1A505F' } };

  const ws = wb.addWorksheet('Change Report', {
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } } as any;
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F4' } } as any;
  const thin = { style: 'thin', color: { argb: 'FFD9D9D9' } } as any;
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  let r = 1;

  // ---- Title block ----
  const title = ws.getCell(`A${r}`);
  const modeLabel = summary.mode === 'COMBINE' ? 'BD + JAPAN COMBINED' : `${summary.mode} STOCK`;
  title.value = `GARIR DOKAN — ${modeLabel} CHANGE REPORT`;
  title.font = TITLE_FONT;
  ws.getRow(r).height = 24;
  r++;

  ws.getCell(`A${r}`).value = `As-of date: ${summary.asOfDate}`;
  ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10, color: { argb: 'FF666666' } };
  r++;
  ws.getCell(`A${r}`).value = `Generated: ${new Date().toLocaleString()}`;
  ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10, color: { argb: 'FF666666' } };
  r += 2;

  // ---- Summary counts ----
  const summaryRows: [string, number | string][] = [
    [summary.mode === 'COMBINE' ? 'Japan-only cars added' : 'New cars added', summary.newCount],
    [summary.mode === 'COMBINE' ? 'Merged (BD + Japan)' : 'Cars updated (fields refreshed)', summary.updatedCount],
    [summary.mode === 'COMBINE' ? 'Transferred (Japan → BD)' : 'Cars moved to Stock-Out', summary.stockOutCount],
    ['Total rows now in master', summary.totalRowsCount],
    ['Warnings', summary.warnings.length],
  ];
  ws.getCell(`A${r}`).value = 'SUMMARY';
  ws.getCell(`A${r}`).font = { name: 'Oswald', size: 12, bold: true, color: { argb: 'FF1A505F' } };
  r++;
  for (const [label, val] of summaryRows) {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10 };
    ws.getCell(`B${r}`).value = val;
    ws.getCell(`B${r}`).font = { name: 'Oswald', size: 10, bold: true };
    r++;
  }
  r++;

  const writeTableHeader = (cols: string[]) => {
    const row = ws.getRow(r);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c;
      cell.font = HEADER_FONT;
      cell.fill = headerFill;
      cell.border = border;
      cell.alignment = { vertical: 'middle' };
    });
    row.height = 18;
    r++;
  };
  const writeSectionTitle = (t: string) => {
    const cell = ws.getCell(`A${r}`);
    cell.value = t;
    cell.font = { name: 'Oswald', size: 12, bold: true, color: { argb: 'FF1A505F' } };
    ws.getRow(r).getCell(1).fill = sectionFill;
    r++;
  };

  // ---- New cars ----
  writeSectionTitle(`${summary.mode === 'COMBINE' ? 'JAPAN-ONLY CARS ADDED' : 'NEW CARS'} (${summary.newCars.length})`);
  writeTableHeader(['Key', 'Car Name', 'Year', 'Price', 'Grade', 'Color', 'Point', 'Milage', 'Location', 'Source Tag']);
  if (summary.newCars.length === 0) {
    ws.getCell(`A${r}`).value = '— none —';
    ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10, italic: true, color: { argb: 'FF999999' } };
    r++;
  } else {
    for (const c of summary.newCars) {
      const row = ws.getRow(r);
      const vals = [c.key, c.carName, c.year ?? '', c.price ?? '', c.grade ?? '', c.color ?? '', c.point ?? '', c.milage ?? '', c.location ?? '', c.sourceSheetTag ?? ''];
      vals.forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 10 }; cell.border = border; });
      r++;
    }
  }
  r++;

  // ---- Updated cars (one line per field change) ----
  writeSectionTitle(`${summary.mode === 'COMBINE' ? 'MERGED (BD + JAPAN)' : 'UPDATED CARS'} (${summary.updatedCars.length})`);
  writeTableHeader(['Key', 'Car Name', 'Field', 'Column', 'Old Value', 'New Value']);
  if (summary.updatedCars.length === 0) {
    ws.getCell(`A${r}`).value = '— none —';
    ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10, italic: true, color: { argb: 'FF999999' } };
    r++;
  } else {
    for (const c of summary.updatedCars) {
      if (c.changes.length === 0) {
        const row = ws.getRow(r);
        [c.key, c.carName, '(formulas rebuilt)', '', '', ''].forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 10 }; cell.border = border; });
        r++;
      }
      for (const ch of c.changes) {
        const row = ws.getRow(r);
        const vals = [c.key, c.carName, ch.field, ch.colName ?? '', ch.oldValue ?? '', ch.newValue ?? ''];
        vals.forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 10 }; cell.border = border; });
        r++;
      }
      if (c.formulasRebuilt && c.formulasRebuilt.length) {
        const row = ws.getRow(r);
        [c.key, c.carName, 'formulas rebuilt', '', '', c.formulasRebuilt.join(', ')].forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 9, italic: true, color: { argb: 'FF888888' } }; cell.border = border; });
        r++;
      }
    }
  }
  r++;

  // ---- Duplicates (combine mode) ----
  const dups = (summary as any).duplicateCars || [];
  if (dups.length) {
    writeSectionTitle(`DUPLICATE JAPAN LISTINGS (${dups.length})`);
    writeTableHeader(['Key', 'Car Name', 'Duplicate listing', 'Action']);
    for (const c of dups) {
      const row = ws.getRow(r);
      const vals = [c.key, c.carName, String(c.changes?.[0]?.oldValue ?? ''), 'kept once — verify'];
      vals.forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 10 }; cell.border = border; });
      r++;
    }
    r++;
  }

  // ---- Stock-out ----
  writeSectionTitle(`${summary.mode === 'COMBINE' ? 'TRANSFERRED (JAPAN → BD)' : 'MOVED TO STOCK-OUT'} (${summary.stockOutCars.length})`);
  writeTableHeader(['Key', 'Car Name', 'From Group', 'Previous Section']);
  if (summary.stockOutCars.length === 0) {
    ws.getCell(`A${r}`).value = '— none —';
    ws.getCell(`A${r}`).font = { name: 'Oswald', size: 10, italic: true, color: { argb: 'FF999999' } };
    r++;
  } else {
    for (const c of summary.stockOutCars) {
      const row = ws.getRow(r);
      [c.key, c.carName, c.groupName, c.previousSection].forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = v as any; cell.font = { name: 'Oswald', size: 10 }; cell.border = border; });
      r++;
    }
  }
  r++;

  // ---- Warnings ----
  if (summary.warnings.length) {
    writeSectionTitle(`WARNINGS (${summary.warnings.length})`);
    for (const w of summary.warnings) {
      const cell = ws.getCell(`A${r}`);
      cell.value = `• ${w}`;
      cell.font = { name: 'Oswald', size: 10, color: { argb: 'FF9A6700' } };
      r++;
    }
  }

  // Column widths
  const widths = [22, 26, 20, 10, 22, 22, 12, 14, 14, 26];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function changeReportFilename(summary: ReconciliationSummary): string {
  const prefix = summary.mode === 'COMBINE' ? 'BD_Japan_Combined' : summary.mode;
  return `${prefix}_Change_Report_${summary.asOfDate || 'latest'}.xlsx`;
}
