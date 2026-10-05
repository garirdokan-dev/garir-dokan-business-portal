import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningsBannerProps {
  warnings: string[];
}

export const WarningsBanner: React.FC<WarningsBannerProps> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="gd-warn" role="status">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
        <div className="flex-1 min-w-0">
          <b>Reconciliation warnings ({warnings.length})</b>
          <ul>
            {warnings.map((warn, i) => (
              <li key={i}><span>{warn}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
