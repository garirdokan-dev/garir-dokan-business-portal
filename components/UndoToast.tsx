import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';

/**
 * "Deleted · Undo" for the whole site.
 *
 * A delete still happens immediately — locally and in the cloud — exactly as before, so nothing
 * is left half-done if the page is closed. What this adds is a ten-second window to put the item
 * back: the toast keeps a copy of what was removed, and Undo saves that copy again under the
 * same id, with the same number and dates.
 */

interface UndoRequest {
  message: string;
  undo: () => Promise<void> | void;
}

const UNDO_SECONDS = 10;
const EVENT = 'gd:offer-undo';

/** Call right after a delete succeeds. */
export const offerUndo = (message: string, undo: () => Promise<void> | void) => {
  window.dispatchEvent(new CustomEvent<UndoRequest>(EVENT, { detail: { message, undo } }));
};

export const UndoToast: React.FC = () => {
  const [req, setReq] = useState<UndoRequest | null>(null);
  const [phase, setPhase] = useState<'offer' | 'working' | 'done'>('offer');
  const [key, setKey] = useState(0);          // restarts the countdown bar for each new delete
  const timer = useRef<number | undefined>(undefined);

  const close = () => { window.clearTimeout(timer.current); setReq(null); };

  useEffect(() => {
    const onOffer = (e: Event) => {
      const detail = (e as CustomEvent<UndoRequest>).detail;
      window.clearTimeout(timer.current);
      setReq(detail);
      setPhase('offer');
      setKey(k => k + 1);
      timer.current = window.setTimeout(() => setReq(null), UNDO_SECONDS * 1000);
    };
    window.addEventListener(EVENT, onOffer);
    return () => { window.removeEventListener(EVENT, onOffer); window.clearTimeout(timer.current); };
  }, []);

  if (!req) return null;

  const runUndo = async () => {
    window.clearTimeout(timer.current);
    setPhase('working');
    try {
      await req.undo();
      setPhase('done');
      timer.current = window.setTimeout(() => setReq(null), 2200);
    } catch {
      setPhase('offer');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 px-4 print:hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className="force-dark relative flex min-w-[300px] max-w-[92vw] items-center gap-4 overflow-hidden rounded-2xl border border-white/10 px-5 py-4 shadow-2xl"
        style={{ background: '#111113' }}
        role="status"
        aria-live="polite"
      >
        {phase === 'done' ? (
          <>
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-white">Restored</span>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest text-white">
              {req.message}
            </span>
            <button
              type="button"
              onClick={runUndo}
              disabled={phase === 'working'}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-800 active:scale-95 disabled:opacity-60"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${phase === 'working' ? 'animate-spin' : ''}`} />
              {phase === 'working' ? 'Restoring…' : 'Undo'}
            </button>
            <button type="button" onClick={close} aria-label="Dismiss" className="shrink-0 text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </>
        )}
        {phase === 'offer' && (
          <span
            key={key}
            className="absolute bottom-0 left-0 h-[3px] bg-red-700"
            style={{ animation: `gd-undo-countdown ${UNDO_SECONDS}s linear forwards` }}
          />
        )}
      </div>
      <style>{`@keyframes gd-undo-countdown { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
};
