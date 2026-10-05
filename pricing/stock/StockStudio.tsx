import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Mode, ReconciliationSummary } from './types';
import { FileDropzone } from './components/FileDropzone';
import { WarningsBanner } from './components/WarningsBanner';
import { ResultsDashboard } from './components/ResultsDashboard';
import { combineStocks } from './services/combineService';
import { CarAnimation } from './components/CarAnimation';
import { reconcileBDStock } from './services/bdReconciler';
import { reconcileJapanStock } from './services/japanReconciler';
import { generateSampleBDFiles, generateSampleJapanFiles } from './utils/sampleData';
import { formatDateForInput } from './utils/excelHelpers';
import { generateChangeReportBlob, changeReportFilename } from './utils/changeReport';
import { Calendar, Sparkles, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';

export type StockMode = 'BD' | 'JAPAN' | 'COMBINE';

/* per-tool masthead copy */
const PAGE: Record<StockMode, {
  title: string; lede: string; bn: string; seal: string;
  intakeBn: string; outputTitle: string; outputBn: string; runLabel: string; working: string;
}> = {
  BD: {
    title: 'BD Stock Update',
    lede: 'Upload your master sheet and the new BD stock list. Every car is matched by chassis, location, costing and photos are refreshed, and sold units move to Stock-Out.',
    bn: 'কাস্টমাইজড শিট + নতুন স্টক লিস্ট → আপডেট শিট',
    seal: 'STOCK · BD',
    intakeBn: 'দুটো ফাইল দিন',
    outputTitle: 'Updated Workbook', outputBn: 'আপডেট শিট ডাউনলোড করুন',
    runLabel: 'Update BD Stock', working: 'Reconciling BD Stock…',
  },
  JAPAN: {
    title: 'Japan Stock Update',
    lede: 'Upload your master sheet and the latest RAITA supplier list. Cars are matched by SL and their Mileage · Year · Colour · Point fingerprint, prices are refreshed with notes, and sold units move to Stock-Out.',
    bn: 'কাস্টমাইজড শিট + RAITA লিস্ট → আপডেট শিট',
    seal: 'STOCK · JP',
    intakeBn: 'দুটো ফাইল দিন',
    outputTitle: 'Updated Workbook', outputBn: 'আপডেট শিট ডাউনলোড করুন',
    runLabel: 'Update Japan Stock', working: 'Reconciling Japan Stock…',
  },
  COMBINE: {
    title: 'BD + Japan Combine',
    lede: 'Upload your updated BD and Japan sheets. Shared cars are merged into one row, transfers are flagged red, and Japan-only cars join their model sections.',
    bn: 'আপডেট BD শিট + আপডেট Japan শিট → কম্বাইন্ড শিট',
    seal: 'BD + JP',
    intakeBn: 'দুটো আপডেট শিট দিন',
    outputTitle: 'Combined Workbook', outputBn: 'কম্বাইন্ড শিট ডাউনলোড করুন',
    runLabel: 'Combine BD + Japan', working: 'Combining BD + Japan…',
  },
};

export default function StockStudio({ mode: requestedMode }: { mode: StockMode }) {
  type AppMode = Mode | 'COMBINE';
  const [mode, setMode] = useState<AppMode>(requestedMode);

  const [bdCustomizedFile, setBdCustomizedFile] = useState<File | null>(null);
  const [bdSourceFile, setBdSourceFile] = useState<File | null>(null);
  const [japanCustomizedFile, setJapanCustomizedFile] = useState<File | null>(null);
  const [japanSourceFile, setJapanSourceFile] = useState<File | null>(null);
  const [combineBdFile, setCombineBdFile] = useState<File | null>(null);
  const [combineJpFile, setCombineJpFile] = useState<File | null>(null);

  const [asOfDate, setAsOfDate] = useState<string>(formatDateForInput(new Date()));
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  const handleSelectMode = (newMode: AppMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setSummary(null);
    setErrorMsg(null);
    if (newMode !== 'BD') { setBdCustomizedFile(null); setBdSourceFile(null); }
    if (newMode !== 'JAPAN') { setJapanCustomizedFile(null); setJapanSourceFile(null); }
    if (newMode !== 'COMBINE') { setCombineBdFile(null); setCombineJpFile(null); }
  };

  const activeHasFiles =
    mode === 'BD'
      ? !!bdCustomizedFile && !!bdSourceFile
      : mode === 'JAPAN'
      ? !!japanCustomizedFile && !!japanSourceFile
      : !!combineBdFile && !!combineJpFile;

  const handleLoadSampleFiles = async () => {
    try {
      setIsProcessing(true);
      setProgressMsg('Generating sample test Excel workbooks…');
      setErrorMsg(null);
      if (mode === 'BD') {
        const { customizedBlob, sourceBlob } = await generateSampleBDFiles();
        setBdCustomizedFile(new File([customizedBlob], 'BD_Update_Customized_Sheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        setBdSourceFile(new File([sourceBlob], 'BD_STOCK_LIST.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      } else {
        const { customizedBlob, sourceBlob } = await generateSampleJapanFiles();
        setJapanCustomizedFile(new File([customizedBlob], 'Japan_Customized_Sheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        setJapanSourceFile(new File([sourceBlob], 'RAITA_MY_STOCK_LIST.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate sample files.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleRunReconciliation = async () => {
    if (!activeHasFiles) return;
    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setSummary(null);
      const targetDate = asOfDate || formatDateForInput(new Date());
      let result: ReconciliationSummary;
      if (mode === 'BD') {
        result = await reconcileBDStock(bdCustomizedFile!, bdSourceFile!, targetDate, (msg) => setProgressMsg(msg));
      } else if (mode === 'JAPAN') {
        result = await reconcileJapanStock(japanCustomizedFile!, japanSourceFile!, targetDate, (msg) => setProgressMsg(msg));
      } else {
        result = await combineStocks(combineBdFile!, combineJpFile!, targetDate, (msg) => setProgressMsg(msg));
      }
      setSummary(result);
      setTimeout(() => document.getElementById('results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'An error occurred during reconciliation.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleDownload = () => {
    if (!summary) return;
    const url = window.URL.createObjectURL(summary.outputBlob);
    const a = document.createElement('a');
    a.href = url; a.download = summary.outputFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async () => {
    if (!summary) return;
    try {
      const blob = await generateChangeReportBlob(summary);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = changeReportFilename(summary);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate the change report.');
    }
  };

  const handleResetAll = () => {
    setBdCustomizedFile(null); setBdSourceFile(null);
    setJapanCustomizedFile(null); setJapanSourceFile(null);
    setCombineBdFile(null); setCombineJpFile(null);
    setSummary(null); setErrorMsg(null);
  };

  const stepFilesDone = activeHasFiles;
  const stepRunDone = !!summary;

  // The left panel chooses the tool; switching runs exactly the same handler the old
  // in-page mode buttons used (clears the other tools' files and any previous result).
  useEffect(() => {
    handleSelectMode(requestedMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedMode]);

  const p = PAGE[mode as StockMode] || PAGE.BD;   // never render without page copy

  return (
    <div className="gd-page">
      {/* ==================== MASTHEAD ==================== */}
      <header className="gd-mast">
        <div className="gd-wrap gd-mast-in">
          <div className="gd-seal" aria-hidden="true"><b>৳</b><small>{p.seal}</small></div>
          <div>
            <h1>{p.title}</h1>
            <p className="gd-lede">{p.lede}</p>
            <p className="gd-bn">{p.bn}</p>
          </div>
          <div className="gd-ticket">Stock sheet<br />terminal</div>
        </div>
      </header>

      <div className="gd-wrap">
        {/* ==================== INTAKE ==================== */}
        <motion.section
          key={mode}
          className="gd-sheet"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="gd-sheet-head">
            <span className="gd-tag">Intake</span>
            <h2>Workbooks</h2>
            <span className="gd-head-bn">{p.intakeBn}</span>
          </div>
          <div className="gd-sheet-body">
            <div className="gd-intake">
              {mode === 'BD' ? (
                <>
                  <FileDropzone id="bd-customized-dropzone" step={1} label="Current Customized Sheet"
                    expectedFilename="BD_Update_Customized_Sheet.xlsx"
                    description="The master tracker with IN STOCK & STOCK OUT sections"
                    file={bdCustomizedFile} onFileSelect={setBdCustomizedFile} onFileRemove={() => setBdCustomizedFile(null)} disabled={isProcessing} />
                  <FileDropzone id="bd-source-dropzone" step={2} label="New Stock List"
                    expectedFilename="BD_STOCK_LIST.xlsx"
                    description="Fresh flat list: NAME, DESCRIPTION, CHASSIS, PRICE"
                    file={bdSourceFile} onFileSelect={setBdSourceFile} onFileRemove={() => setBdSourceFile(null)} disabled={isProcessing} />
                </>
              ) : mode === 'JAPAN' ? (
                <>
                  <FileDropzone id="japan-customized-dropzone" step={1} label="Current Customized Sheet"
                    expectedFilename="Japan_Customized_Sheet.xlsx"
                    description="The master tracker with IN STOCK & STOCK OUT sections"
                    file={japanCustomizedFile} onFileSelect={setJapanCustomizedFile} onFileRemove={() => setJapanCustomizedFile(null)} disabled={isProcessing} />
                  <FileDropzone id="japan-source-dropzone" step={2} label="New Supplier Stock List"
                    expectedFilename="RAITA-style file (MY STOCK LIST)"
                    description="Supplier list: SL NO, CAR NAME, USD, CNF, DUTY, TOTAL"
                    file={japanSourceFile} onFileSelect={setJapanSourceFile} onFileRemove={() => setJapanSourceFile(null)} disabled={isProcessing} />
                </>
              ) : (
                <>
                  <FileDropzone id="combine-bd-dropzone" step={1} label="Updated BD Sheet"
                    expectedFilename="BD_Update_Customized_Sheet.xlsx"
                    description="Your latest BD STOCK workbook (after BD update)"
                    file={combineBdFile} onFileSelect={setCombineBdFile} onFileRemove={() => setCombineBdFile(null)} disabled={isProcessing} />
                  <FileDropzone id="combine-jp-dropzone" step={2} label="Updated Japan Sheet"
                    expectedFilename="Japan_Customized_Sheet.xlsx"
                    description="Your latest JAPAN STOCK workbook (after Japan update)"
                    file={combineJpFile} onFileSelect={setCombineJpFile} onFileRemove={() => setCombineJpFile(null)} disabled={isProcessing} />
                </>
              )}
            </div>

            {/* options */}
            <div className="gd-options">
              <label className="gd-field" htmlFor="as-of-date-input">
                <Calendar className="w-4 h-4" /> As-of date
                <input
                  id="as-of-date-input"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  disabled={isProcessing}
                />
              </label>
              {mode !== 'COMBINE' && (
                <button id="try-sample-data-btn" type="button" className="gd-btn-ghost"
                  onClick={handleLoadSampleFiles} disabled={isProcessing}>
                  <Sparkles className="w-3.5 h-3.5" /> Load {mode === 'BD' ? 'BD' : 'Japan'} sample
                </button>
              )}
              <button id="header-reset-btn" type="button" className="gd-btn-ghost" onClick={handleResetAll}>
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            {/* action row */}
            <div className="gd-actions">
              {!activeHasFiles && <span className="gd-status">Upload both files to enable the update</span>}
              {activeHasFiles && !summary && (
                <span className="gd-status ok"><CheckCircle className="w-4 h-4" /> Both files loaded — ready to run</span>
              )}
              {summary && (
                <span className="gd-status done"><CheckCircle className="w-4 h-4" /> Done — your workbook is ready below</span>
              )}
              <button
                id="update-stock-btn"
                type="button"
                className="gd-btn-primary"
                onClick={handleRunReconciliation}
                disabled={!activeHasFiles || isProcessing}
              >
                {isProcessing ? <>Processing…</> : <>{p.runLabel} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div className="gd-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <b>Something needs attention</b>
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ==================== OUTPUT ==================== */}
        <div id="results-anchor" />
        <section className="gd-sheet">
          <div className="gd-sheet-head">
            <span className="gd-tag">Output</span>
            <h2>{p.outputTitle}</h2>
            <span className="gd-head-bn">{p.outputBn}</span>
          </div>
          <div className="gd-sheet-body">
            <AnimatePresence mode="wait">
              {summary ? (
                <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
                  <WarningsBanner warnings={summary.warnings} />
                  {mode === 'COMBINE' ? (
                    <ResultsDashboard
                      summary={summary}
                      onDownload={handleDownload}
                      onDownloadReport={handleDownloadReport}
                      labels={{
                        neu: 'Japan-only Added', neuSub: 'from Japan list',
                        updated: 'Merged (BD+JP)', updatedSub: 'info combined',
                        stockout: 'Transferred', stockoutSub: 'shown red',
                        total: 'Total Combined', keyLabel: 'CHASSIS / SL', dup: 'Duplicates',
                      }}
                    />
                  ) : (
                    <ResultsDashboard summary={summary} onDownload={handleDownload} onDownloadReport={handleDownloadReport} />
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty" className="gd-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <CarAnimation width={280} />
                  <p>Your updated workbook &amp; change report will appear here.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <p className="gd-note">Runs entirely in your browser · Styles, formulas &amp; notes preserved</p>
      </div>

      {/* ==================== PROCESSING OVERLAY ==================== */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div className="gd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="gd-overlay-card" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}>
              <div className="gd-sheet-head">
                <span className="gd-tag">Working</span>
                <h2>{p.working}</h2>
              </div>
              <div className="gd-overlay-body">
                <CarAnimation width={320} driving className="mx-auto" />
                <p>{progressMsg || 'Crunching your workbook…'}</p>
                <div className="gd-progress">
                  <motion.div
                    initial={{ x: '-60%' }}
                    animate={{ x: ['-60%', '160%'] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
