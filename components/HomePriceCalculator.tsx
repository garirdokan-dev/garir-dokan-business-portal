import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, ArrowUpRight, Car, Upload } from 'lucide-react';
import { Dropdown } from '../pricing/price/Dropdown';
import '../pricing/pricing-desk.css';
import {
  getStore, setStore as setSharedStore, getSelection, setSelection as setSharedSelection, subscribe,
  findMonth, yearsOf, carsOf, dutiesOf, totals, fmt,
} from '../pricing/price/priceStore';

interface Props {
  /** take the operator to the full calculator inside the Pricing Desk */
  onOpenDesk: () => void;
}

const Money: React.FC<{
  label: string; value: string | number; onChange: (v: string) => void; hint?: string; placeholder?: string;
}> = ({ label, value, onChange, hint, placeholder }) => (
  <label className="block">
    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-gray-500">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm font-bold text-white outline-none transition-colors placeholder:text-gray-500 hover:border-white/20 focus:border-red-700"
    />
    {hint && <span className="mt-1.5 block text-[10px] font-bold text-gray-400">{hint}</span>}
  </label>
);

export const HomePriceCalculator: React.FC<Props> = ({ onOpenDesk }) => {
  const [, tick] = useState(0);
  useEffect(() => subscribe(() => tick(n => n + 1)), []);

  const store = getStore();
  const sel = getSelection();
  const month = useMemo(() => findMonth(store), [store]);
  const years = useMemo(() => yearsOf(month), [month]);
  const cars = useMemo(() => carsOf(month, sel.year), [month, sel.year]);
  const picked = useMemo(
    () => dutiesOf(month, sel.year, sel.carName).find(d => d.key === sel.entryKey) || null,
    [month, sel.year, sel.carName, sel.entryKey],
  );

  const sum = totals(store, sel, picked ? picked.duty : 0);
  const ready = sum.usdVal > 0 && !!picked;
  const set = (patch: Partial<typeof sel>) => setSharedSelection(p => ({ ...p, ...patch }));

  return (
    <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] border border-white/5 bg-white/5">
      {/* ---------- moving backdrop: a road with a car crossing it ---------- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-20 top-[-30%] h-[140%] w-[60%] rotate-12 bg-gradient-to-br from-red-700/10 via-transparent to-transparent blur-3xl" />
        <div className="gd-road-edge absolute inset-x-0 bottom-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-[38px] h-px overflow-hidden opacity-40">
          <div className="gd-road h-px w-[200%] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.35)_0_28px,transparent_28px_64px)]" />
        </div>
        <Car className="gd-drive absolute bottom-[42px] h-7 w-7 text-red-700/40" />
        <div className="absolute right-[-60px] top-[-60px] h-56 w-56 rounded-full bg-red-700/10 blur-3xl" />
      </div>
      <style>{`
        @keyframes gd-road-slide { to { transform: translateX(-64px); } }
        @keyframes gd-drive-across { 0% { left: -8%; opacity: 0; } 8% { opacity: 1; }
          92% { opacity: 1; } 100% { left: 104%; opacity: 0; } }
        .gd-road { animation: gd-road-slide 1.6s linear infinite; }
        .gd-drive { animation: gd-drive-across 14s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .gd-road, .gd-drive { animation: none; } }
        /* the road is drawn in white for the dark theme; on a light page it needs dark ink */
        html.light-mode .gd-road-edge { background-image: linear-gradient(90deg, transparent, rgba(17,24,39,.18), transparent) !important; }
        html.light-mode .gd-road { background-image: repeating-linear-gradient(90deg, rgba(17,24,39,.45) 0 28px, transparent 28px 64px) !important; }
      `}</style>

      <div className="relative p-6 md:p-12">
        {/* ---------- header ---------- */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-700 text-white shadow-lg shadow-red-700/30">
                <Calculator className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Instant Pricing</span>
            </div>
            <h3 className="text-2xl font-black uppercase leading-none tracking-tighter md:text-4xl">
              Price a car <span className="text-gray-400">in seconds</span>
            </h3>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-gray-500 md:text-sm">
              Dollar price, customs duty, C&amp;F and drive — the landed cost, right here. The duty
              sheets and the charges are the same ones the Pricing Desk uses.
            </p>
          </div>
          <button
            onClick={onOpenDesk}
            title="Open the full calculator in the Pricing Desk"
            aria-label="Open the full calculator in the Pricing Desk"
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-all hover:border-red-700/40 hover:bg-red-700/10 hover:text-red-600 active:scale-95 md:h-12 md:w-12"
          >
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>

        {store.months.length === 0 ? (
          /* ---------- nothing loaded yet ---------- */
          <div className="mt-8 flex flex-col items-start gap-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-gray-200">No duty sheet loaded</p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-gray-500">
                Upload a customs duty sheet once in the Pricing Desk. It stays in this browser, and
                this card starts working straight away.
              </p>
            </div>
            <button
              onClick={onOpenDesk}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-red-700 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-800 active:scale-95"
            >
              <Upload className="h-4 w-4" /> Load a duty sheet
            </button>
          </div>
        ) : (
          <>
            {/* ---------- vehicle & duty: the Pricing Desk's own controls ---------- */}
            <div className="gd-app gd-embed mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Dropdown
                id="home-month"
                label="Duty month"
                placeholder="Select duty month"
                value={store.selectedMonth}
                options={store.months.map(m => ({ value: m.label, label: m.label, hint: `${m.entries.length} entries` }))}
                onChange={v => { setSharedStore({ ...store, selectedMonth: v }); set({ carName: '', entryKey: '' }); }}
              />
              <Dropdown
                id="home-year"
                label="Car year"
                placeholder={month ? 'Select car year' : 'Pick a month first'}
                value={sel.year}
                disabled={!month}
                options={years.map(y => ({ value: y, label: y }))}
                onChange={v => set({ year: v, carName: '', entryKey: '' })}
              />
              {/* choosing a car opens its duty amounts inside the same panel */}
              <Dropdown
                id="home-car"
                label="Car name"
                placeholder={sel.year ? 'Select car name' : 'Pick a year first'}
                value={sel.carName}
                disabled={!sel.year}
                searchable
                searchPlaceholder="নাম বা chassis code লিখুন…"
                options={cars.map(c => ({ value: c.name, label: c.name, search: c.search }))}
                onChange={v => set({ carName: v, entryKey: '' })}
                step2={{
                  heading: name => `${name} · ${sel.year}`,
                  value: sel.entryKey,
                  options: name => dutiesOf(month, sel.year, name).map(d => ({
                    value: d.key,
                    label: `${d.code}${d.hybrid ? ' · hyb' : ''}`,
                    hint: `৳${fmt(d.duty)}`,
                  })),
                  onSelect: (name, key) => set({ carName: name, entryKey: key }),
                }}
              />
            </div>

            {picked && (
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                Duty chosen — <span className="text-gray-300">{picked.code}{picked.hybrid ? ' · hyb' : ''}</span>
                <span className="text-red-600"> ৳{fmt(picked.duty)}</span>
              </p>
            )}

            {/* ---------- rate & charges ---------- */}
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <Money label="Dollar price" value={sel.usd} placeholder="e.g. 22300"
                onChange={v => set({ usd: v })} hint={`× ${store.rate || 0} = ৳${fmt(sum.converted)}`} />
              <Money label="USD → ৳ rate" value={store.rate}
                onChange={v => setSharedStore({ ...store, rate: Number(v) || 0 })} hint="default 128" />
              <Money label="C&F cost" value={store.cnf}
                onChange={v => setSharedStore({ ...store, cnf: Number(v) || 0 })} hint="default 30,000" />
              <Money label="Drive cost" value={store.drive}
                onChange={v => setSharedStore({ ...store, drive: Number(v) || 0 })} hint="default 15,000" />
              <Money label="Profit" value={sel.profit} placeholder="optional"
                onChange={v => set({ profit: v })} hint="adds a sale price" />
            </div>

            {/* ---------- the total ---------- */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6 md:p-8">
              {ready ? (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                    {[
                      ['Dollar price', sum.converted],
                      ['Duty', sum.duty],
                      ['C&F', store.cnf],
                      ['Drive', store.drive],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</p>
                        <p className="mt-1 text-sm font-bold text-gray-300">৳{fmt(value as number)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="lg:text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400">Costing price</p>
                    <p className="text-3xl font-black tracking-tighter text-white md:text-4xl">৳{fmt(sum.costing)}</p>
                    {sum.profit > 0 && (
                      <p className="mt-2 text-xs font-bold text-red-600">
                        + ৳{fmt(sum.profit)} profit = <span className="text-sm font-black">৳{fmt(sum.sale)}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {month ? 'Choose a car, a duty and the dollar price' : 'Choose a duty month to begin'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
