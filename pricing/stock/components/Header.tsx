import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  onResetAll?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onResetAll }) => {
  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* mini car badge */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#31859B] to-[#1A505F] text-white flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path d="M3 13.5 4.3 9.2C4.6 8.2 5.5 7.5 6.6 7.5h10.8c1.1 0 2 0.7 2.3 1.7L21 13.5v4c0 .6-.4 1-1 1h-1c-.6 0-1-.4-1-1V17H6v.5c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1v-4Z" fill="currentColor" opacity="0.95"/>
              <circle cx="7" cy="17" r="1.6" fill="#0d171d"/>
              <circle cx="17" cy="17" r="1.6" fill="#0d171d"/>
              <path d="M6.5 13.2 7.4 9.6h9.2l.9 3.6H6.5Z" fill="#dff1f6"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold font-oswald tracking-wide text-neutral-900 leading-tight">
              GARIR DOKAN <span className="text-[#31859B]">STOCK STUDIO</span>
            </h1>
            <p className="text-[11px] text-neutral-500 font-medium -mt-0.5">
              Car stock sheet updater
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onResetAll && (
            <motion.button
              id="header-reset-btn"
              type="button"
              onClick={onResetAll}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              title="Reset application state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </motion.button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#1A505F] bg-[#31859B]/10 rounded-full border border-[#31859B]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#31859B]" />
            Private · in-browser
          </span>
        </div>
      </div>
    </header>
  );
};
