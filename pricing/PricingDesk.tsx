import React, { useEffect, useRef, useState } from 'react';
import { PanelLeft, ArrowLeftRight, ShieldCheck, Calculator } from 'lucide-react';
import './pricing-desk.css';
import CostingDesk from './costing/CostingDesk';
import PriceCalculator from './price/PriceCalculator';
import StockStudio, { type StockMode } from './stock/StockStudio';

type Tool = 'PRICE' | 'COSTING' | StockMode;

const TOOL_TITLES: Record<Tool, string> = {
  PRICE: 'Price Calculator',
  COSTING: 'Japan to BD Convert',
  BD: 'BD Stock',
  JAPAN: 'Japan Stock',
  COMBINE: 'BD + Japan Combine',
};

const MOBILE_QUERY = '(max-width: 760px)';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* storage unavailable — ignore */ }
}
const isMobile = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

export default function PricingDesk() {
  const [tool, setTool] = useState<Tool>(() =>
    readStored<Tool>('gd.tool', ['PRICE', 'COSTING', 'BD', 'JAPAN', 'COMBINE'], 'COSTING'));
  const [stockMode, setStockMode] = useState<StockMode>(() =>
    readStored<StockMode>('gd.stockMode', ['BD', 'JAPAN', 'COMBINE'], 'BD'));
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (isMobile()) return true;
    return readStored('gd.panel', ['open', 'closed'] as const, 'open') === 'closed';
  });

  const selectTool = (next: Tool) => {
    setTool(next);
    writeStored('gd.tool', next);
    if (next !== 'COSTING' && next !== 'PRICE') { setStockMode(next); writeStored('gd.stockMode', next); }
    if (isMobile()) setCollapsed(true);
    window.scrollTo({ top: 0 });
  };

  const togglePanel = () => {
    setCollapsed((c) => {
      const next = !c;
      if (!isMobile()) writeStored('gd.panel', next ? 'closed' : 'open');
      return next;
    });
  };

  const navItem = (id: Tool, icon: React.ReactNode, title: string, sub: string, taka = false) => (
    <button
      type="button"
      id={`nav-${id.toLowerCase()}`}
      className={`gd-nav-item${tool === id ? ' is-active' : ''}`}
      aria-current={tool === id ? 'page' : undefined}
      title={collapsed ? title : undefined}
      onClick={() => selectTool(id)}
    >
      <span className={`gd-nav-ico${taka ? ' is-taka' : ''}`} aria-hidden="true">{icon}</span>
      <span className="gd-nav-text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
    </button>
  );

  // The site's navigation bar is fixed and its height changes with the breakpoint, so the desk
  // measures it and keeps its own top offset in step instead of assuming a number.
  const appRef = useRef<HTMLDivElement>(null);
  // the home page can ask for this tool by name
  useEffect(() => {
    const onOpenTool = (e: Event) => {
      const wanted = (e as CustomEvent).detail;
      if (wanted === 'PRICE' || wanted === 'COSTING' || wanted === 'BD' || wanted === 'JAPAN' || wanted === 'COMBINE') {
        selectTool(wanted as Tool);
      }
    };
    window.addEventListener('gd:open-tool', onOpenTool);
    return () => window.removeEventListener('gd:open-tool', onOpenTool);
  }, []);

  useEffect(() => {
    const sync = () => {
      const el = appRef.current;
      if (!el) return;
      const nav = document.querySelector('nav');
      let h = 0;
      if (nav) {
        const cs = window.getComputedStyle(nav);
        if (cs.position === 'fixed' || cs.position === 'sticky') h = nav.getBoundingClientRect().height;
      }
      el.style.setProperty('--gd-nav', `${Math.round(h)}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    const t = window.setTimeout(sync, 400);          // after the site's own entrance animation
    return () => { window.removeEventListener('resize', sync); window.clearTimeout(t); };
  }, []);

  return (
    <div className="gd-app" ref={appRef}>
    <div className="gd-shell">
      {!collapsed && <div className="gd-scrim" onClick={togglePanel} aria-hidden="true" />}

      <aside className={`gd-side${collapsed ? ' is-collapsed' : ''}`} aria-label="Tools">
        <div className="gd-side-head">
          <div className="gd-brand">
            <div className="gd-brand-seal" aria-hidden="true"><b>৳</b></div>
            <div className="gd-brand-text">
              <strong>GARIR DOKAN</strong>
              <span>Operations Desk</span>
            </div>
          </div>
          <button
            type="button"
            id="panel-toggle-btn"
            className="gd-toggle"
            onClick={togglePanel}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <PanelLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="gd-nav">
          <div className="gd-sec-label">Price</div>
          {navItem('PRICE', <Calculator className="w-[15px] h-[15px]" strokeWidth={2} />, 'Price Calculator', 'One car, by hand')}

          <div className="gd-sec-gap" aria-hidden="true" />

          <div className="gd-sec-label">Japan → BD</div>
          {navItem('COSTING', '৳', 'Japan to BD Convert', 'Raita + duty → BDT costing', true)}

          <div className="gd-sec-gap" aria-hidden="true" />

          <div className="gd-sec-label">Stock Sheets</div>
          {navItem('BD', 'BD', 'BD Stock', 'Chassis-keyed update')}
          {navItem('JAPAN', 'JP', 'Japan Stock', 'SL + fingerprint update')}
          {navItem('COMBINE', <ArrowLeftRight className="w-[15px] h-[15px]" strokeWidth={2} />, 'BD + Japan Combine', 'Merge both into one sheet')}
        </nav>

        <div className="gd-side-foot" title="Runs 100% in your browser">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Runs 100% in your browser</span>
        </div>
      </aside>

      <div className="gd-content">
        {/* Both tools stay mounted so each keeps its files and results while you switch.
            The costing tool also loads its PDF/Excel libraries once, exactly as it did standalone. */}
        <div hidden={tool !== 'PRICE'}>
          <PriceCalculator />
        </div>
        <div hidden={tool !== 'COSTING'}>
          <CostingDesk />
        </div>
        <div hidden={tool === 'COSTING' || tool === 'PRICE'}>
          <StockStudio mode={stockMode} />
        </div>
      </div>
    </div>
    </div>
  );
}
