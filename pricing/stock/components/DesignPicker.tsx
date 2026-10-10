import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Settings, X } from 'lucide-react';
import { SHEET_DESIGN_NAMES, type SheetDesign } from '../utils/sheetDesign';
import {
  DESIGN_LOCAL_KEY, msSinceDesignPull, onDesignChoicesChanged, pullDesignChoices,
  readDesignChoices, setSheetDesign, type DesignTool,
} from '../utils/designSetting';
import { isHostingerConfigured, LOGGED_IN_EVENT } from '../../../utils/hostinger.ts';

const TOOL_NAME: Record<DesignTool, string> = {
  BD: 'BD Stock',
  JAPAN: 'Japan Stock',
  COMBINE: 'BD + Japan Combine',
};

const ABOUT: Record<SheetDesign, string> = {
  classic: 'Teal header and red title bar — the look your sheets have today.',
  brand: 'Black title band, deep red header, light zebra rows — the website’s look.',
};

/** The design one tool writes, kept in step with other tabs and other computers. */
export function useSheetDesign(tool: DesignTool): SheetDesign {
  const [design, setDesign] = useState<SheetDesign>(() => readDesignChoices()[tool]);
  useEffect(() => {
    setDesign(readDesignChoices()[tool]);
    const off = onDesignChoicesChanged(c => setDesign(c[tool]));
    const pull = () => { void pullDesignChoices(); };
    const onFocus = () => { if (msSinceDesignPull() > 20000) pull(); };
    const onStorage = (e: StorageEvent) => { if (e.key === DESIGN_LOCAL_KEY) setDesign(readDesignChoices()[tool]); };
    pull();
    window.addEventListener('focus', onFocus);
    window.addEventListener(LOGGED_IN_EVENT, pull);
    window.addEventListener('storage', onStorage);
    return () => {
      off();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(LOGGED_IN_EVENT, pull);
      window.removeEventListener('storage', onStorage);
    };
  }, [tool]);
  return design;
}

/* ------------------------------------------------------------------ *
 * A small drawing of each design (fixed colours: it shows the Excel   *
 * file, so it looks the same in the site's dark and light modes)      *
 * ------------------------------------------------------------------ */
interface Palette {
  title: [string, string, string];      // three title rows
  titleInk: [string, string, string];
  accentWord?: string;                  // "OFFER LIST" colour
  titleFull: boolean;                   // the title spans the whole sheet
  header: string; headerGrid: string;
  grid: string; zebra?: string; band?: string;
  name: string; nameBold: boolean; text: string; status: string;
  separator: string; sepHeight: number;
  stockOut: string; stockOutFull: boolean;
}
const PALETTES: Record<SheetDesign, Palette> = {
  classic: {
    title: ['#BFBFBF', '#E2062B', '#FFFFFF'], titleInk: ['#262626', '#FFFFFF', '#262626'], titleFull: false,
    header: '#31859B', headerGrid: '#1d4f5c',
    grid: '#7a7a7a', band: '#CFE2F3',
    name: '#262626', nameBold: false, text: '#262626', status: '#262626',
    separator: '#31859B', sepHeight: 4, stockOut: '#E2062B', stockOutFull: false,
  },
  brand: {
    title: ['#111111', '#111111', '#111111'], titleInk: ['#A6A6A6', '#FFFFFF', '#D9D9D9'], accentWord: '#E2062B', titleFull: true,
    header: '#9D1414', headerGrid: '#B84A4A',
    grid: '#E0E0E0', zebra: '#FAFAFA',
    name: '#111111', nameBold: true, text: '#4D4D4D', status: '#2E7D32',
    separator: '#111111', sepHeight: 3, stockOut: '#E2062B', stockOutFull: true,
  },
};
// SL, NAME, GRADE, DESCRIPTION, PRICE, CHASSIS, LOCATION, STATUS
const COLS = '.45fr 1.25fr .7fr 2.4fr .85fr 1fr .85fr .85fr';
const CHASSIS = ['#B6D7A8', '#B6D7A8', '#CFE2F3', '#B6D7A8'];

function MiniSheet({ design }: { design: SheetDesign }) {
  const p = PALETTES[design];
  const brand = design === 'brand';
  const bar = (colour: string, width: string, bold = false) => (
    <b style={{ background: colour, width, height: bold ? 3 : 2 }} />
  );
  const carRow = (i: number, flagged = false) => {
    const bg = p.zebra && i % 2 === 1 ? p.zebra : '#FFFFFF';
    const cell = (c: number) => {
      let fill = bg;
      let ink = p.text;
      let bold = false;
      if (c === 1) { ink = p.name; bold = p.nameBold; }
      if (c === 5) fill = CHASSIS[i % CHASSIS.length];
      if (p.band && (c === 6 || c === 7)) fill = p.band;
      if (c === 7) { ink = flagged && brand ? '#C00000' : p.status; bold = brand; }
      if (flagged && c === 1) { fill = '#FF0000'; ink = '#FFFFFF'; }
      const align = c === 3 || (brand && c === 1) ? 'flex-start' : brand && c === 4 ? 'flex-end' : 'center';
      return (
        <i key={c} style={{ background: fill, borderColor: p.grid, justifyContent: align }}>
          {bar(ink, c === 3 ? '78%' : c === 0 ? '30%' : '58%', bold)}
        </i>
      );
    };
    return <div className="gd-xl-row gd-xl-car" style={{ gridTemplateColumns: COLS }}>{Array.from({ length: 8 }, (_, c) => cell(c))}</div>;
  };
  const titleText = (t: number) => t === 1
    ? (p.accentWord ? <>GARIR DOKAN&nbsp; <span style={{ color: p.accentWord }}>OFFER LIST</span></> : <>GARIR DOKAN OFFER LIST</>)
    : bar(p.titleInk[t], t === 0 ? '28%' : '50%');

  return (
    <div className="gd-xl" aria-hidden="true">
      {[0, 1, 2].map(t => (
        <div key={t} className={`gd-xl-title gd-xl-t${t}`}
          style={{ gridTemplateColumns: p.titleFull ? '1fr' : '62% 1fr 1fr 1fr' }}>
          <span style={{ background: p.title[t], color: p.titleInk[t], borderColor: p.titleFull ? p.title[t] : p.grid }}>{titleText(t)}</span>
          {!p.titleFull && [0, 1, 2].map(k => <span key={k} style={{ background: p.title[t], borderColor: p.grid }} />)}
        </div>
      ))}
      <div className="gd-xl-row gd-xl-head" style={{ gridTemplateColumns: COLS }}>
        {Array.from({ length: 8 }, (_, c) => (
          <i key={c} style={{ background: p.header, borderColor: p.headerGrid }}>{bar('#FFFFFF', '55%', brand)}</i>
        ))}
      </div>
      {carRow(0)}{carRow(1)}{carRow(2)}
      <div className="gd-xl-sep" style={{ background: p.separator, height: p.sepHeight }} />
      {carRow(3)}
      <div className="gd-xl-gap" />
      <div className="gd-xl-out" style={{ gridTemplateColumns: p.stockOutFull ? '1fr' : '62% 1fr' }}>
        <span style={{ background: p.stockOut, fontWeight: brand ? 700 : 400 }}>STOCK OUT</span>
        {!p.stockOutFull && <span />}
      </div>
      {carRow(0, true)}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The gear button and its panel                                       *
 * ------------------------------------------------------------------ */
export function DesignPicker({ tool, design, disabled, hasResult, runLabel }: {
  tool: DesignTool;
  design: SheetDesign;
  disabled?: boolean;
  /** a finished workbook is showing (it keeps the design it was made with) */
  hasResult?: boolean;
  runLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [changed, setChanged] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = (d: SheetDesign) => {
    if (d === design) return;
    setSheetDesign(tool, d);
    setChanged(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        id="excel-design-btn"
        type="button"
        className="gd-design-btn"
        onClick={() => { setChanged(false); setOpen(true); }}
        disabled={disabled}
        title="Excel design of the output file"
        aria-label={`Excel design: ${SHEET_DESIGN_NAMES[design]}. Change`}
      >
        <Settings />
        <small>Excel design</small>
        <b className="gd-design-full">{SHEET_DESIGN_NAMES[design]}</b>
        <b className="gd-design-short">{design === 'brand' ? 'Black & Red' : 'Classic'}</b>
      </button>

      {/* drawn at page level like the processing overlay, so the card's own animation cannot move it */}
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div className="gd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <motion.div className="gd-overlay-card gd-design-card" role="dialog" aria-modal="true" aria-labelledby="gd-design-title"
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}>
              <div className="gd-sheet-head">
                <span className="gd-tag">Settings</span>
                <h2 id="gd-design-title">Excel design · {TOOL_NAME[tool]}</h2>
                <button type="button" className="gd-design-close" onClick={() => setOpen(false)} aria-label="Close">
                  <X />
                </button>
              </div>
              <div className="gd-design-body">
                <p className="gd-design-lede">Choose how the {TOOL_NAME[tool]} output file looks. Only the look changes — data, order, serials and colour meanings stay the same.</p>
                <p className="gd-design-bn">কোন ডিজাইনে Excel ফাইল বের হবে, বেছে নিন</p>

                <div className="gd-design-grid" role="radiogroup" aria-label="Excel design">
                  {(['classic', 'brand'] as SheetDesign[]).map(d => (
                    <button key={d} type="button" role="radio" aria-checked={design === d}
                      id={`excel-design-${d}`}
                      className={`gd-design-opt${design === d ? ' is-on' : ''}`} onClick={() => choose(d)}>
                      <MiniSheet design={d} />
                      <h4>{SHEET_DESIGN_NAMES[d]}</h4>
                      <p>{ABOUT[d]}</p>
                      {design === d && <span className="gd-design-tick"><Check /></span>}
                    </button>
                  ))}
                </div>

                <div className="gd-design-foot">
                  <span>
                    {changed ? 'Saved. ' : ''}
                    {isHostingerConfigured ? 'Applies on every computer.' : 'Saved in this browser.'}
                    {changed && hasResult ? ` Press “${runLabel}” again to get the file in this design.` : ''}
                  </span>
                  <button type="button" className="gd-btn-primary" onClick={() => setOpen(false)}>Done</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, btnRef.current?.closest('.gd-page') || document.body)}
    </>
  );
}
