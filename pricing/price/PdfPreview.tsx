import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';

interface PdfPreviewProps {
  title: string;
  blob: Blob | null;
  onClose: () => void;
}

/**
 * Shows the duty sheet in the browser's built-in PDF viewer, so the operator gets real text
 * search (Ctrl + F), zoom and print instead of a picture of the page.
 */
export const PdfPreview: React.FC<PdfPreviewProps> = ({ title, blob, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const u = URL.createObjectURL(pdf);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="gd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div
        className="gd-pdf-modal"
        initial={{ scale: 0.97, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="gd-sheet-head">
          <span className="gd-tag">Preview</span>
          <h2>{title}</h2>
          <span className="gd-head-bn">Ctrl + F দিয়ে খুঁজুন</span>
          {url && (
            <a className="gd-btn-ghost" href={url} target="_blank" rel="noreferrer" style={{ marginLeft: 12 }}>
              <ExternalLink className="w-3.5 h-3.5" /> নতুন ট্যাবে
            </a>
          )}
          <button type="button" className="gd-remove" style={{ marginLeft: 10 }} onClick={onClose} title="বন্ধ করুন">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="gd-pdf-body">
          {url ? (
            <iframe className="gd-pdf-frame" src={`${url}#view=FitH`} title={title} />
          ) : (
            <p className="gd-empty">এই duty sheet টা দেখানো যাচ্ছে না। আবার আপলোড করলে preview পাওয়া যাবে।</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
