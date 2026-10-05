import React, { useState, useMemo } from 'react';
import type { ReconciliationSummary } from '../types';
import { Download, PlusCircle, RefreshCw, LogOut, Layers, Search, ArrowUpDown, FileCheck2, ExternalLink, FileText } from 'lucide-react';

interface DashLabels {
  neu: string; neuSub: string; updated: string; updatedSub: string;
  stockout: string; stockoutSub: string; total: string; keyLabel?: string; dup?: string;
}
interface ResultsDashboardProps {
  summary: ReconciliationSummary;
  onDownload: () => void;
  onDownloadReport?: () => void;
  labels?: DashLabels;
}

type TabType = 'NEW' | 'UPDATED' | 'STOCK_OUT' | 'DUPLICATE';

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  summary,
  onDownload,
  onDownloadReport,
  labels,
}) => {
  const L: DashLabels = labels || {
    neu: 'New Cars', neuSub: 'added to sheet',
    updated: 'Updated Cars', updatedSub: 'fields refreshed',
    stockout: 'Moved to Stock-Out', stockoutSub: 'relocated',
    total: 'Total Rows Now',
  };
  const [activeTab, setActiveTab] = useState<TabType>('NEW');
  const duplicateCars = summary.duplicateCars || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('key');
  const [sortAsc, setSortAsc] = useState(true);

  const isBD = summary.mode === 'BD';
  const keyLabel = L.keyLabel || (isBD ? 'CHASSIS NUMBER' : 'SL NO');

  // Sort toggle helper
  const filteredDuplicateCars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = duplicateCars;
    if (q) list = list.filter((c: any) =>
      String(c.key || '').toLowerCase().includes(q) ||
      String(c.carName || '').toLowerCase().includes(q) ||
      (c.changes || []).some((ch: any) => String(ch.oldValue || '').toLowerCase().includes(q)));
    return list;
  }, [duplicateCars, searchQuery]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtered & Sorted New Cars
  const filteredNewCars = useMemo(() => {
    let list = [...summary.newCars];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.carName.toLowerCase().includes(q) ||
          String(c.year || '').includes(q) ||
          String(c.price || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const valA = String((a as any)[sortField] || '').toLowerCase();
      const valB = String((b as any)[sortField] || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return list;
  }, [summary.newCars, searchQuery, sortField, sortAsc]);

  // Filtered & Sorted Updated Cars
  const filteredUpdatedCars = useMemo(() => {
    let list = [...summary.updatedCars];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.carName.toLowerCase().includes(q) ||
          c.changes.some(
            (ch) =>
              ch.field.toLowerCase().includes(q) ||
              String(ch.oldValue).toLowerCase().includes(q) ||
              String(ch.newValue).toLowerCase().includes(q)
          )
      );
    }
    list.sort((a, b) => {
      const valA = String((a as any)[sortField] || '').toLowerCase();
      const valB = String((b as any)[sortField] || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return list;
  }, [summary.updatedCars, searchQuery, sortField, sortAsc]);

  // Filtered & Sorted Stock Out Cars
  const filteredStockOutCars = useMemo(() => {
    let list = [...summary.stockOutCars];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.key.toLowerCase().includes(q) ||
          c.carName.toLowerCase().includes(q) ||
          c.groupName.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const valA = String((a as any)[sortField] || '').toLowerCase();
      const valB = String((b as any)[sortField] || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return list;
  }, [summary.stockOutCars, searchQuery, sortField, sortAsc]);

  return (
    <div className="mt-4 space-y-6">
      {/* Top Banner with Download & Color Legend */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold font-oswald text-white tracking-wide">
              RECONCILIATION COMPLETED ({summary.mode} STOCK)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            As of date: <strong className="text-white">{summary.asOfDate}</strong> · Ready to download customized workbook
          </p>

          {/* Color Legend Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
              Color Legend:
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white bg-[#B6D7A8] border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Green: Confirmed
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white bg-[#CFE2F3] border border-sky-500/35">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              Blue: Pending
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white bg-[#E2062B]">
              Red: Stock-Out Section
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white bg-[#FF0000]">
              Red Highlight: Stock-Out Car / Flag
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white bg-[#31859B]">
              Teal: Separator
            </span>
          </div>
        </div>

        {/* Prominent Download Button */}
        <button
          id="download-customized-sheet-btn"
          type="button"
          onClick={onDownload}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-sm tracking-wide shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          Download {summary.outputFilename}
        </button>
        {onDownloadReport && (
          <button
            id="download-change-report-btn"
            type="button"
            onClick={onDownloadReport}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-700/40 bg-white/5 hover:bg-red-700/10 text-red-500 font-semibold text-xs tracking-wide transition-all cursor-pointer shrink-0"
            title="Download an Excel audit of exactly what changed in this run"
          >
            <FileText className="w-4 h-4" />
            Change Report
          </button>
        )}
      </div>

      {/* 1. Four Headline Count Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {L.neu}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-oswald text-white">
              {summary.newCount}
            </span>
            <span className="text-xs text-gray-500 font-medium">{L.neuSub}</span>
          </div>
        </div>

        {/* Updated */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {L.updated}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-oswald text-white">
              {summary.updatedCount}
            </span>
            <span className="text-xs text-gray-500 font-medium">{L.updatedSub}</span>
          </div>
        </div>

        {/* Moved to Stock-Out */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {L.stockout}
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-oswald text-white">
              {summary.stockOutCount}
            </span>
            <span className="text-xs text-gray-500 font-medium">{L.stockoutSub}</span>
          </div>
        </div>

        {/* Total Rows */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {L.total}
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-oswald text-white">
              {summary.totalRowsCount}
            </span>
            <span className="text-xs text-gray-500 font-medium">in master sheet</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Tables Section */}
      <div className="bg-white/5 rounded-lg border border-white/10 shadow-sm overflow-hidden">
        {/* Tab Selector & Search Bar */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5">
          <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-lg shrink-0">
            <button
              id="tab-new-cars-btn"
              type="button"
              onClick={() => {
                setActiveTab('NEW');
                setSortField('key');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'NEW'
                  ? 'bg-white/5 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {L.neu} ({summary.newCount})
            </button>
            <button
              id="tab-updated-cars-btn"
              type="button"
              onClick={() => {
                setActiveTab('UPDATED');
                setSortField('key');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'UPDATED'
                  ? 'bg-white/5 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {L.updated} ({summary.updatedCount})
            </button>
            <button
              id="tab-stockout-cars-btn"
              type="button"
              onClick={() => {
                setActiveTab('STOCK_OUT');
                setSortField('key');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'STOCK_OUT'
                  ? 'bg-white/5 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {L.stockout} ({summary.stockOutCount})
            </button>
            {duplicateCars.length > 0 && (
              <button
                id="tab-duplicate-cars-btn"
                type="button"
                onClick={() => {
                  setActiveTab('DUPLICATE');
                  setSortField('key');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'DUPLICATE'
                    ? 'bg-white/5 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {(L.dup || 'Duplicates')} ({duplicateCars.length})
              </button>
            )}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by key, car name, field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/20 rounded-md focus:outline-hidden focus:ring-1 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-h-[500px]">
          {/* TAB 1: NEW CARS */}
          {activeTab === 'NEW' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-white/10 sticky top-0 z-10 text-gray-400 font-semibold border-b border-white/10">
                <tr>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('key')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{keyLabel}</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('carName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>CAR NAME</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('year')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>YEAR</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>PRICE</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th className="py-2.5 px-4">GRADE</th>
                  <th className="py-2.5 px-4">COLOR</th>
                  <th className="py-2.5 px-4">POINT</th>
                  <th className="py-2.5 px-4">MILAGE</th>
                  <th className="py-2.5 px-4">SOURCE TAG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredNewCars.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500 font-medium">
                      No new cars found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredNewCars.map((car, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-white bg-[#CFE2F3]/40">
                        {car.key}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white">{car.carName}</td>
                      <td className="py-2.5 px-4 text-gray-400">{car.year || '—'}</td>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        {car.price || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-gray-400">{car.grade || '—'}</td>
                      <td className="py-2.5 px-4 text-gray-400">{car.color || '—'}</td>
                      <td className="py-2.5 px-4 text-gray-400">{car.point || '—'}</td>
                      <td className="py-2.5 px-4 text-gray-400">{car.milage || '—'}</td>
                      <td className="py-2.5 px-4 text-[11px] text-gray-500 font-mono">
                        {car.sourceSheetTag || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: UPDATED CARS */}
          {activeTab === 'UPDATED' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-white/10 sticky top-0 z-10 text-gray-400 font-semibold border-b border-white/10">
                <tr>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('key')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{keyLabel}</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('carName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>CAR NAME</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th className="py-2.5 px-4">WHAT CHANGED (OldValue → NewValue)</th>
                  <th className="py-2.5 px-4">FORMULA / NOTE STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUpdatedCars.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 font-medium">
                      No updated records found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredUpdatedCars.map((car, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-white">
                        {car.key}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white">{car.carName}</td>
                      <td className="py-2.5 px-4">
                        <div className="space-y-1">
                          {car.changes.map((ch, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white font-mono">
                                {ch.field} {ch.colName ? `[${ch.colName}]` : ''}
                              </span>
                              <span className="line-through text-gray-500">
                                {String(ch.oldValue ?? 'BLANK')}
                              </span>
                              <span className="text-gray-500 font-bold">→</span>
                              <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                                {String(ch.newValue ?? 'BLANK')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">
                        {car.formulasRebuilt ? (
                          <span className="text-[11px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/25">
                            Rebuilt Live Formulas: {car.formulasRebuilt.join(', ')}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: MOVED TO STOCK-OUT */}
          {activeTab === 'STOCK_OUT' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-white/10 sticky top-0 z-10 text-gray-400 font-semibold border-b border-white/10">
                <tr>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('key')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{keyLabel}</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('carName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>CAR NAME</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th className="py-2.5 px-4">TARGET GROUP IN STOCK-OUT</th>
                  <th className="py-2.5 px-4">STATUS APPLIED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredStockOutCars.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 font-medium">
                      No cars moved to stock-out in this run.
                    </td>
                  </tr>
                ) : (
                  filteredStockOutCars.map((car, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-white">
                        {car.key}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-white font-bold bg-[#FF0000]">
                          {car.carName}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-gray-400">
                        Group: {car.groupName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold text-red-400 bg-red-500/15 border border-red-500/25">
                          STOCK OUT
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: DUPLICATES (combine only) */}
          {activeTab === 'DUPLICATE' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-white/10 sticky top-0 z-10 text-gray-400 font-semibold border-b border-white/10">
                <tr>
                  <th
                    className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('key')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{keyLabel}</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-500" />
                    </div>
                  </th>
                  <th className="py-2.5 px-4">CAR NAME (BD)</th>
                  <th className="py-2.5 px-4">DUPLICATE JAPAN LISTING</th>
                  <th className="py-2.5 px-4">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredDuplicateCars.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 font-medium">
                      No duplicate listings.
                    </td>
                  </tr>
                ) : (
                  filteredDuplicateCars.map((car: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-white">{car.key}</td>
                      <td className="py-2.5 px-4 font-bold text-white">{car.carName}</td>
                      <td className="py-2.5 px-4 text-gray-400">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {String(car.changes?.[0]?.oldValue ?? '')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30">
                          Kept once · verify
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
