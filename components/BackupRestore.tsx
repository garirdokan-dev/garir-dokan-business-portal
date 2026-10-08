import React, { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { BusinessDocument, Asset } from '../types.ts';
import {
  loadDocuments, addOrUpdateDocument, getCachedDocuments,
  loadAssets, saveAsset,
  loadFooterSettings, saveFooterSettings,
  loadAllHeaderSettings, saveAllHeaderSettings,
  loadHeroSettings, saveHeroSettings,
} from '../utils/storage.ts';

const BACKUP_VERSION = 1;

interface BackupFile {
  app: 'garir-dokan-doc-manager';
  version: number;
  exportedAt: string;
  documents: BusinessDocument[];
  assets: Asset[];
  settings: {
    footer?: unknown;
    headers?: unknown;
    hero?: unknown;
  };
}

const download = (name: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const stamp = () => new Date().toISOString().slice(0, 10);

/** Documents as a spreadsheet-friendly table — handy for records, not for restoring. */
const toCsv = (docs: BusinessDocument[]): string => {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Type', 'Doc number', 'Date', 'Client', 'Phone', 'Address', 'Items', 'Total', 'Created', 'Status']];
  for (const d of docs) {
    const items = Array.isArray((d as any).items) ? (d as any).items : [];
    const total = items.reduce(
      (sum: number, i: any) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    rows.push([
      d.type, d.docNumber, d.date, d.clientName, (d as any).clientPhone || '', d.clientAddress || '',
      String(items.length), String(total), d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : '',
      d.status === 'draft' ? 'Draft' : 'Final',
    ].map(esc));
  }
  return rows.map(r => r.join(',')).join('\n');
};

export const BackupRestore: React.FC = () => {
  const [busy, setBusy] = useState<'export' | 'csv' | 'import' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportAll = async () => {
    setBusy('export'); setMessage(null);
    try {
      const [documents, assets, footer, headers, hero] = await Promise.all([
        loadDocuments(), loadAssets(), loadFooterSettings(), loadAllHeaderSettings(), loadHeroSettings(),
      ]);
      const backup: BackupFile = {
        app: 'garir-dokan-doc-manager',
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        documents, assets,
        settings: { footer, headers, hero },
      };
      download(`garir-dokan-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
      setMessage({ tone: 'ok', text: `Backed up ${documents.length} documents and ${assets.length} assets.` });
    } catch (e) {
      setMessage({ tone: 'error', text: `Backup failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv'); setMessage(null);
    try {
      const documents = await loadDocuments();
      download(`garir-dokan-documents-${stamp()}.csv`, toCsv(documents), 'text/csv;charset=utf-8');
      setMessage({ tone: 'ok', text: `Exported ${documents.length} documents as a spreadsheet.` });
    } catch (e) {
      setMessage({ tone: 'error', text: `Export failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (file: File) => {
    setBusy('import'); setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      if (parsed?.app !== 'garir-dokan-doc-manager' || !Array.isArray(parsed.documents)) {
        throw new Error('this file is not a Garir Dokan backup');
      }
      // the local copy is the truth for this count and never depends on the connection
      const known = new Set(getCachedDocuments().map(d => d.id));
      const incoming = parsed.documents.filter(d => d && d.id);
      const fresh = incoming.filter(d => !known.has(d.id)).length;

      const proceed = window.confirm(
        `Restore from ${new Date(parsed.exportedAt).toLocaleString()}?\n\n` +
        `${incoming.length} documents and ${parsed.assets?.length || 0} assets in the file.\n` +
        `${fresh} are new here; the rest will be overwritten with the backup's version.\n\n` +
        `Nothing that only exists here is deleted.`
      );
      if (!proceed) { setBusy(null); return; }

      for (const doc of incoming) await addOrUpdateDocument(doc);
      for (const asset of (parsed.assets || [])) if (asset && asset.id) await saveAsset(asset);
      if (parsed.settings?.footer) await saveFooterSettings(parsed.settings.footer as any);
      if (parsed.settings?.headers) await saveAllHeaderSettings(parsed.settings.headers as any);
      if (parsed.settings?.hero) await saveHeroSettings(parsed.settings.hero as any);

      setMessage({
        tone: 'ok',
        text: `Restored ${incoming.length} documents (${fresh} new). Reload the page to see everything.`,
      });
    } catch (e) {
      setMessage({ tone: 'error', text: `Restore failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tone = message?.tone === 'ok'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
    : message?.tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
      : 'border-red-500/40 bg-red-500/10 text-red-400';

  return (
    <div className="rounded-3xl border border-white/5 bg-white/5 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-red-600" />
        <h3 className="text-base font-black uppercase tracking-widest md:text-lg">Backup &amp; Restore</h3>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-gray-400">
        A backup holds every document, every asset and all header, footer and banner settings in one
        file. Keep one before big changes — it is the only way back if something is deleted by
        mistake or a browser is cleared.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportAll}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-800 active:scale-95 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {busy === 'export' ? 'Preparing…' : 'Download backup'}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-200 transition-all hover:bg-white/10 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> {busy === 'csv' ? 'Preparing…' : 'Documents as spreadsheet'}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-200 transition-all hover:bg-white/10 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {busy === 'import' ? 'Restoring…' : 'Restore from backup'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void restore(f); }}
        />
      </div>

      {message && (
        <div className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs ${tone}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-400">
        Restoring adds and updates; it never deletes anything that is only on this device.
      </p>
    </div>
  );
};
