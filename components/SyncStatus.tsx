import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { subscribeSync, flushPending, type SyncStatus as SyncState } from '../utils/sync.ts';

const timeAgo = (t: number | null): string => {
  if (!t) return 'not yet';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

interface Props {
  /** compact = icon only, for the top bar; full = icon + words, for the mobile menu */
  variant?: 'compact' | 'full';
}

/**
 * Tells the operator, at a glance, whether their work has reached the cloud.
 * Grey = everything is in sync, amber = saved on this device and waiting, red = no connection.
 */
export const SyncStatus: React.FC<Props> = ({ variant = 'compact' }) => {
  const [status, setStatus] = useState<SyncState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSync(setStatus), []);
  useEffect(() => {
    const t = window.setInterval(() => setStatus(s => (s ? { ...s } : s)), 30000); // refresh "x min ago"
    return () => window.clearInterval(t);
  }, []);

  // Nothing to say when everything reached the cloud — the badge only exists to warn.
  if (!status || !status.cloud) return null;
  if (status.online && status.pending === 0) return null;

  const state: 'offline' | 'pending' = !status.online ? 'offline' : 'pending';
  const look = {
    offline: { cls: 'text-red-500 border-red-500/30 bg-red-500/10', Icon: CloudOff, label: 'Offline' },
    pending: { cls: 'text-amber-500 border-amber-500/30 bg-amber-500/10', Icon: AlertTriangle, label: `${status.pending} waiting` },
  }[state];
  const Icon = look.Icon;

  const title = state === 'offline'
    ? 'No connection. Your work is saved on this device and will be sent when you are back online.'
    : `${status.pending} change${status.pending > 1 ? 's' : ''} saved on this device only — click to try again.${
        status.lastError ? ` Last error: ${status.lastError}` : ''} Last sync ${timeAgo(status.lastSyncedAt)}.`;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try { await flushPending(); } finally { setBusy(false); }
  };

  return (
    <button
      type="button"
      onClick={retry}
      title={title}
      aria-label={title}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all hover:brightness-125 ${look.cls}`}
    >
      {busy
        ? <RefreshCw className="w-4 h-4 animate-spin" />
        : <Icon className="w-4 h-4" />}
      <span className={`font-black uppercase tracking-widest ${variant === 'full' ? 'text-[11px]' : 'text-[10px]'}`}>
        {look.label}
      </span>
    </button>
  );
};

/**
 * The same warning, floating above whatever is on screen. Used when the navigation bar is
 * covered — inside the document editor, the preview or the settings panel — so the operator is
 * never left thinking a save reached the cloud when it did not.
 */
export const SyncFloatingBadge: React.FC = () => (
  <div className="fixed top-4 right-4 z-[120] print:hidden no-print animate-in fade-in slide-in-from-top-2 duration-300">
    <div className="rounded-xl bg-black/70 backdrop-blur-md shadow-2xl">
      <SyncStatus variant="full" />
    </div>
  </div>
);

/**
 * A banner for the editor: appears only when the last save could not reach the cloud.
 */
export const SaveWarning: React.FC = () => {
  const [status, setStatus] = useState<SyncState | null>(null);
  useEffect(() => subscribeSync(setStatus), []);
  if (!status || !status.cloud || status.pending === 0) return null;

  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 print:hidden">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
          Saved on this device only
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {status.online
            ? 'The cloud copy failed. It will be retried automatically — your work is safe in this browser meanwhile.'
            : 'You are offline. Your work is safe in this browser and will be sent as soon as the connection returns.'}
          {status.lastError ? ` (${status.lastError})` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => { void flushPending(); }}
        className="ml-auto shrink-0 rounded-lg border border-amber-500/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-500/10"
      >
        <span className="inline-flex items-center gap-1.5"><Cloud className="h-3 w-3" /> Retry</span>
      </button>
    </div>
  );
};
