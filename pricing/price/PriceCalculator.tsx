import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, RefreshCw, FileText, X, Check, ChevronDown, Eye } from 'lucide-react';
import { parseDutyPdfFile, type UnifiedDutyBlock } from '../costing/utils/dutyParser';
import { Dropdown } from './Dropdown';
import { PdfPreview } from './PdfPreview';
import { savePdf, loadPdf, deletePdf, clearPdfs } from './pdfStore';
import {
  getStore, setStore as setSharedStore, getSelection, setSelection as setSharedSelection, subscribe,
  monthKey, monthRank, fmt, DEFAULT_STORE, EMPTY_SELECTION,
  type PriceStore as Store, type MonthData, type Entry,
} from './priceStore';

/* The state lives in ./priceStore, so this tool and the home-page card are one calculator. */
const PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/** pdf.js is loaded from the CDN once per page; reuse it if another tool already did. */
async function getPdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib?.GlobalWorkerOptions) return w.pdfjsLib;
  if (!document.querySelector(`script[src="${PDF_SRC}"]`)) {
    const s = document.createElement('script');
    s.src = PDF_SRC;
    s.async = true;
    document.body.appendChild(s);
  }
  for (let i = 0; i < 80; i++) {
    if (w.pdfjsLib) {
      if (!w.pdfjsLib.GlobalWorkerOptions.workerSrc) w.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return w.pdfjsLib;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('PDF লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ দেখে পেজটা refresh করুন।');
}

export default function PriceCalculator() {
  // both calculators read and write the same state
  const [, forceRender] = useState(0);
  useEffect(() => subscribe(() => forceRender(n => n + 1)), []);
  const store = getStore();
  const setStore = setSharedStore;
  const sel = getSelection();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [isErr, setIsErr] = useState(false);

  // the car being priced is shared too, so moving between the two views keeps your place
  const { year, carName, entryKey, usd, profit } = sel;
  const setYear = (v: string) => setSharedSelection(p => ({ ...p, year: v }));
  const setCarName = (v: string) => setSharedSelection(p => ({ ...p, carName: v }));
  const setEntryKey = (v: string) => setSharedSelection(p => ({ ...p, entryKey: v }));
  const setUsd = (v: string) => setSharedSelection(p => ({ ...p, usd: v }));
  const setProfit = (v: string) => setSharedSelection(p => ({ ...p, profit: v }));

  const [sheetsOpen, setSheetsOpen] = useState(false);        // section starts collapsed
  const [preview, setPreview] = useState<{ title: string; blob: Blob | null } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const openPreview = async (m: MonthData) => {
    const blob = await loadPdf(m.pdfId);
    setPreview({ title: `${m.label} · ${m.source}`, blob });
  };

  const say = (t: string, err = false) => { setStatus(t); setIsErr(err); };

  /* ---------------- duty sheet upload ---------------- */
  const handleUpload = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const files = [...list].filter(f => /\.pdf$/i.test(f.name));
    if (!files.length) { say('অনুগ্রহ করে duty sheet PDF দিন।', true); return; }
    setBusy(true);
    try {
      const pdfjsLib = await getPdfJs();
      const added: string[] = [];
      let firstCurrentLabel = '';
      let next = { ...store, months: [...store.months] };
      for (const f of files) {
        say(`পড়া হচ্ছে: ${f.name}…`);
        const res = await parseDutyPdfFile(f, pdfjsLib);
        const pdfId = `${f.name}|${f.size}|${f.lastModified}`;
        await savePdf(pdfId, f);                                  // keep the file for preview
        // one sheet carries two months: the current column and the previous one
        if (!firstCurrentLabel && res.meta.currentMonthLabel) firstCurrentLabel = res.meta.currentMonthLabel.trim();
        const pairs: { label: string; pick: (b: UnifiedDutyBlock, y: string) => number }[] = [
          { label: res.meta.currentMonthLabel, pick: (b, y) => b.rows[y].feb },
          { label: res.meta.previousMonthLabel, pick: (b, y) => b.rows[y].jan },
        ];
        for (const { label, pick } of pairs) {
          if (!label) continue;
          const entries: Entry[] = res.blocks
            .filter(b => b.vehicleName.trim() && Object.keys(b.rows).length)
            .map(b => {
              const years: { [y: string]: number } = {};
              for (const y of Object.keys(b.rows)) {
                const v = pick(b, y);
                if (Number.isFinite(v) && v > 0) years[y] = Math.round(v);
              }
              return { name: b.vehicleName.trim(), code: b.modelCode, hybrid: b.isHybrid, years };
            })
            .filter(e => Object.keys(e.years).length);
          if (!entries.length) continue;
          const i = next.months.findIndex(m => monthKey(m.label) === monthKey(label));
          const data: MonthData = { label: label.trim(), source: f.name, pdfId, entries };
          if (i >= 0) next.months[i] = data; else next.months.push(data);
          added.push(`${label.trim()} (${entries.length})`);
        }
      }
      next.months.sort((a, b) => monthRank(b.label) - monthRank(a.label));   // newest first
      // First sheet: start on the sheet's own current month. Later uploads never move the
      // operator's choice — it only changes when they pick another month or reset.
      const hadMonths = store.months.length > 0;
      const current = files.length ? firstCurrentLabel : '';
      if ((!hadMonths || !next.selectedMonth) && (current || next.months.length)) {
        next.selectedMonth = current || next.months[0].label;
      }
      setStore(next);
      say(added.length ? `✓ লোড হলো: ${added.join(', ')}` : 'এই PDF থেকে কোনো duty পাওয়া যায়নি।', !added.length);
    } catch (e: any) {
      say(e.message || 'PDF পড়া যায়নি।', true);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReset = () => {
    clearPdfs();
    setStore({ ...DEFAULT_STORE });
    setSharedSelection({ ...EMPTY_SELECTION });
    setYear(''); setCarName(''); setEntryKey(''); setUsd('');
    say('সব duty sheet মুছে ফেলা হয়েছে।');
  };

  const removeMonth = (label: string) => {
    const gone = store.months.find(m => monthKey(m.label) === monthKey(label));
    const months = store.months.filter(m => monthKey(m.label) !== monthKey(label));
    // drop the PDF only when no remaining month still comes from it
    if (gone && !months.some(m => m.pdfId === gone.pdfId)) deletePdf(gone.pdfId);
    const selectedMonth = monthKey(store.selectedMonth) === monthKey(label)
      ? (months[0]?.label || '') : store.selectedMonth;
    setStore({ ...store, months, selectedMonth });
    setCarName(''); setEntryKey('');
  };

  /* ---------------- derived lists ---------------- */
  const month = useMemo(
    () => store.months.find(m => monthKey(m.label) === monthKey(store.selectedMonth)) || null,
    [store.months, store.selectedMonth],
  );
  const years = useMemo(() => {
    const s = new Set<string>();
    month?.entries.forEach(e => Object.keys(e.years).forEach(y => s.add(y)));
    return [...s].sort((a, b) => Number(b) - Number(a));
  }, [month]);
  // Car names for the chosen month and year, each carrying the chassis codes behind it so the
  // name can also be found by typing a code — "NKE165" brings up both AXIO and FIELDER.
  const names = useMemo(() => {
    if (!month || !year) return [];
    const codes = new Map<string, Set<string>>();
    month.entries.forEach(e => {
      if (!e.years[year]) return;
      if (!codes.has(e.name)) codes.set(e.name, new Set());
      codes.get(e.name)!.add(e.code);
    });
    return [...codes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, set]) => ({ name, search: [...set].join(' ') }));
  }, [month, year]);
  const options = useMemo(() => {
    if (!month || !year || !carName) return [];
    return month.entries
      .filter(e => e.name === carName && e.years[year])
      .map(e => ({ key: `${e.code}|${e.hybrid}`, code: e.code, hybrid: e.hybrid, duty: e.years[year] }))
      .sort((a, b) => a.duty - b.duty);
  }, [month, year, carName]);

  // keep selections valid when something above them changes
  useEffect(() => { if (year && !years.includes(year)) { setYear(''); setCarName(''); setEntryKey(''); } }, [years]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (carName && !names.some(n => n.name === carName)) { setCarName(''); setEntryKey(''); } }, [names]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (options.length === 1) setEntryKey(options[0].key);
    else if (entryKey && !options.some(o => o.key === entryKey)) setEntryKey('');
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- the sum ---------------- */
  const picked = options.find(o => o.key === entryKey) || null;
  const usdVal = Number(usd) || 0;
  const converted = Math.round(usdVal * (store.rate || 0));
  const duty = picked ? picked.duty : 0;
  const total = converted + duty + (store.cnf || 0) + (store.drive || 0);
  const profitVal = Number(profit) || 0;
  const ready = usdVal > 0 && !!picked;

  const num = (v: number, set: (n: number) => void, id: string, label: string, hint?: string) => (
    <label className="gd-field gd-field-col" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" inputMode="numeric" value={Number.isFinite(v) ? v : ''}
        onChange={e => set(e.target.value === '' ? 0 : Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );

  return (
    <div className="gd-page">
      {/* ==================== MASTHEAD ==================== */}
      <header className="gd-mast">
        <div className="gd-wrap gd-mast-in">
          <div className="gd-seal" aria-hidden="true"><b>৳</b><small>PRICE</small></div>
          <div>
            <h1>Price Calculator</h1>
            <p className="gd-lede">
              Price one car by hand. Load a customs duty sheet once, pick the month, year and vehicle,
              then add the dollar price, C&amp;F and drive cost to get the costing price.
            </p>
            <p className="gd-bn">ডলার দাম + ডিউটি + CNF + ড্রাইভ → কস্টিং প্রাইস</p>
          </div>
          <div className="gd-ticket">Single car<br />pricing</div>
        </div>
      </header>

      <div className="gd-wrap">
        {/* ==================== DUTY SHEETS (collapsed by default) ==================== */}
        <section className="gd-sheet">
          <button type="button" className="gd-sheet-head gd-sheet-toggle" onClick={() => setSheetsOpen(o => !o)}
            aria-expanded={sheetsOpen}>
            <span className="gd-tag">Duty</span>
            <h2>Duty sheets</h2>
            <span className="gd-head-bn">
              {store.months.length
                ? `${store.months.length} মাস লোড আছে`
                : 'কোনো duty sheet নেই — খুলে আপলোড করুন'}
            </span>
            <motion.span animate={{ rotate: sheetsOpen ? 180 : 0 }} transition={{ duration: 0.18 }} className="gd-dd-chev">
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {sheetsOpen && (
              <motion.div
                key="sheets"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="gd-sheet-body">
                  <input ref={fileRef} id="price-duty-input" type="file" accept="application/pdf,.pdf" multiple
                    className="hidden" onChange={e => handleUpload(e.target.files)} disabled={busy} />

                  {store.months.length === 0 ? (
                    <div className="gd-drop" role="button" tabIndex={0}
                      onClick={() => !busy && fileRef.current?.click()}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}>
                      <span className="gd-step">1</span>
                      <h3>Customs duty sheet</h3>
                      <p>যেকোনো ডিউটি শিট (PDF) — Sahara / Habiba</p>
                      <p className="gd-hint">
                        একটা শিট থেকেই দুই মাসের ডিউটি পাওয়া যায় (চলতি ও আগের মাস)। একাধিক শিট দিলে সব মাস জমা থাকবে।
                      </p>
                      <div className="gd-files"><span className="gd-none">— কোনো duty sheet নেই —</span></div>
                    </div>
                  ) : (
                    <>
                      <div className="gd-month-list">
                        {store.months.map(m => (
                          <div key={m.label} className="gd-month">
                            <button type="button" className="gd-month-pick" onClick={() => openPreview(m)}
                              title="ডিউটি শিটটা দেখুন">
                              <span className="gd-month-name"><Eye className="w-3.5 h-3.5" />{m.label}</span>
                              <small>{m.entries.length} entries · {m.source}</small>
                            </button>
                            <button type="button" className="gd-remove" title="এই মাসটা সরান"
                              onClick={() => removeMonth(m.label)}><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                      <div className="gd-options">
                        <button type="button" className="gd-btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
                          <Upload className="w-3.5 h-3.5" /> আরেকটা duty sheet
                        </button>
                        <button type="button" className="gd-btn-ghost" onClick={handleReset} disabled={busy}>
                          <RefreshCw className="w-3.5 h-3.5" /> Reset
                        </button>
                        <span className="gd-status" style={{ marginLeft: 'auto' }}>মাসের নামে ক্লিক করলে শিটটা দেখা যাবে</span>
                      </div>
                    </>
                  )}

                  {status && <p className={`gd-status ${isErr ? '' : 'ok'}`} style={isErr ? { color: 'var(--stamp)' } : undefined}>{status}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ==================== CAR ==================== */}
        <section className="gd-sheet">
          <div className="gd-sheet-head">
            <span className="gd-tag">Car</span>
            <h2>Vehicle &amp; duty</h2>
            <span className="gd-head-bn">বছর → গাড়ি → ডিউটি বাছুন</span>
          </div>
          <div className="gd-sheet-body">
            {store.months.length === 0 ? (
              <p className="gd-empty">উপরে একটা duty sheet দিন — তারপর এখানে গাড়ি বাছা যাবে।</p>
            ) : (
              <>
                <div className="gd-grid4">
                  <Dropdown
                    id="price-month"
                    label="Duty month"
                    placeholder="Select duty month"
                    value={store.selectedMonth}
                    options={store.months.map(m => ({ value: m.label, label: m.label, hint: `${m.entries.length} entries` }))}
                    onChange={v => { setStore({ ...store, selectedMonth: v }); setCarName(''); setEntryKey(''); }}
                  />

                  <Dropdown
                    id="price-year"
                    label="Car year"
                    placeholder={month ? 'Select car year' : 'আগে duty month বাছুন'}
                    value={year}
                    options={years.map(y => ({ value: y, label: y }))}
                    disabled={!month}
                    onChange={v => { setYear(v); setCarName(''); setEntryKey(''); }}
                  />

                  <Dropdown
                    id="price-car"
                    label="Car name"
                    placeholder={year ? 'Select car name' : 'আগে বছর বাছুন'}
                    value={carName}
                    options={names.map(n => ({ value: n.name, label: n.name, search: n.search }))}
                    disabled={!year}
                    searchable
                    searchPlaceholder="নাম বা chassis code লিখুন…"
                    onChange={v => { setCarName(v); setEntryKey(''); }}
                  />

                  <label className="gd-field gd-field-col" htmlFor="price-usd">
                    <span>Dollar price (USD)</span>
                    <input id="price-usd" type="number" inputMode="decimal" placeholder="e.g. 22300"
                      value={usd} onChange={e => setUsd(e.target.value)} />
                    <small>× {store.rate || 0} = ৳{fmt(converted)}</small>
                  </label>
                </div>

                <AnimatePresence initial={false}>
                {carName && (
                  <motion.div className="gd-duty-pick" key={`${carName}-${year}`}
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}>
                    <p className="gd-hint">{carName} · {year} — এই গাড়ির যত ডিউটি আছে, একটা বাছুন:</p>
                    {options.map((o, i) => (
                      <motion.label key={o.key} className={`gd-duty-row${entryKey === o.key ? ' is-on' : ''}`}
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 + i * 0.05, duration: 0.2 }}>
                        <input type="radio" name="price-duty" value={o.key}
                          checked={entryKey === o.key} onChange={() => setEntryKey(o.key)} />
                        <span className="gd-duty-code">{o.code}{o.hybrid ? ' · hybrid' : ''}</span>
                        <span className="gd-duty-amt">৳{fmt(o.duty)}</span>
                      </motion.label>
                    ))}
                  </motion.div>
                )}
                </AnimatePresence>
              </>
            )}
          </div>
        </section>

        {/* ==================== COSTS ==================== */}
        <section className="gd-sheet">
          <div className="gd-sheet-head">
            <span className="gd-tag">Costs</span>
            <h2>Rate &amp; charges</h2>
            <span className="gd-head-bn">মনে রাখা হয়</span>
          </div>
          <div className="gd-sheet-body">
            <div className="gd-grid4">
              {num(store.rate, v => setStore({ ...store, rate: v }), 'price-rate', 'USD → ৳ rate', 'default 128')}
              {num(store.cnf, v => setStore({ ...store, cnf: v }), 'price-cnf', 'C&F cost (৳)', 'default 30,000')}
              {num(store.drive, v => setStore({ ...store, drive: v }), 'price-drive', 'Drive cost (৳)', 'default 15,000')}
              <label className="gd-field gd-field-col" htmlFor="price-profit">
                <span>Profit amount (৳)</span>
                <input id="price-profit" type="number" inputMode="numeric" placeholder="ফাঁকা রাখা যায়"
                  value={profit} onChange={e => setProfit(e.target.value)} />
                <small>দিলে নিচে বিক্রয় মূল্য দেখাবে</small>
              </label>
            </div>
          </div>
        </section>

        {/* ==================== RESULT ==================== */}
        <section className="gd-sheet">
          <div className="gd-sheet-head">
            <span className="gd-tag">Total</span>
            <h2>Costing price</h2>
            <span className="gd-head-bn">সব যোগ করে</span>
          </div>
          <div className="gd-sheet-body">
            <AnimatePresence mode="wait">
              {ready ? (
                <motion.div key="sum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <table className="gd-sum">
                    <tbody>
                      <tr>
                        <td>Dollar price</td>
                        <td className="gd-sum-sub">${usdVal.toLocaleString('en-US')} × {store.rate}</td>
                        <td className="gd-sum-amt">{fmt(converted)}</td>
                      </tr>
                      <tr>
                        <td>Duty</td>
                        <td className="gd-sum-sub">{picked!.code}{picked!.hybrid ? ' · hybrid' : ''} · {carName} · {year} · {month!.label}</td>
                        <td className="gd-sum-amt">{fmt(duty)}</td>
                      </tr>
                      <tr><td>C&amp;F cost</td><td /><td className="gd-sum-amt">{fmt(store.cnf)}</td></tr>
                      <tr><td>Drive cost</td><td /><td className="gd-sum-amt">{fmt(store.drive)}</td></tr>
                      <tr className={profitVal > 0 ? 'gd-sum-sub-total' : 'gd-sum-total'}>
                        <td>Costing price</td><td />
                        <td className="gd-sum-amt">৳{fmt(total)}</td>
                      </tr>
                      {profitVal > 0 && (
                        <>
                          <tr><td>Profit</td><td /><td className="gd-sum-amt">{fmt(profitVal)}</td></tr>
                          <tr className="gd-sum-total">
                            <td>Sale price</td><td />
                            <td className="gd-sum-amt">৳{fmt(total + profitVal)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </motion.div>
              ) : (
                <motion.p key="wait" className="gd-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <FileText className="w-4 h-4" />
                  {month ? 'গাড়ি, ডিউটি আর ডলার দাম দিলে এখানে কস্টিং প্রাইস দেখাবে।' : 'শুরু করতে একটা duty sheet দিন।'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </section>

        <p className="gd-note">Duty sheets stay in this browser until you reset them</p>
      </div>

      <AnimatePresence>
        {preview && (
          <PdfPreview title={preview.title} blob={preview.blob} onClose={() => setPreview(null)} />
        )}
      </AnimatePresence>

      {busy && (
        <div className="gd-overlay">
          <div className="gd-overlay-card">
            <div className="gd-sheet-head"><span className="gd-tag">Working</span><h2>Duty sheet পড়া হচ্ছে…</h2></div>
            <div className="gd-overlay-body">
              <p>{status}</p>
              <div className="gd-progress">
                <motion.div initial={{ x: '-60%' }} animate={{ x: ['-60%', '160%'] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
