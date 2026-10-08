import React from 'react';
import { FileClock, X } from 'lucide-react';
import { BusinessDocument } from '../types.ts';

/**
 * Auto-save for the document editors.
 *
 * While an editor is open its form is copied to this browser about once a second. The copy is
 * cleared when the document is saved (as a draft or final). If the page is closed, the browser
 * crashes, or the tab is reloaded before that, the copy is still here the next time the site
 * opens, and this banner offers to put it back in the editor.
 *
 * The copy never enters Records by itself — that would fill the list with half-written forms.
 */

export const AUTOSAVE_KEY = 'gd_autosave_v1';

export interface AutosaveEntry {
  doc: Partial<BusinessDocument>;
  savedAt: number;
}

export const readAutosave = (): AutosaveEntry | null => {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.doc && typeof v.savedAt === 'number' ? v : null;
  } catch {
    return null;
  }
};

export const writeAutosave = (doc: Partial<BusinessDocument>) => {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc, savedAt: Date.now() }));
  } catch { /* storage full — auto-save is a convenience, never block editing */ }
};

export const clearAutosave = () => {
  try { window.localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
};

const clock = (t: number) =>
  new Date(t).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

interface Props {
  entry: AutosaveEntry;
  onResume: () => void;
  onDismiss: () => void;
}

export const ResumeDraftBanner: React.FC<Props> = ({ entry, onResume, onDismiss }) => {
  const label = entry.doc.docNumber || entry.doc.clientName || 'a document';
  return (
    <div className="fixed bottom-6 left-1/2 z-[125] -translate-x-1/2 px-4 print:hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className="force-dark flex min-w-[300px] max-w-[94vw] items-center gap-4 rounded-2xl border border-amber-500/30 px-5 py-4 shadow-2xl"
        style={{ background: '#111113' }}
        role="status"
        aria-live="polite"
      >
        <FileClock className="h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-white">Unsaved work found</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {label} · last edited {clock(entry.savedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onResume}
          className="shrink-0 rounded-xl bg-red-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-800 active:scale-95"
        >
          Resume
        </button>
        <button type="button" onClick={onDismiss} aria-label="Discard the unsaved work" title="Discard"
          className="shrink-0 text-gray-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
