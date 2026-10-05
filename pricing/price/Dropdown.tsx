import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
  /** extra text the filter looks at but never shows — e.g. every chassis code behind a car name */
  search?: string;
}

interface DropdownProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** text of the row that clears the current choice */
  clearLabel?: string;
  /** show a type-to-filter box above the list (for long lists like car names) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * An optional second step inside the same panel: choosing an option opens its own list —
   * a car's duty amounts, for instance — instead of closing. Used by the home-page calculator.
   */
  step2?: {
    options: (parent: string) => DropdownOption[];
    value?: string;
    onSelect: (parent: string, child: string) => void;
    heading?: (parent: string) => string;
  };
}

/**
 * Same behaviour as the garage picker in the Delivery Challan editor: a panel that opens
 * under the field with a "Clear Selection" row on top, then the choices.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  id, label, placeholder, value, options, onChange, disabled = false, clearLabel = 'Clear Selection',
  searchable = false, searchPlaceholder = 'নাম লিখে খুঁজুন…', step2,
}) => {
  const [open, setOpen] = useState(false);
  // The panel is positioned against the viewport so it is never clipped by the sheet it sits in.
  const [rect, setRect] = useState<
    { left: number; width: number; maxH: number; top?: number; bottom?: number } | null>(null);
  const [query, setQuery] = useState('');
  // the option we drilled into, when a second step is configured
  const [stepParent, setStepParent] = useState<string | null>(null);
  // The panel renders at the desk's root: inside a card any ancestor that creates a containing
  // block (a blur or a transform) would trap a fixed panel and throw it off-screen.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost((boxRef.current?.closest('.gd-app') as HTMLElement) || document.body); }, []);
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Every typed word must appear somewhere in the option. Two haystacks are used so both
  // "corolla cross" (the name) and "nke165" (a chassis code inside "6AA-NKE165G") match.
  const compact = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    const words = q.split(/\s+/).filter(Boolean);
    return options.filter(o => {
      const raw = `${o.label} ${o.hint || ''} ${o.search || ''}`.toLowerCase();
      const flat = compact(raw);
      return words.every(w => raw.includes(w) || flat.includes(compact(w)));
    });
  }, [options, query, searchable]);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 6, margin = 12;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    // open upward when the list would not fit under the field, so it is never cut off
    const up = below < 240 && above > below;
    setRect({
      left: r.left,
      width: r.width,
      maxH: Math.max(170, Math.min(360, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
    });
  };
  const selected = options.find(o => o.value === value) || null;

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const insidePanel = !!(t instanceof Element && t.closest('.gd-dd-panel'));
      if (boxRef.current && !boxRef.current.contains(t) && !insidePanel) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const reposition = () => place();
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setQuery('');
    if (step2 && v) { setStepParent(v); return; }   // stay open and show that option's own list
    setOpen(false);
    setStepParent(null);
  };

  const chooseChild = (childValue: string) => {
    if (stepParent) step2?.onSelect(stepParent, childValue);
    setOpen(false);
    setStepParent(null);
  };

  return (
    <div className="gd-dd" ref={boxRef}>
      <span className="gd-dd-label" id={`${id}-label`}>{label}</span>
      <button
        type="button"
        id={id}
        className={`gd-dd-trigger${open ? ' is-open' : ''}${selected ? ' has-value' : ''}`}
        ref={triggerRef}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            place();
            setQuery('');
            setStepParent(null);
            setTimeout(() => searchRef.current?.focus(), 60);
          }
          setOpen(o => !o);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
      >
        <span className="gd-dd-text">{selected ? selected.label : placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }} className="gd-dd-chev">
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      {host && createPortal(
        <AnimatePresence>

        {open && (
          <motion.div
            className="gd-dd-panel"
            style={rect ? {
              left: rect.left, width: rect.width, maxHeight: rect.maxH,
              ...(rect.top !== undefined ? { top: rect.top } : { bottom: rect.bottom }),
            } : undefined}
            role="listbox"
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {stepParent && step2 ? (
              <button type="button" className="gd-dd-back" onClick={() => setStepParent(null)}>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{step2.heading ? step2.heading(stepParent) : stepParent}</span>
              </button>
            ) : (
              <button type="button" className="gd-dd-clear" onClick={() => choose('')}>{clearLabel}</button>
            )}
            {searchable && !stepParent && (
              <div className="gd-dd-search">
                <Search className="w-3.5 h-3.5" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && shown.length) { e.preventDefault(); choose(shown[0].value); } }}
                />
              </div>
            )}
            <div className="gd-dd-list" style={rect ? { maxHeight: rect.maxH - (searchable && !stepParent ? 96 : 52) } : undefined}>
              {stepParent && step2 ? (
                step2.options(stepParent).length === 0
                  ? <div className="gd-dd-empty">কিছু নেই</div>
                  : step2.options(stepParent).map((o, i) => (
                      <motion.button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={o.value === step2.value}
                        className={`gd-dd-item gd-dd-duty${o.value === step2.value ? ' is-on' : ''}`}
                        onClick={() => chooseChild(o.value)}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.02, duration: 0.14 }}
                      >
                        <span>{o.label}</span>
                        {o.hint && <strong>{o.hint}</strong>}
                      </motion.button>
                    ))
              ) : (
                <>
                  {shown.length === 0 && <div className="gd-dd-empty">{query ? 'কিছু মিলল না' : 'কিছু নেই'}</div>}
                  {shown.map((o, i) => (
                    <motion.button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={o.value === value}
                      className={`gd-dd-item${o.value === value ? ' is-on' : ''}`}
                      onClick={() => choose(o.value)}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.018, duration: 0.14 }}
                    >
                      <span>{o.label}</span>
                      {o.hint && <small>{o.hint}</small>}
                    </motion.button>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>,
        host,
      )}
    </div>
  );
};
