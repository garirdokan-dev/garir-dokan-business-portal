import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, FileSpreadsheet } from 'lucide-react';

interface FileDropzoneProps {
  id: string;
  label: string;
  expectedFilename: string;
  description: string;
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onLoadSample?: () => void;
  disabled?: boolean;
  /** step number shown on the card's corner badge */
  step?: number;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  id,
  label,
  expectedFilename,
  description,
  file,
  onFileSelect,
  onFileRemove,
  onLoadSample,
  disabled = false,
  step,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.name.endsWith('.xlsx') ||
        droppedFile.name.endsWith('.xls') ||
        droppedFile.type.includes('spreadsheet') ||
        droppedFile.type.includes('excel')
      ) {
        onFileSelect(droppedFile);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };


  return (
    <div className="gd-drop-wrap">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {!file ? (
        <motion.div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label} — drop an Excel file or press Enter to browse`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); }
          }}
          animate={{ y: isDragOver ? -2 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={`gd-drop${isDragOver ? ' is-drag' : ''}${disabled ? ' is-disabled' : ''}`}
        >
          {step !== undefined && <span className="gd-step">{step}</span>}
          <h3>{label}</h3>
          <p>{description}</p>
          <p className="gd-hint">Drag &amp; drop your Excel file here, or click to browse · .xlsx</p>
          {onLoadSample && (
            <button
              type="button"
              className="gd-sample"
              onClick={(e) => {
                e.stopPropagation();
                onLoadSample();
              }}
            >
              <Sparkles className="w-3 h-3" /> Load sample file
            </button>
          )}
          <div className="gd-files"><span className="gd-none">— {expectedFilename} —</span></div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gd-drop has"
        >
          {step !== undefined && <span className="gd-step">{step}</span>}
          <h3>{label}</h3>
          <p>{description}</p>
          <p className="gd-hint">{formatFileSize(file.size)} · Ready for reconciliation</p>
          <div className="gd-files">
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span title={file.name}>✓ {file.name}</span>
            <button
              type="button"
              className="gd-remove"
              onClick={onFileRemove}
              disabled={disabled}
              title="Remove file"
              aria-label={`Remove ${file.name}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
