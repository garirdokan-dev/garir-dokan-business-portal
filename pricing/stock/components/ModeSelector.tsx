import React from 'react';
import { motion } from 'motion/react';
import type { Mode } from '../types';
import { CheckCircle2, FileText, KeyRound } from 'lucide-react';

interface ModeSelectorProps {
  selectedMode: Mode;
  onSelectMode: (mode: Mode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {/* BD Stock Card */}
      <motion.button
        id="mode-select-bd-btn"
        type="button"
        onClick={() => onSelectMode('BD')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={`relative text-left p-5 rounded-2xl border-2 transition-colors cursor-pointer shadow-sm ${
          selectedMode === 'BD'
            ? 'border-[#31859B] bg-gradient-to-br from-[#31859B]/8 to-teal-50/50 ring-2 ring-[#31859B]/20'
            : 'border-neutral-200 bg-white hover:border-[#31859B]/40 hover:bg-neutral-50/60'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl select-none" role="img" aria-label="Bangladesh Flag">
              🇧🇩
            </span>
            <div>
              <h3 className="text-lg font-bold font-oswald text-neutral-900 tracking-wide">
                BD STOCK
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Local stock reconciliation · 24 Columns (A–X)
              </p>
            </div>
          </div>
          {selectedMode === 'BD' && (
            <CheckCircle2 className="w-5 h-5 text-[#31859B] flex-shrink-0" />
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-200/80 flex flex-wrap gap-y-1.5 gap-x-4 text-xs text-neutral-600">
          <div className="flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
            <span>
              Key: <strong className="font-semibold text-neutral-800">CHASSIS NUMBER</strong>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>Target: <span className="font-mono text-neutral-700">BD_Update_Customized_Sheet.xlsx</span></span>
          </div>
        </div>
      </motion.button>

      {/* Japan Stock Card */}
      <motion.button
        id="mode-select-japan-btn"
        type="button"
        onClick={() => onSelectMode('JAPAN')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={`relative text-left p-5 rounded-2xl border-2 transition-colors cursor-pointer shadow-sm ${
          selectedMode === 'JAPAN'
            ? 'border-[#31859B] bg-gradient-to-br from-[#31859B]/8 to-teal-50/50 ring-2 ring-[#31859B]/20'
            : 'border-neutral-200 bg-white hover:border-[#31859B]/40 hover:bg-neutral-50/60'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl select-none" role="img" aria-label="Japan Flag">
              🇯🇵
            </span>
            <div>
              <h3 className="text-lg font-bold font-oswald text-neutral-900 tracking-wide">
                JAPAN STOCK
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Supplier stock reconciliation · 23 Columns (A–W)
              </p>
            </div>
          </div>
          {selectedMode === 'JAPAN' && (
            <CheckCircle2 className="w-5 h-5 text-[#31859B] flex-shrink-0" />
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-200/80 flex flex-wrap gap-y-1.5 gap-x-4 text-xs text-neutral-600">
          <div className="flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-neutral-400" />
            <span>
              Key: <strong className="font-semibold text-neutral-800">SL NO</strong> (integer coerced)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>Target: <span className="font-mono text-neutral-700">Japan_Customized_Sheet.xlsx</span></span>
          </div>
        </div>
      </motion.button>
    </div>
  );
};
